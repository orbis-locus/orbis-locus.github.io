/* ================= 荒らし対策：通報と、マスターの対応 ================= */
/* サーバーは supabase/20-reports.sql。
   ・通報：フレンドの一覧（届いた申請・申請中・フレンド）とグループのカードの「通報」から。ユーザー名・アイコン・グループの名前・そのほか
   ・マスター：アカウントの小窓の「通報を見る」で一覧。名前をリセット・アイコンを消す・グループの名前を消す・問題なしで閉じる
   通報したことは相手には伝わらない。通報の中身を見られるのはマスターだけ */
const RP_KIND = { username: 'ユーザー名', avatar: 'アイコン画像', group: 'グループの名前', other: 'そのほか' };
const RP_MSG = {
  login: 'ログインしてから通報してください。', self: '自分自身は通報できません。', kind: '通報の種類が正しくありません。',
  nouser: 'そのユーザーは見つかりませんでした（もう退会したのかもしれません）。', nogroup: 'そのグループは見つかりませんでした（もう削除されたのかもしれません）。',
  toomany: '通報は1日20件までです。明日またお願いします。',
};
let rpCtx = null;
/* 「通報」ボタン（相手の id と名前。グループのカードではグループの id と名前も） */
const reportBtn = (uid, name, grp) => !me || !uid || uid === me.id ? ''
  : `<button class="rp-btn" type="button" data-report="${esc(uid)}" data-rname="${esc(name || '')}"${grp ? ` data-rgroup="${esc(grp.id)}" data-rgname="${esc(grp.name || '')}"` : ''} title="不適切な名前や画像を運営に知らせる">通報</button>`;
function openReport(ctx) {
  rpCtx = ctx;
  const kinds = ctx.group ? ['group', 'username', 'avatar', 'other'] : ['username', 'avatar', 'other'];
  $('report-title').textContent = `${ctx.name || 'このユーザー'}さんを通報`;
  $('report-body').innerHTML = `
    <p>不適切な名前や画像を、運営に知らせます。運営が確かめて、必要なら名前や画像を消します。<b>通報したことは、相手には伝わりません。</b></p>
    <div class="rp-kinds" role="radiogroup" aria-label="なにが不適切ですか">
      ${kinds.map((k, i) => `<label class="rp-kind"><input type="radio" name="rp-kind" value="${k}" ${i === 0 ? 'checked' : ''}><span>${RP_KIND[k]}${k === 'group' ? `「${esc(ctx.group.name || '無題')}」` : ''}${k === 'other' ? '' : 'が不適切'}</span></label>`).join('')}
    </div>
    <label class="lbl" for="rp-note">くわしく（書かなくても送れます・500文字まで）</label>
    <textarea class="inp" id="rp-note" rows="3" maxlength="500" placeholder="例：ひどい言葉が入っている、なりすましている など"></textarea>
    <p class="err" id="rp-err" role="alert"></p>`;
  $('report-send').disabled = false;
  openModal('modal-report');
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-report]'); if (!b) return;
  e.preventDefault(); e.stopPropagation();
  if (!me || !sb) { toast('ログインしてから通報してください。'); return; }
  openReport({ uid: b.dataset.report, name: b.dataset.rname, group: b.dataset.rgroup ? { id: b.dataset.rgroup, name: b.dataset.rgname } : null });
}, true);
$('report-send').addEventListener('click', async () => {
  if (!rpCtx || !sb || !me) return;
  const kind = (document.querySelector('input[name="rp-kind"]:checked') || {}).value || 'other';
  const btn = $('report-send'), err = $('rp-err');
  btn.disabled = true; err.textContent = '';
  try {
    const { data, error } = await sb.rpc('report_user', { target: rpCtx.uid, kind, ref: kind === 'group' && rpCtx.group ? rpCtx.group.id : null, note: ($('rp-note').value || '').trim() });
    if (error) throw error;
    if (data !== 'ok') { err.textContent = RP_MSG[data] || 'うまく送れませんでした。'; btn.disabled = false; return; }
    $('modal-report').hidden = true;
    toast('通報を送りました。運営が確かめます。ありがとうございます。');
  } catch (er) {
    err.textContent = /report_user|Could not find the function/i.test(String(er && er.message)) ? 'いまは通報を送れません（サーバーの準備中です）。' : jaErr(er);
    btn.disabled = false;
  }
});

/* ---- マスター：通報の一覧と対応 ---- */
const MOD = { list: null, err: '', busy: false };
const isMaster = () => typeof UE !== 'undefined' && UE.role === 'master';
const modBoxHtml = () => isMaster()
  ? `<div class="wants-box"><button class="btn small" type="button" data-acct="reports">通報を見る（マスター）${MOD.list && MOD.list.length ? `<b class="req-badge">${MOD.list.length}</b>` : ''}</button></div>` : '';
