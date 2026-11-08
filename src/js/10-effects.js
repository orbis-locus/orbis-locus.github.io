/* ================= ふわっとエフェクト ================= */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const SPARK = ['var(--orange)', 'var(--pink)', 'var(--yellow)', 'var(--cyan)', 'var(--lime)', 'var(--sky)'];
function fx(x, y, burst = false) {
  if (reduceMotion.matches) return;
  const make = (cls, vars) => {
    const e = document.createElement('span');
    e.className = 'fx ' + cls; e.style.left = x + 'px'; e.style.top = y + 'px';
    if (vars) Object.entries(vars).forEach(([k, v]) => e.style.setProperty(k, v));
    document.body.appendChild(e);
    setTimeout(() => e.remove(), 1400);
  };
  if (isOrbis()) {   // ORBiS では、やわらかい光の輪と、小さな四つの星が散る
    make('fx-ob-glow'); make('fx-ob-ring');
    const n = burst ? 14 : 5;
    for (let i = 0; i < n; i++) {
      const ang = i / n * Math.PI * 2 + Math.random() * .6, dist = (burst ? 60 : 22) + Math.random() * (burst ? 90 : 34);
      make('fx-ob-star', { '--dx': Math.cos(ang) * dist + 'px', '--dy': Math.sin(ang) * dist * .8 + 'px', '--s': (.5 + Math.random() * (burst ? 1.1 : .7)).toFixed(2), '--r': Math.round(Math.random() * 90) + 'deg', '--d': Math.round(Math.random() * 120) + 'ms' });
    }
    if (burst) make('fx-ob-orbit');
    return;
  }
  make('fx-bloom'); make('fx-ring'); make('fx-ring late');
  if (isAqua()) {   // アクアリウムでは、火花のかわりに小さな泡がのぼる
    for (let i = 0; i < (burst ? 12 : 4); i++) make('fx-bub', { '--dx': (Math.random() - .5) * (burst ? 120 : 40) + 'px', '--dy': -(50 + Math.random() * (burst ? 140 : 60)) + 'px', '--s': (.4 + Math.random() * .8).toFixed(2), '--d': Math.round(Math.random() * 200) + 'ms' });
    return;
  }
  if (burst) {
    make('fx-ring big');
    for (let i = 0; i < 14; i++) {
      const ang = i / 14 * Math.PI * 2 + Math.random() * .3, dist = 70 + Math.random() * 60;
      make('fx-spark', { '--dx': Math.cos(ang) * dist + 'px', '--dy': Math.sin(ang) * dist + 'px', '--c': SPARK[i % SPARK.length] });
    }
  }
}
function fxAt(el, burst) { const r = el.getBoundingClientRect(); fx(r.left + r.width / 2, r.top + r.height / 2, burst); }
function enter(el) { if (!el || reduceMotion.matches) return; el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); }
document.addEventListener('pointerdown', e => { if (e.button === 0) fx(e.clientX, e.clientY); });

function renderAll() { applyBg(); if (!$('select').hidden) renderSelect(); $('copy-status').textContent = ''; renderShelf(); renderSheet(); renderOutput(); enter($('sheet')); enter(document.querySelector('.koma')); }
function touch() {
  const c = active(); if (!c) return; c.updatedAt = Date.now(); delete c.sample;
  save(); renderShelf(); renderOutput(); updateComputed();
  const tk = document.querySelector('.hub-core .token, .bk-portrait .token');
  if (tk) tk.outerHTML = tokenHtml(c);
}
