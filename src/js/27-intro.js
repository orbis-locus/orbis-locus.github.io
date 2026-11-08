/* ================= 音量（全体・BGM・効果音・はじめの画面の曲） =================
   端末ごとの設定なので localStorage の charasheet-kobo.vol に入れる（はじめの画面は、保存データの読み込みより先に出るため）。
   値は 0〜100。テーマ・背景の小窓の「音量」で変える */
const VOL_KEY = 'charasheet-kobo.vol2';   // vol2：はじめの画面の曲をはじめから小さめ（40%）にしたので、前の charasheet-kobo.vol の曲の値は使わない
let VOL = (() => {
  let v = null, old = {};
  try { v = JSON.parse(localStorage.getItem(VOL_KEY) || 'null'); old = JSON.parse(localStorage.getItem('charasheet-kobo.vol') || '{}') || {}; } catch (e) { v = null; }
  v = v || { master: old.master, bgm: old.bgm, sfx: old.sfx };
  return { master: v.master ?? 100, bgm: v.bgm ?? 100, sfx: v.sfx ?? 100, title: v.title ?? 40 };
})();
function volSet(k, val) {
  VOL = Object.assign({}, VOL, { [k]: Math.max(0, Math.min(100, Math.round(val))) });
  try { localStorage.setItem(VOL_KEY, JSON.stringify(VOL)); } catch (e) { /* */ }
  if (SFX.bus) SFX.bus.gain.value = VOL.master / 100 * VOL.sfx / 100;   // 効果音（09-book.js）
  if (typeof applyVol === 'function') applyVol();                       // キャラの BGM（19-bgm.js）
  titleBgmVol();                                                          // はじめの画面の曲
}

/* ================= はじめの画面の曲（ORBiS 版のとき） =================
   ブラウザは、画面を一度も押していないうちは音を出させてくれない。そのため、まず流してみて、だめなら最初に押したときに流す。
   曲ははじめの画面だけ。「ORBiS をひらく」を押したら、ふわーんという音（32-sfx.js の introSwell）といっしょに消す。
   はじめの画面の右上のボタンで止められる（localStorage の charasheet-kobo.titleBgm に覚える） */
const TITLE_BGM = 'assets/brand/title-bgm.mp3';
const TB = { a: null, k: 0, fade: 0, on: (() => { try { return localStorage.getItem('charasheet-kobo.titleBgm') !== 'off'; } catch (e) { return true; } })(), done: false };
/* 大きさ：iPhone・iPad は audio の volume を変えられないので、押したあとは Web Audio の音量つまみ（TB.g）を通して変える */
function titleBgmVol() {
  if (!TB.a) return;
  const v = Math.max(0, Math.min(1, TB.k * VOL.master / 100 * VOL.title / 100));
  if (TB.g) { TB.g.gain.value = v; TB.a.volume = 1; } else TB.a.volume = v;
}
function titleBgmRoute() {   // 押したとき（音を出してよいとき）に、Web Audio につなぐ
  if (TB.g || !TB.a) return;
  try {
    const ctx = actx(); if (!ctx) return;
    const src = ctx.createMediaElementSource(TB.a); TB.g = ctx.createGain();
    src.connect(TB.g); TB.g.connect(ctx.destination); titleBgmVol();
  } catch (e) { TB.g = null; }
}
function titleBgmFade(to, ms, then) {
  const my = ++TB.fade, from = TB.k, t0 = performance.now();
  const step = t => { if (my !== TB.fade) return; const p = Math.min(1, (t - t0) / ms); TB.k = from + (to - from) * p; titleBgmVol(); if (p < 1) requestAnimationFrame(step); else if (then) then(); };
  requestAnimationFrame(step);
}
function titleBgmPlay(gesture) {
  if (!TB.a || !TB.on || TB.done) return;
  if (gesture) titleBgmRoute();
  TB.a.play().then(() => { if (TB.done) { TB.a.pause(); return; } titleBgmFade(1, 2500); titleBgmBtn(); }).catch(() => { /* まだ押していない：押したときにもう一度 */ });
}
function titleBgmStop(ms = 1600) {
  if (!TB.a || TB.done) return;
  TB.done = true;
  const halt = () => { try { TB.a.pause(); } catch (e) { /* */ } };
  titleBgmFade(0, ms, halt);
  setTimeout(() => { TB.fade++; TB.k = 0; titleBgmVol(); halt(); }, ms + 250);   // 動きが止まっていても、時間が来たら必ず止める
}
function titleBgmBtn() {
  const b = $('obi-music'); if (!b) return;
  const playing = TB.a && !TB.a.paused && TB.on;
  b.setAttribute('aria-pressed', String(!!playing));
  b.setAttribute('aria-label', playing ? '音楽を止める' : '音楽を流す');
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17.5V6.2l10-2.2v11.3"/><circle cx="6.6" cy="17.6" r="2.4"/><circle cx="16.6" cy="15.4" r="2.4"/>${playing ? '' : '<path d="M3.5 3.5l17 17"/>'}</svg><span>${playing ? '音楽 オン' : (TB.on ? '押すと音楽が流れます' : '音楽 オフ')}</span>`;
  b.classList.toggle('hint', !playing && TB.on);
}

