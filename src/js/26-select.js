/* ================= 探索者をえらぶ画面 ================= */
let selPress = null, selLong = false, selResizeT = null;
function renderSelect() {
  const stage = $('sel-stage');
  stage.classList.remove('themev');
  $('sel-rest')?.remove();
  document.querySelectorAll('[data-seltab]').forEach(b => { const on = b.dataset.seltab === selTab; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  $('sel-eyebrow').textContent = { friends: 'FRIENDS', groups: 'GROUPS' }[selTab] || 'SELECT YOUR INVESTIGATOR';
  $('sel-title').textContent = { friends: 'フレンド一覧', groups: 'グループ' }[selTab] || '探索者をえらぶ';
  $('sel-desc').textContent = { friends: 'フレンドを押すと、その人の公開キャラシが見られます。真ん中からフレンドを追加できます。', groups: '代表者がグループを作ってフレンドを招待し、招待された人はキーパーか探索者かを選んで参加します。キャラ名を押すとキャラシが開きます。' }[selTab] || ((state.selView || 'orbit') === 'slide' ? 'キャラを押すとシートが開きます。いちばん左から新しい探索者をつくれます。' : 'キャラを押すとシートが開きます。真ん中から新しい探索者をつくれます。');
  renderSortBar();
  if (selTab === 'friends') { renderFriendSelect(stage); return; }
  if (selTab === 'groups') { renderGroupSelect(stage); return; }
  if ((state.selView || 'orbit') === 'slide') {
    stage.classList.remove('grid', 'listv', 'themev'); stage.classList.add('slidev'); stage.style.height = '';
    stage.innerHTML = slideViewHtml(sortedChars());
    initSlide();
    return;
  }
  stage.classList.remove('slidev');
  if ((state.selView || 'orbit') === 'list') {
    stage.classList.remove('grid', 'themev'); stage.classList.add('listv'); stage.style.height = '';
    stage.innerHTML = listViewHtml(sortedChars());
    return;
  }
  stage.classList.remove('listv');
  const tsel = themeSelHtml(sortedChars());   // 和風・ドット・アクアリウムは、そのテーマだけの並べ方
  stage.classList.toggle('themev', !!tsel);
  if (tsel) { stage.classList.remove('grid'); stage.style.height = ''; stage.innerHTML = tsel; return; }
  const W = stage.clientWidth || Math.min(1100, innerWidth - 32);
  const small = W < 560;
  const B = small ? 70 : 100;
  const chars = sortedChars();
  const pos = [], radii = [];
  let r = small ? Math.min(150, W / 2 - (B + 44) / 2 - 4) : 210, ring = 0, idx = 0, grid = false;
  const ky = small ? 1.45 : 1;
  if (r < 100) grid = true;
  while (!grid && idx < chars.length) {
    if (r + (B + 44) / 2 > W / 2) break;
    const cap = Math.max(5, Math.floor(2 * Math.PI * r / (B + 54)));
    const n = Math.min(cap, chars.length - idx);
    for (let j = 0; j < n; j++) {
      const ang = -Math.PI / 2 + (j + (ring % 2) * .5) / n * 2 * Math.PI;
      pos.push([r * Math.cos(ang), r * ky * Math.sin(ang)]);
    }
    radii.push(r); idx += n; r += B + 62; ring++;
  }
  const newBtn = `<button class="sel-new" type="button" id="sel-new"><span class="plus">＋</span><b>新しい探索者</b><small>NEW INVESTIGATOR</small></button>`;
  const charBtn = (c, i, xy) => `<button class="sel-char" type="button" data-id="${c.id}" style="--i:${i};--B:${B}px${xy ? `;left:calc(50% + ${xy[0].toFixed(1)}px);top:calc(50% + ${xy[1].toFixed(1)}px)` : ''}" aria-label="${esc(c.profile.name || '名無し')}のシートを開く">
      ${tokenHtml(c)}${c.bgm ? '<span class="sel-bgm" title="BGMあり">♪</span>' : ''}${c.locked ? '<span class="sel-lock" title="フレンドに非公開"><svg class="lk" viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg></span>' : ''}<span class="sel-name">${esc(c.profile.name || '名無し')}</span><span class="sel-sys">${esc(sortValueText(c) || (SYS[c.system].short + (c.profile.occupation ? ' ・ ' + c.profile.occupation : '')))}</span>
    </button>`;
  stage.classList.toggle('grid', grid);
  if (grid) idx = chars.length;
  if (grid) {
    stage.style.height = '';
    stage.innerHTML = `${newBtn}<div class="sel-grid">${chars.map((c, i) => charBtn(c, i)).join('')}</div>`;
  } else {
    const maxR = radii.length ? radii[radii.length - 1] : r;
    const H = Math.max(small ? 360 : 480, 2 * (maxR * ky + B / 2 + 46));
    const rest = chars.slice(idx);
    stage.style.height = H + 'px';
    const ringR = radii.length ? radii : [maxR];
    stage.innerHTML = `<svg class="sel-rings" aria-hidden="true">${ringR.map(rr => `<ellipse cx="50%" cy="50%" rx="${rr}" ry="${(rr * ky).toFixed(1)}"/>`).join('')}<circle cx="50%" cy="50%" r="${small ? 80 : 112}"/></svg>
      ${newBtn}${chars.slice(0, idx).map((c, i) => charBtn(c, i, pos[i])).join('')}
      ${chars.length ? '' : '<p class="sel-empty">まだ探索者がいません。真ん中を押して作りましょう。</p>'}`;
    if (rest.length) stage.insertAdjacentHTML('afterend', `<div class="sel-grid sel-rest" id="sel-rest">${rest.map((c, i) => charBtn(c, idx + i)).join('')}</div>`);
  }
}
/* ---- スライド表示の動き ---- */
let slideRaf = 0;
function slideUpdate() {
  const tr = $('sl-track'); if (!tr) return;
  const mid = tr.scrollLeft + tr.clientWidth / 2;
  tr.querySelectorAll('.sl-card').forEach(el => {
    const d = (el.offsetLeft + el.offsetWidth / 2 - mid) / el.offsetWidth, ad = Math.min(2.5, Math.abs(d));
    el.style.setProperty('--d', Math.max(-2.5, Math.min(2.5, d)).toFixed(3));
    el.style.setProperty('--ad', ad.toFixed(3));
    el.style.zIndex = String(100 - Math.round(ad * 10));
    el.classList.toggle('center', Math.abs(d) < .5);
  });
}
function slideTo(tr, el, smooth) {
  tr.scrollTo({ left: el.offsetLeft + el.offsetWidth / 2 - tr.clientWidth / 2, behavior: smooth && !reduceMotion.matches ? 'smooth' : 'auto' });
}
function initSlide() {
  const tr = $('sl-track'); if (!tr) return;
  const start = [...tr.querySelectorAll('.sel-char')].find(x => x.dataset.id === state.activeId) || tr.querySelector('.sel-char') || tr.querySelector('.sl-card');
  if (start) slideTo(tr, start, false);
  slideUpdate();
  tr.addEventListener('scroll', () => { cancelAnimationFrame(slideRaf); slideRaf = requestAnimationFrame(slideUpdate); }, { passive: true });
  // マウスのホイール・ドラッグでも横に流し、止まったら一番近いキャラを真ん中に寄せる
  let snapT = null;
  const settle = () => {
    clearTimeout(snapT);
    snapT = setTimeout(() => {
      const mid = tr.scrollLeft + tr.clientWidth / 2;
      let best = null, bd = Infinity;
      tr.querySelectorAll('.sl-card').forEach(el => { const dd = Math.abs(el.offsetLeft + el.offsetWidth / 2 - mid); if (dd < bd) { bd = dd; best = el; } });
      if (best) slideTo(tr, best, true);
      setTimeout(() => tr.classList.remove('free'), 600);
    }, 160);
  };
  tr.addEventListener('wheel', e => {
    const dl = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (!dl) return;
    e.preventDefault(); hidePeek(); clearTimeout(selPress);
    tr.classList.add('free'); tr.scrollLeft += dl; settle();
  }, { passive: false });
  let drag = null;
  tr.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse' && e.button === 0) drag = { x: e.clientX, s: tr.scrollLeft, id: e.pointerId, moved: false }; });
  tr.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 6) { drag.moved = true; clearTimeout(selPress); hidePeek(); tr.classList.add('free', 'dragging'); tr.setPointerCapture(e.pointerId); }
    if (drag.moved) tr.scrollLeft = drag.s - dx;
  });
  const end = () => { if (drag && drag.moved) { selLong = true; tr.classList.remove('dragging'); settle(); } drag = null; };
  tr.addEventListener('pointerup', end); tr.addEventListener('pointercancel', end);
  tr.addEventListener('focusin', e => { const c = e.target.closest('.sl-card'); if (c && !c.classList.contains('center')) slideTo(tr, c, true); });
  tr.addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const cards = [...tr.querySelectorAll('.sl-card')], i = cards.findIndex(c => c.classList.contains('center'));
    const n = cards[Math.max(0, Math.min(cards.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)))];
    if (n) { e.preventDefault(); n.focus({ preventScroll: true }); slideTo(tr, n, true); }
  });
}
function popSelect() {
  if (reduceMotion.matches) return;
  const stage = $('sel-stage');
  if (stage.classList.contains('themev')) {   // テーマだけの並べ方の出かた
    const cards = [...stage.querySelectorAll('.ts-wa-card, .ts-dot-row, .ts-aq-bub, .ts-aq-new')];
    const d0 = (typeof aqWaveBusy !== 'undefined' && aqWaveBusy) ? 900 : 120;
    if (isWa()) cards.forEach((el, i) => {   // 掛け軸が上からするすると下りる
      el.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], { duration: 900, delay: 300 + i * 110, easing: 'cubic-bezier(.5, 0, .2, 1)', fill: 'backwards' });
      el.animate([{ transform: 'translateY(-8px)' }, { transform: 'rotate(.8deg)', offset: .75 }, { transform: 'none' }], { duration: 1300, delay: 300 + i * 110, easing: 'ease-out', fill: 'backwards' });
    });
    else if (isDot()) cards.forEach((el, i) => el.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { duration: 360, delay: 260 + i * 120, easing: 'steps(8, end)', fill: 'backwards' }));
    else cards.forEach((el, i) => el.animate([{ opacity: 0, transform: 'translateY(60px) scale(.7)' }, { opacity: 1, transform: 'translateY(-6px) scale(1.03)', offset: .7 }, { opacity: 1, transform: 'none' }], { duration: 1000, delay: d0 + i * 90, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'backwards' }));
    document.querySelector('.sel-head')?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, easing: 'ease-out' });
    return;
  }
  if (isOrbis()) {   // 星のように、ひとつずつふわっと灯る
    const d0 = obWarpBusy ? 820 : 60;
    stage.querySelectorAll('.sel-char, .sel-row').forEach((el, i) => el.animate(
      [{ opacity: 0, transform: 'translateY(26px) scale(.86)' }, { opacity: 1, transform: 'translateY(-3px) scale(1.02)', offset: .65 }, { opacity: 1, transform: 'none' }],
      { duration: 820, delay: d0 + i * 60, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'backwards' }));
    [$('sel-new'), document.querySelector('.sel-head')].forEach((el, i) => el?.animate([{ opacity: 0, transform: 'translateY(16px) scale(.96)' }, { opacity: 1, transform: 'none' }], { duration: 760, delay: d0 + i * 40, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'backwards' }));
    return;
  }
  if (isAqua()) {   // 泡のように下からふわりと浮かんでくる
    const d0 = aqWaveBusy ? 900 : 60;
    stage.querySelectorAll('.sel-char, .sel-row').forEach((el, i) => el.animate(
      [{ opacity: 0, transform: 'translateY(40px) scale(.85)' }, { opacity: 1, transform: 'translateY(-4px) scale(1.02)', offset: .7 }, { opacity: 1, transform: 'none' }],
      { duration: 900, delay: d0 + i * 70, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'backwards' }));
    [$('sel-new'), document.querySelector('.sel-head')].forEach(el => el?.animate([{ opacity: 0, transform: 'translateY(24px)' }, { opacity: 1, transform: 'none' }], { duration: 800, delay: d0, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'backwards' }));
    return;
  }
  if (isBook()) {
    const d0 = bookCoverBusy ? 980 : 80;   // 表紙がひらいてから書きこむ
    stage.querySelectorAll('.sel-char, .sel-row').forEach((el, i) => el.animate(
      [{ clipPath: 'inset(0 100% 0 0)', opacity: .35 }, { clipPath: 'inset(0 0% 0 0)', opacity: 1 }],
      { duration: 620, delay: d0 + i * 60, easing: 'cubic-bezier(.45, .1, .35, 1)', fill: 'backwards' }));
    [$('sel-new'), document.querySelector('.sel-head')].forEach(el => el?.animate([{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }], { duration: 560, delay: d0, easing: 'cubic-bezier(.45, .1, .35, 1)', fill: 'backwards' }));
    return;
  }
  stage.querySelectorAll('.sel-char, .sel-row').forEach((el, i) => el.animate(
    [{ opacity: 0, transform: 'scale(.3)', filter: 'blur(6px)' }, { opacity: 1, transform: 'scale(1)', filter: 'blur(0)' }],
    { duration: 700, delay: 120 + i * 70, easing: 'cubic-bezier(.2, .9, .3, 1.25)', fill: 'backwards' }));
  $('sel-new')?.animate([{ opacity: 0, scale: .6 }, { opacity: 1, scale: 1 }], { duration: 700, easing: 'cubic-bezier(.2, .9, .3, 1.2)' });
  document.querySelector('.sel-head')?.animate([{ opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing: 'ease-out' });
}
function showSelect() {
  if (themeSwitchFx() && !showSelect.inner && !reduceMotion.matches && $('select').hidden) { themeSwitchFx()(() => { showSelect.inner = true; try { showSelect(); } finally { showSelect.inner = false; } }); return; }
  hidePeek();
  if (!themeSwitchFx() && $('select').hidden) snd('warp');   // 切りかえの動きがないテーマ（近未来）も音だけ
  if (selTab === 'friends') setTimeout(refreshFriendView, 0);
  stopBgm(); $('bgm').hidden = true;
  const sel = $('select'); sel.hidden = false; sel.scrollTop = 0;
  applyBg();
  document.documentElement.style.overflow = 'hidden';
  renderSelect();
  if (!reduceMotion.matches && !isBook() && !isAqua() && !isOrbis()) sel.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' });
  popSelect();
}
function leaveSelect(fromEl, quick) {
  hidePeek();
  titleBgmStop();   // キャラシを開いたら、はじめの画面の曲をゆっくり消す
  const sel = $('select');
  const done = () => { sel.hidden = true; document.documentElement.style.overflow = ''; scrollTo(0, 0); renderPlayer(); };
  if (reduceMotion.matches || quick) { done(); return; }
  if (themeSwitchFx()) { themeSwitchFx()(done); return; } // 和風は襖、ドットはモザイク、魔導書は表紙で切りかえ
  snd('warp');
  if (fromEl) {
    fxAt(fromEl, true);
    fromEl.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.5)', opacity: 0 }], { duration: 520, easing: 'cubic-bezier(.5, 0, .3, 1)', fill: 'forwards' });
  }
  const a = sel.animate([{ opacity: 1, transform: 'none', filter: 'blur(0)' }, { opacity: 0, transform: 'scale(1.06)', filter: 'blur(10px)' }], { duration: 560, delay: 140, easing: 'cubic-bezier(.5, 0, .3, 1)', fill: 'forwards' });
  a.finished.then(() => {
    done(); a.cancel();
    document.querySelector('.app').animate([{ opacity: .2, transform: 'scale(1.03)', filter: 'blur(10px)' }, { opacity: 1, transform: 'none', filter: 'none' }], { duration: 800, easing: 'cubic-bezier(.2, .8, .2, 1)' });
  });
}
$('select').addEventListener('click', e => {
  const tb = e.target.closest('[data-seltab]');
  if (tb) { setSelTab(tb.dataset.seltab); return; }
  if (e.target.closest('#sel-newgroup')) { openGroupEditor(null); return; }
  const ge = e.target.closest('[data-gedit]');
  if (ge) { openGroupEditor(ge.dataset.gedit); return; }
  const gj = e.target.closest('[data-gjoin]');
  if (gj) { openJoin(gj.dataset.gjoin); return; }
  const gd = e.target.closest('[data-gdecline]');
  if (gd) { declineGroup(gd.dataset.gdecline); return; }
  const gc = e.target.closest('[data-gcopy]');
  if (gc) { copyText(gc.dataset.gcopy, { classList: { remove() {}, add() {} }, set textContent(v) {} }, null).then(ok => toast(ok ? 'ルームURLをコピーしました。' : 'コピーできませんでした。')); return; }
  const gm = e.target.closest('[data-gm-user]');
  if (gm) { openMemberChar(gm.dataset.gmUser, gm.dataset.gmChar); return; }
  if (e.target.closest('#sel-addfriend')) { openFriends(); setTimeout(() => $('ol-name')?.focus(), 60); return; }
  if (e.target.closest('#sel-login')) { acctTab = 'login'; openAccount(); return; }
  const fb = e.target.closest('.sel-friend');
  if (fb) { if (selLong) { selLong = false; return; } if (fb.dataset.kind === 'fr') viewFriend(fb.dataset.fuid, fb.dataset.fname); else openFriends(); return; }
  const nw = e.target.closest('#sel-new');
  if (nw) { if (nw.classList.contains('sl-card') && !nw.classList.contains('center')) slideTo($('sl-track'), nw, true); else openNewChar(); return; }
  if (e.target.closest('#sel-import')) { $('btn-import').click(); return; }
  if (e.target.closest('#sel-theme')) { $('btn-theme').click(); return; }
  const ch = e.target.closest('.sel-char, .sel-row, .ts-card'); if (!ch) return;
  if (selLong) { selLong = false; return; }
  // スライド：奥にいるキャラを押したら、まず真ん中まで回してくる
  if (ch.classList.contains('sl-card') && !ch.classList.contains('center')) { slideTo($('sl-track'), ch, true); return; }
  state.activeId = ch.dataset.id; save();
  renderShelf(); renderSheet(); renderOutput();
  leaveSelect(ch);
  playCharBgm(active());
});
$('select').addEventListener('pointerover', e => {
  if (!canHover.matches) return;
  const ch = e.target.closest('.sel-char:not(.sel-friend):not(.sl-card), .sel-row, .ts-card');
  if (ch && ch.dataset.id !== peekId) showPeek(ch);
  if (!ch && peekId) hidePeek();
});
$('select').addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hidePeek(); });
$('select').addEventListener('scroll', hidePeek, { passive: true });
$('select').addEventListener('pointerdown', e => {
  const ch = e.target.closest('.sel-char'); if (!ch) return;
  if (e.pointerType === 'mouse' && (e.button !== 0 || !ch.classList.contains('sl-card'))) return; // スライドはマウスでも長押しで詳細
  selLong = false; clearTimeout(selPress);
  selPress = setTimeout(() => { selLong = true; showPeek(ch); if (navigator.vibrate) navigator.vibrate(10); }, 450);
});
['pointerup', 'pointercancel'].forEach(ev => $('select').addEventListener(ev, () => clearTimeout(selPress)));
$('select').addEventListener('contextmenu', e => { if (e.target.closest('.sel-char')) e.preventDefault(); });
$('btn-select').addEventListener('click', () => { selTab = 'mine'; showSelect(); });
document.querySelector('.brand').addEventListener('click', () => { selTab = 'mine'; showSelect(); });
document.querySelector('.brand').style.cursor = 'pointer';
addEventListener('resize', () => { clearTimeout(selResizeT); selResizeT = setTimeout(() => { if (!$('select').hidden) renderSelect(); }, 150); });

