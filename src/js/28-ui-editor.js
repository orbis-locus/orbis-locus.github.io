/* ================= 画面の編集モード（部品の文字・色・画像・形・位置を変える） =================
   ・権限が「マスター」か「編集者」の人がログインすると「テーマ・背景」に「画面を編集する」が出る（Ctrl+Shift+E でも開く）
   ・編集中の内容は「下書き」としてこのブラウザに保存される
   ・マスター：「みんなに公開」でサーバー（ui_layout）に送り、全員の画面に反映する。編集者の仮保存を読み込んで確認できる
   ・編集者：「仮保存」でサーバー（ui_drafts）に送るだけ。公開はできない
   ・部品は「CSSセレクター」という住所で覚えておき、CSSを上書きして見た目を変える */
const UE_KEY = 'charasheet-kobo.ui-edit';
const UE_PUB_KEY = UE_KEY + '.pub';
const UE_EMPTY = () => ({ v: 1, items: {} });
const UE = {
  on: false, pause: false, sel: null, el: null, data: UE_EMPTY(), pub: UE_EMPTY(), admin: false, role: null,
  tab: 'look', users: null, userQ: '', drafts: null, saved: null, busy: false, drag: null, noClick: false,
  secOpen: { '文字': true }, sheet: 'half',
};
const UE_STATE_CLS = /^(on|off|open|land|listv|slidev|free|warn|pulse|playing|over|out|enter|leave|drag|changed|center|armed|grid|hidden|active|show|in|is-.*|has-.*|sel-has-bg|res-.*|ue-.*)$/;
const UE_SKIP_DATA = /^data-(i|id|uid|fid|u|row|p|del|ch|tk|gjoin|fv|final|max|sum|open|ring|sides|close|close-panel)$/;

const ueRead = k => { try { const s = JSON.parse(localStorage.getItem(k) || 'null'); return s && s.items ? s : null; } catch (e) { return null; } };
const ueWrite = (k, v) => { try { v ? localStorage.setItem(k, JSON.stringify(v)) : localStorage.removeItem(k); } catch (e) { toast('編集内容を保存できませんでした。'); } };
const ueItemsJson = d => JSON.stringify(d.items);
const ueSame = (a, b) => ueItemsJson(a) === ueItemsJson(b);
const ueClone = d => JSON.parse(JSON.stringify(d));
const ueIsMaster = () => UE.role === 'master';
function ueLoad() {
  UE.pub = ueRead(UE_PUB_KEY) || UE_EMPTY();       // 前回サーバーから受け取った公開版（すぐ表示するため）
  UE.data = ueRead(UE_KEY) || ueClone(UE.pub);    // 自分の下書き
}
function ueSave() { ueWrite(UE_KEY, UE.data); ueApply(); }
/* 公開版をサーバーから受け取る（ログインしていなくても読める） */
async function uePull() {
  const c = sbClient(); if (!c) return;
  try {
    const { data, error } = await c.from('ui_layout').select('data').eq('id', 'main').maybeSingle();
    if (error || !data) return;
    const pub = data.data && data.data.items ? data.data : UE_EMPTY();
    const hadDraft = !ueSame(UE.data, UE.pub);
    UE.pub = pub; ueWrite(UE_PUB_KEY, pub);
    if (!hadDraft) UE.data = ueClone(pub);
    ueApply(); if (UE.on) ueRenderBody();
  } catch (e) { /* つながらないときは前回の公開版のまま */ }
}

