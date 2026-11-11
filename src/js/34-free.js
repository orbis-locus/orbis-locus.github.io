/* ================= 無料版（サンプル版）の鍵と「欲しい！」ボタン ================= */
/* 制限の決まり（何を止めるか）は 03-state.js の FREE_EDITION のところ。
   鍵のかかった機能を押すと、説明と「欲しい！」ボタンを出す。押された数はサーバー（feature_wants、supabase/15-feature-wants.sql）に
   1人（1つの端末）1機能1回だけ数える。ログインしていない人も数える。マスターはアカウントの小窓で数を見られる。 */
const WANT_KEY = 'charasheet-kobo.wants', VOTER_KEY = 'charasheet-kobo.voter', UNLOCK_KEY = 'charasheet-kobo.unlock';
function lockInfo(f) {
  if (f === 'group') return { t: 'グループ', d: 'シナリオごとにグループを作ってフレンドを招待し、キーパーと探索者の記録を残せます。キーパーがダイスを振れる回数を決めたり、探索者の秘匿を読んだりもできます。' };
  if (f === 'chars') return { t: `探索者を${FREE_MAX_CHARS + 1}人以上`, d: `無料版で作れる探索者は${FREE_MAX_CHARS}人までです（製品版では${MAX_CHARS}人まで）。いらない探索者を削除すると、新しく作れます。` };
  const k = f.replace(/^theme:/, ''), t = THEME_PRESETS[k];
  return { t: `テーマ「${t ? t.name : k}」`, d: `${t ? esc(t.sub) + '。' : ''}無料版で使えるテーマは ORBiS だけです。` };
}
const wantedList = () => { try { const a = JSON.parse(localStorage.getItem(WANT_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
function voterId() {
  try {
    let v = localStorage.getItem(VOTER_KEY);
    if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : uid() + uid()); localStorage.setItem(VOTER_KEY, v); }
    return v;
  } catch (e) { return uid() + uid(); }
}
function lockCardHtml(f) {
  const i = lockInfo(f), done = wantedList().includes(f);
  return `<div class="lock-card">
    <span class="lock-ic">${LOCK_SVG}</span>
    <b class="lock-t">${i.t}</b>
    <span class="lock-tag">製品版で解放予定</span>
    <p class="lock-d">${i.d}</p>
    ${done ? '<p class="lock-thanks">「欲しい！」を送りました。ありがとうございます！</p>'
      : `<p class="lock-ask">使ってみたいと思ったら「欲しい！」を押してください。押された数を、製品版を作るかどうかの参考にします。</p>
    <button class="btn primary lock-want" type="button" data-want="${f}">♡ 欲しい！</button>`}
  </div>`;
}
function lockDialog(f) {
  $('lock-body').innerHTML = lockCardHtml(f);
  openModal('modal-lock');
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-want]'); if (!b) return;
  const f = b.dataset.want, c = sbClient();
  if (wantedList().includes(f)) return;
  if (!c) { toast('いまは送れませんでした。ネットにつながっているか確かめてください。'); return; }
  b.disabled = true;
  const { error } = await c.rpc('add_want', { f, v: voterId() });
  if (error) { b.disabled = false; toast('いまは送れませんでした。少したってから、もう一度押してください。'); return; }
  try { localStorage.setItem(WANT_KEY, JSON.stringify([...wantedList(), f])); } catch (er) { /* */ }
  const card = b.closest('.lock-card'); if (card) card.outerHTML = lockCardHtml(f);
  snd('copy');
  toast('「欲しい！」を送りました。ありがとうございます！');
});
/* マスター・編集者は全部使える（ueCheckAdmin から呼ぶ）。端末に覚えておき、次に開いたときもすぐ使えるように */
function setUnlockAll(on) {
  on = !!on;
  if (unlockAll === on) return;
  unlockAll = on;
  try { on ? localStorage.setItem(UNLOCK_KEY, '1') : localStorage.removeItem(UNLOCK_KEY); } catch (e) { /* */ }
  applyTheme(); renderAll(); renderGroupBadge();
  if (!$('modal-theme').hidden) renderPresets();
  if (!$('select').hidden) renderSelect();
  if (on && me) loadGroups().then(() => { if (!$('select').hidden && selTab === 'groups') renderSelect(); });
}
/* マスター用：「欲しい！」の数（アカウントの小窓） */
const wantsBoxHtml = () => FREE_EDITION && typeof UE !== 'undefined' && UE.role === 'master'
  ? '<div class="wants-box"><button class="btn small" type="button" data-acct="wants">「欲しい！」の数を見る（マスター）</button><div id="wants-out"></div></div>' : '';
async function loadWantCounts() {
  const out = $('wants-out'); if (!out || !sb) return;
  out.innerHTML = '<p class="empty">読み込み中…</p>';
  const { data, error } = await sb.rpc('want_counts');
  if (error) { out.innerHTML = `<p class="err">${esc(/want_counts|Could not find/i.test(error.message || '') ? 'サーバーの準備（supabase/15-feature-wants.sql の実行）がまだのようです。' : jaErr(error))}</p>`; return; }
  const rows = (data || []).sort((a, b) => b.n - a.n);
  out.innerHTML = rows.length ? `<table class="wants-tbl">${rows.map(r => `<tr><td>${lockInfo(r.feature).t}</td><td>${r.n}</td></tr>`).join('')}</table>` : '<p class="empty">まだ押されていません。</p>';
}
