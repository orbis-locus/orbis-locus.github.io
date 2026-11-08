/* ================= コピー ================= */
async function copyText(text, statusEl, fallbackEl, okMsg = 'コピーしました。ココフォリアの盤面に貼り付けてください。') {
  statusEl.classList.remove('warn');
  try {
    await navigator.clipboard.writeText(text);
    statusEl.textContent = okMsg;
    return true;
  } catch (err) {
    let ok = false;
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
    ta.remove();
    if (ok) { statusEl.textContent = okMsg; return true; }
    statusEl.classList.add('warn');
    statusEl.textContent = '自動コピーできませんでした。選択された文字を Ctrl+C（⌘+C）でコピーしてください。';
    if (fallbackEl) {
      if (fallbackEl.closest('details')) fallbackEl.closest('details').open = true;
      if (fallbackEl.select) fallbackEl.select();
      else { const r = document.createRange(); r.selectNodeContents(fallbackEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    }
    return false;
  }
}
$('btn-copy').addEventListener('click', e => {
  const btn = e.currentTarget;
  copyText(JSON.stringify(toCcfolia(active())), $('copy-status'), $('json-out')).then(ok => { if (ok) { fxAt(btn, true); enter(document.querySelector('.koma')); } });
});
$('mbar-copy').addEventListener('click', e => {
  const btn = e.currentTarget;
  copyText(JSON.stringify(toCcfolia(active())), $('copy-status'), $('json-out')).then(ok => {
    if (ok) { fxAt(btn, true); toast('コピーしました。ココフォリアの盤面に貼り付けてください。'); }
    else { toast('自動でコピーできませんでした。下の「出力の中身を確認」のJSONを長押ししてコピーしてください。'); $('json-out').scrollIntoView({ block: 'center' }); }
  });
});
