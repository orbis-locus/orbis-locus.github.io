/* ================= モーダル ================= */
function openModal(id) { $(id).hidden = false; const f = $(id).querySelector('button, textarea, input'); f && f.focus(); }
function closeModals() { document.querySelectorAll('.overlay').forEach(o => { o.hidden = true; }); }
document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o || e.target.closest('[data-close]')) closeModals(); });
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if ([...document.querySelectorAll('.overlay')].some(o => !o.hidden)) closeModals();
  else if (!$('stage-ov').hidden) closeStage();
  else closePanel();
});
$('panel-ov').addEventListener('click', e => { if (e.target === e.currentTarget) closePanel(); });
$('panel').addEventListener('click', e => {
  const g = e.target.closest('[data-goto]');
  if (g) { gotoPanel(g.dataset.goto); return; }
  if (e.target.closest('[data-close-panel]')) closePanel();
});
$('sao-menu').innerHTML = SECTIONS.map(s => `<button class="sao-item" type="button" data-goto="${s.key}"><span class="sao-ic">${icon(s.key)}</span><span class="sao-lb"><small>${s.en}</small>${s.jp}</span></button>`).join('');
$('sao-close').innerHTML = icon('close');

$('preset-list').innerHTML = Object.entries(SYS).map(([k, v]) =>
  `<button class="preset" type="button" data-sys="${k}"><b>${esc(v.label)}</b><span>判定 ${esc(v.cmd)}&lt;=○○ ・ 技能${v.skills.length}種</span></button>`).join('');
$('preset-list').addEventListener('click', e => {
  const b = e.target.closest('[data-sys]'); if (!b) return;
  if (!canAddChar()) { $('modal-new').hidden = true; return; }   // 無料版の鍵の小窓は残す
  const c = blank(b.dataset.sys);
  state.chars.unshift(c); state.activeId = c.id; save(); closeModals(); stopBgm();
  if (!$('select').hidden) leaveSelect(null, true);
  renderAll();
  openPanel('profile', document.querySelector('#sheet .hub-core'));
  $('f-profile-name')?.focus({ preventScroll: true });
});
function openNewChar() {
  if (!canAddChar()) return;
  $('new-count').textContent = `いま ${charCount()} 人 ／ 最大 ${maxChars()} 人${isFree() ? '（無料版）' : ''}（あと ${charRoom()} 人作れます）`;
  openModal('modal-new');
}
$('btn-new').addEventListener('click', openNewChar);

$('btn-import').addEventListener('click', () => { $('import-err').textContent = ''; $('import-text').value = ''; openModal('modal-import'); });
$('import-file').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { $('import-text').value = r.result; };
  r.readAsText(f);
});
$('import-run').addEventListener('click', () => {
  const err = $('import-err');
  const raw = $('import-text').value.trim();
  if (!raw) { err.textContent = '貼り付ける欄が空です。いあきゃらやココフォリアでコピーしたデータを貼り付けてください。'; return; }
  let obj = null;
  try { obj = JSON.parse(raw); } catch (e) { obj = null; }
  if (obj === null) {
    const c = fromIachara(raw) || fromText(raw);
    if (!c) { err.textContent = '探索者のデータが見つかりませんでした。いあきゃらの「ココフォリア」出力でコピーしたデータを、途中で切らずにそのまま貼り付けてください。'; return; }
    obj = [c];
  }
  let list = [];
  if (obj && obj.kind === 'character') list = [obj];
  else if (obj && Array.isArray(obj.chars)) list = obj.chars;
  else if (Array.isArray(obj)) list = obj;
  else if (obj && (obj.abilities || obj.params)) list = [obj];
  list = list.map(c => (c && c.v === 2 && SYS[c.system] && c.profile) ? c
    : (c && c.v === 2 && c.importInfo) ? c
    : (c && c.kind === 'character') ? fromCcfolia(c)
    : (c && Array.isArray(c.params)) ? migrateV1(c) : null).filter(Boolean);
  if (!list.length) { err.textContent = '探索者のデータが見つかりませんでした。このアプリのバックアップか、ココフォリアのコマデータを貼り付けてください。'; return; }
  const room = charRoom();
  if (!room) { err.textContent = `探索者は${maxChars()}人まで${isFree() ? '（無料版）' : ''}です。いらない探索者を削除してから読み込んでください。`; return; }
  const cut = list.length - room;
  if (cut > 0) list = list.slice(0, room);
  list.forEach(c => { c.id = uid(); delete c.sample; });
  if (obj && Array.isArray(obj.friends)) {
    state.friends = state.friends || [];
    obj.friends.forEach(f => { if (f && f.id && f.name && !state.friends.some(x => x.id === f.id)) state.friends.push({ id: f.id, name: String(f.name), color: f.color || '#1f6fe0', note: f.note || '' }); });
  }
  state.chars = [...list, ...state.chars]; state.activeId = list[0].id;
  save(); closeModals(); renderAll();
  const info = list[0].importInfo;
  list.forEach(c => { delete c.importInfo; });
  if (cut > 0) toast(`探索者は${maxChars()}人まで${isFree() ? '（無料版）' : ''}なので、先頭の${room}人だけ読み込みました（${cut}人は読み込んでいません）。`);
  else if (info && info.full) toast(`「${list[0].profile.name || '名無し'}」をいあきゃらのテキストから読み込みました。技能${info.matched}個${info.added ? `（うち${info.added}個は新しく追加）` : ''}の内訳、武器・所持品・財産・経歴・通過シナリオ・メモも入っています。`);
  else if (info) toast(`「${list[0].profile.name || '名無し'}」を読み込みました。技能${info.matched}個を反映${info.added ? `、${info.added}個を新しく追加` : ''}しました。技能の値は「その他」欄に入っています。`);
  else toast(`${list.length}人の探索者を読み込みました。`);
});

$('btn-export').addEventListener('click', () => {
  $('export-text').value = JSON.stringify({ app: 'charasheet-kobo', version: 2, chars: state.chars, friends: state.friends || [] }, null, 2);
  $('export-status').textContent = '';
  openModal('modal-export');
});
$('export-copy').addEventListener('click', () => copyText($('export-text').value, $('export-status'), $('export-text'), 'コピーしました。メモ帳などに保存してください。').then(ok => { if (ok) fxAt($('export-copy'), true); }));
