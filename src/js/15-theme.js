/* ================= カラー設定 ================= */
const THEME_DEFAULT = { bg: '#dfe6ef', solid: '#f3f6fa', ink: '#10233a', sky: '#1f6fe0', cyan: '#12a6cf', amber: '#f6a623' };
const THEME_ROWS = [
  ['bg', '背景', 'ページ全体の地の色'], ['solid', 'パネル', 'シートやウィンドウの色'], ['ink', '文字', '本文の色'],
  ['sky', 'メインカラー', 'ボタン・見出し'], ['cyan', 'サブカラー', 'グラデーション・光'], ['amber', '選択中の色', 'メニューで選んだ項目'],
];
const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbToHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v) || 0)).toString(16).padStart(2, '0')).join('');
/* テーマは ORBiS（メイン・初めて開いた人はこれ）・近未来・和風・魔導書・アクアリウム・ドット（深淵・古書・ネオン・森は 2026-11-05 に削除） */
const THEME_PRESETS = {
  orbis:  { name: 'ORBiS', sub: '星めぐる空と、光のガラス（メイン）', look: 'orbis', vals: { bg: '#dfe5fb', solid: '#f5f6ff', ink: '#2b3670', sky: '#5d82f0', cyan: '#9b87f5', amber: '#7c9cf6' } },
  sky:    { name: '近未来', sub: '白と空色', look: '', vals: {} },
  sakura: { name: '和風', sub: '和紙と墨と金、舞う桜', look: 'mincho wa', vals: { bg: '#ebdfc6', solid: '#f7efdd', ink: '#2e2520', sky: '#5a3c2c', cyan: '#b08d4a', amber: '#b08d4a' } },
  book:   { name: '魔導書', sub: '古本に万年筆で書きこむ記録', look: 'dark mincho book', vals: { bg: '#140c07', solid: '#22160d', ink: '#efe0c4', sky: '#7a5a8c', cyan: '#c9a04e', amber: '#c9a04e' } },
  aqua:   { name: 'アクアリウム', sub: '水底の遺跡と光、くらげ', look: 'dark aqua', vals: { bg: '#04173c', solid: '#0b2c5c', ink: '#e8f7ff', sky: '#7fd6ff', cyan: '#b4f1ff', amber: '#9fe8ff' } },
  dot:    { name: 'ドット', sub: '星降る夜のピクセル', look: 'dark dot', vals: { bg: '#0b0e30', solid: '#141a4c', ink: '#e8eeff', sky: '#86a8ff', cyan: '#a8d8ff', amber: '#ffd36b' } },
};
const presetOf = () => THEME_PRESETS[state.themePreset] || THEME_PRESETS.orbis;   // 選んでいない人（初めての人）は ORBiS
const themeVals = () => ({ ...THEME_DEFAULT, ...presetOf().vals, ...(state.theme || {}) });
function renderPresets() {
  const cur = state.themePreset && THEME_PRESETS[state.themePreset] ? state.themePreset : 'orbis';
  $('theme-presets').innerHTML = Object.entries(THEME_PRESETS).map(([k, t]) => {
    const v = { ...THEME_DEFAULT, ...t.vals };
    return `<button type="button" class="tp ${k === cur ? 'on' : ''}" data-preset-theme="${k}" aria-pressed="${k === cur}">
      <span class="tp-sw" style="background:${v.bg}"><i style="background:${v.solid};border-color:${v.sky}"><b style="background:linear-gradient(100deg, ${v.sky}, ${v.cyan})"></b><em style="background:${v.amber}"></em><u style="background:${v.ink}"></u></i></span>
      <span class="tp-n">${t.name}</span><span class="tp-s">${t.sub}</span>
    </button>`;
  }).join('');
}

