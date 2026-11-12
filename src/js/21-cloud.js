/* ================= アカウント・クラウド同期（Supabase） ================= */
const CLOUD = Object.assign({
  url: 'https://umrouqvbmnttirdzixvc.supabase.co',
  key: 'sb_publishable_9GwpXgDVVrzCeWjihR6yzQ_uKQsxbia',
}, window.CHARASHEET_CLOUD || {});
const cloudReady = () => /^https:\/\/[\w-]+\.supabase\.co\/?$/.test(CLOUD.url) && CLOUD.key.length > 20 && !!(window.supabase && window.supabase.createClient);
let sb = null, me = null, online = null, syncTimer = null, syncing = false, syncAgain = false, syncState = 'off', syncMsg = '', acctTab = 'login';
const lastSynced = new Map();

/* ---- ユーザーのアイコン画像（profiles.avatar に小さな正方形の画像を data URL で入れる） ---- */
const AVATARS = {};    // ユーザーID → 画像
let avatarCol = true;  // サーバーに avatar 欄がまだ無い（SQL 07 を実行していない）ときは false にして、名前だけ読む
const okAvatar = v => typeof v === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v) ? v : '';
const avImg = uid => AVATARS[uid] ? `<img src="${esc(AVATARS[uid])}" alt="" loading="lazy" draggable="false">` : '';
/* profiles を読む。q は列の名前を受け取ってクエリを返す関数。avatar 欄があればいっしょに読んで覚えておく */
async function selectProfiles(q) {
  if (avatarCol) {
    const r = await q('id,username,avatar');
    if (!r.error) {
      [].concat(r.data || []).forEach(p => { if (p && p.id) { if (okAvatar(p.avatar)) AVATARS[p.id] = p.avatar; else delete AVATARS[p.id]; } });
      return r;
    }
    if (!/avatar/i.test(r.error.message || '')) return r;
    avatarCol = false;
  }
  return q('id,username');
}
/* 画像ファイル → 真ん中を正方形に切りぬいた 160px の画像（data URL） */
function avatarFromFile(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('画像ファイル（PNG・JPGなど）を選んでください。')); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を読み込めませんでした。別の画像で試してください。')); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) * .3; // 縦長の画像は少し上（顔のあたり）を使う
      const cv = document.createElement('canvas'); cv.width = cv.height = 160;
      const g = cv.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, 160, 160);
      g.drawImage(img, sx, sy, s, s, 0, 0, 160, 160);
      let out = '';
      for (const q of [.85, .72, .6, .45]) { out = cv.toDataURL('image/jpeg', q); if (out.length <= 60000) break; }
      resolve(out);
    };
    img.src = url;
  });
}
async function saveAvatar(v) {
  if (!sbClient() || !me) return;
  const { error } = await sb.from('profiles').update({ avatar: v || null }).eq('id', me.id);
  if (error) { toast(/avatar/i.test(error.message || '') ? 'サーバーの準備がまだです。Supabase で supabase/07-avatars.sql を実行してください。' : 'アイコンを保存できませんでした：' + jaErr(error)); return; }
  avatarCol = true;
  if (v) AVATARS[me.id] = v; else delete AVATARS[me.id];
  renderAccount(); renderAccountBtn(); renderOnline(); renderFriends();
  if (!$('select').hidden) renderSelect();
  toast(v ? 'アイコンを変えました。フレンドやグループの人にも見えます。' : 'アイコンを外しました。');
}
function sbClient() {
  if (!sb && cloudReady()) sb = window.supabase.createClient(CLOUD.url.replace(/\/$/, ''), CLOUD.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  return sb;
}
const jaErr = e => {
  const m = String((e && (e.message || e.error_description)) || e || '');
  // サーバーの大きさの上限（supabase/19-limits.sql）
  if (/ORBIS_CHAR_TOO_LARGE/.test(m)) return 'キャラシが大きすぎて保存できませんでした（1人分 1MB まで）。メモや経歴を短くするか、画像を減らしてください。';
  if (/ORBIS_TOO_MANY_CHARS/.test(m)) return 'サーバーに保存できる探索者の数（60人）を超えています。使っていない探索者を削除してください。';
  if (/ORBIS_DATA_TOO_LARGE/.test(m)) return 'データが大きすぎて保存できませんでした。メモなどを短くしてください。';
  if (/Invalid login credentials/i.test(m)) return 'ログインできませんでした。このメールアドレスのアカウントがないか、パスワードが違います。アカウントがない場合は、下の「新規アカウント作成へ」から作ってください。';
  if (/Email not confirmed/i.test(m)) return 'メールアドレスの確認がまだです。届いたメールのリンクを押してからログインしてください。';
  if (/already registered|already been registered/i.test(m)) return 'このメールアドレスはすでに登録されています。ログインしてください。';
  if (/duplicate key|profiles_username_lower|23505/i.test(m)) return 'そのユーザー名はすでに使われています。別のユーザー名にしてください。';
  if (/Database error saving new user/i.test(m)) return 'そのユーザー名はすでに使われています。別のユーザー名にしてください。';
  // メールを送れなかった（Supabase の標準のメールは運営チームにしか送れない・送る設定のまちがい など）
  if (/not authorized|Error sending|sending (confirmation|recovery|magic link) email|SMTP/i.test(m)) return 'いまはメールを送れませんでした（運営のメールの設定中です）。少したってからもう一度ためすか、「お問い合わせ」から知らせてください。';
  if (/rate limit|too many/i.test(m)) return '短い時間に何度も送信されました。しばらく待ってからもう一度試してください。';
  if (/Password should be/i.test(m)) return 'パスワードが短すぎます。8文字以上にしてください。';
  if (/valid email|invalid email|Unable to validate email/i.test(m)) return 'メールアドレスの形が正しくありません。';
  if (/relation .* does not exist|Could not find the (table|function)/i.test(m)) return 'サーバーの準備（SQLの実行）がまだ終わっていないようです。管理者に伝えてください。';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'サーバーにつながりませんでした。ネットの接続を確認してください。';
  return 'うまくいきませんでした：' + m;
};
function setSync(st, msg) {
  // 保存できなかったときは、右上の小さな点だけだと気づけないので、一度お知らせを出す
  if (st === 'error' && syncState !== 'error') toast('クラウドに保存できませんでした。ほかの端末には、まだ反映されていません。' + (msg ? '（' + msg + '）' : '') + ' ネットの接続を確かめてください。直ると自動でもう一度送ります。');
  syncState = st; syncMsg = msg || ''; renderAccountBtn(); if (!$('modal-account').hidden) renderAccount();
}
function scheduleSync() { if (!me) return; clearTimeout(syncTimer); syncTimer = setTimeout(flushSync, 1500); if (syncState !== 'pending') setSync('pending'); }
const myChars = () => state.chars.filter(c => !c.sample && (!c.owner || c.owner === me.id));
let retryTimer = null;
/* 秘匿はキャラシ本体（characters.data）には入れず、char_secrets に分けて送る（フレンドや共有リンクに出さないため） */
let secretsOff = false;   // 12-char-secrets.sql をまだ実行していないとき
let secretOpenOff = false;   // 13-secret-open.sql（秘匿の公開）をまだ実行していないとき
const withoutSecret = c => { const { secret, ...rest } = c; return rest; };
async function pushSecrets(list) {
  if (secretsOff || !list.length) return;
  const has = list.filter(c => (c.secret || '').trim()), empty = list.filter(c => !(c.secret || '').trim()).map(c => c.id);
  try {
    if (has.length) {
      const rows = has.map(c => Object.assign({ char_id: c.id, owner: me.id, body: c.secret, updated_at: new Date().toISOString() }, secretOpenOff ? {} : { is_open: !!c.secretOpen }));
      let { error } = await sb.from('char_secrets').upsert(rows);
      if (error && /is_open/.test(String(error.message))) {   // 13-secret-open.sql をまだ実行していない：公開の設定なしで送る
        secretOpenOff = true; rows.forEach(r => { delete r.is_open; }); ({ error } = await sb.from('char_secrets').upsert(rows));
      }
      if (error) throw error;
    }
    if (empty.length) { const { error } = await sb.from('char_secrets').delete().in('char_id', empty); if (error) throw error; }
  } catch (e) { if (groupMissing(e) || /char_secrets/.test(String(e && e.message))) secretsOff = true; else throw e; }
}
async function pullSecrets(ids) {
  const m = new Map();
  if (secretsOff || !ids.length) return m;
  const { data, error } = await sb.from('char_secrets').select('char_id,body').in('char_id', ids);
  if (error) { if (/char_secrets|does not exist|Could not find/i.test(String(error.message))) secretsOff = true; return m; }
  (data || []).forEach(r => m.set(r.char_id, r.body || ''));
  return m;
}
/* ---- 削除したキャラが、ほかの端末から復活しないように ----
   前は「どのキャラをサーバーに送ったか」を開いているあいだしか覚えていなかったので、
   アプリの更新などで読み込み直した端末（古いキャラを持ったままのスマホなど）が、ほかの端末で削除したキャラを「新しいキャラ」と思って送り直していた。
   ・サーバー（14-deleted-chars.sql）：削除すると「削除したしるし」が残り、削除より前の内容を送ってきても受け取らない
   ・アプリ：しるしのあるキャラはこの端末からも片付ける。この端末で削除したキャラは、送り終わるまで state.delQueue に覚えておく（途中で閉じても消し忘れない） */
let tombOff = false;   // 14-deleted-chars.sql をまだ実行していないとき
async function deletedOnServer(ids) {   // 返り値：キャラの id → 削除した時刻
  const m = new Map();
  if (tombOff || !sb || !ids.length) return m;
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await sb.from('deleted_chars').select('id,deleted_at').in('id', ids.slice(i, i + 100));
    if (error) { if (/deleted_chars|does not exist|Could not find/i.test(String(error.message))) tombOff = true; return m; }
    (data || []).forEach(r => m.set(r.id, Date.parse(r.deleted_at) || 0));
  }
  return m;
}
function queueCharDelete(id) {   // この端末で削除した：サーバーからも消すまで覚えておく（11-edit.js から呼ぶ）
  state.delQueue = state.delQueue || [];
  if (!state.delQueue.includes(id)) state.delQueue.push(id);
}
function dropDeleted(ids) {   // ほかの端末で削除されたキャラを、この端末からも片付ける
  const set = new Set(ids);
  const hit = state.chars.filter(c => set.has(c.id));
  if (!hit.length) return 0;
  hit.forEach(c => { if (c.bgm?.src === 'idb') AudioDB.del(c.id).catch(() => {}); if (bgmFor === c.id) stopBgm(); });
  state.chars = state.chars.filter(c => !set.has(c.id));
  ids.forEach(id => lastSynced.delete(id));
  if (!state.chars.some(c => c.id === state.activeId)) state.activeId = state.chars.length ? state.chars[0].id : null;
  toast(`ほかの端末で削除した探索者${hit.length}人を、この端末からも片付けました。`);
  return hit.length;
}
function afterDrop() {   // 片付けたあとの画面
  saveNow(); renderAll();
  if (!state.chars.length && $('select').hidden) { selTab = 'mine'; showSelect(); }
  else if (!$('select').hidden) renderSelect();
}
/* ---- 立ち絵などの画像は、キャラシ本体とは別に Storage（char-images）に置く（18-char-images.sql） ----
   データベース（無料枠は約500MB）に立ち絵をそのまま入れると、数十人ですぐいっぱいになるため。
   ・送るとき：キャラシの中の画像（立ち絵・差分・自分で選んだアイコン・キャラの背景）を「持ち主の id/中身から作った名前」で置き、
     サーバーに送るキャラシには、その画像の URL だけを書く（この端末の中のキャラシはそのまま）
   ・小さなアイコン（avatar）は一覧で使うので、今までどおりキャラシの中に入れる
   ・前に画像ごと送ったキャラは、ログインしたときに読みこんで、もう一度送り直す（そのとき画像が分かれる）
   ・使われなくなった画像は、ときどき片付ける（cleanupImages） */