/* ---- テーマごとの「探索者をえらぶ」画面（近未来のまるい並び方とは別の形） ----
   和風：掛け軸が右から左へ並ぶ ／ ドット：昔のRPGの「ぼうけんのしょ」 ／ アクアリウム：泡に入ったキャラが水中にうかぶ
   押したときは .ts-card の data-id で探索者を開く（下のクリックの処理）。新しい探索者は #sel-new */
const themeSelName = () => isWa() ? '掛け軸' : isDot() ? 'ぼうけんのしょ' : isAqua() ? '水槽' : '';
function themeSelHtml(chars) {
  const pic = c => { const src = portraitSrc(c); return src ? `<img src="${esc(imgSrc(src))}" alt="" draggable="false" onerror="this.remove()">` : ''; };
  const meta = c => esc([SYS[c.system].short, c.profile.occupation].filter(Boolean).join('・'));
  if (isWa()) return `<div class="ts-wa"><i class="ts-wa-rail" aria-hidden="true"></i><div class="ts-wa-row">
      <button class="ts-wa-card new" type="button" id="sel-new" style="--i:0"><i class="rod"></i><span class="paper"><b class="tate">新しき探索者</b><span class="stamp">新</span></span><i class="rod low"></i></button>
      ${chars.map((c, i) => `<button class="ts-card ts-wa-card" type="button" data-id="${c.id}" style="--i:${i + 1}" aria-label="${esc(c.profile.name || '名無し')}のシートを開く">
        <i class="rod"></i><span class="paper"><span class="pic ${pic(c) ? 'has' : ''}">${pic(c) || tokenHtml(c)}</span><b class="tate">${esc(c.profile.name || '名無し')}</b><small class="tate">${meta(c)}</small></span><i class="rod low"></i></button>`).join('')}
    </div></div>`;
  if (isDot()) return `<div class="ts-dot"><div class="ts-dot-win"><p class="ts-dot-ttl">▼ ぼうけんのしょ を えらんでください</p><ol>
      ${chars.map((c, i) => { const d = compute(c); return `<li><button class="ts-card ts-dot-row" type="button" data-id="${c.id}" style="--i:${i}" aria-label="${esc(c.profile.name || '名無し')}のシートを開く">
        <span class="cur" aria-hidden="true">▶</span><span class="no">${String(i + 1).padStart(2, '0')}</span>${tokenHtml(c)}<span class="nm">${esc(c.profile.name || '名無し')}</span><span class="job">${meta(c)}</span><span class="hp">HP ${d.hp}/${d.hpMax}　SAN ${d.san}</span></button></li>`; }).join('')}
      <li><button class="ts-dot-row new" type="button" id="sel-new" style="--i:${chars.length}"><span class="cur" aria-hidden="true">▶</span><span class="no">＋</span><span class="nm">あたらしく ぼうけんを はじめる</span></button></li>
    </ol></div></div>`;
  if (isAqua()) return `<div class="ts-aq">
      <button class="ts-aq-new" type="button" id="sel-new"><span class="bub"><b>＋</b></span><span class="plate"><b>新規作成</b><small>NEW</small></span></button>
      ${chars.map((c, i) => `<button class="ts-card ts-aq-bub" type="button" data-id="${c.id}" style="--i:${i};--y:${[0, 38, 12, 52, 4, 30][i % 6]}px;--s:${[1, .86, .94, .8, 1.04, .9][i % 6]};--d:${(5 + (i % 4) * .8).toFixed(1)}s" aria-label="${esc(c.profile.name || '名無し')}のシートを開く">
        <span class="bub">${pic(c) || tokenHtml(c)}</span><span class="plate"><b>${esc(c.profile.name || '名無し')}</b><small>${meta(c)}</small></span></button>`).join('')}
    </div>`;
  return '';
}