function applyTheme() {
  const t = themeVals();
  Object.entries(t).forEach(([k, v]) => document.documentElement.style.setProperty('--' + k, v));
  document.documentElement.dataset.look = presetOf().look;
  try { localStorage.setItem('charasheet-kobo.look', presetOf().look); } catch (e) { /* */ }
  applyBg();
  waScene();
  dotScene();
  aquaScene();
  orbisScene();
}
function applyBg() {
  const ac = state.chars && state.chars.find(c => c.id === state.activeId);
  const sheetImg = (ac && ac.bgImage) || state.bgImage || '';
  const selImg = state.selBgImage || state.bgImage || '';
  const L = $('bg-layer'), R = document.documentElement.style;
  L.classList.toggle('on', !!sheetImg);
  document.documentElement.classList.toggle('has-bg', !!sheetImg);
  document.documentElement.classList.toggle('sel-has-bg', !!selImg);
  L.style.backgroundImage = sheetImg ? `url("${imgSrc(sheetImg)}")` : '';
  L.style.setProperty('--veil', (state.bgVeil ?? 15) / 100);
  L.style.setProperty('--bgblur', (state.bgBlur ?? 0) + 'px');
  R.setProperty('--veil', (state.bgVeil ?? 15) / 100); R.setProperty('--bgblur', (state.bgBlur ?? 0) + 'px');
  R.setProperty('--sel-img', selImg ? `url("${imgSrc(selImg)}")` : 'none');
  R.setProperty('--glass-a', (100 - (state.bgGlass ?? 75)) + '%');
}
let bgSlot = 'all';
const bgGet = slot => slot === 'sel' ? state.selBgImage : slot === 'char' ? (active() || {}).bgImage : state.bgImage;
function bgSet(slot, v) {
  if (slot === 'sel') state.selBgImage = v;
  else if (slot === 'char') { const c = active(); if (!c) return; c.bgImage = v; c.updatedAt = Date.now(); }
  else state.bgImage = v;
}
function renderBgControls() {
  const ac = active();
  document.querySelectorAll('[data-bgslot]').forEach(b => { const on = b.dataset.bgslot === bgSlot; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  const cn = $('bgslot-char-name'); if (cn) cn.textContent = (ac && ac.profile.name) || '名無し';
  const img = bgGet(bgSlot);
  $('bg-thumb').style.backgroundImage = img ? `url("${imgSrc(img)}")` : '';
  $('bg-thumb').textContent = img ? '' : (bgSlot === 'all' ? '未設定' : '共通の画像を使用');
  $('bg-remove').hidden = !img;
  $('bg-slot-hint').textContent = { all: '「探索者をえらぶ画面」と各キャラで画像を設定していないときに使われます。', sel: '探索者をえらぶ画面（フレンド一覧も）だけの背景です。未設定なら共通の画像を使います。', char: `「${(ac && ac.profile.name) || '名無し'}」のシートを開いているときだけの背景です。キャラを切り替えると、そのキャラの背景に変わります。` }[bgSlot];
  $('bg-veil').value = state.bgVeil ?? 15; $('bg-veil-v').textContent = (state.bgVeil ?? 15) + '%';
  $('bg-blur').value = state.bgBlur ?? 0; $('bg-blur-v').textContent = (state.bgBlur ?? 0) + 'px';
  $('bg-glass').value = state.bgGlass ?? 75; $('bg-glass-v').textContent = (state.bgGlass ?? 75) + '%';
}
function renderThemeRows() {
  const t = themeVals();
  $('theme-rows').innerHTML = THEME_ROWS.map(([k, name, desc]) => {
    const rgb = hexToRgb(t[k]);
    return `<div class="trow" data-tk="${k}">
      <input type="color" id="tc-${k}" value="${t[k]}" aria-label="${name}の色">
      <div class="tname"><b>${name}</b><span>${desc}</span><code data-hex>${t[k].toUpperCase()}</code></div>
      <div class="tch">${['r', 'g', 'b'].map((ch, i) => `
        <label class="${ch}">${ch.toUpperCase()}
          <input type="range" min="0" max="255" value="${rgb[i]}" data-ch="${i}" id="tr-${k}-${ch}" aria-label="${name} ${ch.toUpperCase()}">
          <input type="number" min="0" max="255" value="${rgb[i]}" data-ch="${i}" id="tn-${k}-${ch}" aria-label="${name} ${ch.toUpperCase()} の数値">
        </label>`).join('')}</div>
    </div>`;
  }).join('');
}
$('theme-rows').addEventListener('input', e => {
  const row = e.target.closest('.trow'); if (!row) return;
  const k = row.dataset.tk;
  let rgb = hexToRgb(themeVals()[k]);
  if (e.target.type === 'color') rgb = hexToRgb(e.target.value);
  else if (e.target.dataset.ch != null) rgb[+e.target.dataset.ch] = Math.max(0, Math.min(255, Number(e.target.value) || 0));
  const hex = rgbToHex(rgb);
  state.theme = { ...(state.theme || {}), [k]: hex };
  applyTheme(); save();
  row.querySelector('input[type="color"]').value = hex;
  row.querySelector('[data-hex]').textContent = hex.toUpperCase();
  row.querySelectorAll('[data-ch]').forEach(el => { if (el !== e.target) el.value = rgb[+el.dataset.ch]; });
});
$('btn-theme').addEventListener('click', () => { bgSlot = $('select').hidden ? 'char' : 'sel'; renderPresets(); renderThemeRows(); renderBgControls(); openModal('modal-theme'); });
$('bg-file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    bgSet(bgSlot, await loadImageData(f, bgSlot === 'char' ? 1600 : 1920, bgSlot === 'char' ? .78 : .8));
    applyBg(); renderBgControls(); saveNow(); if (bgSlot === 'char') { scheduleSync(); renderSheet(); }
    toast({ all: '共通の背景画像を設定しました。', sel: '探索者をえらぶ画面の背景画像を設定しました。', char: 'このキャラの背景画像を設定しました。' }[bgSlot]);
  } catch (err) { toast(err.message); }
});
$('bg-remove').addEventListener('click', () => { bgSet(bgSlot, ''); applyBg(); renderBgControls(); save(); if (bgSlot === 'char') renderSheet(); });
$('bg-slots').addEventListener('click', e => { const b = e.target.closest('[data-bgslot]'); if (!b) return; bgSlot = b.dataset.bgslot; renderBgControls(); });
$('theme-presets').addEventListener('click', e => {
  const b = e.target.closest('[data-preset-theme]'); if (!b) return;
  state.themePreset = b.dataset.presetTheme; state.theme = {};
  applyTheme(); save(); renderPresets(); renderThemeRows(); renderSheet();
  fxAt(b, true);
});
$('bg-veil').addEventListener('input', e => { state.bgVeil = +e.target.value; applyTheme(); renderBgControls(); save(); });
$('bg-blur').addEventListener('input', e => { state.bgBlur = +e.target.value; applyTheme(); renderBgControls(); save(); });
$('bg-glass').addEventListener('input', e => { state.bgGlass = +e.target.value; applyTheme(); renderBgControls(); save(); });
$('theme-reset').addEventListener('click', e => {
  if (!arm(e.currentTarget, 'もう一度押すと戻します')) return;
  state.theme = {}; applyTheme(); save(); renderThemeRows();
  fxAt(e.currentTarget, true);
});

