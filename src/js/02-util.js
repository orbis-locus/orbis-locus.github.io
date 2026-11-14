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

/* ---- 使えないユーザー名（運営になりすます名前・ひどい言葉）。サーバーの決まりは supabase/25-banned-names.sql（言葉を足すときは両方に） ----
   くらべる前に、全角→半角・大文字→小文字・カタカナ→ひらがなにそろえ、あいだの記号を消す（nameKey）。言葉はそろえた後の形で書く */
const NAME_NG = ['運営', '公式', '管理者', '管理人', '事務局', 'うんえい', 'こうしき', 'かんりしゃ', 'かんりにん', 'さぽーと', 'すたっふ', 'もでれーたー', 'admin', 'official', 'staff', 'support', 'moderator', 'operator', '死ね', '氏ね', '殺す', 'ころすぞ', '自殺', 'くたばれ', 'れいぷ', 'せっくす', 'ちんこ', 'ちんぽ', 'まんこ', 'きちがい', '基地外', 'がいじ', '支那', '土人', 'にがー', 'fuck', 'nigger', 'nigga', 'porn'];
const NAME_NG_EXACT = ['orbis', 'おるびす'];   // これだけは「ぴったり同じ」のときだけ使えない
const nameKey = s => String(s || '').normalize('NFKC').toLowerCase().replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[ _\-.*\u30fb\u3000]/g, '');
const nameBanned = s => { const k = nameKey(s); return NAME_NG_EXACT.includes(k) || NAME_NG.some(w => k.includes(w)); };
const NAME_NG_MSG = 'この名前は使えません。別のユーザー名にしてください。';
