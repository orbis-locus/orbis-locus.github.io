/* ================= アクアリウムテーマ（look: aqua）：水底の遺跡、光の帯、くらげ、ガラスの泡のような画面 =================
   ・背景は見本の絵から文字を消した assets/aqua/scene.webp（少し暗め）。canvas はその上で動く光・粒・泡だけ
   ・画面の切りかえは aquaWave：ぼやけた水の中（assets/aqua/bokeh.webp）にガラスの札と光の輪、泡がのぼる
   ・キャラシは aquaHtml：厚いガラスの水槽。舷窓（丸窓）の肖像と展示の札、液体の入ったガラス管の HP/MP/SAN、
     能力値、9つの項目のボタン。一覧のキャラは舷窓に入った肖像を横に並べる（CSS）
   ・はじめの画面（オープニング）はどのテーマでも同じまま */
const isAqua = () => (presetOf().look || '').split(' ').includes('aqua');
const AQ = { on: false, raf: 0, last: 0, W: 0, H: 0, k: 1, bub: [], dust: [] };

function aquaScene() {
  const on = isAqua();
  let el = $('aq-bg');
  if (on && !el) {
    el = document.createElement('div'); el.id = 'aq-bg'; el.className = 'aq-bg'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<i class="aq-caus c1"></i><i class="aq-caus c2"></i><canvas id="aq-cv"></canvas>';   // 水底にゆれる光の網（2枚を逆向きに動かす）
    document.body.prepend(el);
    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (AQ.on) aquaBuild(); }, 200); });
  }
  if (el) el.hidden = !on;
  if (on) aquaMenuSetup();
  if (on === AQ.on) return;
  AQ.on = on;
  cancelAnimationFrame(AQ.raf);
  if (on) { aquaBuild(); AQ.raf = requestAnimationFrame(aquaTick); }
}

/* 上の帯：画像のように「ホーム・バックアップ・テーマ」と歯車だけ見せ、残りは ☰ の中へ。一覧の「＋ 新規作成」もここでつなぐ */
function aquaMenuSetup() {
  if ($('aq-menu')) return;
  const bar = document.querySelector('.bar'); if (!bar) return;
  const b = document.createElement('button');
  b.className = 'aq-menu-btn'; b.id = 'aq-menu'; b.type = 'button'; b.setAttribute('aria-label', 'メニュー'); b.setAttribute('aria-expanded', 'false');
  b.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>';
  bar.appendChild(b);
  const set = open => { bar.classList.toggle('aq-open', open); b.setAttribute('aria-expanded', String(open)); };
  b.addEventListener('click', e => { e.stopPropagation(); set(!bar.classList.contains('aq-open')); });
  document.addEventListener('click', e => { if (bar.classList.contains('aq-open') && !e.target.closest('.bar-actions')) set(false); });
  bar.querySelector('.bar-actions')?.addEventListener('click', e => { if (e.target.closest('.btn')) set(false); });
  $('shelf-new')?.addEventListener('click', () => $('btn-new').click());
  // 見本どおりの「ホーム・バックアップ・テーマ・背景・歯車」の列（本物のボタンを押す代わりのボタン）
  const row = document.createElement('nav'); row.className = 'aq-navrow'; row.setAttribute('aria-label', 'おもなメニュー');
  row.innerHTML = [['btn-select', 'home', 'ホーム'], ['btn-export', 'backup', 'バックアップ'], ['btn-theme', 'theme', 'テーマ・背景'], ['btn-account', 'gear', 'アカウント']]
    .map(([id, k, l]) => `<button type="button" class="aq-nv ${k}" data-for="${id}" aria-label="${l}"></button>`).join('');
  row.addEventListener('click', e => { const b = e.target.closest('[data-for]'); if (b) $(b.dataset.for)?.click(); });
  bar.after(row);
}

