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

/* 1人が持てる探索者は最大 50 人（見本は数えない） */
const MAX_CHARS = 50;
const charCount = () => state.chars.filter(c => !c.sample).length;
const charRoom = () => Math.max(0, MAX_CHARS - charCount());
function canAddChar(n = 1) {
  if (charRoom() >= n) return true;
  toast(`探索者は${MAX_CHARS}人までです。いらない探索者を削除してから作ってください。`);
  return false;
}
