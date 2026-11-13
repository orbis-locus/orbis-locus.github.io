/* ================= ORBiS 管理ページ（マスターだけ使える） =================
   サーバーは本番と同じ Supabase（住所と鍵は build.py が 21-cloud.js から写す）。
   ログインは本番の ORBiS と同じ保存場所なので、本番でログインしていれば、そのまま使える。
   中身を読めるかどうかは、サーバーの関数がマスターかどうかで決めている（このページを開いただけでは何も見えない）。 */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const okAvatar = u => typeof u === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : '';
const day = t => { const d = new Date(t); return isNaN(d) ? '' : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* */ } } };
const missing = e => /Could not find the function|does not exist/i.test(String(e && e.message));
const errText = e => missing(e) ? 'サーバーの準備（SQL の実行）がまだのようです。' : 'うまくいきませんでした：' + String((e && e.message) || e);
/* 押しまちがい防止：1回目は「もう一度押すと…」にして、3秒以内にもう一度押したら実行 */
function arm(b, label) {
  if (b.dataset.armed) { delete b.dataset.armed; return true; }
  const old = b.textContent; b.dataset.armed = '1'; b.textContent = label;
  setTimeout(() => { if (b.dataset.armed) { delete b.dataset.armed; b.textContent = old; } }, 3000);
  return false;
}

const URL_ = '__CLOUD_URL__', KEY = '__CLOUD_KEY__';
const sb = window.supabase && window.supabase.createClient ? window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
let me = null, tab = store.get('orbis-admin.tab') || 'staging';
const loaded = {};

/* ---- ログインと権限 ---- */
function show(which) { ['ad-login', 'ad-deny', 'ad-app'].forEach(id => { $(id).hidden = id !== which; }); }
function renderMe() {
  $('ad-me').innerHTML = me ? `<span>ログイン中：<b>${esc(me.username || '')}</b></span> <span class="ad-mail">${esc(me.email || '')}</span><button class="ad-btn small" type="button" id="ad-logout">ログアウト</button>` : '';
}
async function onSession(session) {
  const u = session && session.user;
  if (!u) { me = null; renderMe(); show('ad-login'); return; }
  if (me && me.id === u.id) return;
  me = { id: u.id, email: u.email, username: (u.user_metadata || {}).username || '' };
  const p = await sb.from('profiles').select('username').eq('id', u.id).maybeSingle();
  if (p.data && p.data.username) me.username = p.data.username;
  renderMe();
  const r = await sb.rpc('my_app_role');
  if (r.error || r.data !== 'master') {
    $('ad-deny-msg').textContent = r.error ? errText(r.error) : 'このアカウントには、管理ページを使う権限がありません（マスターだけが使えます）。';
    show('ad-deny'); return;
  }
  show('ad-app');
  openTab(tab);
  loadReports(true); loadContacts(true);   // 届いている数だけ、先にタブに出す
}
$('ad-login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const err = $('ad-login-err'); err.textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email: $('ad-email').value.trim(), password: $('ad-pass').value });
  if (error) err.textContent = /Invalid login/i.test(error.message) ? 'メールアドレスかパスワードがちがいます。' : errText(error);
});
document.addEventListener('click', async e => {
  if (e.target.closest('#ad-logout')) { await sb.auth.signOut(); location.reload(); }
});

