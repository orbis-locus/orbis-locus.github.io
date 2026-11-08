/* ================= 効果音（テーマごとに、そのテーマらしい音） =================
   音のファイルは使わず、その場で作る（Web Audio）。オン・オフは state.sfx（テーマ・背景の小窓、ORBiS のスピーカー、魔導書の本の中のボタン）。
   BGM を消音しているときも鳴らさない（sfxOn は 09-book.js）。
   鳴らす場面：tap（ボタンなどを押す）・open / close（項目の窓）・switch（窓の中の切りかえ）・warp（画面の切りかえ）・copy（コマをコピー）
   ・ORBiS：ガラスの鈴      ・近未来：電子音の「ピッ」とスイープ   ・和風：拍子木・琴・紙・襖・鈴
   ・魔導書：羽ペンの音と封蝋（ページをめくる音・書く音は 09-book.js）   ・アクアリウム：泡・水の音   ・ドット：昔のゲーム機の音 */
const SND = { out: null, wet: null, lastTap: 0 };
const sndTheme = () => isOrbis() ? 'orbis' : isAqua() ? 'aqua' : isDot() ? 'dot' : isWa() ? 'wa' : isBook() ? 'book' : 'sky';
function sndCtx() {
  if (!sfxOn()) return null;
  const ctx = actx(); if (!ctx) return null;
  if (!SND.out) {
    SND.out = ctx.createGain(); SND.out.gain.value = .55; SND.out.connect(sfxOut(ctx));
    // ひびき（残響）：だんだん小さくなる雑音でひびきの形を作る
    const len = Math.round(ctx.sampleRate * 2.4), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    const rev = ctx.createConvolver(); rev.buffer = ir;
    SND.wet = ctx.createGain(); SND.wet.gain.value = 1;
    SND.wet.connect(rev); rev.connect(SND.out);
  }
  return ctx;
}
/* 音の部品。wet はひびきの量（0〜1）。f2 があれば、その高さへすべらせる。lp は音をこもらせる強さ（Hz） */
function sTone(ctx, at, f, dur, { type = 'sine', vol = .1, attack = .004, wet = .3, f2 = 0, glide = 0, lp = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f, at);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + (glide || dur));
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let node = o;
  if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl); node = fl; }
  node.connect(g); g.connect(SND.out);
  if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(SND.wet); }
  o.start(at); o.stop(at + dur + .05);
}
function sNoise(ctx, at, dur, { f0 = 1000, f1 = 1000, q = 1, vol = .05, attack = .01, type = 'bandpass', wet = .2 } = {}) {
  actx();   // 雑音のもと（SFX.noise）を用意
  const src = ctx.createBufferSource(); src.buffer = SFX.noise;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q;
  fl.frequency.setValueAtTime(f0, at); fl.frequency.exponentialRampToValueAtTime(Math.max(40, f1), at + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + attack); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(fl).connect(g); g.connect(SND.out);
  if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(SND.wet); }
  src.start(at, Math.random() * 1.2, dur + .05);
}
const sPick = arr => arr[Math.floor(Math.random() * arr.length)];

/* ---- ORBiS：ガラスの鈴（ミ・ファ#・ソ#・シ・ド# の並び） ---- */
const OB_NOTE = [659.25, 739.99, 830.61, 987.77, 1108.73, 1318.51, 1479.98, 1661.22, 1975.53, 2217.46];
const obBell = (ctx, at, f, vol = .08, dur = .9) => { sTone(ctx, at, f, dur, { vol, wet: .32 }); sTone(ctx, at, f * 2.01, dur * .5, { vol: vol * .28, wet: .32 }); sTone(ctx, at, f * 3.02, dur * .3, { vol: vol * .1, wet: .32 }); };
const SND_ORBIS = {
  tap: (c, t) => obBell(c, t, sPick(OB_NOTE.slice(5, 9)), .05, .45),
  open: (c, t) => { [0, 2, 3, 5, 7].forEach((n, i) => obBell(c, t + i * .055, OB_NOTE[n], .06 - i * .006, 1.1)); sNoise(c, t, .42, { f0: 900, f1: 5200, q: 1.2, vol: .045, attack: .12 }); },
  close: (c, t) => { [6, 4, 2].forEach((n, i) => obBell(c, t + i * .05, OB_NOTE[n], .045, .7)); sNoise(c, t, .32, { f0: 4200, f1: 900, q: 1.2, vol: .035, attack: .04 }); },
  switch: (c, t) => { obBell(c, t, OB_NOTE[4], .045, .6); obBell(c, t + .07, OB_NOTE[6], .045, .8); },
  copy: (c, t) => { obBell(c, t, OB_NOTE[3], .07, .7); obBell(c, t + .11, OB_NOTE[5], .08, 1.3); obBell(c, t + .11, OB_NOTE[8], .03, 1); },
  warp: (c, t) => {   // 光が集まる「すうっ」→ 星がはじける鈴
    sNoise(c, t, .75, { f0: 300, f1: 6000, q: .9, vol: .07, attack: .55 });
    [0, 3, 5].forEach(n => sTone(c, t, OB_NOTE[n], 1.5, { type: 'triangle', vol: .022, attack: .45, wet: .32 }));
    const b = t + .74; obBell(c, b, OB_NOTE[5], .09, 1.6); obBell(c, b, OB_NOTE[8], .05, 1.4);
    for (let i = 0; i < 7; i++) obBell(c, b + .05 + i * .045 + Math.random() * .02, sPick(OB_NOTE.slice(5)), .03, .5);
  },
};

