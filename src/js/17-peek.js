/* ================= 探索者カードのチラ見せ ================= */
const canHover = matchMedia('(hover: hover) and (pointer: fine)');
let peekId = null;
function peekHtml(c) {
  const d = compute(c), S = SYS[c.system], p = c.profile, src = portraitSrc(c), a = d.a;
  const bars = [['HP', d.hp, d.hpMax, 'var(--hp), var(--orange)'], ['MP', d.mp, d.mpMax, 'var(--mp), var(--cyan)'], ['SAN', d.san, d.sanMax, 'var(--san), var(--pink)']];
  if (c.system === 'coc7') bars.push(['幸運', a.LUCK, 99, 'var(--yellow), var(--orange)']);
  const skills = c.skills.filter(s => s.name && skillTotal(s, a) !== skillInit(s, a))
    .map(s => [skillLabel(s), skillTotal(s, a)]).sort((x, y) => y[1] - x[1]).slice(0, 12);
  return `
    <div class="peek-art">${src ? `<img src="${esc(imgSrc(src))}" alt="" onerror="this.remove()">` : tokenHtml(c)}</div>
    <div class="peek-info">
      <div class="peek-head">
        <span class="peek-sys">${esc(S.short)}${c.locked ? ' ・ 非公開' : ''}</span>
        <span class="peek-name">${esc(p.name || '名無し')}</span>
        ${p.kana ? `<span class="peek-kana">${esc(p.kana)}</span>` : ''}
        <span class="peek-sub">${esc([p.occupation, p.age && p.age + '歳', p.birthday && '誕生日 ' + p.birthday, p.sex].filter(Boolean).join(' / ') || 'プロフィール未入力')}</span>
      </div>
      <div class="pbars">${bars.map(([l, v, m, g]) => `<div class="pbar"><b>${l}</b><span class="tr"><i style="width:${m > 0 ? Math.max(0, Math.min(100, v / m * 100)) : 0}%;background:linear-gradient(90deg, ${g})"></i></span><span>${v}/${m}</span></div>`).join('')}</div>
      <div class="peek-radar">${radarSvg(c, a, 230, false)}</div>
      <div class="peek-der"><span>アイデア <b>${d.idea}</b></span><span>幸運 <b>${d.luck}</b></span><span>知識 <b>${d.know}</b></span><span>DB <b>${esc(d.db)}</b></span>${c.system === 'coc7' ? `<span>MOV <b>${d.mov}</b></span>` : ''}</div>
      ${playedWith(c).length ? `<div class="peek-friends"><small>一緒に遊んだ</small>${playedWith(c).map(({ f, n }) => `<span class="fchip on static" style="--fc:${esc(f.color)}"><span class="fdot">${fInit(f)}</span>${esc(f.name)}${n > 1 ? `<b>×${n}</b>` : ''}</span>`).join('')}</div>` : ''}
      <div class="peek-skills">${skills.length ? skills.map(([n, v]) => `<span>${esc(n)}<b>${v}</b></span>`).join('') : '<span class="none">ポイントを振った技能はまだありません</span>'}</div>
    </div>`;
}
function showPeek(item) {
  const c = state.chars.find(x => x.id === item.dataset.id); if (!c) return;
  const pk = $('peek'), wasHidden = pk.hidden;
  pk.innerHTML = peekHtml(c); pk.hidden = false; peekId = c.id;
  const r = item.getBoundingClientRect(), pw = pk.offsetWidth, ph = pk.offsetHeight;
  let left = r.right + 16;
  if (left + pw > innerWidth - 12) left = Math.max(12, innerWidth - pw - 12);
  let top = Math.min(Math.max(12, r.top + r.height / 2 - ph / 2), Math.max(12, innerHeight - ph - 12));
  if (innerWidth < 760) { left = Math.max(12, (innerWidth - pw) / 2); top = Math.max(12, (innerHeight - ph) / 2 - 30); }
  pk.style.left = left + 'px'; pk.style.top = top + 'px';
  pk.style.setProperty('--ay', Math.min(ph - 20, Math.max(20, r.top + r.height / 2 - top)) + 'px');
  if (!reduceMotion.matches) {
    pk.animate(wasHidden
      ? [{ opacity: 0, transform: 'translateX(-14px) scale(.96)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'none' }]
      : [{ opacity: .6 }, { opacity: 1 }], { duration: wasHidden ? 340 : 160, easing: 'cubic-bezier(.2, .9, .3, 1.1)' });
  }
}
function hidePeek() { $('peek').hidden = true; peekId = null; }
$('shelf').addEventListener('pointerover', e => {
  if (!canHover.matches) return;
  const it = e.target.closest('.char-item');
  if (it && it.dataset.id !== peekId) showPeek(it);
});
$('shelf').addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hidePeek(); });
$('shelf').addEventListener('focusin', e => { const it = e.target.closest('.char-item'); if (it) showPeek(it); });
$('shelf').addEventListener('focusout', hidePeek);
addEventListener('scroll', hidePeek, { passive: true });
