/* ================= キャラシをリンクで共有する ================= */
/* 持ち主：ログインしてクラウドに保存されたキャラに「共有リンク」を作る（サーバーの char_shares。supabase/10-share.sql）。
   見る人：リンク（…/?share=合言葉）を開くと、ログインしていなくても読み取り専用で見られる。自分の探索者として取り込むこともできる。
   リンク先はいつも公開サイト（1ファイル版や Claude の公開版から作っても、送った相手が開けるように）。 */
const SHARE_BASE = 'https://orbis-locus.github.io/';   // 2026-11-08 に kanno-925.github.io/charasheet から引っ越し
/* LINE・Discord・X に貼ったとき立ち絵入りのカードを出すための「中継の入口」（Cloudflare Workers。cloudflare/share-worker.js）。
   そのURL（最後の /s/ まで）をここに書く。空にすると公開サイトのリンクにもどる（カードは出ない）。
   前に作った ?share= の形のリンクも、そのまま開ける */
const SHARE_PAGE = 'https://orbis-share.masakawwwww.workers.dev/s/';
const shareUrl = token => SHARE_PAGE ? SHARE_PAGE + token : SHARE_BASE + '?share=' + token;
let shares = null, shareErr = '', shareFor = null, shareBusy = false;   // shares：キャラID → 合言葉（読み込む前は null）

async function loadShares() {
  if (!sb || !me) return;
  const { data, error } = await sb.from('char_shares').select('char_id,token').eq('owner', me.id);
  if (error) {
    shares = {};
    shareErr = /char_shares|relation .* does not exist|Could not find the table/i.test(error.message || '') ? 'サーバーの準備がまだです。Supabase で supabase/10-share.sql を実行してください。' : jaErr(error);
    return;
  }
  shareErr = '';
  shares = {};
  (data || []).forEach(r => { shares[r.char_id] = r.token; });
}
/* 共有リンクを作る前に、そのキャラがクラウドに保存されているか確かめる（まだなら今すぐ送る） */
async function ensureSynced(id) {
  for (let i = 0; i < 40 && !lastSynced.has(id); i++) {
    if (!syncing) { clearTimeout(syncTimer); await flushSync(); }
    else await new Promise(r => setTimeout(r, 250));
    if (syncState === 'error') break;
  }
  return lastSynced.has(id);
}

function openShare(c) {
  if (!c) return;
  if (c.sample) { toast('見本の探索者は共有できません。少し書きかえるか、新しい探索者を作ってから共有してください。'); return; }
  shareFor = c.id;
  $('share-status').textContent = '';
  renderShare();
  openModal('modal-share');
  if (me && shares === null) loadShares().then(() => { renderShare(); if (shares && shares[c.id]) uploadShareCard(c, shares[c.id]); }).catch(() => {});
  else if (me && shares && shares[c.id]) uploadShareCard(c, shares[c.id]);   // 立ち絵や名前が変わっていたら、カードの画像を作り直す
}

