/* ================= 並べ替え ================= */
const SORT_LABEL = { created: ['新しい順', '古い順'], name: ['あ→ん', 'ん→あ'], age: ['若い順', '年上順'], birthday: ['1月→12月', '12月→1月'], updated: ['最近順', '昔順'], system: ['6版→7版', '7版→6版'] };
function bdayKey(t) {
  t = toHalf(t || '');
  let m = t.match(/(\d{4})\s*[\/\-.年]\s*(\d{1,2})\s*[\/\-.月]\s*(\d{1,2})/);
  if (m) return +m[2] * 100 + +m[3];
  m = t.match(/(\d{1,2})\s*[月\/\-.]\s*(\d{1,2})/);
  if (m) return +m[1] * 100 + +m[2];
  m = t.match(/(\d{1,2})\s*月/);
  return m ? +m[1] * 100 : null;
}
function ageKey(t) { const m = toHalf(t || '').match(/\d+/); return m ? +m[0] : null; }
function sortedChars() {
  const key = state.sortKey || 'created', desc = !!state.sortDesc;
  const list = state.chars.map((c, i) => ({ c, i }));
  const val = ({ c, i }) => {
    switch (key) {
      case 'name': { const n = (c.profile.kana || c.profile.name || '').trim(); return n || null; }
      case 'age': return ageKey(c.profile.age);
      case 'birthday': return bdayKey(c.profile.birthday);
      case 'updated': return -(c.updatedAt || 0);
      case 'system': return c.system === 'coc7' ? 7 : 6;
      default: return i;
    }
  };
  list.forEach(x => { x.v = val(x); });
  list.sort((a, b) => {
    if (a.v == null && b.v == null) return a.i - b.i;
    if (a.v == null) return 1;
    if (b.v == null) return -1;
    const d = typeof a.v === 'string' ? a.v.localeCompare(b.v, 'ja') : a.v - b.v;
    return (desc ? -d : d) || a.i - b.i;
  });
  return list.map(x => x.c);
}
function sortValueText(c) {
  switch (state.sortKey) {
    case 'age': return c.profile.age ? c.profile.age + '歳' : '年齢未設定';
    case 'birthday': return c.profile.birthday ? '誕生日 ' + c.profile.birthday : '誕生日未設定';
    case 'updated': { const d = new Date(c.updatedAt || 0); return c.updatedAt ? `${d.getMonth() + 1}/${d.getDate()} 更新` : ''; }
    default: return '';
  }
}
function renderSortBar() {
  $('sel-sort').hidden = selTab !== 'mine';
  $('sort-key').value = state.sortKey || 'created';
  const lab = SORT_LABEL[state.sortKey || 'created'];
  $('sort-dir').innerHTML = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 4v12M3 13l3 3 3-3M14 16V4M11 7l3-3 3 3"/></svg>${lab[state.sortDesc ? 1 : 0]}`;
  const ov = document.querySelector('[data-view="orbit"]'); if (ov) ov.textContent = themeSelName() || 'ふよふよ';   // テーマだけの並べ方の名前
  document.querySelectorAll('[data-view]').forEach(b => { const on = b.dataset.view === (state.selView || 'orbit'); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
function listViewHtml(chars) {
  return `<button class="sel-list-new" type="button" id="sel-new"><span class="plus">＋</span>新しい探索者をつくる</button>
  <ol class="sel-list">${chars.map((c, i) => {
    const p = c.profile;
    return `<li><button class="sel-row" type="button" data-id="${c.id}" aria-label="${esc(p.name || '名無し')}のシートを開く">
      <span class="sr-rank">${i + 1}</span>${tokenHtml(c)}
      <span class="sr-name"><b>${esc(p.name || '名無し')}</b><small>${esc(p.kana || '')}</small></span>
      <span class="sr-meta"><span><i>年齢</i>${esc(p.age ? p.age + '歳' : '—')}</span><span><i>誕生日</i>${esc(p.birthday || '—')}</span><span><i>職業</i>${esc(p.occupation || '—')}</span><span><i>版</i>${esc(SYS[c.system].short)}</span></span>
      <span class="sr-flags">${c.bgm ? '<em title="BGMあり">♪</em>' : ''}${c.locked ? '<em class="lk" title="フレンドに非公開">非公開</em>' : ''}</span>
    </button></li>`;
  }).join('')}</ol>`;
}
/* スライド表示：立ち絵を全身で横に並べ、真ん中のキャラを大きく見せる */
function slideViewHtml(chars) {
  const flags = c => `${c.bgm ? '<span class="sel-bgm" title="BGMあり">♪</span>' : ''}${c.locked ? '<span class="sel-lock" title="フレンドに非公開"><svg class="lk" viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg></span>' : ''}`;
  const card = (c, i) => {
    const p = c.profile, src = portraitSrc(c);
    return `<button class="sel-char sl-card" type="button" data-id="${c.id}" style="--i:${i}" aria-label="${esc(p.name || '名無し')}のシートを開く">
      <span class="sl-body"><span class="sl-art ${src ? 'has' : ''}">${src ? `<img src="${esc(imgSrc(src))}" alt="" draggable="false" onerror="this.parentNode.classList.remove('has');this.remove()">` : ''}${tokenHtml(c)}</span>
      <span class="sl-ground" aria-hidden="true"></span>
      <span class="sl-name">${esc(p.name || '名無し')}${flags(c)}</span>
      <span class="sl-sys">${esc(sortValueText(c) || [SYS[c.system].short, p.occupation].filter(Boolean).join(' ・ '))}</span></span>
    </button>`;
  };
  return `<div class="sl-track" id="sl-track">
    <button class="sl-card sl-new" type="button" id="sel-new" style="--i:0"><span class="sl-body"><span class="sl-art"><span class="sl-plus">＋</span></span><span class="sl-ground" aria-hidden="true"></span><span class="sl-name">新しい探索者</span><span class="sl-sys">NEW INVESTIGATOR</span></span></button>
    ${chars.map((c, i) => card(c, i + 1)).join('')}
  </div>
  <p class="sl-hint">横にスクロールして選ぶ ・ 長押しで詳細 ・ ${canHover.matches ? 'クリック' : 'タップ'}で編集</p>`;
}
$('sel-sort').addEventListener('change', e => { if (e.target.id === 'sort-key') { state.sortKey = e.target.value; state.sortDesc = false; save(); renderSelect(); popSelect(); renderShelf(); } });
$('sel-sort').addEventListener('click', e => {
  if (e.target.closest('#sort-dir')) { state.sortDesc = !state.sortDesc; save(); renderSelect(); popSelect(); renderShelf(); return; }
  const v = e.target.closest('[data-view]');
  if (v && v.dataset.view !== (state.selView || 'orbit')) { state.selView = v.dataset.view; save(); renderSelect(); popSelect(); }
});

/* ---- フレンド一覧（探索者をえらぶ画面の「フレンド」タブ） ---- */
let selTab = 'mine';
function ringLayout(n, W, B) {
  const small = W < 560, pos = [], radii = [];
  let r = small ? Math.min(150, W / 2 - (B + 44) / 2 - 4) : 210, ring = 0, idx = 0;
  const ky = small ? 1.45 : 1;
  while (idx < n && r >= 100) {
    if (r + (B + 44) / 2 > W / 2) break;
    const cap = Math.max(5, Math.floor(2 * Math.PI * r / (B + 54)));
    const k = Math.min(cap, n - idx);
    for (let j = 0; j < k; j++) { const ang = -Math.PI / 2 + (j + (ring % 2) * .5) / k * 2 * Math.PI; pos.push([r * Math.cos(ang), r * ky * Math.sin(ang)]); }
    radii.push(r); idx += k; r += B + 62; ring++;
  }
  return { pos, radii: radii.length ? radii : [small ? Math.min(150, W / 2 - (B + 44) / 2 - 4) : 210], idx, ky, small };
}
function renderFriendSelect(stage) {
  const W = stage.clientWidth || Math.min(1100, innerWidth - 32);
  const B = W < 560 ? 70 : 96;
  const L = ringLayout(0, W, B);
  const rings = rr => `<svg class="sel-rings" aria-hidden="true">${rr.map(r => `<ellipse cx="50%" cy="50%" rx="${r}" ry="${(r * L.ky).toFixed(1)}"/>`).join('')}<circle cx="50%" cy="50%" r="${L.small ? 80 : 112}"/></svg>`;
  stage.classList.remove('grid');
  if (!cloudReady() || !me) {
    stage.style.height = (L.small ? 380 : 460) + 'px';
    stage.innerHTML = `${rings(L.radii)}<button class="sel-new" type="button" id="sel-login"><span class="plus">⟶</span><b>ログイン</b><small>SIGN IN</small></button>
      <p class="sel-empty">${!cloudReady() ? 'アカウント機能の準備中です。' : 'ログインすると、フレンドとキャラシを見せ合えます。'}</p>`;
    return;
  }
  const o = online || { friends: [], incoming: [], outgoing: [], chars: {} };
  const items = [...o.incoming.map(u => ({ u, kind: 'in' })), ...o.friends.map(u => ({ u, kind: 'fr' })), ...o.outgoing.map(u => ({ u, kind: 'out' }))];
  const lay = ringLayout(items.length, W, B);
  const H = Math.max(L.small ? 380 : 480, 2 * (lay.radii[lay.radii.length - 1] * lay.ky + B / 2 + 60));
  const colorOf = u => (friendsOf().find(f => f.uid === u.id) || {}).color || '#1f6fe0';
  const bubble = ({ u, kind }, i, xy) => {
    const chars = (o.chars || {})[u.id] || [];
    const sub = kind === 'fr' ? (o.chars && o.chars[u.id] !== undefined ? `公開キャラ ${chars.length}人` : '公開キャラ …') : kind === 'in' ? '申請が届いています' : '承認待ち';
    const minis = kind === 'fr' && chars.length ? `<span class="sel-minis">${chars.slice(0, 4).map(ch => `<i style="--tc:${esc(ch.color)}">${ch.avatar ? `<img src="${esc(ch.avatar)}" alt="">` : esc((ch.name || '？').charAt(0))}</i>`).join('')}${chars.length > 4 ? `<i class="more">+${chars.length - 4}</i>` : ''}</span>` : '';
    return `<button class="sel-char sel-friend ${kind}" type="button" data-fuid="${u.id}" data-fname="${esc(u.username)}" data-kind="${kind}" style="--i:${i};--B:${B}px${xy ? `;left:calc(50% + ${xy[0].toFixed(1)}px);top:calc(50% + ${xy[1].toFixed(1)}px)` : ''}" aria-label="${esc(u.username)}${kind === 'fr' ? 'さんのキャラシを見る' : kind === 'in' ? 'さんからの申請を確認する' : 'さん（承認待ち）'}">
      <span class="token" style="--tc:${esc(colorOf(u))}">${avImg(u.id) || esc((u.username || '？').charAt(0))}</span>${kind === 'in' ? '<span class="sel-reqmark">申請</span>' : ''}
      <span class="sel-name">${esc(u.username)}</span><span class="sel-sys">${sub}</span>${minis}
    </button>`;
  };
  stage.style.height = H + 'px';
  stage.innerHTML = `${rings(lay.radii)}<button class="sel-new" type="button" id="sel-addfriend"><span class="plus">＋</span><b>フレンドを追加</b><small>ADD FRIEND</small></button>
    ${items.slice(0, lay.idx).map((it, i) => bubble(it, i, lay.pos[i])).join('')}
    ${items.length ? '' : '<p class="sel-empty">まだフレンドがいません。真ん中から、友達のユーザー名で申請しましょう。</p>'}`;
  const rest = items.slice(lay.idx);
  if (rest.length) stage.insertAdjacentHTML('afterend', `<div class="sel-grid sel-rest" id="sel-rest">${rest.map((it, i) => bubble(it, lay.idx + i)).join('')}</div>`);
}
async function loadFriendChars() {
  if (!sb || !me || !online) return;
  const ids = online.friends.map(u => u.id);
  const map = {};
  ids.forEach(id => { map[id] = []; });
  if (ids.length) {
    const { data, error } = await sb.from('characters').select('id,owner,name,color:data->profile->>color,avatar:data->>avatar').in('owner', ids);
    if (error) throw error;
    (data || []).forEach(r => { (map[r.owner] = map[r.owner] || []).push({ id: r.id, avatar: r.avatar || '', name: r.name || (r.data && r.data.profile && r.data.profile.name) || '', color: r.color || (r.data && r.data.profile && r.data.profile.color) || '#1f6fe0' }); });
  }
  online.chars = map;
}
async function refreshFriendView() {
  if (!sb || !me) return;
  try { await loadFriendships(); await loadFriendChars(); } catch (e) { toast(jaErr(e)); }
  await loadGroups();
  if (!$('select').hidden && (selTab === 'friends' || selTab === 'groups')) renderSelect();
}
function setSelTab(t) {
  if (selTab === t) { if (t !== 'mine') refreshFriendView(); return; }
  selTab = t; hidePeek();
  renderSelect(); popSelect();
  if (t === 'friends' || t === 'groups') refreshFriendView();
}
