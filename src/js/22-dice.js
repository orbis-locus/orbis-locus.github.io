/* ================= ダイスの結果表示 ================= */
const diceTray = (() => { const t = document.createElement('div'); t.className = 'dice-tray'; t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); return t; })();
function judge(v, target, sys) {
  if (sys === 'coc7') {
    if (v === 1) return ['crit', 'クリティカル'];
    if (v === 100 || (target < 50 && v >= 96)) return ['fumble', 'ファンブル'];
    if (v <= Math.floor(target / 5)) return ['crit', 'イクストリーム成功'];
    if (v <= Math.floor(target / 2)) return ['ok', 'ハード成功'];
    if (v <= target) return ['ok', 'レギュラー成功'];
    return ['fail', '失敗'];
  }
  if (v <= 5 && v <= target) return ['crit', '決定的成功（クリティカル）'];
  if (v >= 96 && v > target) return ['fumble', '致命的失敗（ファンブル）'];
  if (v <= target) return ['ok', '成功'];
  return ['fail', '失敗'];
}
function pushCard(html, cls) {
  const card = document.createElement('div');
  card.className = 'dcard ' + (cls || '');
  card.innerHTML = html + '<button class="dc-x" type="button" aria-label="閉じる">×</button>';
  diceTray.prepend(card);
  [...diceTray.children].slice(innerWidth < 760 ? 1 : 3).forEach(el => el.remove());
  card.querySelector('.dc-x').addEventListener('click', () => card.remove());
  clearTimeout(card._t);
  card._t = setTimeout(() => { card.classList.add('out'); setTimeout(() => card.remove(), 400); }, 9000);
  return card;
}
function tumble(card, done) {
  const faces = card.querySelectorAll('[data-face]');
  const nums = card.querySelectorAll('[data-final]');
  if (reduceMotion.matches) { faces.forEach(f => { f.textContent = f.dataset.face; }); nums.forEach(n => { n.textContent = n.dataset.final; }); done && done(); return; }
  const t0 = performance.now(), dur = 650;
  const step = t => {
    const k = (t - t0) / dur;
    if (k < 1) {
      faces.forEach(f => { f.textContent = 1 + Math.floor(Math.random() * (+f.dataset.sides || 6)); });
      nums.forEach(n => { n.textContent = Math.floor(Math.random() * (+n.dataset.max || 99)) + 1; });
      requestAnimationFrame(step);
    } else {
      faces.forEach(f => { f.textContent = f.dataset.face; f.classList.add('land'); });
      nums.forEach(n => { n.textContent = n.dataset.final; n.classList.add('land'); });
      done && done();
    }
  };
  requestAnimationFrame(step);
}
const facesHtml = r => r.groups.map(g => g.faces.map(f => `<i class="die" data-face="${f}" data-sides="${g.s}">?</i>`).join('')).join('<span class="dplus">＋</span>');
function diceCardOne(name, r) {
  const card = pushCard(`<div class="dc-head"><b>${esc(name)}</b><small>${esc(r.expr)}</small></div>
    <div class="dc-body"><span class="dc-faces">${facesHtml(r)}</span><span class="dc-eq">＝</span><b class="dc-total" data-final="${r.total}" data-max="${Math.max(18, r.total)}">?</b></div>`, 'one');
  tumble(card);
}
function diceCardAll(list) {
  const card = pushCard(`<div class="dc-head"><b>能力値をまとめて振りました</b></div>
    <div class="dc-grid">${list.map(r => `<div class="dc-row"><b>${esc(r.k)}</b><span class="dc-faces sm">${facesHtml(r)}</span><small>${esc(r.expr)}</small><b class="dc-total sm" data-final="${r.total}" data-max="${Math.max(18, r.total)}">?</b></div>`).join('')}</div>`, 'all');
  tumble(card);
}
function diceCardCheck(name, target, sys) {
  const v = 1 + Math.floor(Math.random() * 100);
  const [cls, label] = judge(v, target, sys);
  const card = pushCard(`<div class="dc-head"><b>${esc(name)}</b><small>${sys === 'coc7' ? 'CC' : 'CCB'}&lt;=${target}</small></div>
    <div class="dc-body"><b class="dc-total big" data-final="${v}" data-max="100">?</b><span class="dc-vs">/ ${target}</span><span class="dc-verdict" hidden>${label}</span></div>`, 'check');
  tumble(card, () => {
    const vd = card.querySelector('.dc-verdict');
    vd.hidden = false; card.classList.add('res-' + cls);
    if (cls === 'crit' && !reduceMotion.matches) fxAt(vd, true);
  });
}