/* ---- リンクを貼ったときに出るカードの画像（横1200×縦630の JPEG）。Storage の share-og/合言葉.jpg に置く ---- */
const loadImg = (src, cors) => new Promise((ok, ng) => { const im = new Image(); if (cors) im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = ng; im.src = src; });
const CARD_VER = 2;   // カードの絵柄を変えたら数字を上げる（みんなの画像が作り直される）
const cardSig = c => { const d = compute(c), pic = portraitSrc(c) || c.avatar || ''; return [CARD_VER, c.profile.name, c.profile.kana, c.profile.occupation, c.profile.age, c.profile.sex, c.system, c.profile.color, d.hpMax, d.mpMax, d.san, pic.length, pic.slice(-80)].join('|'); };
async function makeShareCard(c) {
  const W = 1200, H = 630, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d'), d = compute(c), p = c.profile, S = SYS[c.system];
  const font = '"Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic", sans-serif';
  try { await Promise.all(['800 80px "Zen Kaku Gothic New"', '500 30px "Zen Kaku Gothic New"', '600 40px Cinzel'].map(f => document.fonts.load(f))); } catch (e) { /* 文字の形がなくても描ける */ }
  // 背景：深い紺に、キャラの色のぼんやりした光
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0d1030'); bg.addColorStop(1, '#1b2f63');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(270, 330, 20, 270, 330, 420); glow.addColorStop(0, (p.color || '#1f7cf2') + '88'); glow.addColorStop(1, '#0d103000');
  g.fillStyle = glow; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(160, 200, 255, .35)'; g.lineWidth = 2; g.strokeRect(18, 18, W - 36, H - 36);
  // 左：立ち絵（なければアイコン、それもなければ頭文字の丸）
  let pic = null;
  const src = portraitSrc(c);
  if (src) { try { pic = await loadImg(src, !src.startsWith('data:')); } catch (e) { pic = null; } }
  if (pic) {
    const bw = 470, bh = H - 60, k = Math.min(bw / pic.width, bh / pic.height), w = pic.width * k, h = pic.height * k;
    g.drawImage(pic, 40 + (bw - w) / 2, H - 30 - h, w, h);
  } else {
    let av = null;
    const a2 = c.avatar || iconSrc(c);
    if (a2) { try { av = await loadImg(a2, !a2.startsWith('data:')); } catch (e) { av = null; } }
    g.save(); g.beginPath(); g.arc(275, 315, 190, 0, Math.PI * 2); g.closePath();
    g.fillStyle = p.color || '#1f7cf2'; g.fill(); g.clip();
    if (av) { const s = Math.max(380 / av.width, 380 / av.height); g.drawImage(av, 275 - av.width * s / 2, 315 - av.height * s / 2, av.width * s, av.height * s); }
    else { g.fillStyle = '#fff'; g.font = `800 170px ${font}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(initial(c), 275, 322); }
    g.restore();
    g.strokeStyle = 'rgba(255, 255, 255, .7)'; g.lineWidth = 6; g.beginPath(); g.arc(275, 315, 190, 0, Math.PI * 2); g.stroke();
  }
  // 右：名前・プロフィール・HP/MP/SAN
  const X = 560, RW = W - X - 60;
  const fit = (text, weight, size, min) => { let s = size; do { g.font = `${weight} ${s}px ${font}`; s -= 2; } while (g.measureText(text).width > RW && s > min); };
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#7fd8ff'; g.font = `600 26px ${font}`; g.fillText(S.label, X, 110);
  const name = p.name || '名無し';
  g.fillStyle = '#ffffff'; fit(name, 800, 88, 40); g.fillText(name, X, 210);
  let y = 210;
  if (p.kana) { g.fillStyle = 'rgba(220, 230, 255, .8)'; fit(p.kana, 500, 30, 18); g.fillText(p.kana, X, y += 50); }
  const sub = [p.occupation, p.age && p.age + '歳', p.sex].filter(Boolean).join(' ／ ');
  if (sub) { g.fillStyle = '#e8eeff'; fit(sub, 500, 34, 20); g.fillText(sub, X, y += 58); }
  const stats = [['HP', d.hpMax, '#ff7a6b'], ['MP', d.mpMax, '#5cb8ff'], ['SAN', d.san, '#c08cff']];
  stats.forEach(([l, v, col], i) => {
    const bx = X + i * 190, by = 420;
    g.fillStyle = 'rgba(255, 255, 255, .08)'; g.strokeStyle = col; g.lineWidth = 3;
    g.beginPath(); g.roundRect ? g.roundRect(bx, by, 170, 96, 18) : g.rect(bx, by, 170, 96); g.fill(); g.stroke();
    g.fillStyle = col; g.font = `700 24px ${font}`; g.fillText(l, bx + 18, by + 34);
    g.fillStyle = '#ffffff'; g.font = `800 46px ${font}`; g.fillText(String(v), bx + 18, by + 82);
  });
  // 右下：ORBiS のロゴ（暗い地なので白っぽく光るほう。docs/brand.md）
  try { const lg = await loadImg('assets/brand/logo.webp'), lw = 200, lh = lg.height * lw / lg.width; g.globalAlpha = .9; g.drawImage(lg, W - 36 - lw, H - 30 - lh, lw, lh); g.globalAlpha = 1; }
  catch (e) { g.fillStyle = 'rgba(200, 220, 255, .75)'; g.font = `600 30px Cinzel, ${font}`; g.textAlign = 'right'; g.fillText('ORBiS', W - 50, H - 46); }
  let blob = null;
  for (const q of [.86, .75, .62, .5]) { blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', q)); if (blob && blob.size <= 900000) break; }
  return blob;
}
const cardDone = {};   // 合言葉 → 最後に送ったカードの中身の印（同じなら送り直さない）
async function uploadShareCard(c, token) {
  if (!sb || !me || !token) return;
  const sig = cardSig(c), key = 'charasheet-kobo.card.' + token;
  let prev = cardDone[token];
  if (prev == null) { try { prev = localStorage.getItem(key); } catch (e) { prev = null; } }
  if (prev === sig) return;
  try {
    const blob = await makeShareCard(c);
    if (!blob) return;
    const { error } = await sb.storage.from('share-og').upload(token + '.jpg', blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '60' });
    if (error) throw error;
    cardDone[token] = sig;
    try { localStorage.setItem(key, sig); } catch (e) { /* */ }
  } catch (er) { console.warn('共有カードの画像を送れませんでした（supabase/11-share-card.sql を実行しているか確認）', er); }
}
function renderShare() {
  const body = $('share-body'), c = state.chars.find(x => x.id === shareFor);
  if (!c) { body.innerHTML = '<p class="empty">探索者が見つかりません。</p>'; return; }
  const name = esc(c.profile.name || '名無し');
  if (!cloudReady()) { body.innerHTML = '<p class="err">いまは共有を使えません。ネットにつながっているか確かめて、ページを読み込み直してください。</p>'; return; }
  if (!me) {
    body.innerHTML = `<p>「${name}」を共有するには、ログインが必要です（キャラシをサーバーに保存して、そこからリンクで見せるため）。</p>
      <p class="share-note">見る人はログインしなくても大丈夫です。</p>
      <div class="modal-actions"><button class="btn primary" type="button" data-share="login">ログイン・新規登録</button></div>`;
    return;
  }
  if (c.owner && c.owner !== me.id) { body.innerHTML = '<p>この探索者はあなたのものではないので、共有できません。</p>'; return; }
  if (shares === null) { body.innerHTML = '<p class="empty">読み込み中…</p>'; return; }
  if (shareErr) { body.innerHTML = `<p class="err">${esc(shareErr)}</p>`; return; }
  const token = shares[c.id];
  if (!token) {
    body.innerHTML = `<p>「${name}」の<b>共有リンク</b>を作ります。リンクを知っている人は、ログインしていなくてもこのキャラシを見られます（書きかえはできません）。</p>
      <ul class="share-list">
        <li>見た人は、ココフォリア用にコピーしたり、自分の探索者として取り込んだりできます。</li>
        <li>あとでキャラシを書きかえると、リンク先にも反映されます。</li>
        <li>「共有をやめる」を押せば、リンクはすぐに使えなくなります。</li>
        <li>フレンドへの公開・非公開（鍵のボタン）とは別の設定です。</li>
      </ul>
      <div class="modal-actions"><button class="btn primary" type="button" data-share="make" ${shareBusy ? 'disabled' : ''}>${shareBusy ? '作成中…' : '共有リンクを作る'}</button></div>`;
    return;
  }
  const url = shareUrl(token);
  body.innerHTML = `<p>「${name}」の共有リンクです。コピーして、見せたい人に送ってください。</p>
    <div class="share-url"><input class="inp" id="share-url" readonly value="${esc(url)}" aria-label="共有リンク"><button class="btn primary" type="button" data-share="copy">コピー</button></div>
    <p class="share-note">リンクを知っている人は誰でも見られます。キャラシを書きかえると、リンク先にも反映されます。</p>
    <div class="share-row">
      ${navigator.share ? '<button class="btn small" type="button" data-share="send">ほかのアプリで送る</button>' : ''}
      <a class="btn small" href="${esc(url)}" target="_blank" rel="noopener">リンク先を開いて確かめる</a>
      <button class="btn small danger" type="button" data-share="stop" ${shareBusy ? 'disabled' : ''}>共有をやめる</button>
    </div>`;
}
$('share-body').addEventListener('click', async e => {
  const b = e.target.closest('[data-share]'); if (!b) return;
  const c = state.chars.find(x => x.id === shareFor); if (!c) return;
  const act = b.dataset.share;
  if (act === 'login') { closeModals(); openAccount(); return; }
  if (act === 'copy') { copyText($('share-url').value, $('share-status'), $('share-url'), 'コピーしました。見せたい人に送ってください。').then(ok => { if (ok) fxAt(b, true); }); return; }
  if (act === 'send') { navigator.share({ title: `${c.profile.name || '探索者'}のキャラシ（ORBiS）`, url: $('share-url').value }).catch(() => {}); return; }
  if (shareBusy) return;
  $('share-status').classList.remove('warn');
  if (act === 'make') {
    shareBusy = true; renderShare();
    try {
      if (!(await ensureSynced(c.id))) throw new Error(syncMsg || 'キャラシをサーバーに保存できませんでした。少し待ってからもう一度押してください。');
      const { data, error } = await sb.from('char_shares').insert({ char_id: c.id }).select('token').single();
      if (error) {
        if (/duplicate key|23505/i.test(error.message || '')) await loadShares();   // ほかの端末ですでに作っていた
        else throw error;
      } else shares[c.id] = data.token;
      shareErr = '';
      if (shares[c.id]) await uploadShareCard(c, shares[c.id]);
      $('share-status').textContent = 'リンクを作りました。コピーして送ってください。';
    } catch (er) {
      $('share-status').classList.add('warn');
      $('share-status').textContent = /char_shares|relation .* does not exist|Could not find the table/i.test(er.message || '') ? 'サーバーの準備がまだです。Supabase で supabase/10-share.sql を実行してください。' : jaErr(er);
    } finally { shareBusy = false; renderShare(); }
    return;
  }
  if (act === 'stop') {
    if (!arm(b, 'もう一度押すとやめる')) return;
    shareBusy = true; renderShare();
    try {
      const old = shares[c.id];
      if (old) { await sb.storage.from('share-og').remove([old + '.jpg']).catch(() => {}); try { localStorage.removeItem('charasheet-kobo.card.' + old); } catch (e) { /* */ } }
      const { error } = await sb.from('char_shares').delete().eq('char_id', c.id);
      if (error) throw error;
      delete shares[c.id];
      $('share-status').textContent = '共有をやめました。前のリンクはもう開けません。';
    } catch (er) { $('share-status').classList.add('warn'); $('share-status').textContent = jaErr(er); }
    finally { shareBusy = false; renderShare(); }
  }
});

/* ---- 共有リンクを開いた人：読み取り専用で見せる ---- */
const sharedToken = (() => { try { const t = new URLSearchParams(location.search).get('share') || ''; return /^[0-9a-f]{32}$/.test(t) ? t : ''; } catch (e) { return ''; } })();
let sharedOwner = '';
async function openSharedView(token) {
  fviewChars = []; fviewCur = null;
  $('fview-title').textContent = '共有されたキャラシ';
  $('fview-body').innerHTML = '<p class="empty">読み込み中…</p>';
  openModal('modal-fview');
  // 一度見たらアドレスから合言葉を外す（読み込み直すたびに出てこないように）
  try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* */ }
  if (!sbClient()) { $('fview-body').innerHTML = '<p class="err">サーバーにつながりませんでした。ネットの接続を確かめて、リンクを開き直してください。</p>'; return; }
  try {
    const { data, error } = await sb.rpc('get_shared_char', { t: token });
    if (error) throw error;
    const c = data && data.data;
    if (!c || c.v !== 2 || !SYS[c.system] || !c.profile) {
      $('fview-body').innerHTML = '<p class="empty">このリンクのキャラシは見つかりませんでした。共有がやめられたか、探索者が削除されたのかもしれません。送ってくれた人に確かめてください。</p>';
      return;
    }
    sharedOwner = data.owner || '';
    fviewCur = c;
    $('fview-title').innerHTML = `<span class="share-from">${sharedOwner ? esc(sharedOwner) + 'さんが共有' : '共有されたキャラシ'}</span> ${esc(c.profile.name || '名無し')}`;
    $('fview-body').innerHTML = sheetViewHtml(c, true);
    if (data.secret) showSecretBox(data.secret, '持ち主が公開しています');
    $('fview-body').scrollTop = 0;
  } catch (er) { $('fview-body').innerHTML = `<p class="err">${esc(jaErr(er))}</p>`; }
}
/* 共有されたキャラを、自分の探索者として写す（持ち主だけのもの：フレンドの印・BGMファイル・ダイスの回数・鍵は外す） */
function takeShared(btn) {
  const src = fviewCur; if (!src || !canAddChar()) return;
  const c = JSON.parse(JSON.stringify(src));
  c.id = uid(); c.updatedAt = Date.now();
  delete c.sample; delete c.owner; c.locked = false; c.secretOpen = false; delete c.secret;
  if (c.bgm && c.bgm.src === 'idb') delete c.bgm;
  if (c.dice) c.dice.used = 0;
  (c.scenarios || []).forEach(sc => { sc.friends = []; });
  state.chars = [c, ...state.chars.filter(x => !x.sample)]; state.activeId = c.id;
  save(); fxAt(btn, true); closeModals(); renderAll();
  if (!$('select').hidden) leaveSelect(null, true);
  toast(`「${c.profile.name || '名無し'}」をあなたの探索者に取り込みました。自由に書きかえられます（元のキャラシは変わりません）。`);
}
