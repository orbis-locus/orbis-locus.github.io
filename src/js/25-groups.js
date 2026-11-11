/* ================= グループ（代表者が作り、フレンドを招待する） ================= */
const G = { list: [], names: {}, loaded: false, err: '' };
let gDraft = null, joinCtx = null;
const ROLE = { kp: 'キーパー', pl: '探索者' };
const LOCK_ICON = '<svg class="lk" viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>', UNLOCK_ICON = '<svg class="lk" viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 5.8-1"/></svg>';
const groupMissing = e => /group_members|relation .* does not exist|Could not find the (table|function)/i.test(String((e && (e.message || e.details)) || e || ''));
const gUser = uid => (me && uid === me.id) ? (me.username || 'あなた') : (G.names[uid] || ((online && online.friends.find(u => u.id === uid)) || {}).username || '？');
const myRow = g => (g.members || []).find(m => me && m.user_id === me.id);
const inviteCount = () => G.list.filter(g => { const r = myRow(g); return r && r.status === 'invited'; }).length;
const isFriendUid = uid => !!(online && online.friends.some(u => u.id === uid));
function renderGroupBadge() {
  const n = inviteCount(), el = $('sel-greq');
  if (el) el.innerHTML = isFree() ? `<i class="tab-lock" title="製品版で解放予定">${LOCK_SVG}</i>` : n ? `<b class="req-badge">${n}</b>` : '';
}
async function loadGroups() {
  if (!sb || !me || isFree()) { G.list = []; renderGroupBadge(); return; }   // 無料版はグループを使わない（鍵の表示だけ）
  try {
    const { data, error } = await sb.from('groups').select('id,owner,locked,data,updated_at');
    if (error) throw error;
    const ids = (data || []).map(r => r.id);
    let mem = [];
    if (ids.length) {
      const cols = 'group_id,user_id,status,role,char_id,char_name,invited_by';
      let r = G.noDice ? { error: { message: 'dice' } } : await sb.from('group_members').select(cols + ',dice_limit,dice_reset').in('group_id', ids);
      if (r.error && /dice/.test(r.error.message || '')) { G.noDice = true; r = await sb.from('group_members').select(cols).in('group_id', ids); } // SQL 09 を実行していないとき
      if (r.error) throw r.error;
      mem = r.data || [];
    }
    const uids = [...new Set([...mem.map(m => m.user_id), ...(data || []).map(r => r.owner)])].filter(u => u !== me.id && !G.names[u]);
    if (uids.length) { const r = await selectProfiles(c => sb.from('profiles').select(c).in('id', uids)); (r.data || []).forEach(x => { G.names[x.id] = x.username; }); }
    G.list = (data || []).map(r => ({ id: r.id, owner: r.owner, locked: !!r.locked, data: r.data || {}, updated: r.updated_at, members: mem.filter(m => m.group_id === r.id) }));
    G.loaded = true; G.err = '';
    if (await migrateLegacyGroups()) return loadGroups();
  } catch (e) { G.err = groupMissing(e) ? 'setup' : jaErr(e); }
  renderGroupBadge();
}
/* 前の形式（自分の端末だけ／KP・探索者を直接書いた形）のグループを新しい形に移す */
async function migrateLegacyGroups() {
  const legacy = [...(state.groups || []).map(g => ({ g, local: true })), ...G.list.filter(x => x.owner === me.id && x.data && (x.data.players || x.data.kp)).map(x => ({ g: Object.assign({ id: x.id, locked: x.locked }, x.data), local: false }))];
  if (!legacy.length) return false;
  for (const { g } of legacy) {
    const extras = [];
    let myRole = null, myChar = null;
    if (g.kp) { if (g.kp.who === 'me') myRole = 'kp'; else if (g.kp.name) extras.push({ role: 'kp', name: g.kp.name, charName: '' }); }
    (g.players || []).forEach(p => {
      if (p.who === 'me' && !myRole) { myRole = 'pl'; myChar = p; }
      else if (p.name || p.charName) extras.push({ role: 'pl', name: p.name || '', charName: p.charName || '' });
    });
    const up = await sb.from('groups').upsert({ id: g.id, owner: me.id, locked: !!g.locked, data: { name: g.name || '', date: g.date || '', note: g.note || '', extras }, updated_at: new Date().toISOString() });
    if (up.error) throw up.error;
    const r = await sb.from('group_members').upsert({ group_id: g.id, user_id: me.id, status: 'joined', role: myRole || 'pl', char_id: myChar ? myChar.charId || null : null, char_name: myChar ? myChar.charName || null : null });
    if (r.error) throw r.error;
  }
  state.groups = []; save();
  return true;
}
function rosterOf(g) {
  const joined = (g.members || []).filter(m => m.status === 'joined');
  const kp = [...joined.filter(m => m.role === 'kp').map(m => ({ user: m.user_id, name: gUser(m.user_id) })), ...(g.data.extras || []).filter(x => x.role === 'kp').map(x => ({ name: x.name }))];
  const pl = [...joined.filter(m => m.role === 'pl').map(m => ({ user: m.user_id, name: gUser(m.user_id), charId: m.char_id, charName: m.char_name })), ...(g.data.extras || []).filter(x => x.role !== 'kp').map(x => ({ name: x.name, charName: x.charName }))];
  const pending = (g.members || []).filter(m => m.status === 'invited').map(m => gUser(m.user_id));
  return { kp, pl, pending };
}
function personColor(uid) {
  if (!uid) return '#8a8f99';
  if (me && uid === me.id) return 'var(--sky)';
  const f = friendsOf().find(x => x.uid === uid);
  return f ? f.color : '#6b7280';
}
function charDot(x) {
  if (!x.user || !x.charId) return '';
  const c = (me && x.user === me.id) ? state.chars.find(ch => ch.id === x.charId) : null;
  const av = c ? (c.avatar || '') : (((online && online.chars && online.chars[x.user]) || []).find(ch => ch.id === x.charId) || {}).avatar;
  return av ? `<span class="gc-dot img"><img src="${esc(av)}" alt=""></span>` : '';
}
const dot = (name, uid) => `<span class="gc-dot ${AVATARS[uid] ? 'img' : ''}" style="--c:${esc(personColor(uid))}">${avImg(uid) || esc((name || '？').charAt(0))}</span>`;
const safeRoom = u => /^https:\/\/[^\s"'<>]+$/.test(u || '') ? u : '';
function roomRow(g, member) {
  const url = safeRoom((g.data || {}).roomUrl);
  if (!url) return '';
  if (!member) return '<div class="gc-room"><span class="gc-room-n">ココフォリアのルームあり（参加者だけが開けます）</span></div>';
  return `<div class="gc-room"><a class="btn small primary gc-room-go" href="${esc(url)}" target="_blank" rel="noopener noreferrer"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M11 3h6v6M17 3l-8 8M15 12v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4"/></svg>ココフォリアのルームを開く</a><button class="btn small ghost" type="button" data-gcopy="${esc(url)}">URLをコピー</button></div>`;
}
function groupCardHtml(g, kind) {
  const d = g.data || {}, { kp, pl, pending } = rosterOf(g), mine = myRow(g), owner = me && g.owner === me.id;
  const chips = pl.map(x => `<button class="gc-pl" type="button" ${x.user && x.charId ? `data-gm-user="${x.user}" data-gm-char="${esc(x.charId)}"` : 'disabled'}>
      ${charDot(x) || dot(x.name, x.user)}<span class="gc-pn">${esc(x.name || '？')}</span>${x.charName ? `<span class="gc-cn">${esc(x.charName)}</span>` : '<span class="gc-none">キャラ未設定</span>'}</button>`).join('');
  let actions = '';
  if (kind === 'invite') actions = `<button class="btn small primary" type="button" data-gjoin="${g.id}">参加する</button><button class="btn small" type="button" data-gdecline="${g.id}">断る</button>`;
  else if (owner) actions = `<button class="btn small" type="button" data-gedit="${g.id}">編集</button>`;
  else if (mine && mine.status === 'joined') actions = `<button class="btn small" type="button" data-gjoin="${g.id}">参加内容を変更</button>`;
  return `<article class="grp-card ${g.locked ? 'locked' : ''} ${kind === 'invite' ? 'invite' : ''}">
    ${kind === 'invite' ? `<p class="gc-invite">${esc(gUser(g.owner))}さんから招待が届いています。キーパーか探索者かを選んで参加してください。</p>` : ''}
    <div class="gc-top">
      <div class="gc-title"><b>${esc(d.name || '無題のシナリオ')}</b>${d.date ? `<span class="gc-date">${esc(d.date)}</span>` : ''}</div>
      ${g.locked ? `<span class="gc-lock" title="グループの参加者以外には見えません">${LOCK_ICON}非公開</span>` : ''}
      <span class="gc-owner">代表 ${dot(gUser(g.owner), g.owner)}${esc(gUser(g.owner))}</span>
      ${actions}
    </div>
    <div class="gc-row"><span class="gc-role kp">KP</span><div class="gc-pls">${kp.length ? kp.map(x => `<span class="gc-kp">${dot(x.name, x.user)}${esc(x.name || '？')}</span>`).join('') : '<span class="gc-none">未定</span>'}</div></div>
    <div class="gc-row"><span class="gc-role pl">探索者</span><div class="gc-pls">${chips || '<span class="gc-none">未定</span>'}</div></div>
    ${pending.length ? `<div class="gc-row"><span class="gc-role wait">招待中</span><div class="gc-pls">${pending.map(n => `<span class="gc-wait">${esc(n)}</span>`).join('')}</div></div>` : ''}
    ${roomRow(g, owner || (mine && mine.status === 'joined'))}
    ${diceRowHtml(g, mine)}
    ${d.note ? `<p class="gc-note">${esc(d.note)}</p>` : ''}
  </article>`;
}
function sortGroups(list) { return [...list].sort((a, b) => String(b.data.date || '').localeCompare(String(a.data.date || '')) || String(b.updated || '').localeCompare(String(a.updated || ''))); }
function renderGroupSelect(stage) {
  stage.classList.remove('grid'); stage.classList.add('listv'); stage.style.height = '';
  if (isFree()) { stage.innerHTML = `<div class="grp-gate free-gate">${lockCardHtml('group')}</div>`; return; }   // 無料版：鍵と「欲しい！」
  if (!cloudReady() || !me) {
    stage.innerHTML = `<div class="grp-gate"><p>グループは、アカウントを持っている人どうしで作ります。代表者がグループを作ってフレンドを招待し、招待された人がキーパーか探索者かを選んで参加します。</p><button class="btn primary" type="button" id="sel-login">ログイン・新規登録</button></div>`;
    return;
  }
  if (G.err === 'setup') {
    stage.innerHTML = `<div class="grp-gate"><p>グループの招待機能を使うには、サーバーの追加設定（<b>supabase/03-group-invites.sql</b>）が必要です。Supabase の SQL Editor で実行してから、ページを再読み込みしてください。</p></div>`;
    return;
  }
  const inv = sortGroups(G.list.filter(g => { const r = myRow(g); return r && r.status === 'invited'; }));
  const mine = sortGroups(G.list.filter(g => g.owner === me.id || (myRow(g) && myRow(g).status === 'joined')));
  const fr = sortGroups(G.list.filter(g => g.owner !== me.id && !myRow(g)));
  stage.innerHTML = `${inv.length ? `<h3 class="grp-h">届いている招待</h3><div class="grp-list">${inv.map(g => groupCardHtml(g, 'invite')).join('')}</div>` : ''}
    <button class="sel-list-new" type="button" id="sel-newgroup"><span class="plus">＋</span>グループをつくってフレンドを招待する</button>
    ${mine.length ? `<h3 class="grp-h">参加しているグループ</h3><div class="grp-list">${mine.map(g => groupCardHtml(g, 'mine')).join('')}</div>` : (G.err ? `<p class="err">${esc(G.err)}</p>` : '<p class="empty grp-empty">まだグループがありません。遊ぶシナリオごとにグループを作り、フレンドを招待しましょう。</p>')}
    ${fr.length ? `<h3 class="grp-h">フレンドのグループ</h3><div class="grp-list">${fr.map(g => groupCardHtml(g, 'friend')).join('')}</div>` : ''}`;
}
const charOptions = sel => state.chars.filter(c => !c.sample || state.chars.length === 1).map(c => `<option value="${c.id}" ${sel === c.id ? 'selected' : ''}>${esc(c.profile.name || '名無し')}${c.locked ? '（非公開のキャラ）' : ''}</option>`).join('');
const roleSwitch = (cur, attr) => `<div class="role-sw" role="group" aria-label="役割">${['kp', 'pl'].map(r => `<button type="button" class="role-btn ${cur === r ? 'on' : ''}" ${attr}="${r}" aria-pressed="${cur === r}"><b>${ROLE[r]}</b><small>${r === 'kp' ? 'シナリオを回す' : 'キャラで遊ぶ'}</small></button>`).join('')}</div>`;
/* ---- 代表をゆずる（参加中のメンバーだけが相手になれる） ---- */
function transferHtml(d) {
  const joined = (d.members || []).filter(m => m.status === 'joined' && m.user_id !== me.id);
  return `<div class="gm-sec gm-transfer"><b>代表をゆずる</b>
    <span class="hint">代表（グループの編集・招待・削除ができる人）を、参加中のメンバーにゆずれます。ゆずったあと、あなたは参加者として残ります。ほかの変更は先に「保存」してください。</span>
    ${joined.length ? `<div class="row"><select class="inp" id="g-newowner" aria-label="代表をゆずる相手"><option value="">ゆずる相手を選ぶ</option>${joined.map(m => `<option value="${m.user_id}">${esc(gUser(m.user_id))}（${m.role ? ROLE[m.role] : '参加中'}）</option>`).join('')}</select>
      <button class="btn small" type="button" data-gact="transfer">代表をゆずる</button></div>`
      : '<span class="empty">まだ参加中のメンバーがいないので、ゆずれません。招待した人が参加すると選べるようになります。</span>'}</div>`;
}
async function transferGroup(btn) {
  const d = gDraft, to = $('g-newowner') && $('g-newowner').value, err = $('g-err');
  err.textContent = '';
  if (!to) { err.textContent = 'ゆずる相手を選んでください。'; return; }
  if (!arm(btn, `${gUser(to)}さんにゆずる（もう一度押す）`)) return;
  btn.disabled = true;
  try {
    const { error } = await sb.rpc('transfer_group', { gid: d.id, new_owner: to });
    if (error) throw error;
    closeModals(); await loadGroups(); renderSelect(); popSelect();
    toast(`グループ「${d.name || '名前なし'}」の代表を${gUser(to)}さんにゆずりました。あなたは参加者として残っています。`);
  } catch (er) {
    const m = String(er && er.message || '');
    const known = { not_found: 'グループが見つかりません。', not_owner: '代表をゆずれるのは、いまの代表者だけです。', bad_target: 'ゆずる相手を選んでください。', not_member: '代表をゆずれるのは、このグループに参加中のメンバーだけです。' };
    const code = Object.keys(known).find(k => m.includes(k));
    err.textContent = code ? known[code] : /transfer_group|Could not find the function|schema cache/.test(m) ? 'サーバーの追加設定（supabase/08-group-transfer.sql）がまだのようです。Supabase の SQL Editor で実行してください。'
      : /[ぁ-んァ-ヶ一-龠]/.test(m) ? m : jaErr(er);
  } finally { btn.disabled = false; }
}
/* ---- 代表者の編集画面 ---- */
function renderGroupEditor() {
  const d = gDraft;
  $('grp-title').textContent = d._new ? '新しいグループ' : 'グループを編集';
  const friends = (online && online.friends) || [];
  const memberById = Object.fromEntries((d.members || []).map(m => [m.user_id, m]));
  $('grp-body').innerHTML = `
    <div class="fields">
      <div class="field wide"><label for="g-name">シナリオ名</label><input class="inp" id="g-name" data-g="name" value="${esc(d.name)}" placeholder="例：悪霊の家"></div>
      <div class="field wide"><label for="g-room">ココフォリアのルームURL</label><input class="inp" id="g-room" data-g="roomUrl" value="${esc(d.roomUrl)}" placeholder="https://ccfolia.com/rooms/…" inputmode="url" autocomplete="off"><span class="hint">参加者のカードに「ルームを開く」ボタンが出ます。公開グループでも、ボタンは参加者にだけ表示されます。</span></div>
      <div class="field"><label for="g-date">日付</label><input class="inp" id="g-date" data-g="date" value="${esc(d.date)}" placeholder="例：2026/10/01"></div>
      <div class="field"><span class="lbl">公開</span><button class="btn lock-btn ${d.locked ? 'on' : ''}" type="button" data-gact="lock" aria-pressed="${d.locked}">${d.locked ? LOCK_ICON + '非公開（参加者だけ）' : UNLOCK_ICON + 'フレンドに公開'}</button></div>
    </div>
    <div class="gm-sec"><b>あなたの参加</b>${roleSwitch(d.myRole, 'data-gmyrole')}
      ${d.myRole === 'pl' ? `<select class="inp" id="g-mychar" aria-label="使う探索者"><option value="">使う探索者を選ぶ</option>${charOptions(d.myChar)}</select>` : ''}</div>
    <div class="gm-sec"><b>フレンドを招待</b><span class="hint">招待された人が、参加するときにキーパーか探索者かを選びます。</span>
      <div class="gm-friends">${friends.length ? friends.map(u => {
        const m = memberById[u.id], on = d.invite.includes(u.id), removed = d.remove.includes(u.id);
        if (m && !removed) return `<span class="gm-mem">${dot(u.username, u.id)}<b>${esc(u.username)}</b><small>${m.status === 'joined' ? (m.role ? ROLE[m.role] + 'で参加中' : '参加中') : '招待中'}</small><button class="icon-btn" type="button" data-gact="remove" data-u="${u.id}" aria-label="${esc(u.username)}をグループから外す">×</button></span>`;
        return `<button type="button" class="fchip ${on ? 'on' : ''}" style="--fc:${esc(personColor(u.id))}" data-gact="invite" data-u="${u.id}" aria-pressed="${on}"><span class="fdot">${avImg(u.id) || esc((u.username || '？').charAt(0))}</span>${esc(u.username)}${removed ? '（外す）' : ''}</button>`;
      }).join('') : '<span class="empty">オンラインのフレンドがいません。「フレンド」タブでフレンドを追加すると招待できます。</span>'}
      ${(d.members || []).filter(m => m.user_id !== me.id && !friends.some(u => u.id === m.user_id)).map(m => `<span class="gm-mem">${dot(gUser(m.user_id), m.user_id)}<b>${esc(gUser(m.user_id))}</b><small>${m.status === 'joined' ? ROLE[m.role] || '参加中' : '招待中'}</small></span>`).join('')}</div></div>
    <div class="gm-sec"><b>アプリを使っていない参加者</b><span class="hint">アカウントのない人は、ここに名前を書いておけます。</span>
      <div class="gm-list">${d.extras.map((x, i) => `<div class="gm-row ex">
        <select class="inp" data-gx="role" data-i="${i}" aria-label="役割"><option value="kp" ${x.role === 'kp' ? 'selected' : ''}>キーパー</option><option value="pl" ${x.role !== 'kp' ? 'selected' : ''}>探索者</option></select>
        <input class="inp" data-gx="name" data-i="${i}" placeholder="名前" value="${esc(x.name || '')}" aria-label="名前">
        <input class="inp" data-gx="charName" data-i="${i}" placeholder="キャラ名（探索者のとき）" value="${esc(x.charName || '')}" aria-label="キャラ名">
        <button class="icon-btn" type="button" data-gact="rmx" data-i="${i}" aria-label="この参加者を消す">×</button></div>`).join('')}</div>
      <button class="btn small" type="button" data-gact="addx">＋ 参加者を書き加える</button></div>
    <div class="field wide"><label for="g-note">メモ（生還・ロスト・感想など）</label><textarea class="inp" id="g-note" data-g="note" rows="3">${esc(d.note)}</textarea></div>
    ${d._new ? '' : transferHtml(d)}
    <p class="err" id="g-err" role="alert"></p>`;
  $('grp-del').hidden = !!d._new;
}
function openGroupEditor(id) {
  const g = id && G.list.find(x => x.id === id);
  const mine = g && myRow(g);
  gDraft = g
    ? { id: g.id, name: g.data.name || '', date: g.data.date || '', note: g.data.note || '', roomUrl: g.data.roomUrl || '', locked: g.locked, extras: JSON.parse(JSON.stringify(g.data.extras || [])), members: g.members, invite: [], remove: [], myRole: (mine && mine.role) || 'kp', myChar: (mine && mine.char_id) || '' }
    : { _new: true, id: uid(), name: '', date: '', note: '', roomUrl: '', locked: false, extras: [], members: [], invite: [], remove: [], myRole: 'kp', myChar: '' };
  renderGroupEditor(); openModal('modal-group');
}
$('grp-body').addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.g) gDraft[t.dataset.g] = t.value;
  if (t.dataset.gx) gDraft.extras[+t.dataset.i][t.dataset.gx] = t.value;
});
$('grp-body').addEventListener('change', e => {
  if (e.target.id === 'g-mychar') gDraft.myChar = e.target.value;
  if (e.target.dataset.gx === 'role') gDraft.extras[+e.target.dataset.i].role = e.target.value;
});
$('grp-body').addEventListener('click', e => {
  const r = e.target.closest('[data-gmyrole]');
  if (r) { gDraft.myRole = r.dataset.gmyrole; if (gDraft.myRole === 'pl' && !gDraft.myChar) gDraft.myChar = state.activeId; renderGroupEditor(); return; }
  const b = e.target.closest('[data-gact]'); if (!b) return;
  const u = b.dataset.u, act = b.dataset.gact;
  if (act === 'transfer') { transferGroup(b); return; }
  if (act === 'lock') gDraft.locked = !gDraft.locked;
  if (act === 'invite') { const rm = gDraft.remove.indexOf(u); if (rm >= 0) gDraft.remove.splice(rm, 1); else { const i = gDraft.invite.indexOf(u); if (i >= 0) gDraft.invite.splice(i, 1); else gDraft.invite.push(u); } }
  if (act === 'remove') gDraft.remove.push(u);
  if (act === 'addx') gDraft.extras.push({ role: 'pl', name: '', charName: '' });
  if (act === 'rmx') gDraft.extras.splice(+b.dataset.i, 1);
  renderGroupEditor();
});
$('grp-save').addEventListener('click', async e => {
  const d = gDraft, btn = e.currentTarget;
  if (!d.name.trim()) { $('g-err').textContent = 'シナリオ名を書いてください。'; $('g-name').focus(); return; }
  if (d.myRole === 'pl' && !d.myChar) { $('g-err').textContent = '使う探索者を選んでください。'; return; }
  d.roomUrl = (d.roomUrl || '').trim();
  if (d.roomUrl && !safeRoom(d.roomUrl)) { $('g-err').textContent = 'ルームURLは https:// で始まるURLを入れてください。'; $('g-room').focus(); return; }
  btn.disabled = true;
  try {
    const ch = state.chars.find(c => c.id === d.myChar);
    let r = await sb.from('groups').upsert({ id: d.id, owner: me.id, locked: !!d.locked, data: { name: d.name.trim(), date: d.date.trim(), note: d.note, roomUrl: d.roomUrl, extras: d.extras.filter(x => (x.name || '').trim() || (x.charName || '').trim()) }, updated_at: new Date().toISOString() });
    if (r.error) throw r.error;
    r = await sb.from('group_members').upsert({ group_id: d.id, user_id: me.id, status: 'joined', role: d.myRole, char_id: d.myRole === 'pl' ? d.myChar : null, char_name: d.myRole === 'pl' && ch ? (ch.profile.name || '名無し') : null });
    if (r.error) throw r.error;
    const have = new Set((d.members || []).map(m => m.user_id));
    const inv = d.invite.filter(u => !have.has(u));
    if (inv.length) { r = await sb.from('group_members').insert(inv.map(u => ({ group_id: d.id, user_id: u, status: 'invited', invited_by: me.id }))); if (r.error) throw r.error; }
    for (const u of d.remove) { r = await sb.from('group_members').delete().eq('group_id', d.id).eq('user_id', u); if (r.error) throw r.error; }
    closeModals(); await loadGroups(); renderSelect(); popSelect();
    toast(inv.length ? `グループ「${d.name.trim()}」を保存し、${inv.length}人を招待しました。` : `グループ「${d.name.trim()}」を保存しました。`);
  } catch (er) { $('g-err').textContent = groupMissing(er) ? 'サーバーの追加設定（supabase/03-group-invites.sql）がまだのようです。' : jaErr(er); }
  finally { btn.disabled = false; }
});
$('grp-del').addEventListener('click', async e => {
  if (!arm(e.currentTarget, '本当に削除')) return;
  const r = await sb.from('groups').delete().eq('id', gDraft.id);
  if (r.error) { $('g-err').textContent = jaErr(r.error); return; }
  closeModals(); await loadGroups(); renderSelect();
  toast('グループを削除しました。');
});
/* ---- 招待された人：参加・変更・抜ける ---- */
function renderJoin() {
  const g = G.list.find(x => x.id === joinCtx.id); if (!g) return;
  const r = myRow(g), joined = r && r.status === 'joined';
  $('join-title').textContent = joined ? '参加内容を変更' : `「${g.data.name || '無題のシナリオ'}」に参加する`;
  $('join-body').innerHTML = `<p>${esc(gUser(g.owner))}さんのグループです。${joined ? '役割や使う探索者を変えられます。' : 'キーパーか探索者かを選んでください。'}</p>
    ${roleSwitch(joinCtx.role, 'data-jrole')}
    ${joinCtx.role === 'pl' ? `<label class="lbl" for="j-char">使う探索者</label><select class="inp" id="j-char"><option value="">選ぶ</option>${charOptions(joinCtx.char)}</select><p class="hint">非公開のキャラを選ぶと、ほかの参加者にはキャラ名だけ表示され、キャラシは開けません。</p>` : ''}
    <p class="err" id="j-err" role="alert"></p>`;
  $('join-leave').hidden = !joined;
  $('join-ok').textContent = joined ? '変更する' : '参加する';
}
function openJoin(id) {
  const g = G.list.find(x => x.id === id); if (!g) return;
  const r = myRow(g);
  joinCtx = { id, role: (r && r.role) || 'pl', char: (r && r.char_id) || state.activeId };
  renderJoin(); openModal('modal-join');
}
$('join-body').addEventListener('click', e => { const b = e.target.closest('[data-jrole]'); if (b) { joinCtx.role = b.dataset.jrole; renderJoin(); } });
$('join-body').addEventListener('change', e => { if (e.target.id === 'j-char') joinCtx.char = e.target.value; });
$('join-ok').addEventListener('click', async () => {
  if (joinCtx.role === 'pl' && !joinCtx.char) { $('j-err').textContent = '使う探索者を選んでください。'; return; }
  const ch = state.chars.find(c => c.id === joinCtx.char);
  const r = await sb.from('group_members').update({ status: 'joined', role: joinCtx.role, char_id: joinCtx.role === 'pl' ? joinCtx.char : null, char_name: joinCtx.role === 'pl' && ch ? (ch.profile.name || '名無し') : null }).eq('group_id', joinCtx.id).eq('user_id', me.id);
  if (r.error) { $('j-err').textContent = jaErr(r.error); return; }
  closeModals(); await loadGroups(); renderSelect();
  toast(`${ROLE[joinCtx.role]}として参加しました。`);
});
$('join-leave').addEventListener('click', async e => {
  if (!arm(e.currentTarget, '本当に抜ける')) return;
  const r = await sb.from('group_members').delete().eq('group_id', joinCtx.id).eq('user_id', me.id);
  if (r.error) { $('j-err').textContent = jaErr(r.error); return; }
  closeModals(); await loadGroups(); renderSelect();
  toast('グループから抜けました。');
});
async function declineGroup(id) {
  const r = await sb.from('group_members').delete().eq('group_id', id).eq('user_id', me.id);
  if (r.error) { toast(jaErr(r.error)); return; }
  await loadGroups(); renderSelect();
  toast('招待を断りました。');
}
function openMemberChar(user, charId) {
  if (me && user === me.id) {
    const c = state.chars.find(x => x.id === charId);
    if (!c) { toast('このキャラはこの端末に見つかりませんでした。'); return; }
    state.activeId = c.id; save(); renderShelf(); renderSheet(); renderOutput(); leaveSelect(null); playCharBgm(active()); return;
  }
  if (!isFriendUid(user)) { toast(`${gUser(user)}さんはフレンドではないため、キャラシを開けません。`); return; }
  viewFriend(user, gUser(user)).then(() => {
    const idx = fviewChars.findIndex(c => c.id === charId);
    if (idx >= 0) document.querySelector(`#fview-body [data-fv="${idx}"]`)?.click();
    else toast('このキャラシは非公開か、見つかりませんでした。');
  });
}

