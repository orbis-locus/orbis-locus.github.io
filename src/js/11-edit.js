/* ================= 編集 ================= */
function setPath(obj, path, val) {
  const ks = path.split('.'); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
  o[ks[ks.length - 1]] = val;
}
function onEdit(e) {
  const t = e.target; if (!t.dataset.p) return;
  setPath(active(), t.dataset.p, t.type === 'checkbox' ? t.checked : t.value);
  touch();
  if (t.dataset.p.startsWith('dice.')) refreshDiceBox();
}
const onBoth = (ev, fn) => [$('sheet'), $('panel')].forEach(el => el.addEventListener(ev, fn));
onBoth('input', e => { if (e.target.type !== 'checkbox' && e.target.tagName !== 'SELECT') onEdit(e); });
onBoth('change', e => { if (e.target.type === 'checkbox' || e.target.tagName === 'SELECT') { onEdit(e); if (e.target.tagName === 'SELECT') updateComputed(); } });

function arm(b, label) {
  if (b.classList.contains('armed')) return true;
  const orig = b.textContent;
  b.classList.add('armed'); b.textContent = label;
  setTimeout(() => { b.classList.remove('armed'); b.textContent = orig; }, 3000);
  return false;
}

onBoth('click', e => {
  const bt = e.target.closest('[data-booktab]');
  if (bt) { setBookTab(bt.dataset.booktab); return; }
  const bs = e.target.closest('[data-booksub]');
  if (bs) { setBookSub(bs.dataset.booksub); return; }
  const stg = e.target.closest('[data-stage]');
  if (stg) { openStage(stg); return; }
  const op = e.target.closest('[data-open]');
  if (op) { openPanel(op.dataset.open, op); return; }
  const b = e.target.closest('button'); if (!b) return;
  const c = active();
  if (b.dataset.del) { c[b.dataset.del].splice(+b.dataset.i, 1); touch(); renderSheet(); return; }
  let focus = null;
  switch (b.dataset.act) {
    case 'add-skill': {
      const i = c.skills.map(s => s.cat).lastIndexOf(b.dataset.cat) + 1;
      c.skills.splice(i, 0, { cat: b.dataset.cat, name: '', hasSub: false, sub: '', init: '1', job: '', hobby: '', grow: '', other: '', isJob: false, custom: true });
      focus = pid(`skills.${i}.name`); break;
    }
    case 'dup-skill': {
      const i = +b.dataset.i, s = c.skills[i];
      c.skills.splice(i + 1, 0, { ...s, sub: '', job: '', hobby: '', grow: '', other: '', isJob: false, dup: true });
      focus = pid(`skills.${i + 1}.sub`); break;
    }
    case 'icon-edit': openIconEditor(); return;
    case 'sfx': state.sfx = state.sfx === false; save(); renderSheet(); if (state.sfx !== false) sfxFlip(0, 700); toast(state.sfx === false ? '効果音をオフにしました。' : '効果音をオンにしました。'); return;
    case 'portrait-remove': c.portrait = ''; c.avatar = ''; break;
    case 'charbg-remove': c.bgImage = ''; applyBg(); break;
    case 'lock':
      c.locked = !c.locked;
      toast(c.locked ? 'このキャラシは非公開になりました。フレンドからは見えません。' : 'このキャラシはフレンドに公開されます。');
      break;
    case 'toggle-friend': {
      const sc = c.scenarios[+b.dataset.i]; if (!sc) return;
      sc.friends = sc.friends || [];
      const k = sc.friends.indexOf(b.dataset.fid);
      if (k < 0) sc.friends.push(b.dataset.fid); else sc.friends.splice(k, 1);
      break;
    }
    case 'open-friends': openFriends(); return;
    case 'secret-open': {   // 秘匿を公開する／しない（公開すると、キャラシを見られる人も読める）
      const v = b.dataset.v === '1'; if (!!c.secretOpen === v) return;
      c.secretOpen = v;
      toast(v ? '秘匿を公開しました。このキャラシを見られる人も読めます。' : '秘匿を非公開にしました。自分とグループのキーパーだけが読めます。');
      const wasOpen = !!b.closest('.secret-box')?.classList.contains('open');
      touch(); renderSheet();
      if (panelKey && !$('panel-ov').hidden) fillPanel(panelKey);
      if (wasOpen) document.querySelectorAll('.secret-box').forEach(x => { x.classList.add('open'); const t = x.querySelector('[data-act="toggle-secret"]'); if (t) { t.textContent = '隠す'; t.setAttribute('aria-expanded', 'true'); } });   // 開いていた秘匿は開いたまま
      return;
    }
    case 'toggle-secret': {
      const box = b.closest('.secret-box'); if (!box) return;
      const open = box.classList.toggle('open');
      b.textContent = open ? '隠す' : '表示する'; b.setAttribute('aria-expanded', open);
      if (open) box.querySelector('textarea')?.focus();
      return;
    }
    case 'share': openShare(c); return;
    case 'face-pick': pickFace(c, +b.dataset.i); return;
    case 'face-del': {
      if (!arm(b, '消す?')) return;
      const i = +b.dataset.i; if (!c.faces || !c.faces[i]) return;
      c.faces.splice(i, 1);
      if (c.face === i) c.face = -1; else if (c.face > i) c.face--;
      break;
    }
    case 'face-url': {
      const u = ($('f-face-url').value || '').trim();
      if (!/^https:\/\/\S+$/.test(u)) { toast('https:// で始まる画像のURLを入れてください。'); return; }
      addFaces(c, [{ label: decodeURIComponent(u.split('/').pop().split('?')[0]).replace(/\.[^.]+$/, '').slice(0, 20) || '差分', src: u }]);
      return;
    }
    case 'bgm-play': playCharBgm(c, true); return;
    case 'bgm-remove': if (c.bgm?.src === 'idb') AudioDB.del(c.id).catch(() => {}); delete c.bgm; if (bgmFor === c.id) stopBgm(); break;
    case 'bgm-url': {
      const u = ($('f-bgm-url').value || '').trim();
      if (!/^https?:\/\/\S+$/.test(u)) { toast('https:// で始まるYouTubeか音楽ファイルのURLを入れてください。'); return; }
      const yt = parseYouTube(u);
      if (yt) {
        if (c.bgm?.src === 'idb') AudioDB.del(c.id).catch(() => {});
        c.bgm = { src: 'yt', vid: yt.id, start: yt.start, url: u, name: 'YouTube', volume: c.bgm?.volume ?? 60 };
        touch(); renderSheet(); playCharBgm(c, true); return;
      }
      if (/youtube\.com|youtu\.be/i.test(u)) { toast('YouTubeの動画URLを読み取れませんでした。動画ページのURL（https://www.youtube.com/watch?v=… や https://youtu.be/…）を入れてください。'); return; }
      if (/nicovideo|soundcloud\.com|spotify\.com/i.test(u)) { toast('このサイトのURLは使えません。YouTubeか、mp3などの音楽ファイルを直接開けるURLを入れてください。'); return; }
      if (c.bgm?.src === 'idb') AudioDB.del(c.id).catch(() => {});
      c.bgm = { src: 'url', url: u, name: decodeURIComponent(u.split('/').pop().split('?')[0]).replace(/\.[^.]+$/, '') || 'BGM', volume: c.bgm?.volume ?? 60 };
      touch(); renderSheet(); playCharBgm(c, true); return;
    }
    case 'add-weapon': c.weapons.push({ name: '', rate: '', damage: '', range: '', attacks: '1', ammo: '', durability: '', note: '' }); focus = pid(`weapons.${c.weapons.length - 1}.name`); break;
    case 'add-item': c.items.push({ name: '', count: '', price: '', note: '' }); focus = pid(`items.${c.items.length - 1}.name`); break;
    case 'add-scenario': c.scenarios.push({ name: '', date: '', note: '', friends: [] }); focus = pid(`scenarios.${c.scenarios.length - 1}.name`); break;
    case 'roll': {
      const filled = Object.values(c.abilities).some(v => v.base !== '');
      if (diceInfo(c).left <= 0) { diceSpend(c); return; }
      if (filled && !arm(b, 'もう一度押すと全部振り直し')) return;
      if (!diceSpend(c)) return;
      const res = SYS[c.system].abil.map(([k, dice, expr, jp]) => { const r = rollDetail(expr); c.abilities[k].base = String(r.total); return { k: jp || k, ...r }; });
      c.hp = ''; c.mp = ''; c.san = '';
      fxAt(b, true);
      diceCardAll(res);
      break;
    }
    case 'roll-one': {
      const def = SYS[c.system].abil.find(([k]) => k === b.dataset.k); if (!def) return;
      if (!diceSpend(c)) return;
      const r = rollDetail(def[2]);
      c.abilities[def[0]].base = String(r.total);
      if (['CON', 'SIZ'].includes(def[0])) c.hp = '';
      if (def[0] === 'POW') { c.mp = ''; c.san = ''; }
      fxAt(b, false);
      diceCardOne(def[3] || def[0], r);
      break;
    }
    case 'check': {
      const sk = c.skills[+b.dataset.i]; if (!sk) return;
      const a = abilities(c), target = skillTotal(sk, a);
      fxAt(b, false);
      diceCardCheck(skillLabel(sk) || '技能', target, c.system);
      return;
    }
    case 'dice-reset': {
      if (!arm(b, 'もう一度押すとリセット')) return;
      c.dice.used = 0; toast('ダイスを振った回数をリセットしました。');
      break;
    }
    case 'dup': {
      if (!canAddChar()) return;
      const copy = JSON.parse(JSON.stringify(c));
      copy.id = uid(); copy.profile.name = (c.profile.name || '名無し') + '（コピー）'; delete copy.sample;
      if (c.bgm?.src === 'idb') AudioDB.get(c.id).then(bl => bl && AudioDB.put(copy.id, bl)).catch(() => {});
      state.chars.splice(state.chars.indexOf(c) + 1, 0, copy); state.activeId = copy.id;
      save(); renderAll(); return;
    }
    case 'del': {
      if (!arm(b, '本当に削除する')) return;
      if (c.bgm?.src === 'idb') AudioDB.del(c.id).catch(() => {});
      if (bgmFor === c.id) stopBgm();
      state.chars = state.chars.filter(x => x.id !== c.id);
      state.activeId = state.chars.length ? state.chars[0].id : null;
      unsetGroupChar(c.id);
      save(); renderAll();
      if (!state.chars.length) { selTab = 'mine'; showSelect(); toast('探索者をすべて削除しました。「＋ 新しい探索者」から作れます。'); }
      return;
    }
    default: return;
  }
  if (isBook()) {
    const listKey = { 'add-weapon': 'weapons', 'add-item': 'items', 'add-scenario': 'scenarios' }[b.dataset.act];
    if (listKey) { bookSubMap()[listKey] = 'e' + (c[listKey].length - 1); state.bookTab = listKey; }
  }
  touch(); renderSheet();
  if (focus) $(focus)?.focus();
});