async function loadReports(announce) {   // announce：ログインしたときに、届いている数を1回だけお知らせする
  if (!sb || !me || !isMaster()) { MOD.list = null; return; }
  const { data, error } = await sb.rpc('report_list');
  if (error) { MOD.list = null; MOD.err = /report_list|Could not find the function/i.test(error.message || '') ? 'サーバーの準備（supabase/20-reports.sql の実行）がまだのようです。' : jaErr(error); }
  else { MOD.list = data || []; MOD.err = ''; }
  if (!$('modal-mod').hidden) renderMod();
  if (!$('modal-account').hidden) renderAccount();
  if (announce && !MOD.told && MOD.list && MOD.list.length) { MOD.told = true; toast(`通報が${MOD.list.length}件届いています（アカウントの小窓の「通報を見る」から確かめられます）。`); }
}
function renderMod() {
  const el = $('mod-body');
  if (MOD.err) { el.innerHTML = `<p class="err">${esc(MOD.err)}</p>`; return; }
  if (!MOD.list) { el.innerHTML = '<p class="empty">読み込み中…</p>'; return; }
  if (!MOD.list.length) { el.innerHTML = '<p class="empty">まだ対応していない通報はありません。</p>'; return; }
  const day = t => { const d = new Date(t); return isNaN(d) ? '' : `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  el.innerHTML = MOD.list.map(r => {
    const av = okAvatar(r.target_avatar), gone = r.target_name == null;
    const acts = [];
    if (!gone && (r.kind === 'username' || r.kind === 'other')) acts.push(['reset_name', '名前をリセット']);
    if (!gone && av && (r.kind === 'avatar' || r.kind === 'other')) acts.push(['clear_avatar', 'アイコンを消す']);
    if (r.kind === 'group' && r.group_name != null) acts.push(['rename_group', 'グループの名前を消す']);
    return `<article class="mod-card">
      <div class="mod-head"><span class="mod-kind">${RP_KIND[r.kind] || esc(r.kind)}</span><small>${esc(day(r.created_at))} ・ 通報した人：${esc(r.reporter_name || '（退会したユーザー）')}</small></div>
      <div class="mod-target">
        <span class="fav sm" style="--fc:var(--sky)">${av ? `<img src="${esc(av)}" alt="">` : esc((r.target_name || '？').charAt(0))}</span>
        <div><b>${gone ? '（退会したユーザー）' : esc(r.target_name)}</b>
          ${r.kind === 'group' ? `<small>グループの名前：「${esc(r.group_name != null ? r.group_name : '（もう削除されています）')}」${r.snap_name && r.snap_name !== r.group_name ? `（通報のとき：「${esc(r.snap_name)}」）` : ''}</small>`
            : r.snap_name && r.snap_name !== r.target_name ? `<small>通報のときの名前：「${esc(r.snap_name)}」</small>` : ''}</div>
      </div>
      ${r.note ? `<p class="mod-note">${esc(r.note)}</p>` : ''}
      <div class="mod-acts">${acts.map(([a, l]) => `<button class="btn small danger" type="button" data-mod="${a}" data-rid="${esc(r.id)}">${l}</button>`).join('')}<button class="btn small" type="button" data-mod="dismiss" data-rid="${esc(r.id)}">問題なし（閉じる）</button></div>
    </article>`;
  }).join('');
}
function openMod() { MOD.list = MOD.list || null; renderMod(); openModal('modal-mod'); loadReports(); }
$('mod-body').addEventListener('click', async e => {
  const b = e.target.closest('[data-mod]'); if (!b || MOD.busy) return;
  const act = b.dataset.mod;
  if (act !== 'dismiss' && !arm(b, 'もう一度押すと実行')) return;
  MOD.busy = true; b.disabled = true;
  try {
    const { data, error } = await sb.rpc('mod_action', { report_id: b.dataset.rid, act });
    if (error) throw error;
    if (data !== 'ok') throw new Error(data);
    toast({ reset_name: '名前をリセットしました（相手は、自分で新しい名前に変えられます）。', clear_avatar: 'アイコンを消しました。', rename_group: 'グループの名前を消しました。', dismiss: '通報を閉じました。' }[act]);
    await loadReports();
    if (act === 'reset_name' || act === 'clear_avatar') { try { await loadFriendships(); } catch (er) { /* */ } }
  } catch (er) { toast(jaErr(er)); b.disabled = false; }
  MOD.busy = false;
});