const IMG_BUCKET = 'char-images';
let imgOff = false;            // 18-char-images.sql をまだ実行していないとき（画像ごと送る）
const imgDone = new Set();     // この端末で置き終わった画像
const imgHashes = new Map();
const cyrb = (s, seed) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < s.length; i++) { ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
};
function imgHash(s) {   // 画像の中身から作る名前（同じ画像は同じ名前になるので、2回置かなくてすむ）
  let h = imgHashes.get(s);
  if (!h) { if (imgHashes.size > 400) imgHashes.clear(); h = cyrb(s, 1) + cyrb(s, 7); imgHashes.set(s, h); }
  return h;
}
const IMG_EXT = { webp: 'webp', png: 'png', jpeg: 'jpg', gif: 'gif' };
const imgPathOf = u => { const m = /^data:image\/(webp|png|jpeg|gif)[;,]/.exec(u || ''); return m && me ? `${me.id}/${imgHash(u)}.${IMG_EXT[m[1]]}` : null; };
const imgBase = () => `${CLOUD.url.replace(/\/$/, '')}/storage/v1/object/public/${IMG_BUCKET}/`;
const isInline = u => typeof u === 'string' && u.startsWith('data:image/');
const charImgs = d => [d.portrait, d.icon, d.bgImage, ...(Array.isArray(d.faces) ? d.faces.map(f => f && f.src) : [])].filter(Boolean);
const hasInlineImg = d => !!d && charImgs(d).some(isInline);
function dataUrlBlob(u) {
  const [head, data] = u.split(','), type = head.slice(5).split(';')[0];
  const bin = atob(data), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}
async function putImage(u) {   // 画像を置いて、その URL を返す（置けないときは元のまま）
  if (imgOff || !isInline(u)) return u;
  const path = imgPathOf(u); if (!path) return u;
  if (!imgDone.has(path)) {
    const blob = dataUrlBlob(u);
    const { error } = await sb.storage.from(IMG_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: '31536000' });
    if (error) {
      const m = String(error.message || '') + ' ' + String(error.statusCode || '') + ' ' + String(error.error || '');
      if (/exist|duplicate|409/i.test(m)) { /* もう置いてある */ }
      else if (/bucket not found/i.test(m)) { imgOff = true; return u; }
      else if (/row-level security|403|unauthorized/i.test(m)) throw new Error('画像の置き場所がいっぱいです（1人 100MB まで）。使っていない立ち絵・差分・背景画像を消すと、また保存できます。');
      else throw error;
    }
    imgDone.add(path);
  }
  return imgBase() + path;
}
async function cloudCopy(c) {   // サーバーに送る形（秘匿を抜き、画像は URL に）
  const d = withoutSecret(c);
  if (imgOff || !hasInlineImg(d)) return d;
  const out = Object.assign({}, d);
  if (isInline(out.portrait)) out.portrait = await putImage(out.portrait);
  if (isInline(out.icon)) out.icon = await putImage(out.icon);
  if (isInline(out.bgImage)) out.bgImage = await putImage(out.bgImage);
  if (Array.isArray(out.faces)) {
    const fs = [];
    for (const f of out.faces) fs.push(f && isInline(f.src) ? Object.assign({}, f, { src: await putImage(f.src) }) : f);
    out.faces = fs;
  }
  return out;
}
/* 使われなくなった画像を片付ける（10分に1回まで）。サーバーのキャラシとこの端末のキャラシのどちらにも出てこない、
   1時間より前に置いた画像だけを消す（ほかの端末が置いたばかりの画像は消さない） */
