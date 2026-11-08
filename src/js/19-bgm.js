/* ================= キャラごとのBGM（音楽ファイル・URL・YouTube） ================= */
const AudioDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('charasheet-kobo', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('bgm');
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => { const t = db.transaction('bgm', mode); const out = fn(t.objectStore('bgm')); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); });
  },
  put(id, blob) { return this.tx('readwrite', st => st.put(blob, id)); },
  get(id) { return this.tx('readonly', st => st.get(id)); },
  del(id) { return this.tx('readwrite', st => st.delete(id)); },
};
function parseYouTube(u) {
  let url; try { url = new URL(u); } catch (e) { return null; }
  const h = url.hostname.replace(/^www\.|^m\.|^music\./, '');
  let id = null;
  if (h === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
    id = url.searchParams.get('v');
    const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
    if (!id && m) id = m[1];
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  const t = url.searchParams.get('t') || url.searchParams.get('start') || '';
  let start = 0;
  if (/^\d+$/.test(t)) start = +t;
  else { const mm = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/); if (mm) start = (+mm[1] || 0) * 3600 + (+mm[2] || 0) * 60 + (+mm[3] || 0); }
  return { id, start };
}
const bgmAudio = new Audio();
bgmAudio.preload = 'auto';
let bgmFor = null, bgmUrl = null, bgmFade = 0, bgmMode = null, bgmCur = 0, bgmPlaying = false;
let ytApi = null, ytReady = null, ytPlayer = null;
const bgmVol = c => Math.max(0, Math.min(1, (c?.bgm?.volume ?? 60) / 100));
const masterVol = () => state.bgmMuted ? 0 : VOL.master / 100 * VOL.bgm / 100;   // 全体×BGM の音量（27-intro.js の VOL）
function applyVol() {
  const v = Math.max(0, Math.min(1, bgmCur * masterVol()));
  if (bgmMode === 'audio') bgmAudio.volume = v;
  else if (bgmMode === 'yt' && ytPlayer && ytPlayer.setVolume) ytPlayer.setVolume(Math.round(v * 100));
}
function fadeTo(target, ms) {
  const my = ++bgmFade;
  return new Promise(res => {
    const start = bgmCur, t0 = performance.now();
    const step = t => {
      if (my !== bgmFade) return res();
      const k = Math.min(1, (t - t0) / ms);
      bgmCur = start + (target - start) * k; applyVol();
      k < 1 ? requestAnimationFrame(step) : res();
    };
    requestAnimationFrame(step);
  });
}
function setNowVol(c) { if (bgmFor === c.id) { bgmFade++; bgmCur = bgmVol(c); applyVol(); } }
function loadYTApi() {
  if (ytApi) return ytApi;
  ytApi = new Promise((res, rej) => {
    if (window.YT && window.YT.Player) { res(window.YT); return; }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { if (prev) prev(); res(window.YT); };
    const sc = document.createElement('script');
    sc.src = 'https://www.youtube.com/iframe_api';
    sc.onerror = () => rej(new Error('yt-load'));
    document.head.appendChild(sc);
    setTimeout(() => { if (!(window.YT && window.YT.Player)) rej(new Error('yt-timeout')); }, 12000);
  });
  ytApi.catch(() => { ytApi = null; });
  return ytApi;
}
function ensureYT() {
  if (ytReady) return ytReady;
  ytReady = loadYTApi().then(YT => new Promise(res => {
    $('yt-wrap').hidden = false;
    ytPlayer = new YT.Player('yt-frame', {
      width: 240, height: 200,
      playerVars: { autoplay: 1, playsinline: 1, rel: 0, controls: 1, disablekb: 1 },
      events: {
        onReady: () => res(ytPlayer),
        onStateChange: e => {
          const c = state.chars.find(x => x.id === bgmFor);
          if (e.data === 0) { ytPlayer.seekTo(c?.bgm?.start || 0, true); ytPlayer.playVideo(); return; }
          if (bgmMode === 'yt') bgmPlaying = e.data === 1 || e.data === 3;
          if (e.data === 1 && c?.bgm?.src === 'yt') {
            const vd = ytPlayer.getVideoData ? ytPlayer.getVideoData() : null;
            if (vd && vd.title && vd.video_id === c.bgm.vid && c.bgm.name !== vd.title) {
              c.bgm.name = vd.title; save();
              const nm = $('bgm-now-name'); if (nm && active().id === c.id) nm.textContent = vd.title;
            }
          }
          renderPlayer();
        },
        onError: () => toast('このYouTube動画は、ほかのサイトでの再生が許可されていないため流せませんでした。別の動画を選んでください。'),
      },
    });
  }));
  ytReady.catch(() => { ytReady = null; });
  return ytReady;
}
async function bgmSource(c) {
  if (!c?.bgm) return null;
  if (c.bgm.src === 'url') return c.bgm.url || null;
  try { const blob = await AudioDB.get(c.id); return blob ? URL.createObjectURL(blob) : null; } catch (e) { return null; }
}
function pauseRaw() {
  if (bgmMode === 'audio') bgmAudio.pause();
  else if (bgmMode === 'yt' && ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
  bgmPlaying = false;
}
async function playCharBgm(c, force) {
  if (!c || !c.bgm) { stopBgm(); return; }
  if (!force && bgmFor === c.id && bgmPlaying) { renderPlayer(); return; }
  titleBgmStop(800);   // はじめの画面の曲は、キャラの BGM と重ならないように消す
  if (bgmPlaying) await fadeTo(0, 300);
  pauseRaw();
  bgmFor = c.id; bgmCur = 0;
  if (c.bgm.src === 'yt') {
    bgmMode = 'yt'; renderPlayer();
    try { await ensureYT(); }
    catch (e) { toast('YouTubeを読み込めませんでした。ネットにつながっているか確認してください。Claude上の公開版ではYouTubeは使えないので、GitHubのURLで開いてください。'); bgmMode = null; renderPlayer(); return; }
    if (bgmFor !== c.id) return;
    applyVol();
    ytPlayer.loadVideoById({ videoId: c.bgm.vid, startSeconds: c.bgm.start || 0 });
    bgmPlaying = true;
    fadeTo(bgmVol(c), 1200);
  } else {
    if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
    bgmMode = 'audio';
    const url = await bgmSource(c);
    if (!url) { toast('BGMの音楽ファイルが見つかりませんでした。もう一度設定してください。'); renderPlayer(); return; }
    if (bgmUrl && bgmUrl.startsWith('blob:')) URL.revokeObjectURL(bgmUrl);
    bgmUrl = url; bgmAudio.src = url; bgmAudio.loop = true; applyVol();
    try { await bgmAudio.play(); bgmPlaying = true; fadeTo(bgmVol(c), 900); }
    catch (e) { if (e && e.name === 'NotSupportedError') toast('このBGMは再生できませんでした。mp3などの音楽ファイルか、音楽ファイルの直接URLを設定してください。'); }
  }
  renderPlayer();
}
function stopBgm() {
  if (!bgmPlaying) { pauseRaw(); renderPlayer(); return; }
  fadeTo(0, 500).then(() => { pauseRaw(); renderPlayer(); });
}
function resumeBgm(c) {
  if (bgmFor !== c.id || !bgmMode) { playCharBgm(c, true); return; }
  if (bgmMode === 'audio') bgmAudio.play().then(() => { bgmPlaying = true; fadeTo(bgmVol(c), 600); renderPlayer(); }).catch(() => playCharBgm(c, true));
  else if (ytPlayer && ytPlayer.playVideo) { ytPlayer.playVideo(); bgmPlaying = true; fadeTo(bgmVol(c), 600); renderPlayer(); }
}
const ICON_PLAY = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4.2v11.6c0 .6.7 1 1.2.6l9-5.8c.5-.3.5-1 0-1.3l-9-5.8C6.7 3.2 6 3.6 6 4.2z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="5" y="4" width="3.4" height="12" rx="1"/><rect x="11.6" y="4" width="3.4" height="12" rx="1"/></svg>';
const ICON_SPK = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z"/><path class="w" d="M13.5 7a4 4 0 0 1 0 6M15.6 5a7 7 0 0 1 0 10"/></svg>';
const ICON_MUTE = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z"/><path class="w" d="M13.5 7.5l5 5M18.5 7.5l-5 5"/></svg>';
function renderPlayer() {
  const c = active(), el = $('bgm');
  const show = !!(c && c.bgm) && $('select').hidden;
  el.hidden = !show;
  $('yt-wrap').hidden = !(show && bgmMode === 'yt' && bgmFor === c.id && c.bgm.src === 'yt');
  el.classList.toggle('has-yt', !$('yt-wrap').hidden);
  if (!show) return;
  const playing = bgmPlaying && bgmFor === c.id;
  el.classList.toggle('playing', playing);
  $('bgm-title').textContent = c.bgm.name || 'BGM';
  $('bgm-src').textContent = c.bgm.src === 'yt' ? 'YouTube' : c.bgm.src === 'url' ? 'URL' : 'ファイル';
  $('bgm-play').setAttribute('aria-label', playing ? '一時停止' : '再生');
  $('bgm-play').innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
  $('bgm-mute').innerHTML = state.bgmMuted ? ICON_MUTE : ICON_SPK;
  $('bgm-mute').setAttribute('aria-label', state.bgmMuted ? 'ミュートを解除' : 'ミュート');
  $('bgm-mute').classList.toggle('on', !!state.bgmMuted);
  $('bgm-vol').value = c.bgm.volume ?? 60;
  $('bgm-vol-v').textContent = c.bgm.volume ?? 60;
}
$('bgm-play').addEventListener('click', () => {
  const c = active(); if (!c?.bgm) return;
  if (bgmPlaying && bgmFor === c.id) stopBgm(); else resumeBgm(c);
});
$('bgm-mute').addEventListener('click', () => { state.bgmMuted = !state.bgmMuted; save(); applyVol(); renderPlayer(); });
$('bgm-vol').addEventListener('input', e => {
  const c = active(); if (!c?.bgm) return;
  c.bgm.volume = +e.target.value; save(); setNowVol(c);
  $('bgm-vol-v').textContent = c.bgm.volume;
  const f = $('f-bgm-vol'); if (f) { f.value = c.bgm.volume; $('f-bgm-vol-v').textContent = c.bgm.volume + '%'; }
});
document.addEventListener('input', e => {
  if (e.target.id !== 'f-bgm-vol') return;
  const c = active(); if (!c?.bgm) return;
  c.bgm.volume = +e.target.value; save(); setNowVol(c);
  $('f-bgm-vol-v').textContent = c.bgm.volume + '%';
  renderPlayer();
});
bgmAudio.addEventListener('play', () => { if (bgmMode === 'audio') { bgmPlaying = true; renderPlayer(); } });
bgmAudio.addEventListener('pause', () => { if (bgmMode === 'audio') { bgmPlaying = false; renderPlayer(); } });
document.addEventListener('change', async e => {
  if (e.target.id !== 'f-bgm-file') return;
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|aac|ogg|oga|wav|flac|opus|webm)$/i.test(f.name)) { toast('音楽ファイル（mp3・m4a・ogg・wav など）を選んでください。'); return; }
  if (f.size > 40 * 1024 * 1024) { toast('ファイルが大きすぎます。40MBまでの音楽ファイルを選んでください。'); return; }
  const c = active();
  try { await AudioDB.put(c.id, f); }
  catch (err) { toast('BGMを保存できませんでした。ブラウザの保存容量がいっぱいかもしれません。'); return; }
  c.bgm = { src: 'idb', name: f.name.replace(/\.[^.]+$/, ''), volume: c.bgm?.volume ?? 60 };
  touch(); renderSheet();
  toast(`BGM「${c.bgm.name}」を設定しました。`);
  playCharBgm(c, true);
});
