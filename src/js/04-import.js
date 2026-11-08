/* ================= いあきゃら・ココフォリア・テキストからの取り込み ================= */
const ABIL_KEYS = ['STR', 'CON', 'POW', 'DEX', 'APP', 'SIZ', 'INT', 'EDU'];
const SKIP_SKILL = /^(SANチェック|SAN値チェック|正気度ロール|正気度チェック|SAN|アイデア|幸運|知識|.*ダメージ.*|(STR|CON|POW|DEX|APP|SIZ|INT|EDU)([×x*✕]\d*)?)$/i;
const normName = t => String(t || '').replace(/\(/g, '（').replace(/\)/g, '）').replace(/[\s　]+/g, '').trim();
const toHalf = t => String(t || '').replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));

function pickField(text, keys) {
  for (const k of keys) {
    const m = text.match(new RegExp(`(?:^|[\\s/／|｜、,【\\[])${k}\\s*[:：]\\s*([^\\n/／|｜,、】\\]]+)`));
    if (m && m[1].trim()) return m[1].split(/[\s　]+[^\s　:：]{1,8}[:：]/)[0].trim();
  }
  return '';
}
function parseProfile(text) {
  return {
    occupation: pickField(text, ['職業']),
    age: pickField(text, ['年齢']).replace(/歳$/, ''),
    birthday: pickField(text, ['誕生日', '生年月日']),
    sex: pickField(text, ['性別']),
    height: pickField(text, ['身長']),
    weight: pickField(text, ['体重']),
    origin: pickField(text, ['出身地', '出身']),
    hair: pickField(text, ['髪の色', '髪色', '髪']),
    eyes: pickField(text, ['瞳の色', '目の色', '瞳色', '瞳']),
    skin: pickField(text, ['肌の色', '肌色', '肌']),
  };
}
function parseSkillLines(text) {
  const out = [];
  const t = toHalf(text);
  const re1 = /(?:CCB?|CC\(-?\d+\)|1D100|1d100)\s*<=\s*(\d+)\s*(?:[【\[「『〈《]([^】\]」』〉》\n]+)[】\]」』〉》]|[ \t]+([^\s【\[]+))/gi;
  for (const m of t.matchAll(re1)) out.push({ name: (m[2] || m[3] || '').trim(), value: +m[1] });
  const re2 = /[《〈]([^》〉\n]+)[》〉]\s*(\d+)\s*[%％]?/g;
  for (const m of t.matchAll(re2)) out.push({ name: m[1].trim(), value: +m[2] });
  return out;
}
function detectSystem(text, params) {
  if (/CCB\s*<=/i.test(text)) return 'coc6';
  if (/\bCC(\(-?\d+\))?\s*<=/i.test(text)) return 'coc7';
  return (params.STR != null && params.STR > 20) || (params.EDU != null && params.EDU > 25) ? 'coc7' : 'coc6';
}