/* ================= ダイスの上限回数 =================
   ・キャラごとに上限を決められる（c.dice = { limit: '空欄なら上限なし', used: 振った回数 }）
   ・そのキャラでグループに参加していて、キーパーが上限を決めているときは、そちらが優先（数はグループごとに c.diceG[グループID] に記録）
   ・数えるのは「能力値を振る」ボタン（まとめて＝1回、1つずつ＝1回ずつ） */
function diceInfo(c) {
  c.dice = c.dice || { limit: '', used: 0 };
  let best = null;
  if (typeof G !== 'undefined' && me) (G.list || []).forEach(g => {
    const mine = (g.members || []).find(m => m.user_id === me.id);
    if (!mine || mine.status !== 'joined' || mine.char_id !== c.id) return;
    const kps = (g.members || []).filter(m => m.role === 'kp' && m.status === 'joined' && m.dice_limit != null && m.dice_limit !== '');
    if (!kps.length) return;
    const limit = Math.min(...kps.map(m => +m.dice_limit));
    const reset = Math.max(0, ...kps.map(m => m.dice_reset ? Date.parse(m.dice_reset) || 0 : 0));
    const rec = (c.diceG || {})[g.id];
    const used = rec && (!reset || (Date.parse(rec.since) || 0) >= reset) ? rec.n : 0;
    if (!best || limit - used < best.limit - best.used) best = { group: g, limit, used, reset };
  });
  if (best) return { ...best, left: Math.max(0, best.limit - best.used) };
  const lim = String(c.dice.limit ?? '').trim();
  const limit = lim === '' ? null : Math.max(0, num(lim));
  const used = c.dice.used || 0;
  return { group: null, limit, used, left: limit == null ? Infinity : Math.max(0, limit - used) };
}
/* 1回分使う。上限に達していたら false */
function diceSpend(c) {
  const d = diceInfo(c);
  if (d.left <= 0) {
    toast(d.group ? `ダイスの上限（${d.limit}回）に達しました。グループ「${d.group.data.name || '無題'}」のキーパーがリセットすると、また振れます。` : `ダイスの上限（${d.limit}回）に達しました。能力値の画面の「回数をリセット」か上限を変えると、また振れます。`);
    return false;
  }
  if (d.group) {
    c.diceG = c.diceG || {};
    const rec = c.diceG[d.group.id], valid = rec && (!d.reset || (Date.parse(rec.since) || 0) >= d.reset);
    c.diceG[d.group.id] = { n: d.used + 1, since: valid ? rec.since : new Date().toISOString() };
  } else c.dice.used = (c.dice.used || 0) + 1;
  return true;
}
function diceBoxHtml(c) {
  const d = diceInfo(c);
  const count = d.limit == null ? `振った回数 <b>${d.used}</b>（上限なし）` : `残り <b class="${d.left ? '' : 'zero'}">${d.left}</b> / ${d.limit}回`;
  // キーパーが決めた上限：数字は見えるが、さわれない（グレー）
  if (d.group) return `<span class="dice-box locked" data-dicebox><span class="db-c">${count}</span>
    <label class="db-lim" title="グループ「${esc(d.group.data.name || '無題')}」のキーパーが決めた上限です">上限<input class="inp num" type="text" value="${d.limit}" disabled aria-disabled="true" aria-label="ダイスの上限回数（キーパーが決めた値のため変更できません）">回</label>
    <button class="btn small ghost" type="button" disabled>回数をリセット</button>
    <small class="db-src">🔒 「${esc(d.group.data.name || '無題')}」のキーパーが決めた上限</small></span>`;
  return `<span class="dice-box" data-dicebox><span class="db-c">${count}</span>
    <label class="db-lim">上限<input class="inp num" type="text" inputmode="numeric" data-p="dice.limit" value="${esc(c.dice.limit ?? '')}" placeholder="なし" aria-label="ダイスを振れる上限回数（空欄なら上限なし）">回</label>
    ${d.used ? '<button class="btn small ghost" type="button" data-act="dice-reset">回数をリセット</button>' : ''}</span>`;
}
function refreshDiceBox() {
  const c = active(); if (!c) return;
  document.querySelectorAll('[data-dicebox] .db-c').forEach(el => { el.innerHTML = diceBoxHtml(c).match(/<span class="db-c">([\s\S]*?)<\/span>/)[1]; });
}