/* 背景の絵（assets/aqua/scene.webp）は CSS で敷く。canvas には、その上で動くもの（光のゆらぎ・ただよう粒・泡）だけを描く */
function aquaBuild() {
  const k = AQ.k = Math.max(.5, Math.min(1, 720 / Math.max(innerWidth, innerHeight * .6)));
  const W = AQ.W = Math.round(innerWidth * k), H = AQ.H = Math.round(innerHeight * k);
  const cv = $('aq-cv'); cv.width = W; cv.height = H; AQ.drawn = false;
  const r = Math.random;
  AQ.dust = Array.from({ length: Math.round(W * H / 5000) }, () => ({ x: r() * W, y: r() * H, r: .5 + r() * 1.3, vx: (r() - .5) * .05, vy: -.02 - r() * .06, ph: r() * 6.3 }));
  AQ.bub = Array.from({ length: 14 }, () => aqBubble(true));
}
function aqBubble(fresh) {
  const r = Math.random;
  return { x: r() * AQ.W, y: fresh ? r() * AQ.H : AQ.H + 10, r: (.8 + r() * 2.8) * Math.max(.7, AQ.k * 1.4), v: .2 + r() * .45, ph: r() * 6.3 };
}
function aquaTick(t) {
  if (!AQ.on) return;
  AQ.raf = requestAnimationFrame(aquaTick);
  const still = reduceMotion.matches;
  if (document.hidden || (!still && t - AQ.last < 33) || (still && AQ.drawn)) return;   // 30コマ/秒で十分
  const dt = Math.min(3, (t - (AQ.last || t)) / 16.7); AQ.last = t; AQ.drawn = true;
  const cv = $('aq-cv'); if (!cv) return;
  const g = cv.getContext('2d'), W = AQ.W, H = AQ.H;
  g.clearRect(0, 0, W, H);
  // 上から差す光が、ゆっくりゆらぐ（絵の光の帯に重ねて、うすく）
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 5; i++) {
    const cx = W * (.18 + i * .17) + Math.sin(t * .00016 + i * 1.7) * W * .05, wTop = W * (.02 + (i % 3) * .01), len = H * (.55 + (i % 2) * .25);
    const a = .025 + .03 * Math.max(0, Math.sin(t * .00035 + i * 2.1));
    const lg = g.createLinearGradient(0, 0, 0, len); lg.addColorStop(0, `rgba(215,248,255,${a})`); lg.addColorStop(1, 'rgba(215,248,255,0)');
    g.fillStyle = lg; g.beginPath(); g.moveTo(cx - wTop, -5); g.lineTo(cx + wTop, -5); g.lineTo(cx + wTop * 4 + len * .16, len); g.lineTo(cx - wTop * 4 + len * .16, len); g.closePath(); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
  // ただよう粒
  g.fillStyle = 'rgba(210,240,255,.6)';
  AQ.dust.forEach(p => {
    if (!still) { p.x += p.vx * dt + Math.sin(t * .0005 + p.ph) * .04; p.y += p.vy * dt; if (p.y < -2) { p.y = H + 2; p.x = Math.random() * W; } }
    g.globalAlpha = .25 + .45 * Math.abs(Math.sin(t * .001 + p.ph)); g.fillRect(p.x, p.y, p.r, p.r);
  });
  g.globalAlpha = 1;
  // 泡
  AQ.bub.forEach((b, i) => {
    if (!still) { b.y -= b.v * dt; b.x += Math.sin(t * .003 + b.ph) * .15 * dt; if (b.y < -10) AQ.bub[i] = aqBubble(false); }
    g.strokeStyle = 'rgba(220,250,255,.55)'; g.lineWidth = .8; g.beginPath(); g.arc(b.x, b.y, b.r, 0, 6.3); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.arc(b.x - b.r * .35, b.y - b.r * .35, b.r * .28, 0, 6.3); g.fill();
  });
}

/* ---- キャラシ：厚いガラスの水槽 ---- */
function aquaHtml(c) {
  const a = abilities(c), p = c.profile, src = portraitSrc(c);
  const pf = (ic, lbl, v) => `<span class="aq-pf-row"><i class="aq-i ${ic}"></i><span><i>${lbl}</i><b>${esc(v || '—')}</b></span></span>`;
  return `
    <div class="aq-st">
      <div class="aq-st-tools">${toolsHtml(c)}</div>
      <div class="aq-st-head"><i class="aq-i shell" aria-hidden="true"></i><div><b data-hub="name"></b><small>— Character Status —</small></div></div>
      <nav class="aq-st-tabs" aria-label="項目">${[['abilities', 'ステータス'], ['skills', '技能'], ['items', '所持品'], ['story', 'メモ']].map(([k, l], i) => `<button class="aq-tabimg t${i}" type="button" data-open="${k}" aria-label="${l}"></button>`).join('')}</nav>
      <div class="aq-st-main">
        <button class="aq-pic" type="button" data-stage aria-label="立ち絵を表示"><span class="aq-pic-in">${src ? `<img src="${esc(imgSrc(src))}" alt="" draggable="false" onerror="this.remove()">` : tokenHtml(c)}</span></button>
        <div class="aq-bars">${[['hp', 'heart', 'HP'], ['mp', 'drop', 'MP'], ['san', 'brain', 'SAN']].map(([k, ic, l]) => `
          <div class="aq-bar ${k}"><i class="aq-i ${ic}"></i><span class="aq-bl">${l}</span><b class="aq-bv" data-out="${k}Cur"></b><span class="aq-tr"><i data-bar="${k}"></i></span></div>`).join('')}
        </div>
      </div>
      <div class="aq-st-low">
        <button class="aq-tiles" type="button" data-open="abilities" aria-label="能力値をひらく">${Object.keys(c.abilities).map(k => `<span class="aq-tile"><i>${k}</i><b>${a[k] || 0}</b></span>`).join('')}</button>
        <button class="aq-pbox" type="button" data-open="profile" aria-label="プロフィールをひらく">${pf('job', '職業', p.occupation)}${pf('age', '年齢', p.age && p.age + '歳')}${pf('sex', '性別', p.sex)}</button>
      </div>
      <button class="aq-detail" type="button" data-open="profile" aria-label="詳細を見る"></button>
    </div>`;
}