let imgCleanAt = 0, imgDirty = false, imgCleanTimer = null;
async function cleanupImages() {
  if (imgOff || !sb || !me || !imgDirty) return;
  const wait = imgCleanAt + 600000 - Date.now();
  if (wait > 0) { if (!imgCleanTimer) imgCleanTimer = setTimeout(() => { imgCleanTimer = null; cleanupImages(); }, wait); return; }   // 10分たったら、もう一度
  imgCleanAt = Date.now(); imgDirty = false;
  try {
    const files = [];
    for (let off = 0; off < 20000; off += 1000) {
      const { data, error } = await sb.storage.from(IMG_BUCKET).list(me.id, { limit: 1000, offset: off });
      if (error) return;
      files.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    if (!files.length) return;
    const used = new Set(), base = imgBase() + me.id + '/';
    const note = u => { if (typeof u !== 'string') return; if (u.startsWith(base)) used.add(u.slice(base.length)); else if (isInline(u)) { const p = imgPathOf(u); if (p) used.add(p.slice(me.id.length + 1)); } };
    myChars().forEach(c => charImgs(c).forEach(note));
    const { data: rows, error } = await sb.from('characters').select('portrait:data->>portrait,icon:data->>icon,bg:data->>bgImage,faces:data->faces').eq('owner', me.id);
    if (error) return;   // サーバーのキャラシを確かめられないときは、何も消さない
    (rows || []).forEach(r => { [r.portrait, r.icon, r.bg].forEach(note); (Array.isArray(r.faces) ? r.faces : []).forEach(f => note(f && f.src)); });
    const old = Date.now() - 3600000;
    const gone = files.filter(f => f.name && !used.has(f.name) && Date.parse(f.created_at || 0) < old).map(f => `${me.id}/${f.name}`);
    for (let i = 0; i < gone.length; i += 100) await sb.storage.from(IMG_BUCKET).remove(gone.slice(i, i + 100));
    gone.forEach(p => imgDone.delete(p));
  } catch (e) { /* 片付けは次の機会に */ }
}
async function flushSync() {
  if (!sb || !me) return;
  clearTimeout(syncTimer); syncTimer = null;
  if (syncing) { syncAgain = true; return; }
  syncing = true;
  try {
    const mine = myChars();
    const rows = [];
    for (const c of mine) {
      c.owner = me.id; const js = JSON.stringify(c);
      if (lastSynced.get(c.id) === js) continue;
      const cd = await cloudCopy(c);   // 画像は Storage に置いて URL に
      if (cd !== c && charImgs(c).some(isInline)) imgDirty = true;
      rows.push([c, js, cd, cd === c ? js.length : JSON.stringify(cd).length]);
    }
    // 大きいキャラ（画像を分けられなかったとき）もあるので、だいたい3MBずつに分けて送る（一度に全部送ると失敗しやすい）
    const batches = [];
    rows.forEach(r => { const b = batches[batches.length - 1]; if (b && b.size + r[3] <= 3e6) { b.rows.push(r); b.size += r[3]; } else batches.push({ rows: [r], size: r[3] }); });
    const refused = [];
    for (const b of batches) {
      const { data: put, error } = await sb.from('characters').upsert(b.rows.map(([c, , cd]) => ({ id: c.id, owner: me.id, name: c.profile.name || '', locked: !!c.locked, data: cd, updated_at: new Date(c.updatedAt || Date.now()).toISOString() }))).select('id');
      if (error) throw error;
      // サーバーが受け取らなかったキャラ＝ほかの端末で削除済み（削除より前の古い内容だった）
      const got = put ? new Set(put.map(r => r.id)) : null;
      const kept = got ? b.rows.filter(([c]) => got.has(c.id)) : b.rows;
      if (got) b.rows.forEach(([c]) => { if (!got.has(c.id)) refused.push(c.id); });
      await pushSecrets(kept.map(([c]) => c));
      kept.forEach(([c, js]) => lastSynced.set(c.id, js));
      kept.forEach(([c]) => { if (shares && shares[c.id]) uploadShareCard(c, shares[c.id]); });   // 共有中なら、リンクのカードの画像も新しく
    }
    const live = new Set(mine.map(c => c.id));
    const queued = (state.delQueue || []).slice();
    const gone = [...new Set([...lastSynced.keys(), ...queued])].filter(id => !live.has(id));
    if (gone.length) {
      const { error } = await sb.from('characters').delete().in('id', gone);
      if (error) throw error;
      gone.forEach(id => lastSynced.delete(id));
      imgDirty = true;   // 削除したキャラの画像を、あとで片付ける
    }
    if (queued.length) { state.delQueue = (state.delQueue || []).filter(id => !queued.includes(id)); saveNow(); }   // 送っているあいだに削除した分は残す
    if (refused.length && dropDeleted(refused)) afterDrop();
    setSync('ok');
    cleanupImages();   // 使われなくなった画像の片付け（待たない）
  } catch (e) { setSync('error', jaErr(e)); clearTimeout(retryTimer); retryTimer = setTimeout(() => { if (me && syncState === 'error') flushSync(); }, 30000); }   // 失敗したら30秒後にもう一度
  finally { syncing = false; if (syncAgain) { syncAgain = false; scheduleSync(); } }
}
async function pullAndMerge() {
  setSync('pending');
  const { data, error } = await sb.from('characters').select('id,data,locked,updated_at').eq('owner', me.id);
  if (error) throw error;
  lastSynced.clear();
  const onServer = new Set((data || []).map(r => r.id));
  const queued = new Set(state.delQueue || []);
  const rows = (data || []).filter(r => !queued.has(r.id));   // この端末で削除して、まだサーバーから消せていないキャラは取りこまない
  const secrets = await pullSecrets(rows.map(r => r.id));
  rows.forEach(r => {
    const sc = Object.assign({}, r.data, { locked: !!r.locked, owner: me.id });
    sc.secret = secrets.has(r.id) ? secrets.get(r.id) : (state.chars.find(c => c.id === r.id)?.secret || r.data.secret || '');
    const i = state.chars.findIndex(c => c.id === r.id);
    // 前に画像ごと送ったキャラは「送った」と覚えないでおく → このあとの flushSync で画像を分けて送り直す
    const mark = () => { if (!hasInlineImg(r.data)) lastSynced.set(sc.id, JSON.stringify(sc)); else imgDirty = true; };
    if (i < 0) { state.chars.push(sc); mark(); }
    else if ((sc.updatedAt || 0) >= (state.chars[i].updatedAt || 0)) { state.chars[i] = sc; mark(); }
  });
  // サーバーに無いキャラのうち、ほかの端末で削除したもの（削除したあとにこの端末で書きかえていないもの）は片付ける
  const tomb = await deletedOnServer(myChars().filter(c => !onServer.has(c.id)).map(c => c.id));
  const dead = myChars().filter(c => tomb.has(c.id) && (c.updatedAt || 0) <= tomb.get(c.id)).map(c => c.id);
  const dropped = dropDeleted(dead);
  const real = state.chars.filter(c => !c.sample);
  if (real.length && state.chars.some(c => c.sample)) state.chars = real;
  if (!state.chars.some(c => c.id === state.activeId)) state.activeId = state.chars.length ? state.chars[0].id : null;
  saveNow();
  renderAll();
  if (dropped && !state.chars.length && $('select').hidden) { selTab = 'mine'; showSelect(); }
  await flushSync();
}
/* ---- ほかの端末での変更を取りこむ（画面にもどったとき・ときどき） ----
   開きっぱなしのタブ（スマホは特に）は、ほかの端末で書きかえた内容を知らないまま古い内容を見せてしまい、
   そのまま書きかえると古い内容でサーバーを上書きしてしまう。そこで、画面にもどるたびと、開いているあいだ1分ごとに
   サーバーの「更新時刻」だけを見て、新しくなったキャラだけ読みなおす（立ち絵が入っていて重いので、全部は読まない） */
let refreshing = false;
const editingNow = () => { const a = document.activeElement; return !!(a && a.matches && a.matches('input, textarea, select') && a.closest('#sheet, #panel')); };
async function refreshFromCloud() {
  if (!sb || !me || refreshing || document.visibilityState === 'hidden') return false;
  refreshing = true;
  try {
    if (syncTimer || syncing) { clearTimeout(syncTimer); syncTimer = null; await flushSync(); }   // まだ送っていない変更を先に送る
    const { data, error } = await sb.from('characters').select('id,updated_at').eq('owner', me.id);
    if (error) throw error;
    const server = new Map((data || []).map(r => [r.id, Date.parse(r.updated_at) || 0]));
    const busy = editingNow() ? state.activeId : null;   // 入力中のキャラは、いまは入れかえない（次の確認で）
    const queued = new Set(state.delQueue || []);
    const need = [...server].filter(([id, t]) => { const l = state.chars.find(c => c.id === id); return id !== busy && !queued.has(id) && (!l || t > (l.updatedAt || 0)); }).map(([id]) => id);
    // ほかの端末で削除されたキャラ（この端末では、前に同期したあと書きかえていないもの／サーバーに「削除したしるし」があるもの）
    const lonely = myChars().filter(c => c.id !== busy && !server.has(c.id));
    const tomb = await deletedOnServer(lonely.map(c => c.id));
    const gone = lonely.filter(c => (lastSynced.has(c.id) && lastSynced.get(c.id) === JSON.stringify(c)) || (tomb.has(c.id) && (c.updatedAt || 0) <= tomb.get(c.id))).map(c => c.id);
    if (!need.length && !gone.length) return false;
    let rows = [];
    for (let i = 0; i < need.length; i += 5) {   // 立ち絵が重いので5人ずつ
      const r = await sb.from('characters').select('id,data,locked,updated_at').in('id', need.slice(i, i + 5));
      if (r.error) throw r.error;
      rows = rows.concat(r.data || []);
    }
    const secrets = await pullSecrets(rows.map(r => r.id));
    rows.forEach(r => {
      const sc = Object.assign({}, r.data, { locked: !!r.locked, owner: me.id });
      const i = state.chars.findIndex(c => c.id === r.id);
      sc.secret = secrets.has(r.id) ? secrets.get(r.id) : (i >= 0 ? state.chars[i].secret || '' : '');
      if (i < 0) state.chars.push(sc); else state.chars[i] = sc;
      if (!hasInlineImg(r.data)) lastSynced.set(sc.id, JSON.stringify(sc));   // 画像ごと入っていたら、画像を分けて送り直す
    });
    if (gone.length) dropDeleted(gone);
    const real = state.chars.filter(c => !c.sample);
    if (real.length && state.chars.some(c => c.sample)) state.chars = real;
    if (!state.chars.some(c => c.id === state.activeId)) state.activeId = state.chars.length ? state.chars[0].id : null;
    saveNow();
    const activeChanged = rows.some(r => r.id === state.activeId) || gone.length;
    renderShelf(); renderOutput();
    if (activeChanged) { renderSheet(); if (!$('panel-ov').hidden && panelKey) fillPanel(panelKey); }
    if (!state.chars.length && $('select').hidden) { selTab = 'mine'; showSelect(); }
    else if (!$('select').hidden) renderSelect();
    setSync('ok');
    return true;
  } catch (e) { setSync('error', jaErr(e)); return false; }
  finally { refreshing = false; }
}
document.addEventListener('visibilitychange', () => {
  if (!me) return;
  if (document.visibilityState === 'hidden') { if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; flushSync(); } }   // 画面を離れるときは、待たずにすぐ送る
  else refreshFromCloud();
});
addEventListener('pagehide', () => { if (me && syncTimer) { clearTimeout(syncTimer); syncTimer = null; flushSync(); } });
addEventListener('focus', () => refreshFromCloud());
addEventListener('online', () => { if (me) { scheduleSync(); refreshFromCloud(); } });
setInterval(() => refreshFromCloud(), 60000);
async function loadFriendships() {
  if (!sb || !me) return;
  const { data, error } = await sb.from('friendships').select('requester,addressee,status');
  if (error) throw error;
  const ids = [...new Set((data || []).flatMap(r => [r.requester, r.addressee]).filter(id => id !== me.id))];
  let profs = [];
  if (ids.length) { const r = await selectProfiles(c => sb.from('profiles').select(c).in('id', ids)); if (r.error) throw r.error; profs = r.data || []; }
  const nm = id => (profs.find(p => p.id === id) || {}).username || '（退会したユーザー）';
  online = { friends: [], incoming: [], outgoing: [], chars: (online && online.chars) || {}, groups: (online && online.groups) || [] };
  (data || []).forEach(r => {
    const other = r.requester === me.id ? r.addressee : r.requester;
    const u = { id: other, username: nm(other) };
    if (r.status === 'accepted') online.friends.push(u);
    else if (r.addressee === me.id) online.incoming.push(u);
    else online.outgoing.push(u);
  });
  const FC = ['#1f6fe0', '#e0457a', '#2f9e57', '#7b52bd', '#e08a1f', '#12a6cf', '#c0392b', '#8e6e1f'];
  let added = false;
  online.friends.forEach(u => {
    const ex = friendsOf().find(f => f.uid === u.id);
    if (ex) {
      if (ex.name !== u.username && u.username !== '（退会したユーザー）') { ex.name = u.username; added = true; }
      if (ex.note === 'キャラシ工房のフレンド') { ex.note = 'ORBiS のフレンド'; added = true; } // 前の名前のメモを新しい名前に
    }
    else { friendsOf().push({ id: 'u-' + u.id, uid: u.id, name: u.username, color: FC[friendsOf().length % FC.length], note: 'ORBiS のフレンド' }); added = true; }
  });
  if (added) { save(); renderSheet(); }
  renderAccountBtn(); renderGroupBadge();
  if (!$('modal-friends').hidden) { renderOnline(); renderFriends(); }
  if (!$('select').hidden && selTab === 'friends') renderSelect();
}
async function handleSession(session) {
  const uid = session && session.user ? session.user.id : null;
  if ((me ? me.id : null) === uid) return;
  if (!uid) { me = null; online = null; shares = null; lastSynced.clear(); setSync('off'); renderAccount(); renderOnline(); ueCheckAdmin(); if (!$('select').hidden && selTab === 'friends') renderSelect(); return; }
  me = { id: uid, email: session.user.email, username: (session.user.user_metadata || {}).username || '' };
  renderAccountBtn(); renderAccount();
  try {
    const { data: prof } = await selectProfiles(c => sb.from('profiles').select(c).eq('id', uid).maybeSingle());
    if (prof && prof.username) me.username = prof.username;
    renderAccountBtn(); renderAccount();
    ueCheckAdmin();
    await pullAndMerge();
    await loadFriendships();
    await loadFriendChars();
    await loadGroups();
    await loadShares().catch(() => {});
    if (!$('select').hidden && (selTab === 'friends' || selTab === 'groups')) renderSelect();
  } catch (e) { setSync('error', jaErr(e)); }
}
async function initCloud() {
  renderAccountBtn();
  if (!sbClient()) return;
  sb.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { acctTab = 'recover'; openAccount(); }
    setTimeout(() => handleSession(session), 0);
  });
  try { const { data } = await sb.auth.getSession(); handleSession(data.session); } catch (e) { /* offline */ }
}
async function logout() {
  if (!sb) return;
  await flushSync();
  const uid = me && me.id;
  await sb.auth.signOut();
  if (uid) {
    state.chars = state.chars.filter(c => c.owner !== uid);
    state.friends = friendsOf().filter(f => !f.uid);
    state.activeId = state.chars.length ? state.chars[0].id : null;
  }
  me = null; online = null; shares = null; lastSynced.clear(); G.list = []; G.err = ''; acctTab = 'login';
  saveNow(); setSync('off'); renderAll(); renderAccount();
  if (!$('select').hidden) renderSelect();
  stopBgm();
  toast('ログアウトしました。この端末からアカウントのキャラシを片付けました（サーバーには残っています）。');
}
function renderAccountBtn() {
  const label = me ? (me.username || 'アカウント') : 'ログイン';
  const dot = me ? `<i class="sync-dot ${syncState}" title="${syncState === 'ok' ? '同期済み' : syncState === 'pending' ? '同期中' : syncState === 'error' ? '同期エラー' : ''}"></i>` : '';
  const req = me && online && online.incoming.length ? `<b class="req-badge">${online.incoming.length}</b>` : '';
  ['btn-account', 'sel-account'].forEach(id => { const b = $(id); if (b) b.innerHTML = `${dot}${esc(label)}${req}`; });
  $('btn-friends').innerHTML = `フレンド${req}`;
  $('sel-friends').innerHTML = `フレンド管理${req}`;
  $('sel-req').innerHTML = req;
}
function renderAccount() {
  const el = $('acct-body'); if (!el) return;
  if (!cloudReady()) {
    el.innerHTML = `<p>アカウント機能はまだ準備中です。サーバー（Supabase）の設定が終わると、ここから登録・ログインできるようになります。</p><p class="empty">それまでは、これまでどおりこのブラウザの中にキャラシが保存されます。</p>`;
    return;
  }
  if (me && acctTab !== 'recover') {
    const st = { ok: '同期済み', pending: '同期中…', error: '同期できませんでした', off: '—' }[syncState];
    el.innerHTML = `<div class="acct-card">
        <label class="fav acct-av ${AVATARS[me.id] ? 'has' : ''}" style="--fc:var(--sky)" title="アイコン画像を選ぶ">${avImg(me.id) || esc((me.username || '？').charAt(0))}<input type="file" id="ac-avatar" accept="image/*" hidden><i class="acct-av-cam" aria-hidden="true">✎</i></label>
        <div><b class="acct-name">${esc(me.username)}</b><span class="acct-mail">${esc(me.email || '')}</span>
          <span class="acct-av-act"><label class="btn small" for="ac-avatar">アイコン画像を${AVATARS[me.id] ? '変える' : '選ぶ'}</label>${AVATARS[me.id] ? '<button class="btn small ghost" type="button" data-acct="avatar-off">外す</button>' : ''}</span>
          <small class="acct-av-note">フレンドやグループの人にも見えます。</small></div>
      </div>
      <form class="acct-rename" data-form="rename">
        <label for="ac-newname">ユーザー名（フレンドに見える名前・2〜20文字）</label>
        <div class="row"><input class="inp" id="ac-newname" maxlength="20" autocomplete="username" value="${esc(me.username)}"><button class="btn" type="submit">変更する</button></div>
        <p class="err" id="ac-err" role="alert"></p><p class="ok-msg" id="ac-ok" role="status"></p>
      </form>
      <div class="acct-sync ${syncState}"><i class="sync-dot ${syncState}"></i>${st}${syncMsg ? `<small>${esc(syncMsg)}</small>` : ''}</div>
      <p>キャラシは自動でサーバーに保存され、ほかの端末でログインしても同じキャラが使えます。フレンドには、<b>非公開（ロック）にしていないキャラシ</b>だけが見えます。ロックはシート上部の「フレンドに公開／非公開」ボタンで切り替えます。</p>
      <div class="acct-actions"><button class="btn" type="button" data-acct="sync">今すぐ同期</button><button class="btn" type="button" data-acct="friends">フレンド</button><button class="btn danger" type="button" data-acct="logout">ログアウト</button></div>${wantsBoxHtml()}${modBoxHtml()}${contactBoxHtml()}`;
    return;
  }

  const f = {
    login: `<div class="acct-mode"><b>ログイン</b><span>登録済みのアカウントで入ります</span></div>
      <form class="acct-form" data-form="login">
        <label>ログインID（メールアドレス）<input class="inp" type="email" id="ac-email" autocomplete="email" required></label>
        <label>パスワード<input class="inp" type="password" id="ac-pass" autocomplete="current-password" required></label>
        <button class="btn primary" type="submit">ログイン</button>
        <p class="err" id="ac-err" role="alert"></p>
        <button class="linkish" type="button" data-tab="reset">パスワードを忘れたとき</button>
      </form>
      <div class="acct-switch">アカウントをお持ちでない方は<button class="btn small" type="button" data-tab="signup">新規アカウント作成へ</button></div>`,
    signup: `<div class="acct-mode signup"><b>新規アカウント作成</b><span>はじめての方はこちら。ログインではありません</span></div>
      <form class="acct-form" data-form="signup">
        <label>ユーザー名（フレンドに見える名前・2〜20文字）<input class="inp" id="ac-user" autocomplete="username" maxlength="20" required></label>
        <label>ログインID（メールアドレス）<input class="inp" type="email" id="ac-email" autocomplete="email" required></label>
        <label>パスワード（8文字以上）<input class="inp" type="password" id="ac-pass" autocomplete="new-password" minlength="8" required></label>
        <label>パスワード（確認のため、もう一度）<input class="inp" type="password" id="ac-pass2" autocomplete="new-password" minlength="8" required></label>
        <label class="acct-agree"><input type="checkbox" id="ac-agree" required><span><button class="link-btn" type="button" data-legal="terms">利用規約</button>と<button class="link-btn" type="button" data-legal="privacy">プライバシーポリシー</button>を読んで、同意します</span></label>
        <button class="btn primary" type="submit">同意してアカウントを作る</button>
        <p class="err" id="ac-err" role="alert"></p>
        <p class="empty">登録すると、このブラウザにあるキャラシもアカウントに保存されます。</p>
      </form>
      <div class="acct-switch">すでにアカウントをお持ちの方は<button class="btn small" type="button" data-tab="login">ログインへ戻る</button></div>`,
    reset: `<form class="acct-form" data-form="reset">
        <p>登録したメールアドレスに、パスワードを変えるためのリンクを送ります。</p>
        <label>ログインID（メールアドレス）<input class="inp" type="email" id="ac-email" autocomplete="email" required></label>
        <button class="btn primary" type="submit">リンクを送る</button>
        <button class="linkish" type="button" data-tab="login">ログインに戻る</button>
      </form>`,
    recover: `<form class="acct-form" data-form="recover">
        <p>新しいパスワードを決めてください。</p>
        <label>新しいパスワード（8文字以上）<input class="inp" type="password" id="ac-pass" autocomplete="new-password" minlength="8" required></label>
        <button class="btn primary" type="submit">パスワードを変える</button>
      </form>`,
  };
  el.innerHTML = f[acctTab] + (/id="ac-err"/.test(f[acctTab]) ? '' : '<p class="err" id="ac-err" role="alert"></p>') + '<p class="ok-msg" id="ac-ok" role="status"></p>';
}
function openAccount() { if (acctTab !== 'recover') acctTab = 'login'; renderAccount(); openModal('modal-account'); }
$('acct-body').addEventListener('click', async e => {
  const t = e.target.closest('[data-tab]');
  if (t) { acctTab = t.dataset.tab; renderAccount(); $('ac-email')?.focus(); return; }
  const a = e.target.closest('[data-acct]'); if (!a) return;
  if (a.dataset.acct === 'avatar-off') { if (!arm(a, 'もう一度押すと外す')) return; saveAvatar(''); return; }
  if (a.dataset.acct === 'sync') { try { await pullAndMerge(); await loadFriendships(); toast('同期しました。'); } catch (er) { setSync('error', jaErr(er)); } }
  if (a.dataset.acct === 'friends') { closeModals(); openFriends(); }
  if (a.dataset.acct === 'wants') loadWantCounts();
  if (a.dataset.acct === 'reports') { closeModals(); openMod(); }
  if (a.dataset.acct === 'contacts') { closeModals(); openContacts(); }
  if (a.dataset.acct === 'logout') { if (!arm(a, 'もう一度押すとログアウト')) return; closeModals(); logout(); }
});
$('acct-body').addEventListener('change', async e => {
  if (e.target.id !== 'ac-avatar') return;
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  try { await saveAvatar(await avatarFromFile(f)); } catch (er) { toast(er.message || 'アイコンを設定できませんでした。'); }
});
$('acct-body').addEventListener('submit', async e => {
  e.preventDefault();
  if (!sbClient()) return;
  const form = e.target, kind = form.dataset.form, err = $('ac-err'), ok = $('ac-ok');
  const btn = form.querySelector('button[type=submit]');
  if (kind === 'rename') {
    err.textContent = ''; ok.textContent = '';
    const name = ($('ac-newname').value || '').trim();
    if (!me) return;
    if (!/^[^\s]{2,20}$/.test(name)) { err.textContent = 'ユーザー名は空白なしの2〜20文字にしてください。'; return; }
    if (name === me.username) { err.textContent = '今のユーザー名と同じです。'; return; }
    btn.disabled = true;
    try {
      if (name.toLowerCase() !== (me.username || '').toLowerCase()) {
        const av = await sb.rpc('username_available', { name });
        if (av.error) throw av.error;
        if (av.data === false) { err.textContent = 'そのユーザー名はすでに使われています。別のユーザー名にしてください。'; return; }
      }
      const { error } = await sb.from('profiles').update({ username: name }).eq('id', me.id);
      if (error) throw error;
      sb.auth.updateUser({ data: { username: name } }).catch(() => {});
      const old = me.username;
      me.username = name;
      renderAccountBtn(); renderAccount();
      if (!$('modal-friends').hidden) renderOnline();
      $('ac-ok').textContent = `ユーザー名を「${old}」から「${name}」に変更しました。フレンドにも新しい名前で表示されます。`;
      fxAt($('ac-newname'), true);
    } catch (er) { err.textContent = jaErr(er); }
    finally { btn.disabled = false; }
    return;
  }
  err.textContent = ''; ok.textContent = '';
  const email = ($('ac-email')?.value || '').trim(), pass = $('ac-pass')?.value || '';
  btn.disabled = true;
  try {
    if (kind === 'login') {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      closeModals(); toast('ログインしました。');
    } else if (kind === 'signup') {
      const username = ($('ac-user').value || '').trim();
      if (!/^[^\s]{2,20}$/.test(username)) { err.textContent = 'ユーザー名は空白なしの2〜20文字にしてください。'; return; }
      if (pass.length < 8) { err.textContent = 'パスワードは8文字以上にしてください。'; return; }
      if (pass !== ($('ac-pass2').value || '')) { err.textContent = '確認用のパスワードが一致しません。同じパスワードを2回入れてください。'; return; }
      if (!$('ac-agree').checked) { err.textContent = '利用規約とプライバシーポリシーを読んで、「同意します」にチェックを入れてください。'; return; }
      const av = await sb.rpc('username_available', { name: username });
      if (av.error) throw av.error;
      if (av.data === false) { err.textContent = 'そのユーザー名はすでに使われています。別のユーザー名にしてください。'; return; }
      const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: { username }, emailRedirectTo: location.origin + location.pathname } });
      if (error) {
        if (/already registered|already been registered|already exists/i.test(error.message || '')) {
          acctTab = 'login'; renderAccount(); $('ac-email').value = email;
          $('ac-err').textContent = 'このメールアドレスはすでに登録されています。新しいアカウントは作らずに、ログインしてください。';
          return;
        }
        throw error;
      }
      if (data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        acctTab = 'login'; renderAccount(); $('ac-email').value = email;
        $('ac-err').textContent = 'このメールアドレスはすでに登録されています。新しいアカウントは作らずに、ログインしてください。';
        return;
      }
      if (data && data.session) { acctTab = 'login'; closeModals(); toast(`ようこそ、${username}さん。登録できました。`); }
      else { acctTab = 'login'; renderAccount(); $('ac-ok').textContent = '確認メールを送りました。メールのリンクを押してから、ここでログインしてください。'; }
    } else if (kind === 'reset') {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) throw error;
      ok.textContent = 'メールを送りました。届いたリンクから新しいパスワードを決めてください。';
    } else if (kind === 'recover') {
      if (pass.length < 8) { err.textContent = 'パスワードは8文字以上にしてください。'; return; }
      const { error } = await sb.auth.updateUser({ password: pass });
      if (error) throw error;
      acctTab = 'login'; closeModals(); toast('パスワードを変更しました。');
    }
  } catch (er) { err.textContent = jaErr(er); }
  finally { btn.disabled = false; }
});
$('btn-account').addEventListener('click', openAccount);
$('sel-account').addEventListener('click', openAccount);

