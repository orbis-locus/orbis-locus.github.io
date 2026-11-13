/* ================= 利用規約・プライバシーポリシー・お問い合わせ ================= */
/* 文は index.html の modal-legal に書いてある。お問い合わせはアプリの中の入力欄から送り、サーバーの contacts に入る（supabase/21-contacts.sql）。
   マスターはアカウントの小窓の「お問い合わせを見る」で一覧を見て、メールで返事をして「対応済み」にする。
   data-legal="terms / privacy / contact" のボタンで、そのタブを開く。
   アカウントを作る小窓の上にも重ねて開くので、閉じるときはこの小窓だけを閉じる（入力した内容が消えないように）。 */

function legalTab(k) {
  const box = $('modal-legal');
  box.querySelectorAll('[data-legal-tab]').forEach(b => { const on = b.dataset.legalTab === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  box.querySelectorAll('[data-legal-doc]').forEach(d => { d.hidden = d.dataset.legalDoc !== k; });
  if (k === 'contact' && !CT.sent) renderContactForm();
  const m = box.querySelector('.modal'); if (m) m.scrollTop = 0;
}
function openLegal(k) {
  legalTab(k || 'terms');
  $('modal-legal').hidden = false;
  const b = $('modal-legal').querySelector('.legal-tab.on'); b && b.focus();
}
const closeLegal = () => { $('modal-legal').hidden = true; };
/* 先に（capture で）受け取り、ほかの小窓まで閉じてしまう共通の処理（13-modals.js）には渡さない */
addEventListener('click', e => {
  const open = e.target.closest('[data-legal]');
  if (open) { e.preventDefault(); openLegal(open.dataset.legal); return; }
  const ov = $('modal-legal');
  if (ov.hidden) return;
  const t = e.target.closest('[data-legal-tab]');
  if (t) { legalTab(t.dataset.legalTab); return; }
  if (e.target === ov || e.target.closest('[data-legal-close]')) { e.stopPropagation(); closeLegal(); }
}, true);
addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('modal-legal').hidden) { e.stopPropagation(); closeLegal(); }
}, true);

/* ---- お問い合わせを送る ---- */
const CT_KIND = { bug: '不具合', delete: 'アカウントの削除', privacy: '個人情報について', rights: '権利について', idea: 'ご意見・ご要望', other: 'そのほか' };
const CT_MSG = {
  kind: 'うまく送れませんでした。もう一度ためしてください。', short: '内容をもう少しくわしく書いてください（5文字以上）。', long: '内容は2000文字までです。',
  mail: 'お返事先のメールアドレスの形が正しくありません。', toomany: 'お問い合わせは1日5件までです。明日またお願いします。',
  busy: 'いま、お問い合わせがこみあっています。少したってから、もう一度送ってください。',
};
const CT = { sent: false, busy: false };
/* 不具合を調べるため、端末・ブラウザの種類をいっしょに送る（名前やメールは入らない） */
const ctInfo = () => `${navigator.userAgent || ''} / 画面 ${innerWidth}x${innerHeight} / テーマ ${presetKey()}`.slice(0, 300);
function renderContactForm() {
  $('legal-contact').innerHTML = `<form class="ct-form" id="ct-form">
    <label class="lbl" for="ct-kind">お問い合わせの種類</label>
    <select class="inp" id="ct-kind">${Object.entries(CT_KIND).map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select>
    <label class="lbl" for="ct-body">内容（2000文字まで）</label>
    <textarea class="inp" id="ct-body" rows="5" maxlength="2000" required placeholder="例：スマホで○○を押すと、××になります"></textarea>
    <label class="lbl" for="ct-mail">お返事先のメールアドレス（お返事がほしい方だけ）</label>
    <input class="inp" type="email" id="ct-mail" maxlength="200" autocomplete="email" value="${me && me.email ? esc(me.email) : ''}">
    <p class="ct-note">${me ? `ログイン中のため、ユーザー名「${esc(me.username || '')}」もいっしょに送ります。` : 'アカウントは、ログインしてアカウントの小窓の「アカウントを削除する」から自分で消せます。'}不具合を調べるため、使っている端末・ブラウザの種類もいっしょに送ります。</p>
    <p class="err" id="ct-err" role="alert"></p>
    <button class="btn primary" type="submit" id="ct-send">送る</button>
  </form>`;
}
$('legal-contact').addEventListener('submit', async e => {
  e.preventDefault();
  if (CT.busy) return;
  const err = $('ct-err'), btn = $('ct-send'), c = sbClient();
  const body = ($('ct-body').value || '').trim(), reply = ($('ct-mail').value || '').trim();
  err.textContent = '';
  if (body.length < 5) { err.textContent = CT_MSG.short; return; }
  if (!c) { err.textContent = 'いまは送れませんでした。ネットにつながっているか確かめてください。'; return; }
  CT.busy = true; btn.disabled = true;
  try {
    const { data, error } = await c.rpc('send_contact', { kind: $('ct-kind').value, body, reply, info: ctInfo(), v: voterId() });
    if (error) throw error;
    if (data !== 'ok') { err.textContent = CT_MSG[data] || 'うまく送れませんでした。'; btn.disabled = false; CT.busy = false; return; }
    CT.sent = true;
    $('legal-contact').innerHTML = `<p class="ct-thanks">お問い合わせを送りました。ありがとうございます。${reply ? 'お返事は、書いていただいたメールアドレスに送ります（時間がかかることがあります）。' : ''}</p>`;
    snd('copy');
  } catch (er) {
    err.textContent = /send_contact|Could not find the function/i.test(String(er && er.message)) ? 'いまはお問い合わせを送れません（サーバーの準備中です）。' : jaErr(er);
    btn.disabled = false;
  }
  CT.busy = false;
});