/* ---- 近未来：すっきりした電子音（短い「ピッ」と、上がる・下がるスイープ） ---- */
const SND_SKY = {
  tap: (c, t) => { sTone(c, t, 2100, .07, { vol: .045, f2: 1650, glide: .04, wet: .1 }); sTone(c, t, 4200, .03, { vol: .012, wet: 0 }); },
  open: (c, t) => { sTone(c, t, 520, .24, { vol: .045, f2: 1560, glide: .2, wet: .15 }); sTone(c, t + .2, 1560, .09, { vol: .04, wet: .15 }); sTone(c, t + .27, 2080, .14, { vol: .035, wet: .2 }); sNoise(c, t, .22, { f0: 2000, f1: 6500, q: .8, vol: .02, attack: .08, type: 'highpass', wet: .1 }); },
  close: (c, t) => { sTone(c, t, 1500, .22, { vol: .04, f2: 480, glide: .2, wet: .12 }); sTone(c, t + .17, 720, .08, { vol: .03, wet: .1 }); },
  switch: (c, t) => { sTone(c, t, 1700, .06, { vol: .04, wet: .1 }); sTone(c, t + .06, 2270, .09, { vol: .04, wet: .15 }); },
  copy: (c, t) => { sTone(c, t, 1320, .1, { vol: .05, wet: .15 }); sTone(c, t + .1, 1980, .25, { vol: .05, wet: .25 }); },
  warp: (c, t) => { sNoise(c, t, .5, { f0: 400, f1: 5000, q: .8, vol: .05, attack: .3, wet: .15 }); sTone(c, t, 300, .5, { type: 'triangle', vol: .03, f2: 1800, glide: .45, attack: .2, wet: .15 }); sTone(c, t + .48, 1760, .3, { vol: .04, wet: .25 }); sTone(c, t + .48, 2640, .25, { vol: .02, wet: .25 }); },
};