/* ================= オープニング ================= */
(function intro() {
  // 前に使っていたテーマの見た目を、保存データの読み込みを待たずに先に当てる（最初の画面がそのテーマで出るように）
  try { const lk = localStorage.getItem('charasheet-kobo.look'); if (lk != null && !document.documentElement.dataset.look) document.documentElement.dataset.look = lk; } catch (e) { /* */ }
  const el = $('intro'); if (!el) return;
  // 共有リンクから開いたときは、オープニングを飛ばしてすぐにキャラシを見せる
  if (/[?&]share=[0-9a-f]{32}/.test(location.search)) { el.remove(); return; }
  document.documentElement.style.overflow = 'hidden';
  // はじめの画面は2種類：ORBiS（星空と光。ふつうはこちら）と、魔法陣（前からの画面）。テーマ・背景の小窓で切りかえ（localStorage に覚える）
  let style = 'orbis';
  try { style = localStorage.getItem('charasheet-kobo.intro') || 'orbis'; } catch (e) { /* */ }
  const orbis = style !== 'classic';
  if (orbis) {
    const mark = 'assets/brand/mark.webp', logo = 'assets/brand/logo-dark.webp';
    const star = (cx, cy, r) => `<path class="obi-sp" d="M${cx} ${cy - r}Q${cx + r * .16} ${cy - r * .16} ${cx + r} ${cy}Q${cx + r * .16} ${cy + r * .16} ${cx} ${cy + r}Q${cx - r * .16} ${cy + r * .16} ${cx - r} ${cy}Q${cx - r * .16} ${cy - r * .16} ${cx} ${cy - r}Z"/>`;
    el.classList.add('ob-intro');
    el.innerHTML = `<i class="obi-sky" aria-hidden="true"></i><i class="obi-cloud c1" aria-hidden="true"></i><i class="obi-cloud c2" aria-hidden="true"></i>
      <canvas class="intro-dust" id="intro-dust" aria-hidden="true"></canvas>
      <svg class="intro-circle obi-orbits" id="intro-circle" viewBox="0 0 600 600" aria-hidden="true">
        <g class="obi-ring r1"><ellipse cx="300" cy="300" rx="292" ry="104"/></g><g class="obi-ring r2"><ellipse cx="300" cy="300" rx="232" ry="78"/></g><g class="obi-ring r3"><ellipse cx="300" cy="300" rx="270" ry="150"/></g>
        <path id="obi-path" d="M8 300a292 104 0 1 0 584 0a292 104 0 1 0 -584 0" fill="none"/>
        <circle r="5" class="obi-sat"><animateMotion dur="9s" repeatCount="indefinite" rotate="0"><mpath href="#obi-path"/></animateMotion></circle>
        ${star(84, 160, 14)}${star(520, 120, 10)}${star(470, 470, 16)}${star(130, 450, 8)}${star(300, 40, 9)}
      </svg>
      <div class="intro-body obi-body">
        <img class="obi-mark" src="${mark}" alt="" draggable="false">
        <img class="obi-logo" src="${logo}" alt="ORBiS" draggable="false">
        <p class="obi-tag">Where Stories Intersect.</p>
        <h2 class="obi-title" id="intro-title">物語が交わる、星の記録帳へ。</h2>
        <button class="intro-btn obi-btn" id="intro-enter" type="button"><span>ORBiS をひらく</span></button>
        <p class="obi-foot">CALL OF CTHULHU ・ CHARACTER SHEET ・ for CCFOLIA</p>
      </div>
      <button class="obi-music" id="obi-music" type="button"></button>`;
    // 曲を用意して、流してみる（だめなら、最初に押したときに流す）
    TB.a = new Audio(TITLE_BGM); TB.a.loop = true; TB.a.preload = 'auto'; TB.k = 0; titleBgmVol();
    titleBgmBtn(); titleBgmPlay();
    const firstTouch = e => {
      if (e.target.closest && e.target.closest('#obi-music')) return;
      document.removeEventListener('pointerdown', firstTouch, true); document.removeEventListener('keydown', firstTouch, true);
      titleBgmPlay(true);
    };
    document.addEventListener('pointerdown', firstTouch, true); document.addEventListener('keydown', firstTouch, true);
    $('obi-music').addEventListener('click', e => {
      e.stopPropagation();
      const playing = TB.a && !TB.a.paused && TB.on;
      TB.on = !playing;
      try { localStorage.setItem('charasheet-kobo.titleBgm', TB.on ? 'on' : 'off'); } catch (er) { /* */ }
      if (TB.on) titleBgmPlay(true); else titleBgmFade(0, 500, () => { TB.a.pause(); titleBgmBtn(); });
      titleBgmBtn();
    });
  } else {
    // 魔法陣：七芒星・六角形・ルーン
    const pt = (r, deg) => [300 + r * Math.cos(deg * Math.PI / 180), 300 + r * Math.sin(deg * Math.PI / 180)];
    $('intro-star').setAttribute('points', Array.from({ length: 7 }, (_, i) => pt(232, -90 + (i * 3 % 7) * 360 / 7).map(v => v.toFixed(1)).join(',')).join(' '));
    $('intro-hex').setAttribute('points', Array.from({ length: 6 }, (_, i) => pt(122, -90 + i * 60).map(v => v.toFixed(1)).join(',')).join(' '));
    const runes = 'ᚠᚢᚦᚨᚱᚲᚷ';
    $('intro-runes').innerHTML = [...runes].map((ch, i) => { const [x, y] = pt(205, -90 + (i + .5) * 360 / 7); return `<text class="rune" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${ch}</text>`; }).join('');
  }

  // 火の粉
  const cv = $('intro-dust'), ctx = cv.getContext('2d');
  let W = 0, H = 0, raf = 0, parts = [];
  const resize = () => { const dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
  const spawn = init => ({ x: Math.random() * W, y: init ? Math.random() * H : H + 10, r: .6 + Math.random() * 1.8, v: .15 + Math.random() * .55, drift: (Math.random() - .5) * .3, ph: Math.random() * 6.28, gold: Math.random() < .55 });
  resize(); addEventListener('resize', resize);
  parts = Array.from({ length: Math.round(Math.min(90, W * H / 14000)) }, () => spawn(true));
  const tick = t => {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.y -= p.v; p.x += p.drift + Math.sin(t / 1400 + p.ph) * .15;
      if (p.y < -10) Object.assign(p, spawn(false));
      const a = .35 + .45 * Math.sin(t / 500 + p.ph) ** 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283);
      ctx.fillStyle = orbis ? (p.gold ? `rgba(255,255,255,${a})` : `rgba(170,160,255,${a * .8})`) : p.gold ? `rgba(226,186,110,${a})` : `rgba(120,215,225,${a * .8})`;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 8; ctx.fill();
    }
    raf = requestAnimationFrame(tick);
  };
  if (!reduceMotion.matches) raf = requestAnimationFrame(tick);

  let entered = false;
  const finish = () => {
    cancelAnimationFrame(raf); removeEventListener('resize', resize); document.removeEventListener('keydown', onKey, true);
    el.remove(); document.documentElement.style.overflow = $('select').hidden ? '' : 'hidden';
  };
  function enter() {
    if (entered) return; entered = true;
    if (orbis) { titleBgmStop(1500); try { introSwell(); } catch (e) { /* */ } }   // 曲は、ふわーんという音とともに消える
    const app = document.querySelector('.app');
    if (reduceMotion.matches) { finish(); return; }
    const b = $('intro-enter').getBoundingClientRect();
    const cx = b.left + b.width / 2, cy = b.top + b.height / 2;
    const reach = Math.hypot(Math.max(cx, innerWidth - cx), Math.max(cy, innerHeight - cy)) * 2 / 40 * 1.25;
    const flash = document.createElement('div');
    flash.className = 'intro-flash'; flash.style.left = cx + 'px'; flash.style.top = cy + 'px';
    el.appendChild(flash);
    const ease = 'cubic-bezier(.55, 0, .2, 1)';
    el.querySelector('.intro-body').animate([{ opacity: 1, filter: 'blur(0)' }, { opacity: 0, transform: 'scale(1.06)', filter: 'blur(8px)' }], { duration: 500, easing: 'ease-in', fill: 'forwards' });
    $('intro-circle').animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 1.7 }], { duration: 1100, easing: ease, fill: 'forwards' });
    flash.animate([{ transform: 'scale(0)', opacity: .95 }, { transform: 'scale(1.4)', opacity: 1, offset: .12 }, { transform: `scale(${reach})`, opacity: 1 }], { duration: 1100, easing: ease, fill: 'forwards' })
      .finished.then(() => {
        el.style.background = 'transparent';
        el.style.pointerEvents = 'none';
        el.querySelectorAll('canvas, .intro-fog, svg, .intro-body').forEach(n => { n.style.display = 'none'; });
        popSelect();
        return flash.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, easing: 'ease-out', fill: 'forwards' }).finished;
      })
      .then(finish);
  }
  $('intro-enter').addEventListener('click', enter);
  const onKey = e => { if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { e.preventDefault(); e.stopImmediatePropagation(); enter(); } };
  document.addEventListener('keydown', onKey, true);
  setTimeout(() => $('intro-enter')?.focus({ preventScroll: true }), 50);
})();

