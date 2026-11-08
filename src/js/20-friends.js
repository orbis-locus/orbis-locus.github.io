/* ================= フレンド ================= */
const friendsOf = () => (state.friends = state.friends || []);
function playedWith(c) {
  const count = new Map();
  (c.scenarios || []).forEach(sc => (sc.friends || []).forEach(id => count.set(id, (count.get(id) || 0) + 1)));
  return friendsOf().filter(f => count.has(f.id)).map(f => ({ f, n: count.get(f.id) })).sort((x, y) => y.n - x.n);
}
/* フレンドの丸：ORBiS のフレンドでアイコン画像があれば画像、なければ名前の1文字目 */
const fInit = f => (f.uid && avImg(f.uid)) || esc((f.name || '？').charAt(0));
const fchip = (f, attrs, on) => `<button type="button" class="fchip ${on ? 'on' : ''}" style="--fc:${esc(f.color)}" ${attrs}><span class="fdot">${fInit(f)}</span>${esc(f.name)}</button>`;
function scenariosHtml(c) {
  const fr = friendsOf(), pw = playedWith(c);
  return `<section class="sec">
    <div class="played-with">
      <span class="lbl">この探索者と冒険したフレンド</span>
      <div class="pw-chips">${pw.length ? pw.map(({ f, n }) => `<span class="fchip on static" style="--fc:${esc(f.color)}"><span class="fdot">${fInit(f)}</span>${esc(f.name)}<b>×${n}</b></span>`).join('') : '<span class="empty">シナリオに「一緒に遊んだフレンド」を付けると、ここに並びます。</span>'}</div>
    </div>
    <div class="sec-title"><span class="hint">シナリオごとに、一緒に遊んだフレンドを押して選べます</span><div class="tools"><button class="btn small" type="button" data-act="open-friends">フレンドを管理</button><button class="btn small" type="button" data-act="add-scenario">＋ シナリオを追加</button></div></div>
    ${c.scenarios.length ? `<div class="scn-list">${c.scenarios.map((sc, i) => `
      <div class="scn">
        <div class="scn-top">
          ${inp(`scenarios.${i}.name`, sc.name, { cls: 'inp scn-name', ph: 'シナリオ名', label: 'シナリオ名' })}
          ${inp(`scenarios.${i}.date`, sc.date, { cls: 'inp scn-date', ph: '日付（例：2026/10/01）', label: '日付' })}
          <button class="icon-btn" type="button" data-del="scenarios" data-i="${i}" aria-label="このシナリオを削除">×</button>
        </div>
        ${inp(`scenarios.${i}.note`, sc.note, { cls: 'inp', ph: 'メモ（生還・報酬・KPなど）', label: 'メモ' })}
        <div class="scn-friends"><span class="lbl">一緒に遊んだフレンド</span>
          ${fr.length ? fr.map(f => fchip(f, `data-act="toggle-friend" data-i="${i}" data-fid="${f.id}" aria-pressed="${(sc.friends || []).includes(f.id)}"`, (sc.friends || []).includes(f.id))).join('') : '<span class="empty">フレンドがまだいません。</span>'}
          <button class="btn small ghost" type="button" data-act="open-friends">＋ フレンドを追加</button>
        </div>
      </div>`).join('')}</div>` : '<p class="empty">まだありません。「＋ シナリオを追加」から記録できます。</p>'}
  </section>`;
}
function friendStats(fid) {
  const out = [];
  state.chars.forEach(c => (c.scenarios || []).forEach(sc => { if ((sc.friends || []).includes(fid)) out.push({ c, sc }); }));
  return out;
}
function renderFriends() {
  const list = friendsOf();
  $('friend-list').innerHTML = list.length ? list.map(f => {
    const st = friendStats(f.id);
    return `<div class="friend" data-fid="${f.id}">
      <span class="fav" style="--fc:${esc(f.color)}">${fInit(f)}${f.uid ? '<i class="ol-badge" title="ORBiS のフレンド"></i>' : ''}</span>
      <div class="fbody">
        <div class="frow">
          <input class="inp" id="fr-name-${f.id}" data-fp="name" value="${esc(f.name)}" aria-label="フレンドの名前">
          <input type="color" class="fcolor" id="fr-color-${f.id}" data-fp="color" value="${esc(f.color)}" aria-label="${esc(f.name)}の色">
          <button class="btn small danger" type="button" data-fdel>削除</button>
        </div>
        <input class="inp fnote" id="fr-note-${f.id}" data-fp="note" value="${esc(f.note || '')}" placeholder="メモ（Discord・Xのアカウントなど）" aria-label="${esc(f.name)}のメモ">
        <div class="fplayed">${st.length
          ? `<b>冒険 ${st.length}回</b>${st.map(({ c, sc }) => `<span class="fp-item">${esc(c.profile.name || '名無し')}「${esc(sc.name || '無題')}」${sc.date ? `<small>${esc(sc.date)}</small>` : ''}</span>`).join('')}`
          : '<span class="empty">まだ一緒に遊んだ記録はありません。通過シナリオで選ぶと、ここに記録されます。</span>'}</div>
      </div>
    </div>`;
  }).join('') : '<p class="empty">まだフレンドがいません。上の欄に名前を入れて「追加」を押してください。</p>';
}
function openFriends() { renderOnline(); renderFriends(); openModal('modal-friends'); if (me) loadFriendships().catch(() => {}); }
$('friend-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = $('friend-name').value.trim();
  if (!name) { $('friend-name').focus(); return; }
  friendsOf().push({ id: uid(), name, color: $('friend-color').value || '#1f6fe0', note: $('friend-note').value.trim() });
  $('friend-name').value = ''; $('friend-note').value = '';
  const FC = ['#1f6fe0', '#e0457a', '#2f9e57', '#7b52bd', '#e08a1f', '#12a6cf', '#c0392b', '#8e6e1f'];
  $('friend-color').value = FC[friendsOf().length % FC.length];
  save(); renderFriends(); renderSheet();
  toast(`フレンド「${name}」を追加しました。`);
});
$('friend-list').addEventListener('input', e => {
  const row = e.target.closest('.friend'), key = e.target.dataset.fp; if (!row || !key) return;
  const f = friendsOf().find(x => x.id === row.dataset.fid); if (!f) return;
  f[key] = e.target.value; save();
  const av = row.querySelector('.fav');
  if (key === 'color') av.style.setProperty('--fc', f.color);
  if (key === 'name') av.textContent = (f.name || '？').charAt(0);
});
$('friend-list').addEventListener('change', () => renderSheet());
$('friend-list').addEventListener('click', e => {
  const b = e.target.closest('[data-fdel]'); if (!b) return;
  if (!arm(b, '本当に削除')) return;
  const id = b.closest('.friend').dataset.fid;
  state.friends = friendsOf().filter(f => f.id !== id);
  state.chars.forEach(c => (c.scenarios || []).forEach(sc => { if (sc.friends) sc.friends = sc.friends.filter(x => x !== id); }));
  save(); renderFriends(); renderSheet();
});
$('btn-friends').addEventListener('click', () => { selTab = 'friends'; showSelect(); });
$('sel-friends').addEventListener('click', openFriends);