/* ---- 画面の切りかえ：水にもぐるように ----
   ① 下から本物らしい泡（ふちが光り、上に光の点、ゆれながらのぼる）がいっせいに吹き上がり、
      画面は水の中のようにぼやけて（すりガラス）、水底の光の網がゆれる
   ② 泡と水でおおわれているあいだに画面を入れかえる（mid）
   ③ 泡がのぼりきるにつれて水が晴れ、新しい画面があらわれる */
let aqWaveBusy = false;
const aqBubbleSprites = (() => {
  let cache = null;
  return () => {
    if (cache) return cache;
    const make = sz => {
      const c = document.createElement('canvas'); c.width = c.height = sz; const g = c.getContext('2d'); const r = sz / 2 - 1, o = sz / 2;
      const body = g.createRadialGradient(o - r * .15, o - r * .2, r * .1, o, o, r);
      body.addColorStop(0, 'rgba(200,240,255,0.03)'); body.addColorStop(.72, 'rgba(160,220,255,0.07)'); body.addColorStop(.9, 'rgba(200,240,255,0.32)');
      body.addColorStop(.97, 'rgba(250,254,255,0.8)'); body.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = body; g.beginPath(); g.arc(o, o, r, 0, 6.283); g.fill();
      const sp = g.createRadialGradient(o - r * .38, o - r * .45, 0, o - r * .38, o - r * .45, r * .36);
      sp.addColorStop(0, 'rgba(255,255,255,0.95)'); sp.addColorStop(.5, 'rgba(255,255,255,0.35)'); sp.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = sp; g.beginPath(); g.ellipse(o - r * .38, o - r * .45, r * .34, r * .22, -.7, 0, 6.283); g.fill();
      const rf = g.createRadialGradient(o + r * .4, o + r * .45, 0, o + r * .4, o + r * .45, r * .5);
      rf.addColorStop(0, 'rgba(150,230,255,0.4)'); rf.addColorStop(1, 'rgba(150,230,255,0)');
      g.fillStyle = rf; g.beginPath(); g.ellipse(o + r * .35, o + r * .5, r * .5, r * .22, -.5, 0, 6.283); g.fill();
      return c;
    };
    return (cache = [make(48), make(160)]);
  };
})();
function aquaWave(mid) {
  if (reduceMotion.matches || aqWaveBusy) { mid(); return; }
  aqWaveBusy = true;
  const toSheet = !$('select').hidden, c = active();
  const ov = document.createElement('div'); ov.className = 'aq-dive'; ov.setAttribute('aria-hidden', 'true');
  ov.innerHTML = '<i class="ad-veil"></i><i class="ad-caus"></i><i class="ad-rays"></i><canvas class="ad-bub"></canvas><b class="ad-name"></b>';
  ov.querySelector('.ad-name').textContent = toSheet ? (c?.profile.name || '') : 'キャラクター一覧';
  document.body.appendChild(ov);
  const veil = ov.querySelector('.ad-veil'), caus = ov.querySelector('.ad-caus'), rays = ov.querySelector('.ad-rays'), name = ov.querySelector('.ad-name');
  const cv = ov.querySelector('.ad-bub'), dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr; const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const [small, big] = aqBubbleSprites(), R = Math.random, bubs = [];
  const spawn = (n, fast) => { for (let i = 0; i < n; i++) {
    const k = R(), size = k < .7 ? 3 + R() * 12 : k < .94 ? 16 + R() * 34 : 50 + R() * 90;
    bubs.push({ x: R() * W, y: H + size + R() * H * (fast ? .5 : .2), s: size, vy: (fast ? 7 : 3) + R() * (fast ? 12 : 6) + size * .03, ph: R() * 6.3, sw: .4 + R() * 1.4, a: .65 + R() * .35 });
  } };
  spawn(Math.round(W * H / 2600), true);
  const T = 1650, MID = 430;
  let t0 = 0, last = 0, switched = false, run = true;
  const frame = now => {
    if (!run) return;
    if (!t0) t0 = last = now;
    const t = now - t0, dt = Math.min(3, (now - last) / 16.7); last = now;
    if (t < 1000 && R() < .7) spawn(t < 500 ? 6 : 2, t < 500);
    g.clearRect(0, 0, W, H);
    for (let i = bubs.length - 1; i >= 0; i--) {
      const b = bubs[i];
      b.vy *= 1 + .012 * dt; b.y -= b.vy * dt; b.x += Math.sin(t * .006 + b.ph) * b.sw * dt;
      if (b.y < -b.s * 1.5) { bubs.splice(i, 1); continue; }
      const wob = Math.sin(t * .012 + b.ph) * (b.s > 30 ? .07 : .03), w = b.s * (1 + wob), h = b.s * (1 - wob) * (1 + Math.min(.25, b.vy * .008));
      g.globalAlpha = b.a; g.drawImage(b.s > 30 ? big : small, b.x - w / 2, b.y - h / 2, w, h);
    }
    g.globalAlpha = 1;
    if (!switched && t >= MID) { switched = true; try { mid(); } catch (e) { console.error(e); } }
    if (t < T || bubs.length) requestAnimationFrame(frame);
    else { run = false; ov.remove(); aqWaveBusy = false; }
  };
  requestAnimationFrame(frame);
  const ease = 'cubic-bezier(.3, .6, .3, 1)';
  veil.animate([{ opacity: 0 }, { opacity: 1, offset: .26 }, { opacity: 1, offset: .55 }, { opacity: 0 }], { duration: T, easing: 'ease-in-out', fill: 'forwards' });
  caus.animate([{ opacity: 0, transform: 'translate(0, 0) scale(1.1)' }, { opacity: .13, offset: .3 }, { opacity: .1, offset: .6 }, { opacity: 0, transform: 'translate(-80px, -140px) scale(1)' }], { duration: T, easing: 'linear', fill: 'forwards' });
  rays.animate([{ opacity: 0 }, { opacity: 1, offset: .3 }, { opacity: .8, offset: .6 }, { opacity: 0 }], { duration: T, easing: 'ease-in-out', fill: 'forwards' });
  name.animate([{ opacity: 0, transform: 'translateY(10px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)', offset: .35 }, { opacity: 1, offset: .55 }, { opacity: 0, transform: 'translateY(-12px)', filter: 'blur(6px)' }], { duration: T, easing: ease, fill: 'forwards' });
  setTimeout(() => { if (aqWaveBusy && ov.isConnected && !switched) { switched = true; try { mid(); } catch (e) { console.error(e); } } }, MID + 400);   // 画面が止まっていても、入れかえは必ずする
}