/* ---- 和風：拍子木（木を打つ音）・琴・紙のこすれ・襖・鈴 ---- */
const WA_NOTE = [293.66, 311.13, 392, 440, 466.16, 587.33, 622.25, 783.99, 880, 932.33, 1174.66];   // 都節（レ・ミ♭・ソ・ラ・シ♭）
function waKoto(c, at, f, vol = .07, dur = 1.5) {   // 琴：はじいた音（はじめ少し高く、すぐ元の高さへ）
  const o1 = c.createOscillator(), o2 = c.createOscillator(), fl = c.createBiquadFilter(), g = c.createGain();
  o1.type = 'triangle'; o2.type = 'sawtooth';
  [o1, o2].forEach(o => { o.frequency.setValueAtTime(f * 1.015, at); o.frequency.exponentialRampToValueAtTime(f, at + .05); });
  fl.type = 'lowpass'; fl.frequency.setValueAtTime(4200, at); fl.frequency.exponentialRampToValueAtTime(700, at + .35);
  const g2 = c.createGain(); g2.gain.value = .35;
  o1.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(g);
  g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + .003); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  g.connect(SND.out); const w = c.createGain(); w.gain.value = .35; g.connect(w); w.connect(SND.wet);
  o1.start(at); o2.start(at); o1.stop(at + dur + .05); o2.stop(at + dur + .05);
}
const waWood = (c, t, f = 1100, vol = .07) => { sTone(c, t, f, .08, { vol, wet: .25 }); sTone(c, t, f * 1.5, .04, { vol: vol * .3, wet: .2 }); sNoise(c, t, .02, { f0: 3200, f1: 3200, q: 1, vol: .03, attack: .001, type: 'highpass', wet: .1 }); };
const waSuzu = (c, t, vol = .025) => { for (let i = 0; i < 3; i++) { const a = t + i * .05 + Math.random() * .015, f = 2600 + Math.random() * 400; sTone(c, a, f, .35, { vol, wet: .4 }); sTone(c, a, f * 2.76, .18, { vol: vol * .4, wet: .4 }); } };
const SND_WA = {
  tap: (c, t) => waWood(c, t),
  open: (c, t) => { sNoise(c, t, .55, { f0: 2600, f1: 4000, q: .7, vol: .035, attack: .1, wet: .15 }); [2, 3, 5, 6].forEach((n, i) => waKoto(c, t + .05 + i * .09, WA_NOTE[n], .065)); },
  close: (c, t) => { sNoise(c, t, .4, { f0: 4000, f1: 2400, q: .7, vol: .03, attack: .05, wet: .15 }); waKoto(c, t + .05, WA_NOTE[5], .06); waKoto(c, t + .16, WA_NOTE[3], .055); },
  switch: (c, t) => { waKoto(c, t, sPick([WA_NOTE[5], WA_NOTE[6], WA_NOTE[7]]), .06, 1.2); },
  copy: (c, t) => waSuzu(c, t),
  warp: (c, t) => {   // 襖がすっと閉まる「しゃーっ」→「とん」→ 琴がひとつ
    sNoise(c, t, .55, { f0: 900, f1: 450, q: .6, vol: .07, attack: .15, type: 'lowpass', wet: .15 });
    sTone(c, t + .5, 170, .2, { vol: .12, f2: 105, glide: .15, wet: .2 }); waWood(c, t + .5, 620, .05);
    waKoto(c, t + .62, WA_NOTE[2], .06, 1.8); waKoto(c, t + .62, WA_NOTE[5], .03, 1.6);
  },
};

/* ---- 魔導書：羽ペンが紙にふれる音・封蝋を押す音（めくる・書く音は 09-book.js にある） ---- */
const SND_BOOK = {
  tap: (c, t) => { sNoise(c, t, .035, { f0: 3200, f1: 2600, q: 2, vol: .05, attack: .002, wet: .1 }); sTone(c, t, 2400, .02, { vol: .01, wet: 0 }); },
  copy: (c, t) => { sTone(c, t, 130, .28, { vol: .16, f2: 70, glide: .2, wet: .2 }); sNoise(c, t, .12, { f0: 500, f1: 200, q: .7, vol: .06, attack: .002, type: 'lowpass', wet: .15 }); },
};

/* ---- アクアリウム：泡が「ぽこっ」・水がゆれる音 ---- */
const aqBloop = (c, t, f = 380, vol = .07) => sTone(c, t, f, .09, { vol, f2: f * 2.8, glide: .07, lp: 2600, wet: .55 });
const SND_AQUA = {
  tap: (c, t) => aqBloop(c, t, 330 + Math.random() * 160),
  open: (c, t) => { sNoise(c, t, .6, { f0: 400, f1: 1200, q: .5, vol: .05, attack: .25, type: 'lowpass', wet: .4 }); for (let i = 0; i < 5; i++) aqBloop(c, t + i * .055 + Math.random() * .03, 300 + Math.random() * 400, .06); },
  close: (c, t) => { sNoise(c, t, .45, { f0: 1100, f1: 380, q: .5, vol: .04, attack: .05, type: 'lowpass', wet: .4 }); [620, 480, 360].forEach((f, i) => aqBloop(c, t + i * .06, f, .055)); },
  switch: (c, t) => { aqBloop(c, t, 420, .06); aqBloop(c, t + .07, 560, .055); },
  copy: (c, t) => { aqBloop(c, t, 600, .07); sTone(c, t + .1, 1568, 1.2, { vol: .05, wet: .6 }); sTone(c, t + .1, 2352, .7, { vol: .015, wet: .6 }); },
  warp: (c, t) => {   // 水にもぐる「ごぼごぼ」→ 泡がいっせいにのぼる → 水の中の鈴
    sNoise(c, t, 1.2, { f0: 250, f1: 700, q: .6, vol: .08, attack: .4, type: 'lowpass', wet: .4 });
    for (let i = 0; i < 16; i++) aqBloop(c, t + .05 + Math.random() * .9, 250 + Math.random() * 600, .045 + Math.random() * .03);
    sTone(c, t + .6, 1046.5, 1.4, { vol: .04, wet: .7 });
  },
};

