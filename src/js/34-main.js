/* ================= 起動 ================= */
/* 保存データの読み込み（IndexedDB）は少し時間がかかるので、終わってから画面を作る */
load().catch(() => {}).finally(() => {
  applyTheme();
  renderAll();
  renderSelect();
  ueApply();
  initCloud();
  if (sharedToken) openSharedView(sharedToken);   // 共有リンクから開いた
  moveListen();   // 前のURLの引っ越しページから開かれた
});
if (!$('intro')) document.documentElement.style.overflow = 'hidden';