/* ---- オンラインのフレンド ---- */
function renderOnline() {
  const el = $('online-friends'); if (!el) return;
  const head = '<div class="ol-head"><b>オンラインのフレンド</b><span class="hint">お互いのキャラシ（非公開以外）が見られます</span></div>';
  if (!cloudReady()) { el.innerHTML = `<div class="ol-box">${head}<p class="empty">アカウント機能の準備ができると、ユーザー名でフレンドを追加して、お互いのキャラシを見られるようになります。</p></div>`; return; }
  if (!me) { el.innerHTML = `<div class="ol-box">${head}<p>ログインすると、相手のユーザー名でフレンド申請を送れます。相手が承認すると、お互いのキャラシ一覧が見られるようになります。</p><button class="btn primary small" type="button" data-ol="login">ログイン・新規登録</button></div>`; return; }
  const o = online || { friends: [], incoming: [], outgoing: [] };
  const av = u => `<span class="fav sm" style="--fc:${esc((friendsOf().find(f => f.uid === u.id) || {}).color || 'var(--sky)')}">${avImg(u.id) || esc((u.username || '？').charAt(0))}</span>`;
  el.innerHTML = `<div class="ol-box">${head}
    <p class="ol-me">あなたのユーザー名：<b>${esc(me.username)}</b>（これを友達に教えると申請してもらえます）</p>
    <form class="ol-search" id="ol-search"><input class="inp" id="ol-name" placeholder="相手のユーザー名" autocomplete="off" aria-label="相手のユーザー名"><button class="btn primary" type="submit">フレンド申請</button></form>
    <p class="err" id="ol-err" role="alert"></p>
    ${o.incoming.length ? `<div class="ol-sec"><span class="lbl">届いた申請</span>${o.incoming.map(u => `<div class="ol-row">${av(u)}<b>${esc(u.username)}</b><span class="sp"></span><button class="btn small primary" type="button" data-ol="accept" data-uid="${u.id}">承認</button><button class="btn small" type="button" data-ol="remove" data-uid="${u.id}">断る</button>${reportBtn(u.id, u.username)}</div>`).join('')}</div>` : ''}
    ${o.outgoing.length ? `<div class="ol-sec"><span class="lbl">申請中</span>${o.outgoing.map(u => `<div class="ol-row">${av(u)}<b>${esc(u.username)}</b><span class="hint">承認待ち</span><span class="sp"></span><button class="btn small" type="button" data-ol="remove" data-uid="${u.id}">取り消す</button>${reportBtn(u.id, u.username)}</div>`).join('')}</div>` : ''}
    <div class="ol-sec"><span class="lbl">フレンド（${o.friends.length}人）</span>${o.friends.length ? o.friends.map(u => `<div class="ol-row">${av(u)}<b>${esc(u.username)}</b><span class="sp"></span><button class="btn small primary" type="button" data-ol="view" data-uid="${u.id}" data-name="${esc(u.username)}">${isFree() ? `<i class="tab-lock">${LOCK_SVG}</i>` : ''}キャラシを見る</button><button class="btn small danger" type="button" data-ol="unfriend" data-uid="${u.id}">解除</button>${reportBtn(u.id, u.username)}</div>`).join('') : '<p class="empty">まだいません。相手のユーザー名で申請してみましょう。</p>'}</div>
  </div>`;
}
const pairFilter = (a, b) => `and(requester.eq.${a},addressee.eq.${b}),and(requester.eq.${b},addressee.eq.${a})`;
$('online-friends').addEventListener('submit', async e => {
  e.preventDefault();
  const name = ($('ol-name').value || '').trim(), err = $('ol-err');
  err.textContent = '';
  if (!name) return;
  try {
    const { data: p, error } = await selectProfiles(c => sb.from('profiles').select(c).ilike('username', name.replace(/[%_\\]/g, '\\$&')).maybeSingle());
    if (error) throw error;
    if (!p) { err.textContent = `「${name}」というユーザーは見つかりませんでした。つづりを確かめてください。`; return; }
    if (p.id === me.id) { err.textContent = '自分自身はフレンドに追加できません。'; return; }
    const o = online || { friends: [], incoming: [], outgoing: [] };
    if (o.friends.some(u => u.id === p.id)) { err.textContent = `${p.username}さんはもうフレンドです。`; return; }
    if (o.outgoing.some(u => u.id === p.id)) { err.textContent = `${p.username}さんには申請済みです。承認を待ってください。`; return; }
    if (o.incoming.some(u => u.id === p.id)) {
      const r = await sb.from('friendships').update({ status: 'accepted' }).eq('requester', p.id).eq('addressee', me.id);
      if (r.error) throw r.error;
      toast(`${p.username}さんからの申請を承認しました。`);
    } else {
      const r = await sb.from('friendships').insert({ requester: me.id, addressee: p.id });
      if (r.error) throw r.error;
      toast(`${p.username}さんにフレンド申請を送りました。`);
    }
    $('ol-name').value = '';
    await loadFriendships(); renderOnline(); renderFriends();
  } catch (er) { err.textContent = jaErr(er); }
});
$('online-friends').addEventListener('click', async e => {
  const b = e.target.closest('[data-ol]'); if (!b) return;
  const uid = b.dataset.uid;
  try {
    if (b.dataset.ol === 'login') { closeModals(); acctTab = 'login'; openAccount(); return; }
    if (b.dataset.ol === 'view') { viewFriend(uid, b.dataset.name); return; }
    if (b.dataset.ol === 'accept') {
      const r = await sb.from('friendships').update({ status: 'accepted' }).eq('requester', uid).eq('addressee', me.id);
      if (r.error) throw r.error;
      toast('フレンドになりました。');
    }
    if (b.dataset.ol === 'remove' || b.dataset.ol === 'unfriend') {
      if (b.dataset.ol === 'unfriend' && !arm(b, '本当に解除')) return;
      const r = await sb.from('friendships').delete().or(pairFilter(me.id, uid));
      if (r.error) throw r.error;
      if (b.dataset.ol === 'unfriend') {
        state.friends = friendsOf().map(f => f.uid === uid ? Object.assign({}, f, { uid: undefined, note: ['キャラシ工房のフレンド', 'ORBiS のフレンド'].includes(f.note) ? '' : f.note }) : f);
        save();
      }
    }
    await loadFriendships(); renderOnline(); renderFriends();
  } catch (er) { toast(jaErr(er)); }
});