function buildImported(src) {
  const sys = src.system || detectSystem(src.allText || '', src.params);
  const c = blank(sys);
  Object.assign(c.profile, Object.fromEntries(Object.entries(src.profile || {}).filter(([, v]) => v)));
  if (src.name) c.profile.name = src.name;
  if (src.kana) c.profile.kana = src.kana;
  if (src.color && /^#[0-9a-f]{6}$/i.test(src.color)) c.profile.color = src.color;
  if (src.iconUrl) c.profile.iconUrl = src.iconUrl;
  if (src.externalUrl) c.profile.externalUrl = src.externalUrl;
  ABIL_KEYS.forEach(k => { if (src.params[k] != null) c.abilities[k].base = String(src.params[k]); });
  if (sys === 'coc7' && src.luck != null) c.abilities.LUCK.base = String(src.luck);
  const st = src.status || {};
  if (st.HP != null) c.hp = String(st.HP);
  if (st.MP != null) c.mp = String(st.MP);
  if (st.SAN != null) c.san = String(st.SAN);
  const a = abilities(c);
  let matched = 0, added = 0;
  const seen = new Set();
  (src.skills || []).forEach(({ name, value }) => {
    const n = normName(name);
    if (!n || SKIP_SKILL.test(n) || seen.has(n) || !isFinite(value)) return;
    seen.add(n);
    let t = c.skills.find(s => normName(skillLabel(s)) === n);
    if (!t) {
      const m = n.match(/^(.+?)（(.+)）$/);
      const base = m && c.skills.find(s => s.hasSub && normName(s.name) === m[1]);
      if (base) {
        if (!base.sub) { base.sub = m[2]; t = base; }
        else { t = { ...base, sub: m[2], job: '', hobby: '', grow: '', other: '', isJob: false, dup: true }; c.skills.splice(c.skills.indexOf(base) + 1, 0, t); }
      }
    }
    if (!t) t = c.skills.find(s => !s.hasSub && normName(s.name).replace(/（.*）$/, '') === n);
    if (t) {
      const diff = value - skillInit(t, a);
      t.other = diff ? String(diff) : '';
      matched++;
    } else {
      c.skills.push({ cat: 'k', name: String(name).trim(), hasSub: false, sub: '', init: String(value), job: '', hobby: '', grow: '', other: '', isJob: false, custom: true });
      added++;
    }
  });
  c.memo = src.memo || '';
  c.extra = src.extra || '';
  c.importInfo = { matched, added };
  return c;
}

/* ココフォリアのコマデータ（いあきゃらの「ココフォリア」出力もこの形） */
function fromCcfolia(obj) {
  const d = obj.data || {};
  const params = {}, status = {};
  (d.params || []).forEach(p => { const k = String(p.label || '').toUpperCase(); const v = Number(toHalf(p.value)); if (ABIL_KEYS.includes(k) && isFinite(v)) params[k] = v; });
  let luck = null;
  (d.status || []).forEach(x => {
    const l = String(x.label || '').toUpperCase();
    const v = Number(x.value);
    if (!isFinite(v)) return;
    if (l === 'HP' || l === '耐久力') status.HP = v;
    else if (l === 'MP' || l === 'マジックポイント') status.MP = v;
    else if (l === 'SAN' || l === '正気度') status.SAN = v;
    else if (l === '幸運' || l === 'LUCK' || l === 'LUC') luck = v;
  });
  const commands = String(d.commands || '');
  const memo = String(d.memo || '');
  const extra = commands.split('\n').map(x => x.trim()).filter(x => x && !/<=/.test(x) && !/^[\/／]/.test(x)).join('\n');
  const kana = (memo.match(/^[\s]*([ぁ-んァ-ヶー・\s]+)\s*$/m) || [])[1] || pickField(memo, ['読み', 'ふりがな', 'フリガナ']);
  let name = d.name || '', kana2 = kana.trim();
  const nk = name.match(/^(.+?)\s*[(（]([^()（）]+)[)）]\s*$/);
  if (nk && /^[ぁ-んァ-ヶー・\s]+$/.test(nk[2])) { name = nk[1].trim(); kana2 = kana2 || nk[2].trim(); }
  return buildImported({
    name, kana: kana2, color: d.color, iconUrl: d.iconUrl || '', externalUrl: d.externalUrl || '',
    params, status, luck, skills: parseSkillLines(commands), profile: parseProfile(memo),
    memo, extra, allText: commands + '\n' + d.params?.map(p => `${p.label} ${p.value}`).join('\n'),
  });
}

/* テキスト（いあきゃらのテキスト出力・チャットパレット・キャラクター保管所形式など） */
function fromText(text) {
  const t = toHalf(text);
  const params = {};
  ABIL_KEYS.forEach(k => { const m = t.match(new RegExp(`(?:^|[^A-Z])${k}\\s*[:：=]?\\s*(\\d+)`, 'i')); if (m) params[k] = +m[1]; });
  const num = re => { const m = t.match(re); return m ? +m[1] : null; };
  const status = { HP: num(/(?:HP|耐久力)\s*[:：=]?\s*(\d+)/i), MP: num(/(?:MP|マジック・?ポイント)\s*[:：=]?\s*(\d+)/i), SAN: num(/(?:現在SAN|SAN値?|正気度)\s*[:：=]?\s*(\d+)/i) };
  Object.keys(status).forEach(k => { if (status[k] == null) delete status[k]; });
  const name = pickField(t, ['キャラクター名', '探索者名', 'PC名', '名前']);
  const skills = parseSkillLines(t);
  const extra = t.split('\n').map(x => x.trim()).filter(x => /^\d*[dD]\d+/.test(x) && !/<=/.test(x)).join('\n');
  if (!name && !Object.keys(params).length && !skills.length) return null;
  return buildImported({
    name, kana: pickField(t, ['ふりがな', 'フリガナ', '読み']), params, status, luck: num(/幸運\s*[:：=]?\s*(\d+)/), skills,
    profile: parseProfile(t), memo: '', extra, allText: t,
  });
}

/* ---------- いあきゃらの「テキスト出力」（いあきゃらテキスト 6版／7版）----------
   いあきゃらのキャラ画面の「テキスト出力」（.txt）には、技能の内訳・武器・所持品・財産・経歴・
   通過シナリオ・メモまで全部入っている。（「ココフォリア駒出力」には合計値しか入っていない） */
const iaWidth = ch => /^[^\x01-\x7E\xA1-\xDF]$/.test(ch) ? 2 : 1; // いあきゃらと同じ数え方（全角は2）
/* 決まった幅で並んだ1行を、列の幅（全角=2で数える）ごとに切り分ける */
function iaCols(line, widths) {
  const out = []; let i = 0;
  for (const w of widths) {
    let acc = 0, cell = '';
    while (i < line.length && acc < w) { cell += line[i]; acc += iaWidth(line[i]); i++; }
    out.push(cell.trim());
  }
  out.push(line.slice(i).trim());
  return out;
}
/* 「[見出し]\n本文」が空行で並ぶ部分を取り出す */
function iaEntries(body) {
  const out = []; let cur = null;
  body.split('\n').forEach(l => {
    const m = l.match(/^\[(.*)\]\s*$/);
    if (m) { cur = { name: m[1], lines: [] }; out.push(cur); }
    else if (cur) cur.lines.push(l);
    else if (l.trim()) { cur = { name: '', lines: [l] }; out.push(cur); }
  });
  return out.map(e => ({ name: e.name.trim(), value: e.lines.join('\n').trim() }));
}
function fromIachara(text) {
  const t = String(text).replace(/\r\n?/g, '\n');
  const head = t.match(/いあきゃらテキスト\s*([67])版/);
  if (!head) return null;
  const sys = head[1] === '7' ? 'coc7' : 'coc6';
  const c = blank(sys);
  // 【見出し】ごとに分ける
  const sec = {}; let cur = '_';
  t.split('\n').forEach(l => {
    const m = l.match(/^【(.+?)】\s*$/);
    if (m) { cur = m[1]; sec[cur] = []; } else (sec[cur] = sec[cur] || []).push(l);
  });
  const body = k => (sec[k] || []).join('\n');
  const field = (src, label) => { const m = src.match(new RegExp(`(?:^|\\n|/ )${label}:[ \\t]*([^\\n/]*?)\\s*(?=$|\\n| / )`)); return m ? m[1].trim() : ''; };
  const notes = []; // 入れる欄がないものはメモの最後にまとめる

  /* 基本情報 */
  const b = body('基本情報'), P = c.profile;
  const nm = b.match(/名前:[ \t]*(.*?)\s*\((.*)\)\s*$/m) || b.match(/名前:[ \t]*(.*)$/m);
  if (nm) { P.name = (nm[1] || '').trim(); P.kana = (nm[2] || '').trim(); }
  const line = label => ((b.match(new RegExp(`^${label}:[ \\t]*(.*)$`, 'm')) || [])[1] || '').trim();
  P.tags = line('タグ'); P.occupation = line('職業');
  P.age = field(b, '年齢').replace(/歳$/, ''); P.sex = field(b, '性別'); P.height = field(b, '身長');
  P.weight = field(b, '体重'); P.origin = field(b, '出身');
  P.hair = field(b, '髪の色'); P.eyes = field(b, '瞳の色'); P.skin = field(b, '肌の色');
  // 自分で足したプロフィール項目（「名前:値」の行）
  const known = /^(名前|タグ|職業|年齢|体重|髪の色)[:：]/;
  b.split('\n').filter(l => l.trim() && !known.test(l) && /^[^:]{1,30}:/.test(l)).forEach(l => {
    const i = l.indexOf(':'), k = l.slice(0, i).trim(), v = l.slice(i + 1).trim();
    if (!v) return;
    if (/誕生日|生年月日/.test(k) && !P.birthday) P.birthday = v;
    else if (/プレイヤー|PL/.test(k) && !P.player) P.player = v;
    else notes.push(`${k}：${v}`);
  });
  const icon = (body('アイコン').match(/https?:\/\/\S+/) || [])[0];
  if (icon) P.iconUrl = icon;
  const url = t.match(/https:\/\/iachara\.com\/view\/[\w-]+/);
  if (url) P.externalUrl = url[0];

  /* 能力値（現在値・能力値・増加分・一時的） */
  const ab = {};
  body('能力値').split('\n').forEach(l => {
    const m = l.trim().match(/^(\S+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)$/);
    if (m) ab[m[1]] = { sum: +m[2], value: +m[3], fixed: +m[4], tmp: +m[5] };
  });
  ABIL_KEYS.forEach(k => {
    const r = ab[k]; if (!r || !c.abilities[k]) return;
    c.abilities[k].base = String(r.value);
    c.abilities[k].adj = r.fixed ? String(r.fixed) : '';
    c.abilities[k].tmp = r.tmp ? String(r.tmp) : '';
  });
  if (sys === 'coc7' && ab['幸運'] && c.abilities.LUCK) { c.abilities.LUCK.base = String(ab['幸運'].value); if (ab['幸運'].fixed) c.abilities.LUCK.adj = String(ab['幸運'].fixed); }
  if (ab.HP) c.hp = String(ab.HP.sum);
  if (ab.MP) c.mp = String(ab.MP.sum);
  const san = body('能力値').match(/正気度\s+(-?\d+)\s*\/\s*(-?\d+)/);
  if (san) c.san = san[1]; else if (ab['正気度']) c.san = String(ab['正気度'].sum);

  /* 技能値（合計・初期値・職業P・興味P・成長分・その他） */
  const a = abilities(c);
  let matched = 0, added = 0;
  const num = v => v ? String(v) : '';
  body('技能値').split('\n').forEach(l => {
    const m = l.trim().match(/^(.+?)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)$/);
    if (!m || m[1] === '技能名') return;
    const [, rawName, sum, def, job, hobby, grow, other] = m;
    const name = rawName.trim(), n = normName(name);
    const sub = (name.match(/^(.+?)[(（](.*)[)）]$/) || []);
    let t2 = c.skills.find(s => normName(skillLabel(s)) === n && !s._ia);
    if (!t2 && sub[1]) {
      const base = c.skills.find(s => s.hasSub && normName(s.name) === normName(sub[1]) && !s._ia);
      if (base) {
        if (!base.sub) { base.sub = sub[2].trim(); t2 = base; }
        else { t2 = { ...base, sub: sub[2].trim(), job: '', hobby: '', grow: '', other: '', isJob: false, dup: true }; c.skills.splice(c.skills.indexOf(base) + 1, 0, t2); }
      }
    }
    if (!t2) t2 = c.skills.find(s => !s.hasSub && !s._ia && normName(s.name).replace(/（.*）$/, '') === n.replace(/（.*）$/, ''));
    if (t2) {
      t2._ia = true;
      t2.job = num(+job); t2.hobby = num(+hobby); t2.grow = num(+grow); t2.isJob = +job > 0;
      // 初期値がこのアプリの計算とちがうときは、差を「その他」に入れて合計をいあきゃらと同じにする
      const diff = +def - skillInit(t2, a);
      t2.other = num(+other + diff);
      matched++;
    } else {
      c.skills.push({ cat: 'k', name, hasSub: false, sub: '', init: String(def), job: num(+job), hobby: num(+hobby), grow: num(+grow), other: num(+other), isJob: +job > 0, custom: true, _ia: true });
      added++;
    }
  });
  c.skills.forEach(s => { delete s._ia; });

  /* 武器（名前20・成功率〜故障は14ずつ・最後にその他） */
  const wl = body('武器').split('\n').filter(l => l.trim());
  const weapons = wl.filter(l => !/^名前\s/.test(l.trim())).map(l => {
    const [name, rate, damage, range, attacks, ammo, durability, broken, note] = iaCols(l, [20, 14, 14, 14, 14, 14, 14, 14]);
    return { name, rate, damage, range, attacks, ammo, durability, note: [broken && broken !== '-' ? '故障 ' + broken : '', note].filter(Boolean).join(' / ') };
  }).filter(w => w.name);
  if (weapons.length) c.weapons = weapons;

  /* 装備と所持品（名称20・単価・個数・価格は14ずつ・最後に備考） */
  const il = (body('装備と所持品') || body('冒険の装備とその他の所持品')).split('\n').filter(l => l.trim());  // 7版／6版で見出しがちがう
  const items = il.filter(l => !/^名称\s/.test(l.trim())).map(l => {
    const [name, unit, count, price, note] = iaCols(l, [20, 14, 14, 14]);
    return { name, count, price: price || unit, note };
  }).filter(x => x.name);
  if (items.length) c.items = items;

  /* 収入と財産 */
  const money = {}, rest = [];
  body('収入と財産').split('\n').forEach(l => {
    const i = l.indexOf(':'); if (i < 0) return;
    const k = l.slice(0, i).trim(), v = l.slice(i + 1).trim(); if (!v) return;
    if (k === '収入') money.income = v;
    else if (k === '支出レベル') money.income = '支出レベル：' + v;
    else if (k === '手持ち現金' || k === '現金') money.cash = v;
    else if (k === '預金') money.deposit = v;
    else if (k === '個人資産' || k === '資産') money.assets = v;
    else rest.push(`${k}：${v}`);
  });
  if (rest.length) money.assets = [money.assets, ...rest].filter(Boolean).join(' / ');
  Object.assign(c.money, money);

  /* バックストーリー：魔導書・遭遇した存在は専用の欄へ、ほかは経歴にまとめる */
  const story = [];
  iaEntries(body('バックストーリー')).forEach(({ name, value }) => {
    if (!value) return;
    const label = name.replace(/^★/, '');
    if (/魔導書|呪文|アーティファクト/.test(label)) c.tomes = [c.tomes, value].filter(Boolean).join('\n');
    else if (/超自然|遭遇/.test(label)) c.entities = [c.entities, value].filter(Boolean).join('\n');
    else story.push(label ? `【${label}】\n${value}` : value);
  });
  c.backstory = story.join('\n\n');

  /* 6版：「新たに得た知識・経験」の中が〈魔導書…〉〈遭遇した…〉〈通過したシナリオ名〉に分かれている */
  const exp = {}; let ek = '';
  body('新たに得た知識・経験').split('\n').forEach(l => { const m = l.match(/^〈(.+?)〉\s*$/); if (m) { ek = m[1]; exp[ek] = []; } else if (ek) exp[ek].push(l); });
  const asList = arr => iaEntries(arr.join('\n')).filter(e => e.name || e.value).map(e => e.name && e.value ? (e.value.includes('\n') ? `${e.name}\n${e.value}` : `${e.name}：${e.value}`) : (e.name || e.value)).join('\n');
  Object.entries(exp).forEach(([k, arr]) => {
    if (/魔導書|呪文|アーティファクト/.test(k)) c.tomes = [c.tomes, asList(arr)].filter(Boolean).join('\n');
    else if (/超自然|遭遇/.test(k)) c.entities = [c.entities, asList(arr)].filter(Boolean).join('\n');
  });

  /* 通過したシナリオ */
  c.scenarios = iaEntries(body('通過したシナリオ名') || (Object.entries(exp).find(([k]) => /シナリオ/.test(k)) || [, []])[1].join('\n')).filter(e => e.name || e.value).map(e => ({ name: e.name || e.value.split('\n')[0], date: '', note: e.name ? e.value : '', friends: [] }));

  /* メモ（追加のメモは見出しつきで続ける） */
  const mb = body('メモ'), firstBr = mb.search(/^\[.*\]\s*$/m);
  const memoMain = (firstBr < 0 ? mb : mb.slice(0, firstBr)).trim();
  const extraMemo = firstBr < 0 ? [] : iaEntries(mb.slice(firstBr));
  c.memo = [memoMain, ...extraMemo.filter(e => e.value || e.name).map(e => `【${e.name}】\n${e.value}`), notes.length ? '【プロフィールの追加項目】\n' + notes.join('\n') : ''].filter(Boolean).join('\n\n');

  c.importInfo = { matched, added, full: true };
  return c;
}