/* ================= 和風テーマ：和紙の背景・景色・金の霞・青海波・舞い散る桜 ================= */
const WA = { on: false, raf: 0, petals: [], sprites: null, last: 0, w: 0, h: 0, dpr: 1 };
function waScene() {
  const on = (presetOf().look || '').split(' ').includes('wa');
  let el = $('wa-bg');
  if (on && !el) {
    el = document.createElement('div'); el.id = 'wa-bg'; el.className = 'wa-bg'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<i class="wa-sun"></i><div class="wa-scene"><i class="wa-branch"></i></div><i class="wa-cloud c1"></i><i class="wa-cloud c2"></i><i class="wa-cloud c3"></i><i class="wa-wave wl"></i><i class="wa-wave wr"></i><i class="wa-wave wg"></i><canvas class="wa-petals" id="wa-petals"></canvas>';
    document.body.prepend(el);
  }
  if (el) el.hidden = !on;
  if (on === WA.on) return;
  WA.on = on;
  if (on) waPetalsStart(); else cancelAnimationFrame(WA.raf);
}
/* 花びらの絵を3色ぶん先に描いておく（毎回描くより軽い） */
function waSprites() {
  const mk = (c1, c2) => {
    const cv = document.createElement('canvas'), w = 28, h = 32; cv.width = w; cv.height = h;
    const g = cv.getContext('2d'); g.translate(w / 2, h / 2);
    const gr = g.createRadialGradient(0, 8, 1, 0, 0, 16); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr; g.beginPath();
    g.moveTo(0, 15); g.bezierCurveTo(13, 7, 13, -10, 4.5, -15); g.lineTo(0, -10.5); g.lineTo(-4.5, -15); g.bezierCurveTo(-13, -10, -13, 7, 0, 15);
    g.fill(); g.strokeStyle = 'rgba(190,110,130,.35)'; g.lineWidth = .8; g.stroke();
    return cv;
  };
  return [mk('#fff6f7', '#f2b8c6'), mk('#fde9ee', '#e89aae'), mk('#fffaf6', '#f6cdd3')];
}
function waPetalsStart() {
  const cv = $('wa-petals'); if (!cv) return;
  const g = cv.getContext('2d');
  WA.sprites = WA.sprites || waSprites();
  const size = () => { WA.dpr = Math.min(2, devicePixelRatio || 1); WA.w = innerWidth; WA.h = innerHeight; cv.width = WA.w * WA.dpr; cv.height = WA.h * WA.dpr; };
  size(); if (!WA.sized) { WA.sized = true; addEventListener('resize', size); }
  const n = reduceMotion.matches ? 0 : innerWidth < 760 ? 14 : 30;
  const make = (fresh) => ({ x: Math.random() * WA.w * 1.2 - WA.w * .1, y: fresh ? Math.random() * WA.h : -30 - Math.random() * 200, s: .45 + Math.random() * .65,
    vy: .35 + Math.random() * .55, vx: -.15 - Math.random() * .35, sw: 18 + Math.random() * 40, sp: .0006 + Math.random() * .0012, ph: Math.random() * 6.3,
    r: Math.random() * 6.3, vr: (Math.random() - .5) * .03, fl: Math.random() * 6.3, vf: .02 + Math.random() * .04, k: Math.floor(Math.random() * 3) });
  WA.petals = Array.from({ length: n }, () => make(true));
  cancelAnimationFrame(WA.raf);
  const tick = t => {
    if (!WA.on) return;
    WA.raf = requestAnimationFrame(tick);
    if (document.hidden) return;
    const dt = Math.min(50, t - (WA.last || t)) / 16.7; WA.last = t;
    const wind = Math.sin(t * .00025) * .45 + Math.sin(t * .0011) * .15;
    g.setTransform(WA.dpr, 0, 0, WA.dpr, 0, 0); g.clearRect(0, 0, WA.w, WA.h);
    WA.petals.forEach((p, i) => {
      p.y += p.vy * dt * p.s * 1.4; p.x += (p.vx + wind) * dt + Math.cos(t * p.sp + p.ph) * .35 * dt;
      p.r += p.vr * dt; p.fl += p.vf * dt;
      if (p.y > WA.h + 30 || p.x < -60 || p.x > WA.w + 60) WA.petals[i] = make(false);
      const x = p.x + Math.sin(t * p.sp + p.ph) * p.sw;
      g.save(); g.translate(x, p.y); g.rotate(p.r); g.scale(p.s * Math.max(.15, Math.abs(Math.cos(p.fl))), p.s);
      g.globalAlpha = .85; g.drawImage(WA.sprites[p.k], -14, -16); g.restore();
    });
  };
  if (n) WA.raf = requestAnimationFrame(tick); else g.clearRect(0, 0, cv.width, cv.height);
}