/* ===== 権限 ===== */
/* ログインした人の権限（'master' マスター / 'editor' 編集者 / null なし） */
async function ueCheckAdmin() {
  let role = null;
  if (me && sb) {
    try {
      const r = await sb.rpc('my_app_role');
      if (!r.error) role = r.data || null;
      else { const r2 = await sb.rpc('is_app_admin'); role = r2.data === true ? 'master' : null; } // 05-app-roles.sql がまだのとき
    } catch (e) { role = null; }
  }
  // マスター・編集者・テスターは、無料版の鍵なしで全部使える（34-free.js。テスターは supabase/16-testers.sql）
  let unlock = !!role;
  if (!unlock && me && sb) { try { const r = await sb.rpc('am_unlocked'); unlock = !r.error && r.data === true; } catch (e) { unlock = false; } }
  UE.role = role;
  const ok = UE.admin = !!role;
  setUnlockAll(unlock);
  if (role === 'master') loadReports(true);   // 届いている通報（35-report.js）
  if (!ueIsMaster() && UE.tab !== 'look') UE.tab = 'look';
  const b = $('ue-open'); if (b) b.hidden = !ok;
  if (!ok && UE.on) ueStop(); else if (UE.on) ueRenderBody();
}
const ueNoPick = () => UE.pause || UE.tab !== 'look';
const UE_ROLE = { master: 'マスター', editor: '編集者', tester: 'テスター', none: 'なし' };
async function ueLoadUsers() {
  UE.users = null; ueRenderBody();
  const { data, error } = await sb.rpc('app_users_list');
  UE.users = error ? { err: jaErr(error) } : (data || []);
  ueRenderBody();
}
function ueRolesHtml() {
  if (!UE.users) return '<p class="ue-hint">読み込み中…</p>';
  if (UE.users.err) return `<p class="ue-hint">${esc(UE.users.err)}</p>`;
  const q = UE.userQ.trim().toLowerCase();
  const list = UE.users.filter(u => !q || String(u.username).toLowerCase().includes(q));
  return `<p class="ue-hint">マスター：画面の編集・公開・権限の変更<br>編集者：画面の編集と仮保存だけ（公開はできない）<br>テスター：無料版の鍵なしで全部使える（画面の編集はできない）</p>
    <input type="search" class="ue-search" id="ue-user-q" placeholder="ユーザー名でさがす" value="${esc(UE.userQ)}">
    <div class="ue-users">${list.map(u => `<label class="ue-user"><span>${esc(u.username)}${me && u.user_id === me.id ? '<small>（あなた）</small>' : ''}</span>
      <select data-ue-role="${esc(u.user_id)}">${Object.entries(UE_ROLE).map(([k, l]) => `<option value="${k}" ${(u.role || 'none') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>`).join('') || '<p class="ue-hint">見つかりません</p>'}</div>`;
}
async function ueSetRole(sel) {
  const u = UE.users.find(x => x.user_id === sel.dataset.ueRole); if (!u) return;
  const role = sel.value, before = u.role || 'none';
  if (me && u.user_id === me.id && role !== 'master' && !confirm('自分の権限を下げると、公開や権限の変更ができなくなります。よろしいですか？')) { sel.value = before; return; }
  sel.disabled = true;
  const { data, error } = await sb.rpc('set_app_role', { target: u.user_id, new_role: role });
  sel.disabled = false;
  if (error || data !== 'ok') { sel.value = before; toast(error ? jaErr(error) : data); return; }
  u.role = role === 'none' ? null : role;
  toast(`${u.username}さんを「${UE_ROLE[role]}」にしました`);
  if (me && u.user_id === me.id) ueCheckAdmin();
}

/* ===== 公開（マスター）と仮保存（編集者） ===== */
async function uePublish() {
  if (!ueIsMaster() || !sb || !me || UE.busy) return;
  UE.busy = true; ueRenderFoot();
  try {
    const { error } = await sb.from('ui_layout').upsert({ id: 'main', data: UE.data, updated_at: new Date().toISOString(), updated_by: me.id });
    if (error) throw error;
    UE.pub = ueClone(UE.data); ueWrite(UE_PUB_KEY, UE.pub);
    toast('みんなの画面に公開しました');
  } catch (e) { toast(/row-level security|permission/i.test(String(e && e.message)) ? '公開できませんでした。公開できるのはマスターだけです。' : jaErr(e)); }
  finally { UE.busy = false; ueRenderFoot(); }
}
async function ueSaveDraft() {
  if (!UE.admin || !sb || !me || UE.busy) return;
  UE.busy = true; ueRenderFoot();
  try {
    const { error } = await sb.from('ui_drafts').upsert({ user_id: me.id, data: UE.data, updated_at: new Date().toISOString() });
    if (error) throw error;
    UE.saved = ueItemsJson(UE.data);
    toast('仮保存しました。マスターが確認して公開します。');
  } catch (e) { toast(/does not exist|Could not find/i.test(String(e && e.message)) ? '仮保存の準備（06のSQL）がまだのようです。マスターに伝えてください。' : jaErr(e)); }
  finally { UE.busy = false; ueRenderFoot(); }
}
/* 編集者：サーバーにある自分の仮保存を受け取る（別の端末で続きをするため） */
async function ueLoadMyDraft() {
  UE.saved = ueItemsJson(UE.pub);
  if (!sb || !me) return;
  try {
    const { data } = await sb.from('ui_drafts').select('data').eq('user_id', me.id).maybeSingle();
    if (data && data.data && data.data.items) {
      UE.saved = ueItemsJson(data.data);
      if (ueSame(UE.data, UE.pub)) { UE.data = ueClone(data.data); ueSave(); }
    }
  } catch (e) { /* なければそのまま */ }
  if (UE.on) ueRenderBody();
}
/* マスター：みんなの仮保存の一覧 */
async function ueLoadDrafts() {
  UE.drafts = null; ueRenderBody();
  try {
    const { data, error } = await sb.from('ui_drafts').select('user_id,data,updated_at').order('updated_at', { ascending: false });
    if (error) throw error;
    const ids = (data || []).map(d => d.user_id);
    const names = {};
    if (ids.length) {
      const { data: ps } = await sb.from('profiles').select('id,username').in('id', ids);
      (ps || []).forEach(p => { names[p.id] = p.username; });
    }
    UE.drafts = (data || []).map(d => ({ ...d, name: names[d.user_id] || '（不明なユーザー）' }));
  } catch (e) { UE.drafts = { err: /does not exist|Could not find/i.test(String(e && e.message)) ? '仮保存の準備（06のSQL）がまだのようです。' : jaErr(e) }; }
  ueRenderBody();
}
function ueDraftsHtml() {
  if (!UE.drafts) return '<p class="ue-hint">読み込み中…</p>';
  if (UE.drafts.err) return `<p class="ue-hint">${esc(UE.drafts.err)}</p>`;
  if (!UE.drafts.length) return '<p class="ue-hint">まだ仮保存はありません。編集者が「仮保存」を押すと、ここに出ます。</p>';
  return `<p class="ue-hint">「読み込んで見る」を押すと、その内容を自分の下書きにして画面で確かめられます。よければ「みんなに公開」を押してください。</p>
    ${UE.drafts.map((d, i) => `<div class="ue-draft"><b>${esc(d.name)}</b>${me && d.user_id === me.id ? '<small>（あなた）</small>' : ''}
      <span>${esc(new Date(d.updated_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))} ・ 部品${Object.keys((d.data && d.data.items) || {}).length}個</span>
      <div class="ue-row"><button type="button" class="ue-b" data-ue-dload="${i}">読み込んで見る</button><button type="button" class="ue-b danger" data-ue-ddel="${i}">削除</button></div></div>`).join('')}`;
}

/* ===== 部品の住所（セレクター） ===== */
function ueSelector(el) {
  const parts = [];
  while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
    if (el.id && !/^ue-/.test(el.id)) { parts.unshift('#' + CSS.escape(el.id)); break; }
    let s = el.tagName.toLowerCase();
    const cls = [...el.classList].filter(c => !UE_STATE_CLS.test(c)).slice(0, 2);
    if (cls.length) s += '.' + cls.map(c => CSS.escape(c)).join('.');
    const da = [...el.attributes].find(a => /^data-[\w-]+$/.test(a.name) && !UE_SKIP_DATA.test(a.name) && a.value && a.value.length < 30 && !/^\d+$/.test(a.value) && !/^[a-z0-9]{10,}$/i.test(a.value));
    if (da) s += `[${da.name}="${CSS.escape(da.value)}"]`;
    const p = el.parentElement;
    if (p) {
      let same = [];
      try { same = [...p.children].filter(x => x.matches(s)); } catch (e) { same = []; }
      if (same.length > 1) s += `:nth-child(${[...p.children].indexOf(el) + 1})`;
    }
    parts.unshift(s);
    el = p;
  }
  return parts.join(' > ');
}
function ueFind(sel) { try { return document.querySelector(sel); } catch (e) { return null; } }
function ueLabel(el) {
  if (!el) return '';
  const t = (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 18);
  return t || el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
}

/* ===== 変えられる項目 ===== */
const UE_FONTS = [
  ['', '元のまま'],
  ['sys', '標準ゴシック', 'system-ui, -apple-system, "Hiragino Sans", "Yu Gothic UI", sans-serif'],
  ['mincho', '標準明朝', '"Hiragino Mincho ProN", "Yu Mincho", YuMincho, serif'],
  ['Noto Sans JP', 'Noto Sans（ゴシック）'], ['Noto Serif JP', 'Noto Serif（明朝）'],
  ['M PLUS Rounded 1c', 'M PLUS Rounded（丸ゴシック）'], ['Zen Maru Gothic', 'Zen丸ゴシック'], ['Kosugi Maru', '小杉丸ゴシック'],
  ['Shippori Mincho', 'しっぽり明朝'], ['Zen Old Mincho', 'Zenオールド明朝'], ['Kaisei Decol', '解星デコール'],
  ['Klee One', 'クレー（手書き風）'], ['Yusei Magic', '油性マジック'], ['Hachi Maru Pop', 'はちまるポップ'],
  ['Yuji Syuku', '佑字 肅（毛筆）'], ['DotGothic16', 'ドットゴシック'], ['RocknRoll One', 'ロックンロール'],
  ['Reggae One', 'レゲエ'], ['Dela Gothic One', 'デラゴシック（極太）'],
];
const ueFontStack = k => { const f = UE_FONTS.find(x => x[0] === k); return f ? f[2] || `"${f[0]}", sans-serif` : ''; };
const ueFontIsWeb = k => !!k && UE_FONTS.some(x => x[0] === k && !x[2]);
const UE_SHADOW = { none: 'none', soft: '0 6px 20px rgba(0,0,0,.18)', strong: '0 4px 0 rgba(0,0,0,.35)', glow: '0 0 18px 4px color-mix(in srgb, var(--sky) 55%, transparent)', inset: 'inset 0 2px 10px rgba(0,0,0,.3)' };
const UE_TSHADOW = { none: 'none', soft: '0 2px 6px rgba(0,0,0,.35)', glow: '0 0 10px color-mix(in srgb, var(--sky) 80%, white)', outline: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000', white: '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff' };
const UE_CLIP = {
  circle: 'circle(50% at 50% 50%)', ellipse: 'ellipse(50% 50% at 50% 50%)',
  hex: 'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)', diamond: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)',
  star: 'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  slant: 'polygon(8% 0, 100% 0, 92% 100%, 0 100%)', arrow: 'polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%)',
  ribbon: 'polygon(0 0, 100% 0, 92% 50%, 100% 100%, 0 100%, 8% 50%)', cut: 'polygon(12% 0, 88% 0, 100% 12%, 100% 88%, 88% 100%, 12% 100%, 0 88%, 0 12%)',
};
const ueOpts = opts => [['', '元のまま'], ...opts];
/* type: num（数字）/ color（色）/ select（選ぶ）/ 特別なものは render で描く */
const UE_SECS = [
  ['文字', [
    { k: 'text', special: 'text' },
    { k: 'font', label: 'フォント', type: 'select', opts: UE_FONTS.map(f => [f[0], f[1]]) },
    { k: 'fs', label: '文字サイズ', type: 'num', min: 6, max: 96, cur: 'font-size', css: v => `font-size:${v}px` },
    { k: 'fw', label: '太さ', type: 'select', opts: ueOpts([['300', '細い'], ['400', '普通'], ['700', '太い'], ['900', '極太']]), css: v => `font-weight:${v}` },
    { k: 'ls', label: '文字の間隔', type: 'num', min: -5, max: 30, step: .5, css: v => `letter-spacing:${v}px` },
    { k: 'lh', label: '行の高さ', type: 'num', min: .8, max: 3, step: .1, css: v => `line-height:${v}` },
    { k: 'ta', label: 'そろえ', type: 'select', opts: ueOpts([['left', '左'], ['center', '中央'], ['right', '右']]), css: v => `text-align:${v}` },
    { k: 'color', label: '文字色', type: 'color', cur: 'color', css: v => `color:${v};-webkit-text-fill-color:${v}` },
    { k: 'tsh', label: '文字の影', type: 'select', opts: ueOpts([['none', 'なし'], ['soft', 'やわらかい影'], ['glow', '光る'], ['outline', '黒いふち'], ['white', '白いふち']]), css: v => `text-shadow:${UE_TSHADOW[v]}` },
  ]],
  ['色・画像', [
    { k: 'bg', label: '背景色', type: 'color', cur: 'background-color', css: v => `background:${v}` },
    { k: 'img', special: 'img' },
    { k: 'fit', label: '画像の合わせ方', type: 'select', opts: ueOpts([['cover', 'いっぱいに（はみ出しは切る）'], ['contain', '全体が入るように'], ['fill', '引きのばす'], ['repeat', 'タイルのように並べる'], ['auto', 'そのままの大きさ']]) },
    { k: 'op', label: '透明度（%）', type: 'num', min: 0, max: 100, cur: o => Math.round(parseFloat(o.opacity) * 100), css: v => `opacity:${v / 100}` },
  ]],
  ['形', [
    { k: 'w', label: '横幅', type: 'num', min: 0, max: 1600, cur: 'width', css: v => `width:${v}px;min-width:0;max-width:none` },
    { k: 'h', label: '高さ', type: 'num', min: 0, max: 1200, cur: 'height', css: v => `height:${v}px;min-height:0;max-height:none` },
    { k: 'pad', label: '内側の余白', type: 'num', min: 0, max: 80, cur: 'padding-top', css: v => `padding:${v}px` },
    { k: 'mar', label: '外側の余白', type: 'num', min: -40, max: 80, cur: 'margin-top', css: v => `margin:${v}px` },
    { k: 'rad', label: '角の丸み', type: 'num', min: 0, max: 200, cur: 'border-top-left-radius', css: v => `border-radius:${v}px` },
    { k: 'shape', label: '切り抜く形', type: 'select', opts: ueOpts([['circle', '円'], ['ellipse', 'だ円'], ['hex', '六角形'], ['diamond', 'ひし形'], ['star', '星'], ['cut', '角を切る'], ['slant', '平行四辺形'], ['arrow', '矢印'], ['ribbon', 'リボン']]), css: v => `clip-path:${UE_CLIP[v]}` },
    { k: 'bw', label: 'ふちの太さ', type: 'num', min: 0, max: 20 },
    { k: 'bc', label: 'ふちの色', type: 'color', cur: 'border-top-color' },
    { k: 'shadow', label: '影', type: 'select', opts: ueOpts([['none', 'なし'], ['soft', 'やわらかい影'], ['strong', 'くっきりした影'], ['glow', '光る'], ['inset', '内側にへこむ']]), css: v => `box-shadow:${UE_SHADOW[v]}` },
    { k: 'rot', label: '回転（度）', type: 'num', min: -180, max: 180, css: v => `rotate:${v}deg` },
    { k: 'sc', label: '拡大（%）', type: 'num', min: 10, max: 300, css: v => `scale:${v / 100}` },
  ]],
  ['位置・表示', [
    { k: 'pos', special: 'pos' },
    { k: 'hide', special: 'hide' },
  ]],
];
const UE_PROPS = UE_SECS.flatMap(([, rows]) => rows);
const ueHas = (o, k) => o[k] != null && o[k] !== '';

/* 上書き用のCSSを作る */
function ueCss() {
  let css = '';
  // 波かっこ・< > は消す（値や部品の住所から、別のきまりを足したり文を閉じたりできないように）
  const safe = x => String(x).replace(/[{}<>]/g, '');
  Object.entries(ueShown().items).forEach(([s, o]) => {
    s = safe(s);
    const d = [];
    UE_PROPS.forEach(p => { if (p.css && ueHas(o, p.k)) d.push(...p.css(o[p.k]).split(';')); });
    if (ueHas(o, 'bw')) d.push(`border:${o.bw}px solid ${o.bc || 'currentColor'}`);
    else if (o.bc) d.push(`border-color:${o.bc}`);
    if (o.img && o.tag !== 'img') {
      d.push(`background-image:url("${String(o.img).replace(/["\\\n]/g, '')}")`);
      const f = o.fit || 'cover';
      if (f === 'repeat') d.push('background-repeat:repeat', 'background-size:auto');
      else d.push('background-repeat:no-repeat', 'background-position:center', `background-size:${f === 'fill' ? '100% 100%' : f}`);
    }
    if (o.tag === 'img' && o.fit && o.fit !== 'repeat') d.push(`object-fit:${o.fit === 'auto' ? 'none' : o.fit}`);
    if (o.x || o.y) {
      const [tx, ty] = (o.tb && o.tb !== 'none' ? o.tb : '0px 0px').split(' ');
      d.push(`translate:calc(${tx} + ${o.x || 0}px) calc(${ty || '0px'} + ${o.y || 0}px)`);
    }
    if (d.length) css += `${s}{${d.map(x => safe(x) + ' !important').join(';')}}\n`;
    // フォントは、アプリが中の部品ごとに決めているので、中の部品にもまとめて効かせる
    if (o.font) css += `${s}, ${s} *:not(svg):not(svg *){font-family:${safe(ueFontStack(o.font))} !important}\n`;
    if (o.hide) css += `body:not(.ue-on) ${s}{display:none !important}\nbody.ue-on ${s}{opacity:.3 !important;outline:2px dashed #e2483d !important}\n`;
  });
  return css;
}
const ueShown = () => UE.on ? UE.data : UE.pub;   // 編集中は下書き、それ以外は公開版を表示
/* 文言と <img> の画像は、CSSでは変えられないので直接書きかえる */
let ueObs = null, ueRaf = 0;
const ueNeedsDom = o => o.text != null || (o.img && o.tag === 'img');
function ueDom() {
  ueRaf = 0;
  Object.entries(ueShown().items).forEach(([s, o]) => {
    if (!ueNeedsDom(o)) return;
    let els = [];
    try { els = document.querySelectorAll(s); } catch (e) { return; }
    els.forEach(e => {
      if (o.text != null && !e.children.length && e.textContent !== o.text) e.textContent = o.text;
      if (o.img && o.tag === 'img' && e.tagName === 'IMG' && e.getAttribute('src') !== o.img) { e.removeAttribute('srcset'); e.src = o.img; }
    });
  });
}
function ueFonts() {
  const used = new Set(Object.values(ueShown().items).map(o => o.font).filter(ueFontIsWeb));
  used.forEach(f => {
    const id = 'ue-font-' + f.replace(/\W/g, '');
    if ($(id)) return;
    const l = document.createElement('link');
    l.id = id; l.rel = 'stylesheet';
    l.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f).replace(/%20/g, '+')}&display=swap`;
    document.head.appendChild(l);
  });
}
function ueApply() {
  let st = $('ue-style');
  if (!st) { st = document.createElement('style'); st.id = 'ue-style'; document.head.appendChild(st); }
  st.textContent = ueCss();
  ueFonts();
  const need = Object.values(ueShown().items).some(ueNeedsDom);
  if (need && !ueObs) {
    // 画面が描き直されても変更を保つ
    ueObs = new MutationObserver(() => { if (!ueRaf) ueRaf = requestAnimationFrame(ueDom); });
    ueObs.observe(document.body, { childList: true, subtree: true, characterData: true });
  } else if (!need && ueObs) { ueObs.disconnect(); ueObs = null; }
  ueDom();
  if (UE.on) uePlaceBox();
}

/* 色を #rrggbb にそろえる（color-mix などもブラウザに変換してもらう） */
const ueCtx = document.createElement('canvas').getContext('2d');
function ueHex(c) {
  if (!c || c === 'transparent' || /rgba\(.*,\s*0\)$/.test(c)) return '';
  ueCtx.fillStyle = '#000'; ueCtx.fillStyle = c;
  const v = ueCtx.fillStyle;
  return /^#[0-9a-f]{6}$/i.test(v) ? v : '';
}

/* 画像をサーバー（Storage）に置いて、そのURLを返す */
async function ueUpload(file) {
  const url = await loadImageData(file, 1600, .85);
  if (sb && me) {
    try {
      const blob = await (await fetch(url)).blob();
      const path = `${me.id}/${Date.now()}.${blob.type === 'image/png' ? 'png' : 'webp'}`;
      const { error } = await sb.storage.from('ui-assets').upload(path, blob, { contentType: blob.type });
      if (error) throw error;
      return sb.storage.from('ui-assets').getPublicUrl(path).data.publicUrl;
    } catch (e) { /* 下で直接入れる */ }
  }
  if (url.length < 400000) { toast('画像をサーバーに置けなかったので、編集内容の中に直接入れました（06のSQLを実行すると軽くなります）'); return url; }
  throw new Error('画像をサーバーに置けませんでした。06のSQLを実行したか確認するか、小さい画像にしてください。');
}

/* ===== パネル ===== */
function uePanelHtml() {
  return `<div class="ue-grip" id="ue-grip" role="button" aria-label="パネルの高さを変える"><i></i></div>
    <div class="ue-head"><b>画面の編集</b>
      <button type="button" class="ue-b" id="ue-pause"></button>
      <button type="button" class="ue-b" id="ue-exit" aria-label="編集モードを終える">終了</button></div>
    <div class="ue-tabs" id="ue-tabs" hidden>
      <button type="button" data-ue-tab="look">見た目</button><button type="button" data-ue-tab="drafts">仮保存</button><button type="button" data-ue-tab="roles">権限</button>
    </div>
    <div class="ue-body" id="ue-body"></div>
    <div class="ue-foot">
      <div class="ue-pub" id="ue-pub"></div>
      <details class="ue-more"><summary>変更した部品 <span id="ue-count"></span>・その他</summary>
        <div id="ue-list"></div>
        <div class="ue-row">
          <button type="button" class="ue-b" id="ue-export">書き出し</button>
          <button type="button" class="ue-b" id="ue-import">読み込み</button>
          <button type="button" class="ue-b danger" id="ue-reset-all">すべて元に戻す</button>
        </div>
        <textarea id="ue-io" hidden placeholder="書き出した内容をここに貼り付けて「読み込む」を押してください"></textarea>
        <button type="button" class="ue-b" id="ue-io-go" hidden>読み込む</button>
      </details>
    </div>`;
}
function ueRenderFoot() {
  if (!$('ue-pub')) return;
  $('ue-pause').textContent = UE.pause ? '部品を選ぶ' : 'アプリを操作する';
  $('ue-pause').classList.toggle('on', UE.pause);
  $('ue-pause').hidden = UE.tab !== 'look';
  $('ue-tabs').hidden = !ueIsMaster();
  document.querySelectorAll('[data-ue-tab]').forEach(b => b.classList.toggle('on', b.dataset.ueTab === UE.tab));
  const n = Object.keys(UE.data.items).length;
  $('ue-count').textContent = n ? `（${n}）` : '';
  $('ue-list').innerHTML = n ? Object.entries(UE.data.items).map(([s, o]) =>
    `<button type="button" class="ue-li" data-ue-sel="${esc(s)}">${esc(o.label || s)}</button>`).join('') : '<p class="ue-hint">まだありません</p>';
  const diffPub = !ueSame(UE.data, UE.pub), busy = UE.busy;
  if (ueIsMaster()) {
    $('ue-pub').innerHTML = `<p class="ue-hint">${diffPub ? '<b class="ue-dirty">● まだ公開していない変更があります</b>（みんなの画面はまだ前のまま）' : 'みんなの画面と同じです'}</p>
      <div class="ue-row"><button type="button" class="ue-b on" id="ue-publish" ${diffPub && !busy ? '' : 'disabled'}>${busy ? '送信中…' : 'みんなに公開'}</button>
      <button type="button" class="ue-b" id="ue-discard" ${diffPub && !busy ? '' : 'disabled'}>公開中の状態に戻す</button></div>`;
  } else {
    const unsaved = UE.saved != null && ueItemsJson(UE.data) !== UE.saved;
    $('ue-pub').innerHTML = `<p class="ue-hint">${unsaved ? '<b class="ue-dirty">● 仮保存していない変更があります</b>' : diffPub ? '仮保存ずみです。マスターが確認して公開します。' : '公開中の画面と同じです'}</p>
      <div class="ue-row"><button type="button" class="ue-b on" id="ue-draft-save" ${unsaved && !busy ? '' : 'disabled'}>${busy ? '送信中…' : '仮保存する'}</button>
      <button type="button" class="ue-b" id="ue-discard" ${diffPub && !busy ? '' : 'disabled'}>公開中の状態に戻す</button></div>`;
  }
}
function ueField(p, o, cs) {
  const has = ueHas(o, p.k);
  const clr = `<button type="button" class="ue-x" data-ue-clear="${p.k}" ${has ? '' : 'disabled'} aria-label="${p.label}を元に戻す">↺</button>`;
  if (p.type === 'color') {
    const cur = has ? o[p.k] : ueHex(p.cur ? cs.getPropertyValue(p.cur) : '') || '#000000';
    return `<label class="ue-f"><span>${p.label}</span><input type="color" data-ue-k="${p.k}" value="${esc(cur)}">${clr}</label>`;
  }
  if (p.type === 'select') {
    return `<label class="ue-f ue-f2"><span>${p.label}</span><select data-ue-k="${p.k}">${p.opts.map(([v, l]) => `<option value="${esc(v)}" ${String(o[p.k] ?? '') === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>${clr}</label>`;
  }
  // 数字：設定していないときは、いまの値を目安に出す
  let cur = '';
  if (has) cur = o[p.k];
  else if (typeof p.cur === 'function') cur = p.cur(cs);
  else if (p.cur) { const v = parseFloat(cs.getPropertyValue(p.cur)); cur = isNaN(v) ? '' : Math.round(v); }
  const step = p.step ? `step="${p.step}"` : '';
  return `<label class="ue-f"><span>${p.label}</span>
    <input type="range" min="${p.min}" max="${p.max}" ${step} value="${cur === '' ? (p.min + p.max) / 2 : cur}" data-ue-k="${p.k}">
    <input type="number" ${step} value="${cur}" placeholder="—" data-ue-k="${p.k}">${clr}</label>`;
}
function ueSpecial(p, o, el) {
  if (p.special === 'text') {
    const leaf = !el.children.length && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && !(el instanceof SVGElement);
    return leaf ? `<label class="ue-f ue-col"><span>文言</span><textarea data-ue-k="text" rows="2">${esc(o.text != null ? o.text : el.textContent)}</textarea></label>`
      : '<p class="ue-hint">文言は、中に別の部品がない一番内側の部品で変えられます（「内側へ」で選び直してください）。</p>';
  }
  if (p.special === 'img') {
    const isImg = el.tagName === 'IMG';
    return `<div class="ue-f ue-col"><span>${isImg ? '画像（差しかえ）' : '背景の画像'}</span>
      ${o.img ? `<div class="ue-thumb" style="background-image:url('${esc(String(o.img).replace(/'/g, ''))}')"></div>` : ''}
      <div class="ue-row"><label class="ue-b">画像を選ぶ<input type="file" accept="image/*" id="ue-img-file" hidden></label>
      <button type="button" class="ue-b" data-ue-clear="img,tag" ${o.img ? '' : 'disabled'}>画像を外す</button></div>
      <input type="url" class="ue-search" data-ue-k="img" placeholder="または画像のURLを貼る" value="${o.img && !String(o.img).startsWith('data:') ? esc(o.img) : ''}"></div>`;
  }
  if (p.special === 'pos') {
    return `<label class="ue-f ue-pos"><span>位置（横・縦）</span>
      <input type="number" data-ue-k="x" value="${o.x || 0}"><input type="number" data-ue-k="y" value="${o.y || 0}">
      <button type="button" class="ue-x" data-ue-clear="x,y,tb" ${o.x || o.y ? '' : 'disabled'} aria-label="位置を元に戻す">↺</button></label>
      <p class="ue-hint">選んだ部品はドラッグで動かせます。右下の四角をドラッグすると大きさを変えられます。</p>`;
  }
  if (p.special === 'hide') return `<label class="ue-f ue-chk"><input type="checkbox" data-ue-k="hide" ${o.hide ? 'checked' : ''}> この部品を隠す</label>`;
  return '';
}
function ueRenderBody() {
  const body = $('ue-body'); if (!body) return;
  ueRenderFoot();
  if (UE.tab === 'roles') {
    const f = document.activeElement && document.activeElement.id === 'ue-user-q', pos = f ? document.activeElement.selectionStart : 0;
    body.innerHTML = ueRolesHtml();
    if (f) { const i = $('ue-user-q'); i.focus(); i.setSelectionRange(pos, pos); }
    return;
  }
  if (UE.tab === 'drafts') { body.innerHTML = ueDraftsHtml(); return; }
  if (UE.pause) { body.innerHTML = '<p class="ue-hint">いまはアプリを普通に操作できます。編集したい画面（ウィンドウなど）を開いてから「部品を選ぶ」を押してください。</p>'; return; }
  const el = UE.el;
  if (!el || !el.isConnected) {
    body.innerHTML = `<p class="ue-hint">画面の中の部品を押すと、ここで文字・色・画像・形を変えられます。<br>選んだ部品はドラッグで動かせます。<br>Escキーで選ぶのをやめます。</p>
      ${ueIsMaster() ? '' : '<p class="ue-hint">編集者は「仮保存」までできます。みんなの画面に出すのはマスターです。</p>'}`;
    return;
  }
  const o = UE.data.items[UE.sel] || {}, cs = getComputedStyle(el);
  const scroll = body.scrollTop;
  body.innerHTML = `
    <div class="ue-sel"><b>${esc(ueLabel(el))}</b><small>${esc(el.tagName.toLowerCase())}</small>
      <span class="ue-nav"><button type="button" class="ue-b" id="ue-parent" ${el.parentElement && el.parentElement !== document.body ? '' : 'disabled'}>外側へ</button><button type="button" class="ue-b" id="ue-child" ${el.firstElementChild && !(el instanceof SVGElement) ? '' : 'disabled'}>内側へ</button></span></div>
    ${UE_SECS.map(([name, rows]) => `<details class="ue-sec" data-ue-sec="${name}" ${UE.secOpen[name] ? 'open' : ''}><summary>${name}${rows.some(p => ueHas(o, p.k) || (p.k === 'pos' && (o.x || o.y))) ? ' <i class="ue-dot">●</i>' : ''}</summary>
      ${rows.map(p => p.special ? ueSpecial(p, o, el) : ueField(p, o, cs)).join('')}</details>`).join('')}
    <button type="button" class="ue-b danger wide" id="ue-reset" ${UE.data.items[UE.sel] ? '' : 'disabled'}>この部品を元に戻す</button>`;
  body.scrollTop = scroll;
}
function ueSet(k, v) {
  if (!UE.sel) return;
  const o = UE.data.items[UE.sel] = UE.data.items[UE.sel] || {};
  o.label = o.label || ueLabel(UE.el);
  if (v === '' || v == null || v === false) delete o[k]; else o[k] = v;
  if (Object.keys(o).every(x => x === 'label')) delete UE.data.items[UE.sel];
  ueSave(); ueRenderFoot();
}
const ueBaseTranslate = el => { const st = $('ue-style'); st.disabled = true; const t = getComputedStyle(el).translate || 'none'; st.disabled = false; return t; };
function ueSelect(el) {
  if (!el || el === document.body || el === document.documentElement) return;
  UE.el?.classList.remove('ue-picked');
  UE.el = el; UE.sel = ueSelector(el);
  el.classList.add('ue-picked');
  if (ueMobile() && UE.sheet === 'min') ueSheet('half');
  ueRenderBody(); uePlaceBox();
  ueReveal(el);
}
const ueMobile = () => matchMedia('(max-width: 720px)').matches;
function ueSheet(k) {
  UE.sheet = k;
  const p = $('ue-panel'); if (p) p.dataset.sheet = k;
  setTimeout(() => { if (UE.el) ueReveal(UE.el); uePlaceBox(); }, 220);
}
/* 選んだ部品がパネルの下に隠れていたら、見える位置までスクロールする */
function ueReveal(el) {
  const p = $('ue-panel'); if (!p || !ueMobile() || !el.isConnected) return;
  const top = p.getBoundingClientRect().top, r = el.getBoundingClientRect();
  if (r.bottom > top - 8) {
    const sc = (function find(n) { for (; n && n !== document.body; n = n.parentElement) { const st = getComputedStyle(n); if (/(auto|scroll)/.test(st.overflowY) && n.scrollHeight > n.clientHeight) return n; } return null; })(el.parentElement);
    const dy = r.bottom - top + 24;
    if (sc) sc.scrollBy({ top: dy, behavior: 'smooth' }); else window.scrollBy({ top: dy, behavior: 'smooth' });
    setTimeout(uePlaceBox, 400);
  }
}
function uePlaceBox() {
  const box = $('ue-box'); if (!box) return;
  const el = UE.el;
  if (!UE.on || ueNoPick() || !el || !el.isConnected) { box.hidden = true; return; }
  const r = el.getBoundingClientRect();
  box.hidden = false;
  Object.assign(box.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
}
function ueHover(el) {
  const h = $('ue-hover'); if (!h) return;
  if (!el || ueNoPick()) { h.hidden = true; return; }
  const r = el.getBoundingClientRect();
  h.hidden = false;
  Object.assign(h.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
}

/* ===== マウス・指の操作 ===== */
const ueInPanel = t => t && t.closest && t.closest('#ue-panel');
function ueOnPointerDown(e) {
  if (!UE.on || ueNoPick() || ueInPanel(e.target)) return;
  e.preventDefault(); e.stopPropagation();
  if (e.button !== 0 || !UE.el) return;
  const o = UE.data.items[UE.sel] || {};
  if (e.target.id === 'ue-handle') {
    const r = UE.el.getBoundingClientRect();
    UE.drag = { resize: true, sx: e.clientX, sy: e.clientY, w0: ueHas(o, 'w') ? o.w : Math.round(r.width), h0: ueHas(o, 'h') ? o.h : Math.round(r.height), moved: false };
  } else if (UE.el.contains(e.target)) {
    UE.drag = { sx: e.clientX, sy: e.clientY, x0: o.x || 0, y0: o.y || 0, moved: false };
  }
}
function ueOnPointerMove(e) {
  if (!UE.on || ueNoPick()) return;
  if (UE.drag) {
    const d = UE.drag, dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    const o = UE.data.items[UE.sel] = UE.data.items[UE.sel] || { label: ueLabel(UE.el) };
    if (!d.moved) { d.moved = true; if (!d.resize && o.tb == null) o.tb = ueBaseTranslate(UE.el); }
    if (d.resize) { o.w = Math.max(4, Math.round(d.w0 + dx)); o.h = Math.max(4, Math.round(d.h0 + dy)); }
    else { o.x = Math.round(d.x0 + dx); o.y = Math.round(d.y0 + dy); }
    $('ue-style').textContent = ueCss(); uePlaceBox();
    return;
  }
  if (!ueInPanel(e.target) && e.target.id !== 'ue-handle') ueHover(e.target); else ueHover(null);
}
function ueOnPointerUp(e) {
  if (!UE.drag) return;
  const moved = UE.drag.moved; UE.drag = null;
  if (moved) { UE.noClick = true; ueSave(); ueRenderBody(); e.stopPropagation(); }
}
function ueOnClick(e) {
  if (!UE.on || ueNoPick() || ueInPanel(e.target)) return;
  e.preventDefault(); e.stopPropagation();
  if (UE.noClick) { UE.noClick = false; return; }
  if (e.target.id === 'ue-handle') return;
  let t = e.target;
  if (t.closest('#toast')) { $('toast').hidden = true; t = document.elementFromPoint(e.clientX, e.clientY) || t; }
  ueSelect(t.ownerSVGElement ? t.closest('svg') : t);
}
const ueBlock = e => { if (UE.on && !ueNoPick() && !ueInPanel(e.target)) { e.preventDefault(); e.stopPropagation(); } };

function ueStart() {
  if (UE.on) return;
  if (!UE.admin) { toast('画面の編集は、マスターか編集者としてログインしているときだけ使えます'); return; }
  closeModals();
  UE.on = true; UE.pause = false; UE.tab = 'look';
  document.body.classList.add('ue-on');
  const p = document.createElement('aside');
  p.id = 'ue-panel'; p.className = 'ue-panel'; p.setAttribute('aria-label', '画面の編集'); p.dataset.sheet = UE.sheet;
  p.innerHTML = uePanelHtml();
  document.body.appendChild(p);
  ['ue-box', 'ue-hover'].forEach(id => { const b = document.createElement('div'); b.id = id; b.className = id; b.hidden = true; document.body.appendChild(b); });
  const h = document.createElement('span'); h.id = 'ue-handle'; h.title = 'ドラッグで大きさを変える'; $('ue-box').appendChild(h);
  ueRenderBody(); ueApply();
  if (!ueIsMaster()) ueLoadMyDraft();
}
function ueStop() {
  UE.el?.classList.remove('ue-picked');
  UE.on = false; UE.el = null; UE.sel = null; UE.drag = null;
  document.body.classList.remove('ue-on');
  ['ue-panel', 'ue-box', 'ue-hover'].forEach(id => $(id)?.remove());
  ueApply();
  if (!ueSame(UE.data, UE.pub)) toast(ueIsMaster() ? '未公開の変更は下書きとして残っています。みんなの画面には公開した分だけが出ます。' : '編集内容は下書きとして残っています。みんなの画面に出るのは、マスターが公開したときです。');
}

document.addEventListener('pointerdown', ueOnPointerDown, true);
document.addEventListener('pointermove', ueOnPointerMove, true);
document.addEventListener('pointerup', ueOnPointerUp, true);
document.addEventListener('click', ueOnClick, true);
['mousedown', 'mouseup', 'dblclick', 'contextmenu', 'submit'].forEach(t => document.addEventListener(t, ueBlock, true));
addEventListener('scroll', () => { if (UE.on) uePlaceBox(); }, true);
addEventListener('resize', () => { if (UE.on) uePlaceBox(); });
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.shiftKey && (e.key === 'E' || e.key === 'e') && UE.admin) { e.preventDefault(); UE.on ? ueStop() : ueStart(); return; }
  if (UE.on && e.key === 'Escape' && !ueInPanel(e.target)) {
    e.stopPropagation();
    if (UE.el) { UE.el.classList.remove('ue-picked'); UE.el = null; UE.sel = null; ueRenderBody(); uePlaceBox(); } else ueStop();
  }
}, true);
/* スマホ：つまみを押すと 小→中→大 と切りかえ、上下にドラッグしても変えられる */
let ueGrip = null;
document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('#ue-grip')) ueGrip = { y: e.clientY, moved: false }; }, true);
document.addEventListener('pointermove', e => {
  if (!ueGrip) return;
  const dy = e.clientY - ueGrip.y; if (Math.abs(dy) < 30) return;
  const order = ['min', 'half', 'full'], i = order.indexOf(UE.sheet);
  const j = Math.max(0, Math.min(2, i + (dy < 0 ? 1 : -1)));
  ueGrip = { y: e.clientY, moved: true };
  if (j !== i) ueSheet(order[j]);
}, true);
document.addEventListener('pointerup', e => {
  if (!ueGrip) return;
  const g = ueGrip; ueGrip = null;
  if (!g.moved) ueSheet({ min: 'half', half: 'full', full: 'min' }[UE.sheet]);
}, true);
document.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.ueSec) UE.secOpen[d.dataset.ueSec] = d.open; }, true);

