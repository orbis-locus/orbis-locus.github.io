/* ================= データ ================= */
let state = { chars: [], activeId: null, paletteAll: false };

function makeSkill(def) {
  const [cat, raw, init] = def;
  const hasSub = raw.endsWith('（）');
  return { cat, name: hasSub ? raw.slice(0, -2) : raw, hasSub, sub: '', init, job: '', hobby: '', grow: '', other: '', isJob: false, custom: false };
}

function blank(system) {
  const S = SYS[system];
  const c = {
    v: 2, id: uid(), system,
    profile: { name: '', kana: '', player: '', occupation: '', age: '', birthday: '', sex: '', height: '', weight: '', origin: '', hair: '', eyes: '', skin: '', tags: '', iconUrl: '', externalUrl: '', color: '#1f7cf2' },
    abilities: {}, hp: '', mp: '', san: '',
    jobFormula: 'EDU4',
    skills: S.skills.map(makeSkill),
    weapons: JSON.parse(JSON.stringify(S.weapons)),
    items: [{ name: '', count: '', price: '', note: '' }],
    money: { cash: '', deposit: '', assets: '', income: '' },
    tomes: '', entities: '',
    backstory: '', secret: '', memo: '', scenarios: [],
    extra: '', updatedAt: Date.now(),
  };
  S.abil.forEach(([k]) => { c.abilities[k] = { base: '', adj: '', tmp: '' }; });
  return c;
}

function sample() {
  const c = blank('coc6');
  Object.assign(c.profile, {
    name: '久遠寺 灯', kana: 'くおんじ あかり', occupation: '古書店主', age: '28', sex: '女', height: '162cm', weight: '50kg',
    origin: '東京都', hair: '黒', eyes: '茶', skin: '色白', tags: '古書 / 眼鏡', color: '#7b52bd',
  });
  const base = { STR: 10, CON: 11, POW: 12, DEX: 13, APP: 10, SIZ: 11, INT: 13, EDU: 14 };
  Object.entries(base).forEach(([k, v]) => { c.abilities[k].base = String(v); });
  const job = { '図書館': 60, '目星': 45, 'オカルト': 45, 'ほかの言語': 40, '心理学': 40, '歴史': 50 };
  const hobby = { '聞き耳': 30, '応急手当': 30, '隠れる': 30, '写真術': 40 };
  c.skills.forEach(s => {
    if (job[s.name] != null) { s.job = String(job[s.name]); s.isJob = true; }
    if (hobby[s.name] != null) s.hobby = String(hobby[s.name]);
    if (s.name === 'ほかの言語') s.sub = 'ラテン語';
    if (s.name === '母国語') s.sub = '日本語';
  });
  c.items = [{ name: '懐中電灯', count: '1', price: '', note: '' }, { name: 'ルーペ', count: '1', price: '', note: '祖父の形見' }, { name: '手帳と万年筆', count: '1', price: '', note: '' }];
  c.money = { cash: '3万円', deposit: '120万円', assets: '古書店「灯台堂」', income: '月20万円' };
  c.backstory = '古書店「灯台堂」の二代目店主。祖父の遺した蔵書目録に、存在しないはずの一冊が載っていた。';
  c.memo = '※ これはサンプルです。自由に書き換えるか削除してください。';
  c.sample = true;
  return c;
}

/* v1（汎用シート）からの移行 */
function migrateV1(o) {
  const sys = o.preset === 'coc7' ? 'coc7' : 'coc6';
  const c = blank(sys);
  Object.assign(c.profile, { name: o.name || '', kana: o.kana || '', player: o.player || '', iconUrl: o.iconUrl || '', externalUrl: o.externalUrl || '', color: o.color || '#1f7cf2' });
  (o.params || []).forEach(p => { if (c.abilities[p.label]) c.abilities[p.label].base = String(p.value ?? ''); });
  const a = abilities(c);
  (o.skills || []).forEach(s => {
    const t = c.skills.find(x => skillLabel(x) === s.name || x.name === s.name);
    if (t) { const d = num(s.value) - skillInit(t, a); if (d) t.other = String(d); }
    else if (s.name) c.skills.push({ cat: 'k', name: s.name, hasSub: false, sub: '', init: String(num(s.value)), job: '', hobby: '', grow: '', other: '', isJob: false, custom: true });
  });
  c.memo = o.memo || ''; c.extra = o.extra || '';
  return c;
}

/* ---- 無料版（サンプル版）の制限（2026-11-11 決定） ----
   ・テーマは ORBiS だけ　・探索者は3人まで　・グループは鍵の表示（有料版で出す）　・フレンドのキャラシを見るのも鍵（2026-11-11 追加）
   ・ログイン・フレンド（申請・一覧）・クラウド保存・共有リンクは無料のまま
   ・マスターと編集者（app_admins の人）は全部使える（28-ui-editor.js の ueCheckAdmin で unlockAll を立てる）
   有料版を出すときは FREE_EDITION を false にする（この制限は画面の側だけ） */
const FREE_EDITION = true;
/* 検証版（https://orbis-locus.github.io/staging/）のとき true。`python3 build.py staging` が書きかえる（ここは false のまま）。
   検証版は、この端末の中の保存場所（orbis-stg.〜）とログインの保存場所を本番と分ける。サーバー（Supabase）は本番と同じ */
const STAGING = false;
const FREE_MAX_CHARS = 3;
const FREE_THEMES = ['orbis'];
let unlockAll = (() => { try { return localStorage.getItem('charasheet-kobo.unlock') === '1'; } catch (e) { return false; } })();
const isFree = () => FREE_EDITION && !unlockAll;
const LOCK_SVG = '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>';

/* 1人が持てる探索者は最大 50 人（無料版は3人。見本は数えない） */
const MAX_CHARS = 50;
const maxChars = () => isFree() ? FREE_MAX_CHARS : MAX_CHARS;
const charCount = () => state.chars.filter(c => !c.sample).length;
const charRoom = () => Math.max(0, maxChars() - charCount());
function canAddChar(n = 1) {
  if (charRoom() >= n) return true;
  if (isFree()) { lockDialog('chars'); return false; }
  toast(`探索者は${MAX_CHARS}人までです。いらない探索者を削除してから作ってください。`);
  return false;
}
