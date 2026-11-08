/* ================= 計算 ================= */
function abilities(c) {
  const a = {};
  Object.entries(c.abilities).forEach(([k, v]) => { a[k] = num(v.base) + num(v.adj) + num(v.tmp); });
  return a;
}
function skillLabel(s) { return s.hasSub ? `${s.name}（${s.sub}）` : s.name; }
function skillInit(s, a) { return typeof s.init === 'number' ? s.init : (s.custom ? num(s.init) : calc(s.init, a)); }
function skillTotal(s, a) { return skillInit(s, a) + num(s.job) + num(s.hobby) + num(s.grow) + num(s.other); }

function compute(c) {
  const S = SYS[c.system], a = abilities(c);
  const mythos = c.skills.filter(s => s.name === 'クトゥルフ神話').reduce((m, s) => Math.max(m, skillTotal(s, a)), 0);
  const d = S.derive(a, mythos, c);
  d.a = a; d.mythos = mythos;
  d.hp = c.hp === '' ? d.hpMax : num(c.hp);
  d.mp = c.mp === '' ? d.mpMax : num(c.mp);
  d.san = c.san === '' ? d.sanStart : num(c.san);
  d.indef = Math.floor(d.san * 4 / 5);
  d.jobUsed = c.skills.reduce((t, s) => t + num(s.job), 0);
  d.hobbyUsed = c.skills.reduce((t, s) => t + num(s.hobby), 0);
  return d;
}