/* ================= 保存 =================
   データは2か所に保存する。
   ・IndexedDB（ブラウザの大きな保存場所。数百MB以上入る）… こちらが本命
       'meta' … キャラ以外の設定と、キャラの並び順（ids）
       'c:キャラのid' … キャラ1人分。中身が変わったキャラだけ書きなおす（50人ぶんの立ち絵を毎回書かないため）
       'state' … 前の形（全部まとめて1つ）。読み込めるようにだけ残し、次に保存したとき消す
   ・localStorage（約5MBまで）… 入りきるうちは予備として。入りきらなくなったら消す
   読み込むときは、新しいほう（savedAt が大きいほう）を使う。 */
const DataDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('charasheet-kobo-data', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
      r.onblocked = () => rej(new Error('blocked'));
    });
  },
  async tx(mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => { const t = db.transaction('kv', mode); const out = fn(t.objectStore('kv')); t.oncomplete = () => res(typeof out === 'function' ? out() : out && out.result); t.onerror = t.onabort = () => rej(t.error); });
  },
  get(k) { return this.tx('readonly', st => st.get(k)); },
  getMany(keys) { return this.tx('readonly', st => { const rs = keys.map(k => st.get(k)); return () => rs.map(r => r.result); }); },
};
const KEY_IDB = 'charasheet-kobo.idb';   // 「IndexedDB に保存したことがある」しるし
const LS_MAX = 2400000;                   // localStorage に入るのはだいたいこの文字数まで
const charJson = new Map();               // IndexedDB に書いてあるキャラの中身（変わったかどうかを比べる）
let loaded = false, idbOk = false, idbLegacy = false;
const withTimeout = (pr, ms) => Promise.race([pr, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
const parseState = raw => { try { const s = raw ? JSON.parse(raw) : null; return s && Array.isArray(s.chars) ? s : null; } catch (e) { return null; } };

async function loadIdb() {
  const [meta, legacy] = await DataDB.getMany(['meta', 'state']);
  idbLegacy = legacy != null;
  let m = null; try { m = meta ? JSON.parse(meta) : null; } catch (e) { m = null; }
  if (m && Array.isArray(m.ids)) {
    const raws = await DataDB.getMany(m.ids.map(id => 'c:' + id));
    const chars = [];
    raws.forEach((r, i) => { try { if (r) { chars.push(JSON.parse(r)); charJson.set(m.ids[i], r); } } catch (e) { /* 壊れた1人分はとばす */ } });
    delete m.ids; m.chars = chars;
    const old = parseState(legacy);
    return old && (old.savedAt || 0) > (m.savedAt || 0) ? old : m;
  }
  return parseState(legacy);
}

async function load() {
  let fromLs = null, fromIdb = null, usedIdb = false;
  try { usedIdb = localStorage.getItem(KEY_IDB) === '1'; fromLs = parseState(localStorage.getItem(KEY)); } catch (e) { /* storage unavailable */ }
  try { fromIdb = await withTimeout(loadIdb(), 8000); idbOk = true; } catch (e) { idbOk = false; }
  if (!idbOk && usedIdb) {
    // 本命の保存場所が読めない。ここで保存すると古いデータで上書きしてしまうので、保存しない
    toast('保存したデータを読み込めませんでした。ほかのタブを閉じてから、ページを読み込み直してください。');
    if (fromLs) state = Object.assign(state, fromLs);
    if (!state.chars.length) state.chars = [sample()];
    if (!state.chars.some(c => c.id === state.activeId)) state.activeId = state.chars[0].id;
    return;
  }
  const best = [fromIdb, fromLs].filter(Boolean).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))[0];
  if (best) state = Object.assign(state, best);
  else {
    try {
      const old = localStorage.getItem(KEY_V1);
      if (old) { const s = JSON.parse(old); if (Array.isArray(s.chars)) state.chars = s.chars.filter(x => !x.sample).map(migrateV1); }
    } catch (e) { /* storage unavailable */ }
  }
  if (!best && !state.chars.length) state.chars = [sample()];   // 見本は、はじめて開いたときだけ（全部消した人には出さない）
  if (!state.chars.some(c => c.id === state.activeId)) state.activeId = state.chars.length ? state.chars[0].id : null;
  // 削除したテーマ（深淵・古書・ネオン・森）を使っていた人は、近未来にもどす（そのテーマ用に変えた色も消す）
  if (state.themePreset && !THEME_PRESETS[state.themePreset]) { state.themePreset = 'orbis'; state.theme = {}; }
  loaded = true;
  if (idbOk && (!fromIdb || idbLegacy || best !== fromIdb)) saveNow();   // 新しい形で IndexedDB に書いておく
}
let saveTimer, persistAsked = false;
function saveNow() {
  clearTimeout(saveTimer);
  if (!loaded) return;   // 読み込みが終わる前に保存すると、空のデータで上書きしてしまう
  state.savedAt = Date.now();
  const { chars, ...rest } = state;
  const ids = chars.map(c => c.id);
  const meta = JSON.stringify(Object.assign(rest, { ids }));
  const jsons = chars.map(c => JSON.stringify(c));
  const total = jsons.reduce((n, j) => n + j.length, meta.length);

  let lsOk = false;
  if (total < LS_MAX) { try { localStorage.setItem(KEY, JSON.stringify(state)); lsOk = true; } catch (e) { /* 入りきらない */ } }
  if (!lsOk) { try { localStorage.removeItem(KEY); } catch (e) { /* */ } }   // 入りきらない古い予備は消して、ほかの設定のために場所を空ける
  const full = () => toast('保存容量がいっぱいです。立ち絵を小さい画像に変えるか、使っていない探索者を削除してください。');
  if (!idbOk) { if (!lsOk) full(); return; }

  const live = new Set(ids);
  const changed = ids.map((id, i) => [id, jsons[i]]).filter(([id, j]) => charJson.get(id) !== j);
  const removed = [...charJson.keys()].filter(id => !live.has(id));
  const dropLegacy = idbLegacy;
  DataDB.tx('readwrite', st => {
    st.put(meta, 'meta');
    changed.forEach(([id, j]) => st.put(j, 'c:' + id));
    removed.forEach(id => st.delete('c:' + id));
    if (dropLegacy) st.delete('state');
  }).then(() => {
    changed.forEach(([id, j]) => charJson.set(id, j));
    removed.forEach(id => charJson.delete(id));
    if (dropLegacy) idbLegacy = false;
    try { localStorage.setItem(KEY_IDB, '1'); } catch (e) { /* */ }
    // ブラウザが空き容量のために勝手に消さないようお願いしておく（できないブラウザもある）
    if (!persistAsked) { persistAsked = true; navigator.storage?.persist?.().catch(() => {}); }
  }).catch(() => { if (!lsOk) full(); });
}
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 250); scheduleSync(); }
addEventListener('pagehide', saveNow);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') saveNow(); });
const active = () => state.chars.find(c => c.id === state.activeId);