/* ===== パネルの中の操作 ===== */
function ueInput(e) {
  const t = e.target, k = t.dataset && t.dataset.ueK; if (!k || !ueInPanel(t)) return;
  let v;
  if (t.type === 'checkbox') v = t.checked;
  else if (t.type === 'range' || t.type === 'number') {
    v = t.value === '' ? '' : Number(t.value);
    t.closest('.ue-f').querySelectorAll(`[data-ue-k="${k}"]`).forEach(x => { if (x !== t) x.value = t.value; });
    if ((k === 'x' || k === 'y') && UE.data.items[UE.sel]?.tb == null) ueSet('tb', ueBaseTranslate(UE.el));
  } else v = t.value;
  if (k === 'text' && v === UE.el.textContent && UE.data.items[UE.sel]?.text == null) return;
  if (k === 'img') { v = v.trim(); if (v && !/^https?:\/\//.test(v)) return; ueSet('tag', v && UE.el.tagName === 'IMG' ? 'img' : ''); }
  ueSet(k, v);
  const clr = t.closest('.ue-f')?.querySelector('.ue-x'); if (clr) clr.disabled = !ueHas(UE.data.items[UE.sel] || {}, k);
  const rs = $('ue-reset'); if (rs) rs.disabled = !UE.data.items[UE.sel];
  if (k === 'img' || k === 'fit') ueRenderBody();
}
document.addEventListener('input', e => {
  if (!ueInPanel(e.target)) return;
  if (e.target.id === 'ue-user-q') { UE.userQ = e.target.value; ueRenderBody(); return; }
  if (e.target.type === 'file' || e.target.tagName === 'SELECT' && e.target.dataset.ueRole) return;
  if (e.target.type === 'url') return; // URL は貼り終わってから（change）
  ueInput(e);
});
document.addEventListener('change', async e => {
  const t = e.target; if (!ueInPanel(t)) return;
  if (t.dataset.ueRole) return ueSetRole(t);
  if (t.type === 'checkbox' || t.type === 'url') return ueInput(e);
  if (t.id === 'ue-img-file' && t.files[0]) {
    const el = UE.el, s = UE.sel;
    toast('画像を読み込んでいます…');
    try {
      const url = await ueUpload(t.files[0]);
      if (UE.sel !== s) return;
      ueSet('tag', el.tagName === 'IMG' ? 'img' : '');
      ueSet('img', url);
      ueRenderBody(); toast('画像を設定しました');
    } catch (err) { toast(err.message || '画像を読み込めませんでした'); }
  }
});
function ueArm(b, label, fn) {
  if (b.dataset.armed) { delete b.dataset.armed; b.textContent = label; fn(); return; }
  b.dataset.armed = '1'; b.textContent = 'もう一度押すと実行します';
  setTimeout(() => { if (b.isConnected && b.dataset.armed) { delete b.dataset.armed; b.textContent = label; } }, 3000);
}
document.addEventListener('click', e => {
  const t = e.target; if (!ueInPanel(t)) return;
  const b = t.closest('button'); if (!b) return;
  if (b.id === 'ue-exit') return ueStop();
  if (b.dataset.ueTab) {
    UE.tab = b.dataset.ueTab; ueHover(null); uePlaceBox();
    if (UE.tab === 'roles') ueLoadUsers(); else if (UE.tab === 'drafts') ueLoadDrafts(); else ueRenderBody();
    return;
  }
  if (b.id === 'ue-pause') { UE.pause = !UE.pause; ueHover(null); ueRenderBody(); uePlaceBox(); return; }
  if (b.id === 'ue-parent') return ueSelect(UE.el.parentElement);
  if (b.id === 'ue-child') return ueSelect(UE.el.firstElementChild);
  if (b.id === 'ue-publish') return uePublish();
  if (b.id === 'ue-draft-save') return ueSaveDraft();
  if (b.id === 'ue-discard') return ueArm(b, '公開中の状態に戻す', () => { UE.data = ueClone(UE.pub); ueSave(); ueRenderBody(); toast('公開中の状態に戻しました（文言や画像は画面を開き直すと戻ります）'); });
  if (b.dataset.ueDload != null) {
    const d = UE.drafts[+b.dataset.ueDload]; if (!d) return;
    const go = () => { UE.data = ueClone(d.data && d.data.items ? d.data : UE_EMPTY()); ueSave(); UE.tab = 'look'; ueRenderBody(); toast(`${d.name}さんの仮保存を読み込みました。よければ「みんなに公開」を押してください。`); };
    return ueSame(UE.data, UE.pub) ? go() : ueArm(b, '読み込んで見る', go);
  }
  if (b.dataset.ueDdel != null) {
    const d = UE.drafts[+b.dataset.ueDdel]; if (!d) return;
    return ueArm(b, '削除', async () => {
      const { error } = await sb.from('ui_drafts').delete().eq('user_id', d.user_id);
      if (error) toast(jaErr(error)); else { toast('仮保存を削除しました'); ueLoadDrafts(); }
    });
  }
  if (b.id === 'ue-reset') {
    const o = UE.data.items[UE.sel];
    if (o && ueNeedsDom(o)) toast('文言や画像は、画面を開き直すと元に戻ります');
    delete UE.data.items[UE.sel]; ueSave(); ueRenderBody(); return;
  }
  if (b.dataset.ueClear) {
    const o = UE.data.items[UE.sel]; if (!o) return;
    b.dataset.ueClear.split(',').forEach(k => delete o[k]);
    if (Object.keys(o).every(x => x === 'label')) delete UE.data.items[UE.sel];
    ueSave(); ueRenderBody(); return;
  }
  if (b.dataset.ueSel) {
    const el = ueFind(b.dataset.ueSel);
    if (!el) { toast('その部品はいまの画面にありません（別の画面やウィンドウの中かもしれません）'); return; }
    UE.pause = false; UE.tab = 'look'; ueSelect(el); el.scrollIntoView({ block: 'nearest' }); return;
  }
  if (b.id === 'ue-reset-all') {
    if (!Object.keys(UE.data.items).length) return;
    return ueArm(b, 'すべて元に戻す', () => { UE.data.items = {}; ueSave(); ueRenderBody(); toast('すべて元に戻しました（文言や画像は画面を開き直すと戻ります）'); });
  }
  if (b.id === 'ue-export') {
    const txt = JSON.stringify(UE.data, null, 1);
    navigator.clipboard.writeText(txt).then(() => toast('編集内容をコピーしました（予備の保存や、Claudeにコードへ組み込んでもらうときに使えます）'),
      () => { const io = $('ue-io'); io.hidden = false; io.value = txt; io.select(); toast('自動でコピーできなかったので、下の文字を選んでコピーしてください'); });
    return;
  }
  if (b.id === 'ue-import') { const io = $('ue-io'); io.hidden = !io.hidden; io.value = ''; $('ue-io-go').hidden = io.hidden; io.focus(); return; }
  if (b.id === 'ue-io-go') {
    try {
      const s = JSON.parse($('ue-io').value);
      if (!s || typeof s.items !== 'object') throw 0;
      UE.data = { v: 1, items: s.items }; ueSave(); ueRenderBody();
      $('ue-io').hidden = true; b.hidden = true; toast('読み込みました');
    } catch (err) { toast('読み込めませんでした。書き出した内容をそのまま貼ってください。'); }
  }
});

$('ue-open')?.addEventListener('click', ueStart);
ueLoad();
uePull();