/* ---- マスター：届いたお問い合わせの一覧 ---- */
const CTM = { list: null, err: '', busy: false };
function contactBoxHtml() {
  return isMaster() ? `<div class="wants-box"><button class="btn small" type="button" data-acct="contacts">お問い合わせを見る（マスター）${CTM.list && CTM.list.length ? `<b class="req-badge">${CTM.list.length}</b>` : ''}</button></div>` : '';
}
async function loadContacts(announce) {   // announce：ログインしたときに、届いている数を1回だけお知らせする
  if (!sb || !me || !isMaster()) { CTM.list = null; return; }
  const { data, error } = await sb.rpc('contact_list');
  if (error) { CTM.list = null; CTM.err = /contact_list|Could not find the function/i.test(error.message || '') ? 'サーバーの準備（supabase/21-contacts.sql の実行）がまだのようです。' : jaErr(error); }
  else { CTM.list = data || []; CTM.err = ''; }
  if (!$('modal-contacts').hidden) renderContacts();
  if (!$('modal-account').hidden) renderAccount();
  if (announce && !CTM.told && CTM.list && CTM.list.length) { CTM.told = true; setTimeout(() => toast(`お問い合わせが${CTM.list.length}件届いています（アカウントの小窓の「お問い合わせを見る」から確かめられます）。`), 2500); }
}
function renderContacts() {
  const el = $('contacts-body');
  if (CTM.err) { el.innerHTML = `<p class="err">${esc(CTM.err)}</p>`; return; }
  if (!CTM.list) { el.innerHTML = '<p class="empty">読み込み中…</p>'; return; }
  if (!CTM.list.length) { el.innerHTML = '<p class="empty">まだ対応していないお問い合わせはありません。</p>'; return; }
  const day = t => { const d = new Date(t); return isNaN(d) ? '' : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
  el.innerHTML = CTM.list.map(r => {
    const who = r.user_id
      ? `ログイン中に送信：<b>${esc(r.now_name || r.user_name || '（退会したユーザー）')}</b>${r.user_email ? `（登録メール：${esc(r.user_email)}）` : ''}`
      : 'ログインなしで送信';
    const mail = r.reply_to ? `mailto:${encodeURIComponent(r.reply_to).replace(/%40/g, '@')}?subject=${encodeURIComponent('ORBiS お問い合わせへのお返事')}` : '';
    return `<article class="mod-card">
      <div class="mod-head"><span class="mod-kind ct-kind">${esc(CT_KIND[r.kind] || r.kind)}</span><small>${esc(day(r.created_at))}</small></div>
      <small class="ct-who">${who}</small>
      <p class="mod-note">${esc(r.body)}</p>
      <small class="ct-who">お返事先：${r.reply_to ? esc(r.reply_to) : '（書かれていません）'}</small>
      ${r.info ? `<small class="ct-info">${esc(r.info)}</small>` : ''}
      <div class="mod-acts">${mail ? `<a class="btn small" href="${esc(mail)}">メールで返事を書く</a>` : ''}<button class="btn small" type="button" data-ctclose="${esc(r.id)}">対応済みにする</button></div>
    </article>`;
  }).join('');
}
function openContacts() { renderContacts(); openModal('modal-contacts'); loadContacts(); }
$('contacts-body').addEventListener('click', async e => {
  const b = e.target.closest('[data-ctclose]'); if (!b || CTM.busy) return;
  if (!arm(b, 'もう一度押すと閉じる')) return;
  CTM.busy = true; b.disabled = true;
  try {
    const { data, error } = await sb.rpc('contact_close', { contact_id: b.dataset.ctclose });
    if (error) throw error;
    if (data !== 'ok') throw new Error(data);
    toast('対応済みにしました。');
    await loadContacts();
  } catch (er) { toast(jaErr(er)); b.disabled = false; }
  CTM.busy = false;
});