/* ---- はじめの画面の切りかえ（テーマ・背景の小窓） ---- */
function renderIntroPick() {
  let cur = 'orbis'; try { cur = localStorage.getItem('charasheet-kobo.intro') || 'orbis'; } catch (e) { /* */ }
  document.querySelectorAll('[data-intro]').forEach(b => { const on = b.dataset.intro === cur; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
}
$('intro-pick')?.addEventListener('click', e => {
  const b = e.target.closest('[data-intro]'); if (!b) return;
  try { localStorage.setItem('charasheet-kobo.intro', b.dataset.intro); } catch (er) { /* */ }
  renderIntroPick();
  toast(b.dataset.intro === 'classic' ? '次に開いたときから、はじめの画面は「魔法陣」になります。' : '次に開いたときから、はじめの画面は「ORBiS」になります。');
});
$('btn-theme').addEventListener('click', renderIntroPick);

/* ---- 音量のつまみ（テーマ・背景の小窓） ---- */
function renderVolRows() {
  document.querySelectorAll('[data-vol]').forEach(el => { el.value = VOL[el.dataset.vol]; });
  document.querySelectorAll('[data-volv]').forEach(el => { el.textContent = VOL[el.dataset.volv] + '%'; });
}
$('vol-rows')?.addEventListener('input', e => {
  const k = e.target.dataset.vol; if (!k) return;
  volSet(k, +e.target.value);
  const v = document.querySelector(`[data-volv="${k}"]`); if (v) v.textContent = VOL[k] + '%';
});
let volPrevT = 0;
$('vol-rows')?.addEventListener('change', e => {   // つまみをはなしたら、効果音の大きさを聞かせる
  const k = e.target.dataset.vol; if ((k === 'sfx' || k === 'master') && performance.now() - volPrevT > 200) { volPrevT = performance.now(); if (typeof snd === 'function') snd('switch'); }
});
$('btn-theme').addEventListener('click', renderVolRows);
