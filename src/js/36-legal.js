/* ================= 利用規約・プライバシーポリシー・お問い合わせ ================= */
/* 文は index.html の modal-legal に書いてある。data-legal="terms / privacy / contact" のボタンで、そのタブを開く。
   アカウントを作る小窓の上にも重ねて開くので、閉じるときはこの小窓だけを閉じる（入力した内容が消えないように）。 */

/* お問い合わせ先：オーナーが用意したら、ここに書く（どちらか片方だけでもよい）。
   CONTACT_FORM … Google フォームなどのURL（https:// から）
   CONTACT_MAIL … 問い合わせ専用のメールアドレス（本名や、ふだん使いのアドレスは書かない） */
const CONTACT_FORM = '';
const CONTACT_MAIL = '';

function legalContactHtml() {
  const a = [];
  if (/^https:\/\//.test(CONTACT_FORM)) a.push(`<a class="btn primary" href="${esc(CONTACT_FORM)}" target="_blank" rel="noopener">お問い合わせフォームを開く</a>`);
  if (CONTACT_MAIL) a.push(`<p>メール：<a href="mailto:${esc(CONTACT_MAIL)}">${esc(CONTACT_MAIL)}</a></p>`);
  return a.length ? a.join('') : '<p class="legal-wait">お問い合わせ先は、いま準備中です。決まりしだい、ここに書きます。</p>';
}
function legalTab(k) {
  const box = $('modal-legal');
  box.querySelectorAll('[data-legal-tab]').forEach(b => { const on = b.dataset.legalTab === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  box.querySelectorAll('[data-legal-doc]').forEach(d => { d.hidden = d.dataset.legalDoc !== k; });
  if (k === 'contact') $('legal-contact').innerHTML = legalContactHtml();
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
