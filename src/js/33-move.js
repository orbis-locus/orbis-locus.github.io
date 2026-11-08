/* ================= 引っ越し（前のURL → 新しいURL）の受け取り =================
   公開サイトは https://kanno-925.github.io/charasheet/ から https://orbis-locus.github.io/ に引っ越した。
   ブラウザはデータをURLごとに分けてしまうので、前のURLにある「引っ越しページ」（move/index.html）が、
   そこに残っているデータ（探索者・設定・BGMのファイル）をこの新しいURLの窓へ postMessage で渡す。
   ・新しいURLを ?move=1 で、前のURLのページから開いたときだけ受け取る（送り主のURLも確かめる）
   ・こちらにまだ自分の探索者がいなければ、そっくりそのまま受け取る。いれば、ない探索者だけ足し、同じ探索者は新しいほうを残す */
const MOVE_FROM = 'https://kanno-925.github.io';
const moveWanted = (() => { try { return new URLSearchParams(location.search).get('move') === '1' && !!window.opener; } catch (e) { return false; } })();
function moveListen() {
  if (!moveWanted) return;
  try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) { /* */ }
  const onMsg = async e => {
    if (e.origin !== MOVE_FROM || !e.data || e.data.type !== 'orbis-move') return;
    removeEventListener('message', onMsg);
    let n = 0;
    try { n = await moveTake(e.data); }
    catch (er) { console.error(er); try { e.source.postMessage({ type: 'orbis-moved', ok: false }, MOVE_FROM); } catch (x) { /* */ } toast('引っ越しのデータを受け取れませんでした。前のURLの「バックアップ」から、手で移してください。'); return; }
    try { e.source.postMessage({ type: 'orbis-moved', ok: true, n }, MOVE_FROM); } catch (x) { /* */ }
  };
  addEventListener('message', onMsg);
  try { window.opener.postMessage({ type: 'orbis-move-ready' }, MOVE_FROM); } catch (e) { /* */ }
}
async function moveTake(d) {
  const inc = d.state && Array.isArray(d.state.chars) ? d.state : null;
  if (!inc) return 0;
  const okChar = c => c && c.v === 2 && SYS[c.system] && c.profile && c.id;
  const incoming = inc.chars.filter(okChar).filter(c => !c.sample);
  const mine = state.chars.filter(c => !c.sample);
  let n = 0;
  if (!mine.length) {
    // こちらはまだ空：設定ごとそっくり受け取る
    const { chars, savedAt, ...rest } = inc;
    Object.assign(state, rest);
    state.chars = incoming; n = incoming.length;
    if (!state.chars.some(c => c.id === state.activeId)) state.activeId = state.chars.length ? state.chars[0].id : null;
  } else {
    incoming.forEach(c => {
      const i = state.chars.findIndex(x => x.id === c.id);
      if (i < 0) { if (charRoom() > 0) { state.chars.push(c); n++; } }
      else if ((c.updatedAt || 0) > (state.chars[i].updatedAt || 0)) { state.chars[i] = c; n++; }
    });
    state.chars = state.chars.filter(c => !c.sample);
    const fr = state.friends || [];
    (inc.friends || []).forEach(f => { if (f && f.id && !f.uid && !fr.some(x => x.id === f.id)) fr.push(f); });
    state.friends = fr;
  }
  // BGM のファイル（キャラごと）
  for (const a of (d.audio || [])) { try { if (a && a.id && a.blob) await AudioDB.put(a.id, a.blob); } catch (e) { /* */ } }
  // 端末ごとの小さな設定（見た目・はじめの画面・音量など）は、こちらに無いものだけ
  Object.entries(d.ls || {}).forEach(([k, v]) => { try { if (/^charasheet-kobo\.(look|intro|vol2|titleBgm)$/.test(k) && localStorage.getItem(k) == null) localStorage.setItem(k, v); } catch (e) { /* */ } });
  saveNow(); applyTheme(); renderAll();
  if (!$('select').hidden) renderSelect();
  if (me) scheduleSync();
  toast(n ? `前のURLから、探索者${n}人を引っ越しました。` : '前のURLのデータを確かめました（新しく足す探索者はありませんでした）。');
  return n;
}
