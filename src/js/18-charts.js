/* ================= グラフ ================= */
function radarSvg(c, a, size, animate) {
  const keys = SYS[c.system].abil.filter(([k]) => k !== 'LUCK').map(([k]) => k);
  const is7 = c.system === 'coc7';
  const maxV = Math.max(is7 ? 90 : 18, ...keys.map(k => a[k] || 0));
  const pad = 38, cx = size / 2, cy = size / 2, R = size / 2 - pad, n = keys.length;
  const P = (i, r) => { const t = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; };
  const poly = r => keys.map((_, i) => P(i, r).map(v => v.toFixed(1)).join(',')).join(' ');
  const pts = keys.map((k, i) => P(i, R * Math.max(0, Math.min(1, (a[k] || 0) / maxV))));
  const grid = [.25, .5, .75, 1].map(f => `<polygon class="rg" points="${poly(R * f)}"/>`).join('');
  const axes = keys.map((_, i) => { const [x, y] = P(i, R); return `<line class="ra" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join('');
  const labels = keys.map((k, i) => {
    const [x, y] = P(i, R + 18), anchor = Math.abs(x - cx) < 4 ? 'middle' : x < cx ? 'end' : 'start';
    return `<text class="rl-k" x="${x.toFixed(1)}" y="${(y - 6).toFixed(1)}" text-anchor="${anchor}">${k}</text><text class="rl-v" x="${x.toFixed(1)}" y="${(y + 8).toFixed(1)}" text-anchor="${anchor}">${a[k] || 0}</text>`;
  }).join('');
  const dots = pts.map(([x, y], i) => `<circle class="rd" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5"/><circle class="rh" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" data-tip="${keys[i]} ${a[keys[i]] || 0}"/>`).join('');
  const aqua = isAqua();
  if (aqua) return radarAqua({ c, a, keys, size, cx, cy, R, pts, axes, labels, animate });
  return `<svg class="radar-svg${animate ? ' grow' : ''}" viewBox="0 0 ${size} ${size}" role="img" aria-label="能力値チャート：${keys.map(k => `${k} ${a[k] || 0}`).join('、')}" style="--cx:${cx}px;--cy:${cy}px">
    ${grid}${axes}<g class="rshape"><polygon class="rarea" points="${pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' ')}"/>${dots}</g>${labels}</svg>`;
}
/* 技能グラフの色の見本 */
const SK_LEGEND = '<span class="legend"><i class="sw sw-init"></i>初期値<i class="sw sw-j"></i>職業P<i class="sw sw-h"></i>興味P<i class="sw sw-g"></i>成長・その他</span>';
function skillBarsHtml(c, a, animate) {
  const list = c.skills.filter(s => s.name && skillTotal(s, a) !== skillInit(s, a))
    .map(s => {
      const t = skillTotal(s, a), i = Math.max(0, Math.min(skillInit(s, a), t));
      // 振ったポイントを 職業P・興味P・成長とその他 に分ける（足して合計をこえないように順に切りつめる）
      let left = t - i; const j = Math.max(0, Math.min(num(s.job), left)); left -= j;
      const h = Math.max(0, Math.min(num(s.hobby), left)); left -= h;
      return { n: skillLabel(s), t, i, j, h, g: Math.max(0, left) };
    })
    .sort((x, y) => y.t - x.t).slice(0, 16);
  if (!list.length) return '<p class="empty">ポイントを振ると、ここに技能のグラフが出ます。</p>';
  const max = Math.max(100, ...list.map(x => x.t));
  return `<div class="sk-bars${animate ? ' grow' : ''}">${list.map((x, k) => `
    <div class="sk-row" style="--k:${k}" data-tip="${esc(x.n)}　初期値 ${x.i}${x.j ? ` ＋ 職業P ${x.j}` : ''}${x.h ? ` ＋ 興味P ${x.h}` : ''}${x.g ? ` ＋ 成長・その他 ${x.g}` : ''} ＝ ${x.t}">
      <span class="sk-n">${esc(x.n)}</span>
      <span class="sk-tr">${[['seg-i', x.i], ['seg-a seg-j', x.j], ['seg-a seg-h', x.h], ['seg-a seg-g', x.g]].filter(([, v]) => v > 0).map(([cl, v]) => `<i class="${cl}" style="width:${(v / max * 100).toFixed(2)}%"></i>`).join('')}</span>
      <b class="sk-v">${x.t}</b>
    </div>`).join('')}
    <div class="sk-row sk-axisrow" aria-hidden="true"><span></span><span class="sk-axis">${[0, 25, 50, 75, 100].filter(v => v <= max).map(v => `<span style="left:${(v / max * 100).toFixed(2)}%">${v}</span>`).join('')}</span><span></span></div>
  </div>`;
}
function updateCharts(c, a) {
  const r = $('ab-radar');
  if (r) { r.innerHTML = radarSvg(c, a, 300, !r.dataset.drawn); r.dataset.drawn = '1'; }
  const k = $('sk-chart');
  if (k) { k.innerHTML = skillBarsHtml(c, a, !k.dataset.drawn); k.dataset.drawn = '1'; }
}
/* アクアリウムテーマのレーダー：水のしずくのように、点を通るなめらかな線でつなぐ（値の位置は変えない）。
   中は水色〜紫のすける水、ゆれる光の網、点は泡。全体がゆっくり「ふよふよ」ゆれる（CSS） */
let radarUid = 0;
function radarAqua({ c, a, keys, size, cx, cy, R, pts, axes, labels, animate }) {
  const id = 'aqr' + (++radarUid);
  const n = pts.length, f = v => v.toFixed(1);
  // 点を通るなめらかな線（Catmull-Rom を弱めにかけて、形は崩しすぎない）
  const T = .16;
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += ` C${f(p1[0] + (p2[0] - p0[0]) * T)},${f(p1[1] + (p2[1] - p0[1]) * T)} ${f(p2[0] - (p3[0] - p1[0]) * T)},${f(p2[1] - (p3[1] - p1[1]) * T)} ${f(p2[0])},${f(p2[1])}`;
  }
  const rings = [.25, .5, .75, 1].map((k, i) => `<circle class="rg-c${i === 3 ? ' out' : ''}" cx="${cx}" cy="${cy}" r="${f(R * k)}"/>`).join('');
  const dots = pts.map(([x, y], i) => `<g class="rb" style="--d:${(i * .37).toFixed(2)}s"><circle class="rb-o" cx="${f(x)}" cy="${f(y)}" r="6.5"/><circle class="rb-h" cx="${f(x - 2)}" cy="${f(y - 2.2)}" r="1.8"/></g><circle class="rh" cx="${f(x)}" cy="${f(y)}" r="14" data-tip="${keys[i]} ${a[keys[i]] || 0}"/>`).join('');
  return `<svg class="radar-svg aq-radar${animate ? ' grow' : ''}" viewBox="0 0 ${size} ${size}" role="img" aria-label="能力値チャート：${keys.map(k => `${k} ${a[k] || 0}`).join('、')}" style="--cx:${cx}px;--cy:${cy}px">
    <defs>
      <radialGradient id="${id}g" cx="50%" cy="40%" r="65%"><stop offset="0" stop-color="#bff0ff" stop-opacity=".55"/><stop offset=".6" stop-color="#5fb8f0" stop-opacity=".32"/><stop offset="1" stop-color="#9a7cff" stop-opacity=".38"/></radialGradient>
      <pattern id="${id}p" width="90" height="90" patternUnits="userSpaceOnUse"><image href="assets/aqua/caustics.webp" width="90" height="90"/></pattern>
      <clipPath id="${id}c"><path d="${d}"/></clipPath>
    </defs>
    <circle class="rg-bg" cx="${cx}" cy="${cy}" r="${f(R)}"/>${rings}${axes}
    <g class="rshape"><g class="rwob">
      <path class="rarea" d="${d}" fill="url(#${id}g)"/>
      <g clip-path="url(#${id}c)"><rect class="rcaus" x="-90" y="-90" width="${size + 180}" height="${size + 180}" fill="url(#${id}p)"/></g>
      <path class="rline" d="${d}"/>${dots}
    </g></g>${labels}</svg>`;
}
/* グラフのツールチップ */
(() => {
  const tip = document.createElement('div');
  tip.className = 'chart-tip'; tip.hidden = true; tip.setAttribute('role', 'status');
  document.body.appendChild(tip);
  document.addEventListener('pointerover', e => {
    const t = e.target.closest('[data-tip]');
    if (!t) { tip.hidden = true; return; }
    tip.textContent = t.dataset.tip; tip.hidden = false;
    const r = t.getBoundingClientRect();
    tip.style.left = Math.min(innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px';
    tip.style.top = Math.max(8, r.top - tip.offsetHeight - 8) + 'px';
  });
  addEventListener('scroll', () => { tip.hidden = true; }, { passive: true, capture: true });
})();