/* ---- ドット：昔のゲーム機の「ピコッ」（四角い波の音。ひびきはなし） ---- */
const dpBeep = (c, t, f, dur = .06, vol = .03) => sTone(c, t, f, dur, { type: 'square', vol, attack: .001, wet: 0 });
const SND_DOT = {
  tap: (c, t) => dpBeep(c, t, 1320, .04, .028),
  open: (c, t) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => dpBeep(c, t + i * .045, f, .06)),
  close: (c, t) => [1046.5, 783.99, 659.25, 523.25].forEach((f, i) => dpBeep(c, t + i * .04, f, .05, .026)),
  switch: (c, t) => { dpBeep(c, t, 987.77, .05); dpBeep(c, t + .05, 1318.51, .07); },
  copy: (c, t) => { dpBeep(c, t, 987.77, .07, .032); dpBeep(c, t + .07, 1318.51, .38, .032); },   // コインの音
  warp: (c, t) => { sTone(c, t, 200, .36, { type: 'square', vol: .028, attack: .001, f2: 1600, glide: .34, wet: 0 }); sTone(c, t, 130, .22, { type: 'triangle', vol: .06, attack: .001, wet: 0 }); sNoise(c, t + .34, .12, { f0: 6000, f1: 3000, q: .5, vol: .04, attack: .002, type: 'highpass', wet: 0 }); dpBeep(c, t + .4, 1567.98, .2, .028); },
};

const SND_THEMES = { orbis: SND_ORBIS, sky: SND_SKY, wa: SND_WA, book: SND_BOOK, aqua: SND_AQUA, dot: SND_DOT };
function snd(kind) {
  const set = SND_THEMES[sndTheme()], fn = set && set[kind]; if (!fn) return;
  if (kind === 'tap') { const now = performance.now(); if (now - SND.lastTap < 70) return; SND.lastTap = now; }
  const ctx = sndCtx(); if (!ctx) return;
  try { fn(ctx, ctx.currentTime + .01); } catch (e) { /* 音が出なくても、ほかの動きは止めない */ }
}

/* ---- 鳴らす場所 ---- */
// ボタンなど、押せる物を押したとき
document.addEventListener('pointerdown', e => {
  if (e.button !== 0) return;
  if (e.target.closest('button, a[href], summary, label.btn, [role="tab"], .char-item, .sel-char, .sel-row, .tp')) snd('tap');
}, true);
// コマをコピー
['btn-copy', 'mbar-copy'].forEach(id => $(id)?.addEventListener('click', () => setTimeout(() => snd('copy'), 120)));
// テーマを選んだら、そのテーマの音を少し聞かせる
$('theme-presets').addEventListener('click', e => { if (e.target.closest('[data-preset-theme]')) setTimeout(() => snd('open'), 60); });
// テーマ・背景の小窓の「効果音」ボタン（どのテーマでも使える）
function renderSfxToggle() {
  const b = $('sfx-toggle'); if (!b) return;
  const on = state.sfx !== false;
  b.textContent = on ? '効果音：オン（押すとオフ）' : '効果音：オフ（押すとオン）';
  b.classList.toggle('primary', on); b.setAttribute('aria-pressed', String(on));
}
$('sfx-toggle')?.addEventListener('click', () => {
  state.sfx = state.sfx === false; save(); renderSfxToggle();
  if (typeof obSoundBtn === 'function') obSoundBtn();
  if (state.sfx !== false) setTimeout(() => snd('switch'), 30);
  if (isBook()) renderSheet();
});
$('btn-theme').addEventListener('click', renderSfxToggle);

/* はじめの画面（ORBiS）から入るときの「ふわーん」：やわらかい和音がふくらんで、空気がすうっと上がり、小さな鈴が光る */
function introSwell() {
  const ctx = sndCtx(); if (!ctx) return;
  const t = ctx.currentTime + .02;
  sNoise(ctx, t, 1.6, { f0: 500, f1: 4200, q: .7, vol: .05, attack: .55, wet: .6 });
  [659.25, 830.61, 987.77, 1479.98].forEach((f, i) => sTone(ctx, t + i * .03, f, 2.2, { type: 'sine', vol: .028, attack: .5, wet: .7, f2: f * 1.005, glide: 2 }));
  sTone(ctx, t, 329.63, 2.4, { type: 'triangle', vol: .03, attack: .6, wet: .5 });
  [1318.51, 1661.22, 1975.53, 2637.02].forEach((f, i) => obBell(ctx, t + .45 + i * .09, f, .025, 1.2));
}