/* 探索者を消したとき、その探索者を使っているグループの参加情報を「未設定」にもどす */
async function unsetGroupChar(charId) {
  (G.list || []).forEach(g => (g.members || []).forEach(m => { if (me && m.user_id === me.id && m.char_id === charId) { m.char_id = null; m.char_name = null; } }));
  if (!sbClient() || !me) return;
  try {
    const { error } = await sb.from('group_members').update({ char_id: null, char_name: null }).eq('user_id', me.id).eq('char_id', charId);
    if (error) throw error;
  } catch (e) { console.warn('group char unset failed', e); }
}

/* ---- ダイスの上限（キーパーが決める） ---- */
function diceRowHtml(g, mine) {
  const kps = (g.members || []).filter(m => m.role === 'kp' && m.status === 'joined' && m.dice_limit != null);
  const lim = kps.length ? Math.min(...kps.map(m => +m.dice_limit)) : null;
  if (mine && mine.status === 'joined' && mine.role === 'kp') {
    return `<div class="gc-dice"><span class="gc-role dice">ダイス</span>
      <label>能力値ダイスの上限<input class="inp" type="text" inputmode="numeric" id="gd-${esc(g.id)}" value="${mine.dice_limit ?? ''}" placeholder="なし" aria-label="ダイスの上限回数（空欄で上限なし）">回</label>
      <button class="btn small" type="button" data-gdice-save="${esc(g.id)}">決める</button>
      <button class="btn small ghost" type="button" data-gdice-reset="${esc(g.id)}">みんなの回数をリセット</button></div>`;
  }
  return lim != null ? `<div class="gc-dice"><span class="gc-role dice">ダイス</span><span>能力値ダイスは <b>${lim}回</b> まで（キーパーが設定）</span></div>` : '';
}
async function saveGroupDice(gid, patch, okMsg) {
  try {
    if (G.noDice) throw { message: 'dice_limit' };
    const { error } = await sb.from('group_members').update(patch).eq('group_id', gid).eq('user_id', me.id);
    if (error) throw error;
    await loadGroups(); renderSelect(); renderSheet(); toast(okMsg);
  } catch (e) {
    toast(/dice/.test(e.message || '') ? 'サーバーの追加設定（supabase/09-dice-limit.sql）がまだのようです。Supabase の SQL Editor で実行してください。' : 'ダイスの上限を保存できませんでした：' + jaErr(e));
  }
}
$('select').addEventListener('click', e => {
  const s = e.target.closest('[data-gdice-save]');
  if (s) {
    const gid = s.dataset.gdiceSave, raw = toHalf(($('gd-' + gid) || {}).value || '').trim();
    if (raw !== '' && !/^\d{1,3}$/.test(raw)) { toast('上限は 0〜999 の数字で入れてください（空欄で上限なし）。'); return; }
    saveGroupDice(gid, { dice_limit: raw === '' ? null : +raw }, raw === '' ? 'ダイスの上限をなしにしました。' : `ダイスの上限を ${raw} 回にしました。参加している探索者のキャラに反映されます。`);
    return;
  }
  const r = e.target.closest('[data-gdice-reset]');
  if (r) { if (!arm(r, 'もう一度押すとリセット')) return; saveGroupDice(r.dataset.gdiceReset, { dice_reset: new Date().toISOString() }, 'みんなのダイスの回数をリセットしました。'); }
});
