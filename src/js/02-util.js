/* ================= ユーティリティ ================= */
const KEY = 'charasheet-kobo.v2';
const KEY_V1 = 'charasheet-kobo.v1';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
/* 色は「#」と英数字だけのときだけ使う（ほかの人のキャラシの色の欄に、外の画像を読みこむ文などを入れられないように） */
const cssColor = (v, def = '#1f6fe0') => /^#[0-9a-f]{3,8}$/i.test(String(v || '').trim()) ? String(v).trim() : def;
const num = v => { const n = Number(String(v ?? '').trim()); return isFinite(n) ? n : 0; };
const calc = (expr, vars = {}) => {
  const s = String(expr).replace(/[A-Z]+/g, k => vars[k] ?? 0);
  if (!/^[\d+\-*/(). ]+$/.test(s)) return 0;
  try { return Math.floor(Function('"use strict";return (' + s + ')')()); } catch (e) { return 0; }
};
function rollDetail(expr) {
  const groups = [];
  const replaced = String(expr).replace(/(\d+)d(\d+)/gi, (_, n, sd) => {
    const faces = Array.from({ length: +n }, () => 1 + Math.floor(Math.random() * +sd));
    groups.push({ n: +n, s: +sd, faces });
    return faces.reduce((a, b) => a + b, 0);
  });
  return { total: calc(replaced), groups, expr: String(expr).toUpperCase().replace(/\*/g, '×') };
}