/* ---- 項目の窓：泡がふくらむようにひらき、しぼんではじけるように閉じる ---- */
function aquaPanelOpen(ov) {
  ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: 'ease-out' });
  $('sao-win').animate([
    { clipPath: 'circle(0% at 50% 55%)', transform: 'scale(.9)' },
    { clipPath: 'circle(48% at 50% 52%)', transform: 'scale(1.015)', offset: .6 },
    { clipPath: 'circle(150% at 50% 50%)', transform: 'scale(1)' },
  ], { duration: 720, easing: 'cubic-bezier(.3, .7, .3, 1)' });
  document.querySelectorAll('.sao-item').forEach((el, i) => el.animate(
    [{ opacity: 0, transform: 'translateY(16px) scale(.8)' }, { opacity: 1 }],
    { duration: 520, delay: 120 + i * 45, easing: 'cubic-bezier(.2, .9, .3, 1.3)', fill: 'backwards' }));
  aqRipple($('sao-win'));
}
function aquaPanelClose(ov) {
  return [
    $('sao-win').animate([
      { clipPath: 'circle(150% at 50% 50%)', transform: 'scale(1)' },
      { clipPath: 'circle(30% at 50% 52%)', transform: 'scale(.97)', offset: .7 },
      { clipPath: 'circle(0% at 50% 55%)', transform: 'scale(.9)' },
    ], { duration: 460, easing: 'cubic-bezier(.6, 0, .6, 1)', fill: 'forwards' }),
    ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, delay: 240, fill: 'forwards' }),
  ];
}
/* 水面に石を落としたような波紋を、要素のまん中に */
function aqRipple(el) {
  if (!el || reduceMotion.matches) return;
  const r = el.getBoundingClientRect();
  for (let i = 0; i < 3; i++) {
    const e = document.createElement('i'); e.className = 'aq-ripple'; e.setAttribute('aria-hidden', 'true');
    e.style.left = (r.left + r.width / 2) + 'px'; e.style.top = (r.top + r.height / 2) + 'px';
    document.body.appendChild(e);
    e.animate([{ transform: 'translate(-50%, -50%) scale(.1)', opacity: .9 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 }], { duration: 1100, delay: i * 160, easing: 'cubic-bezier(.2, .7, .3, 1)', fill: 'both' })
      .finished.then(() => e.remove(), () => e.remove());
  }
}