/* ---- フレンドのキャラシを見る（読み取り専用） ---- */
let fviewChars = [], fviewName = '';
async function viewFriend(uid, name) {
  if (isFree()) { lockDialog('friendview'); return; }   // 無料版：フレンドのキャラシを見るのは製品版（34-free.js）
  fviewName = name || 'フレンド';
  $('fview-title').textContent = `${fviewName}さんのキャラシ`;
  $('fview-body').innerHTML = '<p class="empty">読み込み中…</p>';
  openModal('modal-fview');
  try {
    const { data, error } = await sb.from('characters').select('id,data,locked,updated_at').eq('owner', uid);
    if (error) throw error;
    fviewChars = (data || []).map(r => r.data).filter(c => c && c.v === 2 && SYS[c.system] && c.profile);
    renderFviewList();
  } catch (er) { $('fview-body').innerHTML = `<p class="err">${esc(jaErr(er))}</p>`; }
}
function renderFviewList() {
  $('fview-title').textContent = `${fviewName}さんのキャラシ`;
  $('fview-body').innerHTML = fviewChars.length
    ? `<div class="fv-grid">${fviewChars.map((c, i) => `<button class="fv-card" type="button" data-fv="${i}">${tokenHtml(c)}<span class="sel-name">${esc(c.profile.name || '名無し')}</span><span class="sel-sys">${esc(SYS[c.system].short)}${c.profile.occupation ? ' ・ ' + esc(c.profile.occupation) : ''}</span></button>`).join('')}</div>`
    : '<p class="empty">公開されているキャラシはまだありません。</p>';
  if (!reduceMotion.matches) $('fview-body').querySelectorAll('.fv-card').forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(12px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: i * 50, easing: 'cubic-bezier(.2, .9, .3, 1.2)', fill: 'backwards' }));
}
function sheetViewHtml(c, shared) {   // shared：共有リンクから開いたとき（「自分の探索者に取り込む」を出す）
  const d = compute(c), a = d.a, p = c.profile, S = SYS[c.system], src = portraitSrc(c);
  const bars = [['HP', d.hp, d.hpMax, 'var(--hp), var(--orange)'], ['MP', d.mp, d.mpMax, 'var(--mp), var(--cyan)'], ['SAN', d.san, d.sanMax, 'var(--san), var(--pink)']];
  const prof = [['職業', p.occupation], ['年齢', p.age], ['誕生日', p.birthday], ['性別', p.sex], ['身長', p.height], ['体重', p.weight], ['出身', p.origin], ['髪の色', p.hair], ['瞳の色', p.eyes], ['肌の色', p.skin]].filter(([, v]) => v);
  const list = (arr, f) => arr.filter(x => x.name).map(f).join('');
  return `<div class="sv">
    <div class="sv-top">
      <div class="sv-artcol">
        <div class="sv-art">${src ? `<img src="${esc(imgSrc(src))}" alt="${esc(p.name || '')}の立ち絵" onerror="this.remove()">` : tokenHtml(c)}</div>
        ${(c.faces || []).some(f => f && f.src) ? `<div class="sv-faces" aria-label="差分を切りかえる">${[['基本', -1], ...c.faces.map((f, i) => [f.label || `差分${i + 1}`, i])].filter(([, i]) => i < 0 ? basePortrait(c) : c.faces[i].src).map(([l, i]) => `<button class="btn small ${(curFace(c) ? c.face : -1) === i ? 'primary' : ''}" type="button" data-fvface="${i}">${esc(l)}</button>`).join('')}</div>` : ''}
      </div>
      <div class="sv-id">
        <span class="peek-sys">${esc(S.label)}</span>
        <h3 class="sv-name">${esc(p.name || '名無し')}</h3>
        ${p.kana ? `<span class="peek-kana">${esc(p.kana)}</span>` : ''}
        ${prof.length ? `<dl class="sv-prof">${prof.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
        <div class="pbars">${bars.map(([l, v, m, g]) => `<div class="pbar"><b>${l}</b><span class="tr"><i style="width:${m > 0 ? Math.max(0, Math.min(100, v / m * 100)) : 0}%;background:linear-gradient(90deg, ${g})"></i></span><span>${v}/${m}</span></div>`).join('')}</div>
        <div class="sv-actions"><button class="btn primary small" type="button" data-fvcopy>ココフォリア用にコピー</button>${shared ? '<button class="btn small" type="button" data-fvtake>自分の探索者に取り込む</button>' : ''}<span class="copy-status" id="fv-status" role="status"></span></div>
      </div>
    </div>
    <div class="sv-grid">
      <figure class="chart-fig"><figcaption>能力値チャート</figcaption>${radarSvg(c, a, 280, true)}</figure>
      <div class="derived sv-der">
        <div class="dv"><span class="lbl">アイデア</span><span class="val">${d.idea}</span></div>
        <div class="dv"><span class="lbl">幸運</span><span class="val">${d.luck}</span></div>
        <div class="dv"><span class="lbl">知識</span><span class="val">${d.know}</span></div>
        <div class="dv"><span class="lbl">ダメージ・ボーナス</span><span class="val">${esc(d.db)}</span></div>
        ${c.system === 'coc7' ? `<div class="dv"><span class="lbl">ビルド</span><span class="val">${d.build}</span></div><div class="dv"><span class="lbl">MOV</span><span class="val">${d.mov}</span></div>` : ''}
      </div>
    </div>
    <figure class="chart-fig"><figcaption>技能グラフ ${SK_LEGEND}</figcaption>${skillBarsHtml(c, a, true)}</figure>
    ${list(c.weapons || [], w => `<div class="sv-item"><b>${esc(w.name)}</b><span>成功率 ${esc(w.rate || '—')} ・ ダメージ ${esc(w.damage || '—')}${w.range ? ' ・ 射程 ' + esc(w.range) : ''}</span></div>`) ? `<div class="sv-sec"><h4>武器</h4>${list(c.weapons || [], w => `<div class="sv-item"><b>${esc(w.name)}</b><span>成功率 ${esc(w.rate || '—')} ・ ダメージ ${esc(w.damage || '—')}${w.range ? ' ・ 射程 ' + esc(w.range) : ''}</span></div>`)}</div>` : ''}
    ${list(c.items || [], svItemChip) ? `<div class="sv-sec"><h4>所持品${(c.items || []).some(it => it.name && svItemTip(it)) ? ' <small class="sv-tiphint">（<i>i</i> の付いた品は、カーソルを合わせる・長押しで説明が出ます）</small>' : ''}</h4><div class="sv-chips">${list(c.items || [], svItemChip)}</div></div>` : ''}
    ${list(c.scenarios || [], sc => `<span class="sv-chip">「${esc(sc.name)}」${sc.date ? ' ' + esc(sc.date) : ''}</span>`) ? `<div class="sv-sec"><h4>通過シナリオ</h4><div class="sv-chips">${list(c.scenarios || [], sc => `<span class="sv-chip">「${esc(sc.name)}」${sc.date ? ' ' + esc(sc.date) : ''}</span>`)}</div></div>` : ''}
    ${c.backstory ? `<div class="sv-sec"><h4>経歴</h4><p class="sv-text">${esc(c.backstory)}</p></div>` : ''}
    <div id="sv-secret"></div>
    ${c.memo ? `<div class="sv-sec"><h4>メモ</h4><p class="sv-text">${esc(c.memo)}</p></div>` : ''}
  </div>`;
}
/* 見るだけの画面の所持品：説明（効果・備考）や価格がある品は、カーソルを合わせている間・押している間に吹き出しで出す */
function svItemTip(it) {
  return [String(it.note || '').trim(), String(it.price || '').trim() ? '価格：' + String(it.price).trim() : ''].filter(Boolean).join('\n');
}
function svItemChip(it) {
  const tip = svItemTip(it), label = `${esc(it.name)}${it.count ? ' ×' + esc(it.count) : ''}`;
  return tip ? `<span class="sv-chip has-tip" tabindex="0" data-itip="${esc(tip)}" data-itipname="${esc(it.name)}">${label}<i class="sv-tipmark" aria-hidden="true">i</i></span>` : `<span class="sv-chip">${label}</span>`;
}
const svTip = { el: null, t: 0, on: null };
function svTipShow(chip) {
  clearTimeout(svTip.t);
  let el = svTip.el;
  if (!el) { el = svTip.el = document.createElement('div'); el.className = 'sv-tip'; el.setAttribute('role', 'tooltip'); document.body.appendChild(el); }
  el.innerHTML = `<b>${esc(chip.dataset.itipname || '')}</b><span>${esc(chip.dataset.itip || '')}</span>`;
  svTip.on = chip; el.style.left = '0px'; el.classList.add('on');
  // 品の上に出す（上に入らないときは下に。左右は画面からはみ出さないように）
  const r = chip.getBoundingClientRect(), w = el.offsetWidth, h = el.offsetHeight;
  let y = r.top - h - 10, below = false;
  if (y < 8) { y = r.bottom + 10; below = true; }
  el.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
  el.style.top = y + 'px';
  el.classList.toggle('below', below);
}
function svTipHide(ms) {
  clearTimeout(svTip.t);
  svTip.t = setTimeout(() => { if (svTip.el) svTip.el.classList.remove('on'); svTip.on = null; }, ms || 0);
}
const svTipOf = e => e.target && e.target.closest ? e.target.closest('.sv [data-itip]') : null;
// パソコン：カーソルを合わせている間
document.addEventListener('pointerover', e => { if (e.pointerType === 'mouse') { const c = svTipOf(e); if (c) svTipShow(c); } });
document.addEventListener('pointerout', e => { if (e.pointerType === 'mouse') { const c = svTipOf(e); if (c && !c.contains(e.relatedTarget)) svTipHide(); } });
// スマホ：押している間（指を離しても少しのあいだ残す）。ほかの所を押したら消す
document.addEventListener('pointerdown', e => { const c = svTipOf(e); if (c && e.pointerType !== 'mouse') svTipShow(c); else if (!c && svTip.on) svTipHide(); }, { passive: true });
['pointerup', 'pointercancel'].forEach(t => document.addEventListener(t, e => { if (e.pointerType !== 'mouse' && svTip.on) svTipHide(1600); }, { passive: true }));
// キーボード（Tab で選んだとき）
document.addEventListener('focusin', e => { const c = svTipOf(e); if (c && c.matches(':focus-visible')) svTipShow(c); });
document.addEventListener('focusout', e => { if (svTipOf(e)) svTipHide(); });
addEventListener('scroll', () => { if (svTip.on) svTipHide(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && svTip.on) svTipHide(); });
let fviewCur = null;
/* グループのKPがメンバーのキャラシを見たとき、秘匿も見せる（読めるかどうかはサーバーが決める） */
async function loadKpSecret(c) {
  if (!sb || !me || !c || secretsOff) return;
  let { data, error } = await sb.from('char_secrets').select('body,is_open').eq('char_id', c.id).maybeSingle();
  if (error && /is_open/.test(String(error.message))) ({ data, error } = await sb.from('char_secrets').select('body').eq('char_id', c.id).maybeSingle());
  if (error || !data || !(data.body || '').trim() || fviewCur !== c) return;
  showSecretBox(data.body, data.is_open ? '持ち主が公開しています' : 'キーパーのあなたにだけ見えています');
}
/* 見るだけの画面（フレンド・KP・共有リンク）の秘匿の欄 */
function showSecretBox(body, note) {
  const box = $('sv-secret'); if (!box || !(body || '').trim()) return;
  box.innerHTML = `<div class="sv-sec sv-secret"><h4>秘匿 <small>${esc(note)}</small></h4><p class="sv-text">${esc(body)}</p></div>`;
}
$('fview-body').addEventListener('click', e => {
  const card = e.target.closest('[data-fv]');
  if (card) {
    fviewCur = fviewChars[+card.dataset.fv];
    $('fview-title').innerHTML = `<button class="btn small ghost fv-back" type="button" data-fvback>← 一覧へ</button> ${esc(fviewCur.profile.name || '名無し')}`;
    $('fview-body').innerHTML = sheetViewHtml(fviewCur);
    $('fview-body').scrollTop = 0;
    loadKpSecret(fviewCur);
    return;
  }
  if (e.target.closest('[data-fvcopy]') && fviewCur) {
    copyText(JSON.stringify(toCcfolia(fviewCur)), $('fv-status'), null).then(ok => { if (ok) fxAt(e.target.closest('[data-fvcopy]'), true); });
    return;
  }
  const fb = e.target.closest('[data-fvface]');
  if (fb && fviewCur) {   // 差分を切りかえて見る（見ているだけで、元のキャラシは変えない）
    const i = +fb.dataset.fvface, src = i < 0 ? basePortrait(fviewCur) : (fviewCur.faces[i] || {}).src;
    const art = $('fview-body').querySelector('.sv-art');
    if (src && art) art.innerHTML = `<img src="${esc(imgSrc(src))}" alt="" onerror="this.remove()">`;
    fb.parentNode.querySelectorAll('[data-fvface]').forEach(x => x.classList.toggle('primary', x === fb));
    return;
  }
  if (e.target.closest('[data-fvtake]') && fviewCur) { takeShared(e.target.closest('[data-fvtake]')); return; }
});
$('fview-title').addEventListener('click', e => { if (e.target.closest('[data-fvback]')) { fviewCur = null; renderFviewList(); } });