let pressTimer = null, longPressed = false;
$('shelf').addEventListener('click', e => {
  const b = e.target.closest('[data-id]'); if (!b) return;
  if (longPressed) { longPressed = false; e.preventDefault(); return; }
  const go = () => { state.activeId = b.dataset.id; save(); renderAll(); playCharBgm(active()); };
  if (isBook() && b.dataset.id !== state.activeId) bookCover(go); else go();   // 魔導書では、別の探索者の本に持ちかえる
});
$('shelf').addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') return;
  const it = e.target.closest('.char-item'); if (!it) return;
  longPressed = false;
  clearTimeout(pressTimer);
  pressTimer = setTimeout(() => { longPressed = true; showPeek(it); if (navigator.vibrate) navigator.vibrate(10); }, 450);
});
['pointerup', 'pointercancel', 'pointermove'].forEach(ev => $('shelf').addEventListener(ev, e => {
  if (ev === 'pointermove' && Math.abs(e.movementX) + Math.abs(e.movementY) < 4) return;
  clearTimeout(pressTimer);
}));
$('shelf').addEventListener('contextmenu', e => { if (e.target.closest('.char-item')) e.preventDefault(); });
document.addEventListener('pointerdown', e => { if (!$('peek').hidden && e.pointerType !== 'mouse' && !e.target.closest('.char-item')) hidePeek(); });
$('opt-all').addEventListener('change', e => { state.paletteAll = e.target.checked; save(); renderOutput(); });