/* ================= ドットテーマ：星空と夜の街をドット絵で描く（低い解像度で描いて拡大） ================= */
const DOT = { on: false, raf: 0, last: 0, base: null, stars: [], shoot: null, W: 0, H: 180, t0: 0 };
const isDot = () => (presetOf().look || '').split(' ').includes('dot');
function dotScene() {
  const on = isDot();
  let el = $('dot-bg');
  if (on && !el) {
    el = document.createElement('div'); el.id = 'dot-bg'; el.className = 'dot-bg'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<canvas id="dot-cv"></canvas>';
    document.body.prepend(el);
    addEventListener('resize', () => { if (DOT.on) dotBuild(); });
  }
  if (el) el.hidden = !on;
  if (on === DOT.on) return;
  DOT.on = on;
  if (on) { dotBuild(); cancelAnimationFrame(DOT.raf); DOT.raf = requestAnimationFrame(dotTick); } else cancelAnimationFrame(DOT.raf);
}
/* 決まった並びの乱数（毎回同じ街並みになるように） */
const dotRand = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
function dotBuild() {
  const H = DOT.H, W = DOT.W = Math.max(240, Math.min(560, Math.round(H * innerWidth / innerHeight)));
  const cv = $('dot-cv'); cv.width = W; cv.height = H;
  const b = document.createElement('canvas'); b.width = W; b.height = H; const g = b.getContext('2d');
  const R = dotRand(20261104), px = (x, y, c) => { g.fillStyle = c; g.fillRect(x | 0, y | 0, 1, 1); };
  // 空：色の帯を市松模様でまぜる（ドット絵のグラデーション）
  const sky = ['#070a24', '#0a0e33', '#0e1342', '#121852', '#171e63', '#1d2575', '#262d86', '#30358f'];
  const horizon = 118, band = horizon / sky.length;
  for (let y = 0; y < horizon; y++) {
    const f = y / band, i = Math.min(sky.length - 1, Math.floor(f)), j = Math.min(sky.length - 1, i + 1), mix = f - i;
    for (let x = 0; x < W; x++) px(x, y, (mix > .5 && (x + y) % 2) || (mix > .8) ? sky[j] : sky[i]);
  }
  // 月（右上）と光の輪
  const mx = W - 34, my = 24, mr = 11;
  for (let y = -mr - 6; y <= mr + 6; y++) for (let x = -mr - 6; x <= mr + 6; x++) {
    const d = Math.hypot(x, y);
    if (d <= mr) px(mx + x, my + y, (x + y > 6 && d > mr - 4) ? '#c9d2f2' : '#eef1ff');
    else if (d <= mr + 3 && (x + y) % 2 === 0) px(mx + x, my + y, '#4a56a8');
    else if (d <= mr + 6 && (x * 3 + y) % 4 === 0) px(mx + x, my + y, '#2f3891');
  }
  [[-4, -3, 2], [3, 2, 3], [-2, 5, 1], [5, -5, 1]].forEach(([x, y, r]) => { for (let a = -r; a <= r; a++) for (let c = -r; c <= r; c++) if (a * a + c * c <= r * r) px(mx + x + a, my + y + c, '#cfd6f3'); });
  // 雲（紫のかたまり）
  const cloud = (cx, cy, w) => { for (let k = 0; k < w; k++) { const h = 2 + Math.round(Math.sin(k / w * Math.PI) * (3 + R() * 2)); for (let y = 0; y < h; y++) px(cx + k, cy - y, y === h - 1 ? '#5b4fb4' : '#3e3a96'); } };
  cloud(W * .05, 34, 46); cloud(W * .22, 22, 30); cloud(W * .55, 62, 54); cloud(W * .8, 74, 40);
  // 遠くの街
  const city = (y0, hMin, hMax, col, winP, seed) => {
    const r = dotRand(seed); let x = 0;
    while (x < W) {
      const w = 6 + Math.floor(r() * 16), h = hMin + Math.floor(r() * (hMax - hMin));
      g.fillStyle = col; g.fillRect(x, y0 - h, w, h);
      for (let wy = y0 - h + 2; wy < y0 - 1; wy += 3) for (let wx = x + 1; wx < x + w - 1; wx += 2) if (r() < winP) px(wx, wy, r() < .7 ? '#ffd36b' : '#9fd4ff');
      x += w + (r() < .3 ? 1 : 0);
    }
  };
  city(horizon + 6, 10, 30, '#1b2068', .1, 7);
  city(horizon + 12, 14, 46, '#12164c', .22, 11);
  // 電波塔（右）
  const tx = Math.round(W * .86), ty = horizon + 12;
  for (let y = 0; y < 86; y++) { const w = Math.max(1, Math.round((86 - y) / 9)); g.fillStyle = y % 7 === 0 ? '#3b4aa6' : '#1a2066'; g.fillRect(tx - w, ty - y, w * 2 + 1, 1); }
  g.fillStyle = '#9fb6ff'; g.fillRect(tx - 3, ty - 44, 7, 3); g.fillRect(tx - 2, ty - 66, 5, 2);
  // 水面：街を上下さかさに映して、横の線で切る
  const wy0 = horizon + 12;
  g.fillStyle = '#0a0d33'; g.fillRect(0, wy0, W, H - wy0);
  for (let y = 0; y < H - wy0; y++) if (y % 3 !== 2) g.drawImage(b, 0, wy0 - 1 - y, W, 1, (y % 6 < 3 ? 1 : -1), wy0 + y, W, 1);
  g.fillStyle = 'rgba(10,13,51,.45)'; g.fillRect(0, wy0, W, H - wy0);
  // 手前の手すりと紫陽花（左下）
  g.fillStyle = '#0c0f3a'; g.fillRect(0, H - 34, Math.round(W * .32), 2);
  for (let x = 2; x < W * .32; x += 9) g.fillRect(x, H - 34, 2, 34);
  for (let k = 0; k < 70; k++) { const x = R() * W * .26, y = H - 4 - R() * 22, c = R(); g.fillStyle = c < .35 ? '#7d6ae0' : c < .7 ? '#5e72e6' : '#a993ff'; g.fillRect(x | 0, y | 0, 2, 2); }
  for (let k = 0; k < 40; k++) px(R() * W * .26, H - 2 - R() * 26, '#2b3a7a');
  DOT.base = b;
  // またたく星
  const rs = dotRand(99); DOT.stars = Array.from({ length: Math.round(W / 4) }, () => ({ x: Math.floor(rs() * W), y: Math.floor(rs() * (horizon - 30)), p: rs() * 6.3, s: .002 + rs() * .004, big: rs() < .12 }));
}
function dotTick(t) {
  if (!DOT.on) return;
  DOT.raf = requestAnimationFrame(dotTick);
  if (document.hidden || t - DOT.last < 66) return; // 15コマ/秒で十分
  DOT.last = t;
  const cv = $('dot-cv'); if (!cv || !DOT.base) return;
  const g = cv.getContext('2d'), W = DOT.W, H = DOT.H;
  g.drawImage(DOT.base, 0, 0);
  const still = reduceMotion.matches;
  DOT.stars.forEach(s => {
    const v = still ? .7 : (Math.sin(t * s.s + s.p) + 1) / 2;
    if (v < .25) return;
    g.fillStyle = v > .75 ? '#ffffff' : '#9fb3ff'; g.fillRect(s.x, s.y, 1, 1);
    if (s.big && v > .6) { g.fillStyle = 'rgba(200,215,255,.7)'; g.fillRect(s.x - 1, s.y, 3, 1); g.fillRect(s.x, s.y - 1, 1, 3); }
  });
  if (!still) {
    // 流れ星
    if (!DOT.shoot && Math.random() < .012) DOT.shoot = { x: W * (.3 + Math.random() * .6), y: 4 + Math.random() * 30, l: 0 };
    if (DOT.shoot) {
      const s = DOT.shoot; s.l += 1;
      for (let k = 0; k < 14; k++) { const a = Math.max(0, 1 - k / 14) * Math.min(1, (30 - s.l) / 10); g.fillStyle = `rgba(220,230,255,${a})`; g.fillRect(Math.round(s.x - s.l * 3 + k * 2), Math.round(s.y + s.l * 1.2 - k * .8), 1, 1); }
      if (s.l > 30) DOT.shoot = null;
    }
    // 水面のきらめき
    for (let k = 0; k < 18; k++) { const x = (k * 37 + Math.floor(t / 180) * 13) % W, y = 132 + (k * 11) % (H - 134); g.fillStyle = k % 3 ? 'rgba(160,190,255,.5)' : 'rgba(255,211,107,.45)'; g.fillRect(x, y, 2 + (k % 3), 1); }
  }
}
/* ドットの画面切りかえ：四角いブロックが埋まって、また消える */
function dotMosaic(mid) {
  if (reduceMotion.matches) { mid(); return; }
  const cv = document.createElement('canvas'); cv.className = 'dot-mosaic'; cv.setAttribute('aria-hidden', 'true');
  const S = 28, cols = Math.ceil(innerWidth / S), rows = Math.ceil(innerHeight / S);
  cv.width = cols * S; cv.height = rows * S; document.body.appendChild(cv);
  const g = cv.getContext('2d'), cells = [];
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) cells.push([x, y, (x + y) / (cols + rows) * .7 + Math.random() * .3]);
  const draw = (k, fill) => {
    g.clearRect(0, 0, cv.width, cv.height);
    cells.forEach(([x, y, o]) => { if (fill ? o <= k : o > k) { g.fillStyle = '#0b0e30'; g.fillRect(x * S, y * S, S, S); g.fillStyle = '#2a3290'; g.fillRect(x * S, y * S, S, 2); g.fillRect(x * S, y * S, 2, S); } });
  };
  const run = (ms, fill, then) => { const t0 = performance.now(); const step = t => { const k = Math.min(1, (t - t0) / ms); draw(k, fill); if (k < 1) requestAnimationFrame(step); else then(); }; requestAnimationFrame(step); };
  run(360, true, () => { try { mid(); } catch (e) { console.error(e); } setTimeout(() => run(420, false, () => cv.remove()), 90); });
}
/* テーマごとの画面切りかえ（和風は襖、ドットはモザイク、魔導書は表紙が閉じてひらく、アクアリウムは水が満ちて引く） */
const themeSwitchFx = () => {
  const f = isWa() ? waDoors : isDot() ? dotMosaic : isBook() ? bookCover : isAqua() ? aquaWave : isOrbis() ? orbisWarp : null;
  return f && (mid => { if (!isBook()) snd('warp'); f(mid); });   // 切りかえの音（魔導書は本の音が別にある）
};