/* ---- タブ ---- */
function openTab(t) {
  tab = t; store.set('orbis-admin.tab', t);
  document.querySelectorAll('[data-tab]').forEach(b => { const on = b.dataset.tab === t; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  document.querySelectorAll('[data-pane]').forEach(p => { p.hidden = p.dataset.pane !== t; });
  if (t === 'staging' || t === 'prod') startFrame(t);
  if (t === 'staging') loadNotes();
  if (!loaded[t] || t === 'reports' || t === 'contacts') ({ reports: loadReports, contacts: loadContacts, wants: loadWants, users: loadUsers }[t] || (() => {}))();
  loaded[t] = true;
}
$('ad-tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) openTab(b.dataset.tab); });
document.addEventListener('click', e => {
  const r = e.target.closest('[data-refresh]');
  if (r) ({ reports: loadReports, contacts: loadContacts, wants: loadWants, users: loadUsers }[r.dataset.refresh])();
});

/* ---- 検証版・本番：ページの中でアプリを動かす（開いたときに初めて読みこむ） ---- */
function frameOf(t) { return document.querySelector(`[data-frame="${t}"]`); }
function startFrame(t) {
  const f = frameOf(t);
  if (!f.src) f.src = f.dataset.src;
  setSize(t, store.get('orbis-admin.size.' + t) || 'pc');
}
function setSize(t, size) {
  store.set('orbis-admin.size.' + t, size);
  const w = document.querySelector(`[data-frame-wrap="${t}"]`);
  w.classList.remove('pc', 'phone', 'full'); w.classList.add(size);
  document.querySelectorAll(`[data-size-for="${t}"] [data-size]`).forEach(b => b.classList.toggle('on', b.dataset.size === size));
}
document.addEventListener('click', e => {
  const s = e.target.closest('[data-size]');
  if (s) { setSize(s.closest('[data-size-for]').dataset.sizeFor, s.dataset.size); return; }
  const rl = e.target.closest('[data-reload]');
  if (rl) { const f = frameOf(rl.dataset.reload); f.src = f.dataset.src + '?t=' + Date.now(); if (rl.dataset.reload === 'staging') loadNotes(); }
});
async function loadNotes() {
  try {
    const r = await fetch('../staging/notes.txt?t=' + Date.now(), { cache: 'no-store' });
    $('ad-notes').textContent = r.ok ? await r.text() : '（検証版はまだありません）';
  } catch (e) { $('ad-notes').textContent = '（変更点のメモを読めませんでした）'; }
}

/* ---- 通報（supabase/20-reports.sql） ---- */
const RP_KIND = { username: 'ユーザー名', avatar: 'アイコン画像', group: 'グループの名前', other: 'そのほか' };
function badge(id, n) { const b = $(id); b.hidden = !n; b.textContent = n || ''; }
async function loadReports(countOnly) {
  const el = $('ad-reports');
  const { data, error } = await sb.rpc('report_list');
  if (error) { if (!countOnly) el.innerHTML = `<p class="ad-err">${esc(errText(error))}</p>`; return; }
  const list = data || [];
  badge('ad-badge-reports', list.length);
  if (countOnly && tab !== 'reports') return;
  if (!list.length) { el.innerHTML = '<p class="ad-list-empty">まだ対応していない通報はありません。</p>'; return; }
  el.innerHTML = list.map(r => {
    const av = okAvatar(r.target_avatar), gone = r.target_name == null, acts = [];
    if (!gone && (r.kind === 'username' || r.kind === 'other')) acts.push(['reset_name', '名前をリセット']);
    if (!gone && av && (r.kind === 'avatar' || r.kind === 'other')) acts.push(['clear_avatar', 'アイコンを消す']);
    if (r.kind === 'group' && r.group_name != null) acts.push(['rename_group', 'グループの名前を消す']);
    return `<article class="ad-item">
      <div class="ad-item-head"><span class="ad-tag">${esc(RP_KIND[r.kind] || r.kind)}</span><small>${esc(day(r.created_at))} ・ 通報した人：${esc(r.reporter_name || '（退会したユーザー）')}</small></div>
      <div class="ad-who"><span class="ad-av">${av ? `<img src="${esc(av)}" alt="">` : esc((r.target_name || '？').charAt(0))}</span>
        <div><b>${gone ? '（退会したユーザー）' : esc(r.target_name)}</b>
        ${r.kind === 'group' ? `<small>グループの名前：「${esc(r.group_name != null ? r.group_name : '（もう削除されています）')}」</small>` : r.snap_name && r.snap_name !== r.target_name ? `<small>通報のときの名前：「${esc(r.snap_name)}」</small>` : ''}</div></div>
      ${r.note ? `<p class="ad-note">${esc(r.note)}</p>` : ''}
      <div class="ad-acts">${acts.map(([a, l]) => `<button class="ad-btn small danger" type="button" data-mod="${a}" data-rid="${esc(r.id)}">${l}</button>`).join('')}<button class="ad-btn small" type="button" data-mod="dismiss" data-rid="${esc(r.id)}">問題なし（閉じる）</button></div>
    </article>`;
  }).join('');
}
$('ad-reports').addEventListener('click', async e => {
  const b = e.target.closest('[data-mod]'); if (!b) return;
  if (b.dataset.mod !== 'dismiss' && !arm(b, 'もう一度押すと実行')) return;
  b.disabled = true;
  const { data, error } = await sb.rpc('mod_action', { report_id: b.dataset.rid, act: b.dataset.mod });
  if (error || data !== 'ok') { alert(error ? errText(error) : String(data)); b.disabled = false; return; }
  loadReports();
});

/* ---- お問い合わせ（supabase/21-contacts.sql） ---- */
const CT_KIND = { bug: '不具合', delete: 'アカウントの削除', privacy: '個人情報について', rights: '権利について', idea: 'ご意見・ご要望', other: 'そのほか' };
async function loadContacts(countOnly) {
  const el = $('ad-contacts');
  const { data, error } = await sb.rpc('contact_list');
  if (error) { if (!countOnly) el.innerHTML = `<p class="ad-err">${esc(errText(error))}</p>`; return; }
  const list = data || [];
  badge('ad-badge-contacts', list.length);
  if (countOnly && tab !== 'contacts') return;
  if (!list.length) { el.innerHTML = '<p class="ad-list-empty">まだ対応していないお問い合わせはありません。</p>'; return; }
  el.innerHTML = list.map(r => {
    const who = r.user_id ? `ログイン中に送信：<b>${esc(r.now_name || r.user_name || '（退会したユーザー）')}</b>${r.user_email ? `（登録メール：${esc(r.user_email)}）` : ''}` : 'ログインなしで送信';
    const mail = r.reply_to ? `mailto:${encodeURIComponent(r.reply_to).replace(/%40/g, '@')}?subject=${encodeURIComponent('ORBiS お問い合わせへのお返事')}` : '';
    return `<article class="ad-item">
      <div class="ad-item-head"><span class="ad-tag blue">${esc(CT_KIND[r.kind] || r.kind)}</span><small>${esc(day(r.created_at))}</small></div>
      <small class="ad-meta">${who}</small>
      <p class="ad-note">${esc(r.body)}</p>
      <small class="ad-meta">お返事先：${r.reply_to ? esc(r.reply_to) : '（書かれていません）'}</small>
      ${r.info ? `<small class="ad-meta">${esc(r.info)}</small>` : ''}
      <div class="ad-acts">${mail ? `<a class="ad-btn small" href="${esc(mail)}">メールで返事を書く</a>` : ''}<button class="ad-btn small" type="button" data-ctclose="${esc(r.id)}">対応済みにする</button></div>
    </article>`;
  }).join('');
}
$('ad-contacts').addEventListener('click', async e => {
  const b = e.target.closest('[data-ctclose]'); if (!b) return;
  if (!arm(b, 'もう一度押すと閉じる')) return;
  b.disabled = true;
  const { data, error } = await sb.rpc('contact_close', { contact_id: b.dataset.ctclose });
  if (error || data !== 'ok') { alert(error ? errText(error) : String(data)); b.disabled = false; return; }
  loadContacts();
});

/* ---- 「欲しい！」の数（supabase/15-feature-wants.sql） ---- */
const WANT_NAME = { group: 'グループ', chars: '探索者を4人以上', friendview: 'フレンドのキャラシを見る', 'theme:sky': 'テーマ「近未来」', 'theme:sakura': 'テーマ「和風」', 'theme:book': 'テーマ「魔導書」', 'theme:aqua': 'テーマ「アクアリウム」', 'theme:dot': 'テーマ「ドット」' };
async function loadWants() {
  const el = $('ad-wants');
  const { data, error } = await sb.rpc('want_counts');
  if (error) { el.innerHTML = `<p class="ad-err">${esc(errText(error))}</p>`; return; }
  const rows = (data || []).map(r => ({ f: r.feature, n: Number(r.n) || 0 })).sort((a, b) => b.n - a.n);
  if (!rows.length) { el.innerHTML = '<p class="ad-list-empty">まだ「欲しい！」は押されていません。</p>'; return; }
  const max = Math.max(...rows.map(r => r.n), 1);
  el.innerHTML = `<table class="ad-table"><thead><tr><th>機能</th><th style="width:45%"></th><th>数</th></tr></thead><tbody>${rows.map(r =>
    `<tr><td>${esc(WANT_NAME[r.f] || r.f)}</td><td><div class="ad-bar-mini" style="width:${Math.round(r.n / max * 100)}%"></div></td><td class="num">${r.n}</td></tr>`).join('')}</tbody></table>`;
}

/* ---- 利用者と権限（supabase/05-app-roles.sql・16-testers.sql） ---- */
const ROLE_NAME = { master: 'マスター', editor: '編集者', tester: 'テスター', none: 'なし' };
let users = [];
async function loadUsers() {
  const el = $('ad-users');
  const { data, error } = await sb.rpc('app_users_list');
  if (error) { el.innerHTML = `<p class="ad-err">${esc(errText(error))}</p>`; return; }
  users = data || [];
  renderUsers();
}
function renderUsers() {
  const q = ($('ad-user-q').value || '').trim().toLowerCase();
  const list = users.filter(u => !q || String(u.username || '').toLowerCase().includes(q));
  const cnt = r => users.filter(u => (u.role || 'none') === r).length;
  $('ad-users').innerHTML = `<p class="ad-count">全部で ${users.length} 人（マスター ${cnt('master')}・編集者 ${cnt('editor')}・テスター ${cnt('tester')}）${q ? `／「${esc(q)}」で ${list.length} 人` : ''}</p>
    <table class="ad-table"><thead><tr><th>ユーザー名</th><th>権限</th></tr></thead><tbody>${list.slice(0, 500).map(u =>
      `<tr><td>${esc(u.username || '')}${me && u.user_id === me.id ? '（あなた）' : ''}</td><td><select class="ad-role" data-uid="${esc(u.user_id)}">${Object.entries(ROLE_NAME).map(([k, v]) => `<option value="${k}"${(u.role || 'none') === k ? ' selected' : ''}>${v}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>`;
}
$('ad-user-q').addEventListener('input', renderUsers);
$('ad-users').addEventListener('change', async e => {
  const s = e.target.closest('.ad-role'); if (!s) return;
  const u = users.find(x => x.user_id === s.dataset.uid);
  if (!confirm(`${u ? u.username : ''} さんの権限を「${ROLE_NAME[s.value]}」にしますか？`)) { renderUsers(); return; }
  s.disabled = true;
  const { data, error } = await sb.rpc('set_app_role', { target: s.dataset.uid, new_role: s.value });
  if (error || (data && data !== 'ok')) alert(error ? errText(error) : String(data));
  loadUsers();
});

/* ---- はじめに ---- */
if (!sb) { show('ad-login'); $('ad-login-err').textContent = 'サーバーにつながりませんでした。ネットの接続を確かめてください。'; return; }
sb.auth.onAuthStateChange((ev, session) => { setTimeout(() => onSession(session), 0); });
sb.auth.getSession().then(({ data }) => onSession(data.session)).catch(() => show('ad-login'));
})();
