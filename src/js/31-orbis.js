/* ================= ORBiS テーマ（look: orbis）：アプリの顔になるメインのテーマ =================
   見本：オーナーの画像（うすい青〜むらさきの空、雲、光の軌道、四つの光の星、雲の上のお城、すりガラスの部品）
   ・背景：CSS の空と雲＋SVG の軌道とお城＋canvas の星（またたく星・ただよう光・ときどき流れ星）
   ・キャラシ：orbisHtml。名前の札・道具のボタン・軌道がまわる大きな丸い肖像・HP/MP/SAN・「星図」のガラスのパネル（ひし形の宝石・星座の線・中身の要約）
   ・スマホは下にガラスのドック（ホーム・テーマ・まん中の星＝コマをコピー・フレンド・メニュー）
   ・画面の切りかえは orbisWarp：光が集まって四つの星になり、軌道が広がって、星がはじけて新しい画面
   ・項目の窓は、押したパネルから光の円が広がるようにひらき、パネルにもどるように閉じる
   ・タップすると、小さな四つの星が散る
   ・初めて開いた人はこのテーマ（presetOf のいちばん最初）。ロゴのきまりは docs/brand.md */
const isOrbis = () => (presetOf().look || '').split(' ').includes('orbis');
const OB = { on: false, raf: 0, last: 0, W: 0, H: 0, dpr: 1, stars: [], motes: [], shoot: null, nextShoot: 0 };

/* 四つの光の星の形（SVG の path）。cx,cy がまん中、r が長さ、w が太さ */
const obStarPath = (cx, cy, r, w = .18) => {
  const k = r * w;
  return `M${cx} ${cy - r}C${cx + k * .25} ${cy - k} ${cx + k} ${cy - k * .25} ${cx + r} ${cy}C${cx + k} ${cy + k * .25} ${cx + k * .25} ${cy + k} ${cx} ${cy + r}C${cx - k * .25} ${cy + k} ${cx - k} ${cy + k * .25} ${cx - r} ${cy}C${cx - k} ${cy - k * .25} ${cx - k * .25} ${cy - k} ${cx} ${cy - r}Z`;
};

function orbisScene() {
  const on = isOrbis();
  let el = $('ob-bg');
  if (on && !el) {
    el = document.createElement('div'); el.id = 'ob-bg'; el.className = 'ob-bg'; el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<i class="ob-sky"></i><i class="ob-cloud c1"></i><i class="ob-cloud c2"></i><i class="ob-cloud c3"></i>
      <svg class="ob-orbits" viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid slice">
        <g class="ob-orb-a"><ellipse cx="500" cy="500" rx="640" ry="230"/><ellipse cx="500" cy="500" rx="470" ry="160" class="thin"/></g>
        <g class="ob-orb-b"><ellipse cx="560" cy="430" rx="560" ry="300" class="thin"/></g>
        <path id="ob-orbit-path" d="M-140 500a640 230 0 1 0 1280 0a640 230 0 1 0 -1280 0" fill="none" stroke="none"/>
        <circle r="5" class="ob-sat"><animateMotion dur="48s" repeatCount="indefinite"><mpath href="#ob-orbit-path"/></animateMotion></circle>
      </svg>
      ${obCastleSvg()}
      <i class="ob-cloud c4"></i>
      <canvas id="ob-cv"></canvas>`;
    document.body.prepend(el);
    let rt = 0;
    addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (OB.on) obBuild(); }, 200); });
  }
  if (el) el.hidden = !on;
  if (on) orbisChrome();
  if (on === OB.on) return;
  OB.on = on;
  cancelAnimationFrame(OB.raf);
  if (on) { obBuild(); OB.raf = requestAnimationFrame(obTick); }
}

/* 雲の上にうかぶお城（右下）。細い塔ととがった屋根を、奥（うすい）と手前の2段に重ねた影絵 */
function obCastleSvg() {
  // [まん中の x, 屋根の下の y, 塔の太さ, 屋根の高さ]
  const back = [[70, 330, 12, 90], [104, 290, 14, 120], [372, 300, 13, 110], [404, 340, 10, 80], [150, 250, 16, 130], [330, 260, 15, 120]];
  const front = [[128, 330, 14, 100], [176, 270, 18, 150], [214, 200, 22, 200], [246, 120, 20, 260], [278, 190, 24, 210], [312, 250, 16, 150], [344, 310, 12, 100], [230, 300, 70, 70], [292, 330, 60, 60]];
  const tower = ([x, y, w, roof]) => {
    const top = y - roof;
    return `<path d="M${x - w / 2} 600V${y}L${x - w / 2 - 2} ${y - 4}L${x} ${top}L${x + w / 2 + 2} ${y - 4}L${x + w / 2} ${y}V600Z"/><rect x="${x - .7}" y="${top - 18}" width="1.4" height="18"/>`;
  };
  const wins = [[246, 230], [214, 290], [278, 280], [176, 330], [312, 320], [246, 300]].map(([x, y]) => `<rect x="${x - 2}" y="${y}" width="4" height="10" rx="2"/>`).join('');
  return `<svg class="ob-castle" viewBox="0 0 460 600" preserveAspectRatio="xMaxYMax meet">
    <defs>
      <linearGradient id="ob-cg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9c5f8" stop-opacity=".55"/><stop offset=".75" stop-color="#d9dcfb" stop-opacity=".2"/><stop offset="1" stop-color="#e6e8fd" stop-opacity="0"/></linearGradient>
      <linearGradient id="ob-cg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ada6f3" stop-opacity=".85"/><stop offset=".55" stop-color="#bfc0f6" stop-opacity=".5"/><stop offset="1" stop-color="#dfe2fc" stop-opacity="0"/></linearGradient>
    </defs>
    <g fill="url(#ob-cg1)">${back.map(tower).join('')}</g>
    <g fill="url(#ob-cg2)">${front.map(tower).join('')}<path d="M196 420q34-40 68 0zM262 430q30-34 60 0z" fill="#e8e9fd" opacity=".5"/></g>
    <g class="ob-win">${wins}</g>
  </svg>`;
}

/* キラキラの絵（四つの光＋まわりのぼんやりした光）を先に1枚描いておき、大きさを変えて何度も使う */
const obSprite = (() => {
  let cache = null;
  return () => {
    if (cache) return cache;
    const S = 96, c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), o = S / 2;
    const halo = g.createRadialGradient(o, o, 0, o, o, o); halo.addColorStop(0, 'rgba(255,255,255,.95)'); halo.addColorStop(.12, 'rgba(235,238,255,.55)'); halo.addColorStop(.4, 'rgba(200,205,255,.12)'); halo.addColorStop(1, 'rgba(200,205,255,0)');
    g.fillStyle = halo; g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(255,255,255,.95)'; g.fill(new Path2D(obStarPath(o, o, o * .98, .1)));
    return (cache = c);
  };
})();

function obBuild() {
  const dpr = OB.dpr = Math.min(1.5, devicePixelRatio || 1);
  const W = OB.W = innerWidth, H = OB.H = innerHeight;
  const cv = $('ob-cv'); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const r = Math.random, n = Math.round(Math.min(140, W * H / 9000));
  OB.stars = Array.from({ length: n }, () => {
    const big = r() < .09;
    return { x: r() * W, y: r() * H * .92, s: big ? 10 + r() * 16 : 1.6 + r() * 4, ph: r() * 6.3, sp: .5 + r() * 1.4, big };
  });
  OB.motes = Array.from({ length: Math.round(n * .4) }, () => ({ x: r() * W, y: r() * H, r: .6 + r() * 1.6, vy: -.05 - r() * .12, vx: (r() - .5) * .06, ph: r() * 6.3 }));
  OB.shoot = null; OB.nextShoot = performance.now() + 3000 + r() * 5000; OB.drawn = false;
}
function obTick(t) {
  if (!OB.on) return;
  OB.raf = requestAnimationFrame(obTick);
  const still = reduceMotion.matches;
  if (document.hidden || (!still && t - OB.last < 33) || (still && OB.drawn)) return;   // 30コマ/秒で十分
  const dt = Math.min(3, (t - (OB.last || t)) / 16.7); OB.last = t; OB.drawn = true;
  const cv = $('ob-cv'); if (!cv) return;
  const g = cv.getContext('2d'), W = OB.W, H = OB.H, spr = obSprite();
  g.setTransform(OB.dpr, 0, 0, OB.dpr, 0, 0);
  g.clearRect(0, 0, W, H);
  // ただよう光の粒（ゆっくりのぼる）
  g.fillStyle = '#ffffff';
  OB.motes.forEach(p => {
    if (!still) { p.x += p.vx * dt + Math.sin(t * .0004 + p.ph) * .05; p.y += p.vy * dt; if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; } }
    g.globalAlpha = .25 + .4 * Math.abs(Math.sin(t * .0008 + p.ph));
    g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
  });
  // またたく星（大きいものは十字の光がのびちぢみ）
  OB.stars.forEach(s => {
    const tw = .5 + .5 * Math.sin(t * .0016 * s.sp + s.ph);
    const a = s.big ? .45 + .55 * tw : .25 + .7 * tw * tw, sz = s.s * (s.big ? .75 + .4 * tw : .8 + .3 * tw);
    g.globalAlpha = a; g.drawImage(spr, s.x - sz, s.y - sz, sz * 2, sz * 2);
  });
  // 流れ星（6〜14秒に1つ）
  if (!still && !OB.shoot && t > OB.nextShoot) {
    const fromLeft = Math.random() < .5;
    OB.shoot = { x: fromLeft ? W * (.05 + Math.random() * .4) : W * (.55 + Math.random() * .4), y: H * (.05 + Math.random() * .25), vx: (fromLeft ? 1 : -1) * (9 + Math.random() * 5), vy: 3.2 + Math.random() * 2, life: 0 };
  }
  const sh = OB.shoot;
  if (sh) {
    sh.life += dt; sh.x += sh.vx * dt; sh.y += sh.vy * dt;
    const len = 16, a = Math.min(1, sh.life / 6) * Math.max(0, 1 - sh.life / 46);
    const lg = g.createLinearGradient(sh.x, sh.y, sh.x - sh.vx * len, sh.y - sh.vy * len);
    lg.addColorStop(0, `rgba(255,255,255,${a})`); lg.addColorStop(.25, `rgba(210,215,255,${a * .55})`); lg.addColorStop(1, 'rgba(190,200,255,0)');
    g.globalAlpha = 1; g.strokeStyle = lg; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(sh.x - sh.vx * len, sh.y - sh.vy * len); g.stroke();
    g.globalAlpha = a; g.drawImage(spr, sh.x - 10, sh.y - 10, 20, 20);
    if (sh.life > 46 || sh.x < -200 || sh.x > W + 200 || sh.y > H + 100) { OB.shoot = null; OB.nextShoot = t + 6000 + Math.random() * 8000; }
  }
  g.globalAlpha = 1;
}

/* ---- 上の帯とスマホのドック ---- */
function orbisChrome() {
  if ($('ob-dock')) return;
  const bar = document.querySelector('.bar'); if (!bar) return;
  // スマホ：下のガラスのドック（見本の下の列）。まん中の星は「コマをコピー」
  const ic = {
    home: '<path d="M4 11.2L12 4.5l8 6.7"/><path d="M6.5 9.6V19h11V9.6"/><path d="M10 19v-5h4v5"/>',
    planet: '<circle cx="12" cy="12" r="5.6"/><path d="M3.4 15.6c-1.3-2.3 2.6-5.6 8.6-7.5s11.1-1.6 11 1.1c-.1 1.9-2.6 4.1-6.3 5.8"/><path d="M5.6 17.4c-.9.2-1.6.1-2.1-.2"/>',
    friends: '<circle cx="9" cy="8.6" r="3.2"/><path d="M3.4 18.8c.8-3.2 3-5 5.6-5s4.8 1.8 5.6 5"/><circle cx="16.6" cy="9.4" r="2.5"/><path d="M15.6 13.9c2.4-.3 4.3 1.2 5 4"/>',
    menu: '<path d="M5 7.5h14M5 12h14M5 16.5h14"/>',
  };
  const svg = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ic[k]}</svg>`;
  const dock = document.createElement('nav'); dock.className = 'ob-dock'; dock.id = 'ob-dock'; dock.setAttribute('aria-label', 'おもなメニュー');
  dock.innerHTML = `
    <button type="button" class="ob-dk" data-for="btn-select">${svg('home')}<small>ホーム</small></button>
    <button type="button" class="ob-dk" data-for="btn-theme">${svg('planet')}<small>テーマ</small></button>
    <button type="button" class="ob-dk ob-dk-star" data-for="mbar-copy" aria-label="ココフォリア用にコマをコピー"><span class="ob-dk-gem"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="${obStarPath(20, 20, 15, .2)}"/></svg></span><small>コマをコピー</small></button>
    <button type="button" class="ob-dk" data-for="btn-friends">${svg('friends')}<small>フレンド</small></button>
    <button type="button" class="ob-dk" data-ob="menu" aria-expanded="false">${svg('menu')}<small>メニュー</small></button>`;
  document.body.appendChild(dock);
  // スマホ：右上の歯車（アカウント）。見本の右上
  const gear = document.createElement('button'); gear.type = 'button'; gear.className = 'ob-gear'; gear.setAttribute('aria-label', 'アカウント・設定');
  gear.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.8l1.6 2.3 2.7-.7.7 2.7 2.6 1-.8 2.7 1.9 2-1.9 2 .8 2.7-2.6 1-.7 2.7-2.7-.7L12 21.2l-1.6-2.3-2.7.7-.7-2.7-2.6-1 .8-2.7L3.3 12l1.9-2-.8-2.7 2.6-1 .7-2.7 2.7.7z"/></svg>';
  gear.addEventListener('click', () => $('btn-account')?.click());
  bar.style.position = 'relative'; bar.appendChild(gear);
  const snd = document.createElement('button'); snd.type = 'button'; snd.className = 'ob-sound'; snd.id = 'ob-sound';
  snd.addEventListener('click', () => { state.sfx = state.sfx === false; save(); obSoundBtn(); if (state.sfx !== false) snd('switch'); toast(state.sfx === false ? '効果音をオフにしました。' : '効果音をオンにしました。'); });
  bar.querySelector('.brand')?.after(snd); obSoundBtn();
  const setOpen = open => { document.documentElement.classList.toggle('ob-menu-open', open); dock.querySelector('[data-ob="menu"]').setAttribute('aria-expanded', String(open)); };
  dock.addEventListener('click', e => {
    const b = e.target.closest('.ob-dk'); if (!b) return;
    if (b.dataset.ob === 'menu') { e.stopPropagation(); setOpen(!document.documentElement.classList.contains('ob-menu-open')); return; }
    setOpen(false);
    $(b.dataset.for)?.click();
  });
  document.addEventListener('click', e => { if (document.documentElement.classList.contains('ob-menu-open') && !e.target.closest('.bar-actions, .ob-dock')) setOpen(false); });
  bar.querySelector('.bar-actions')?.addEventListener('click', e => { if (e.target.closest('.btn')) setOpen(false); });
}

/* ---- キャラシ ---- */
function orbisHtml(c) {
  const p = c.profile, S = SYS[c.system], f = curFace(c);
  // まん中の大きな丸：差分を選んでいればその絵、なければアイコン
  const big = f ? `<span class="token ob-face" style="--tc:${esc(p.color || '#6f8cf0')}"><img src="${esc(imgSrc(f.src))}" alt="" style="${cropStyle(c.iconCrop)}" onerror="this.remove()"></span>` : tokenHtml(c);
  const spark = (x, y, r, cls = '') => `<path class="ob-sp ${cls}" d="${obStarPath(x, y, r)}"/>`;
  return `
    <div class="ob-st">
      <div class="ob-id">
        <span class="ob-mini">${tokenHtml(c)}</span>
        <div class="ob-id-t"><b data-hub="name"></b><small>${esc([S.short, p.occupation].filter(Boolean).join('・'))}</small></div>
      </div>
      <div class="ob-tools">${toolsHtml(c)}</div>
      <div class="ob-hero">
        <svg class="ob-orbit" viewBox="0 0 400 300" aria-hidden="true">
          <defs><linearGradient id="ob-og" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7aa6f6"/><stop offset=".55" stop-color="#ffffff"/><stop offset="1" stop-color="#a990f6"/></linearGradient></defs>
          <g class="ob-orbit-g"><ellipse cx="200" cy="150" rx="186" ry="58" class="back"/></g>
          ${spark(32, 182, 9, 'a')}${spark(370, 92, 7, 'b')}${spark(352, 66, 4, 'c')}${spark(58, 120, 4, 'c')}
        </svg>
        <button class="ob-pic" type="button" data-stage aria-label="立ち絵を表示"><span class="ob-ring" aria-hidden="true"></span>${big}</button>
        <svg class="ob-orbit front" viewBox="0 0 400 300" aria-hidden="true">
          <path class="front" d="M14 150a186 58 0 0 0 372 0"/>
          <circle r="4.5" class="ob-moon"><animateMotion dur="14s" repeatCount="indefinite" path="M386 150a186 58 0 1 1 -372 0a186 58 0 1 1 372 0"/></circle>
        </svg>
      </div>
      <div class="ob-name"><b data-hub="name"></b><span data-hub="kana"></span></div>
      <div class="ob-stats">${[['HP', 'hp'], ['MP', 'mp'], ['SAN', 'san']].map(([l, k]) => `<span class="${k}"><i>${l}</i><b data-out="${k}Cur"></b></span>`).join('')}</div>
      <nav class="ob-map" aria-label="項目">${SECTIONS.map((s, i) => `
        <button class="ob-tile t-${s.key}" type="button" data-open="${s.key}" style="--i:${i}">
          ${obConstellation(i)}
          <span class="ob-gem" aria-hidden="true"><i>${icon(s.key)}</i></span>
          <span class="ob-tile-t"><small>${s.en}</small><b>${s.jp}</b></span>
          <span class="ob-tile-v" data-sum="${s.key}"></span>
          <span class="ob-tile-go" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="${obStarPath(10, 10, 7, .2)}"/></svg></span>
        </button>`).join('')}
      </nav>
    </div>`;
}
/* パネルの背景の「星座」：点を線で結んだ形。パネルごとに形を変える（点の位置は右上の 100×60 の中） */
const OB_CONS = [
  [[8, 40], [30, 18], [55, 26], [78, 8], [94, 30]],
  [[10, 12], [34, 30], [60, 16], [88, 42]],
  [[14, 44], [30, 14], [62, 22], [80, 48], [96, 20]],
  [[6, 20], [40, 8], [52, 40], [90, 30]],
  [[12, 30], [36, 46], [58, 12], [84, 22]],
  [[8, 10], [28, 36], [64, 30], [92, 8]],
  [[10, 46], [44, 30], [70, 44], [96, 12]],
  [[6, 26], [26, 8], [50, 24], [74, 10], [94, 40]],
  [[12, 18], [38, 40], [66, 14], [86, 36], [98, 10]],
];
function obConstellation(i) {
  const pts = OB_CONS[i % OB_CONS.length];
  return `<svg class="ob-cons" viewBox="0 0 100 56" aria-hidden="true" preserveAspectRatio="xMaxYMin meet">
    <polyline points="${pts.map(p => p.join(',')).join(' ')}"/>
    ${pts.map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${k % 2 ? 1.3 : 1.9}" style="--k:${k}"/>`).join('')}
  </svg>`;
}

/* ---- 画面の切りかえ：光が集まって星になり、はじけて新しい画面へ ----
   ① まわりから光の粒がまん中へ吸いこまれ、空がうすく白んでいく（軌道の輪が開く）
   ② まん中に四つの光の星がひらき、行き先の名前がうかぶ。ここで画面を入れかえる（mid）
   ③ 星がはじけて、光の粒が外へ飛び、白さが晴れて新しい画面があらわれる
   iPhone で重くならないよう、動かすのは opacity・transform と canvas だけ（filter は使わない） */
let obWarpBusy = false;
function orbisWarp(mid) {
  if (reduceMotion.matches || obWarpBusy) { mid(); return; }
  obWarpBusy = true;
  const toSheet = !$('select').hidden, c = active();
  const ov = document.createElement('div'); ov.className = 'ob-warp'; ov.setAttribute('aria-hidden', 'true');
  ov.innerHTML = `<i class="ow-veil"></i><canvas class="ow-cv"></canvas>
    <svg class="ow-rings" viewBox="-300 -300 600 600"><g class="r1"><ellipse rx="230" ry="70"/></g><g class="r2"><ellipse rx="170" ry="52"/></g><g class="r3"><ellipse rx="280" ry="95"/></g></svg>
    <svg class="ow-star" viewBox="-100 -100 200 200"><defs>
      <radialGradient id="ow-h"><stop offset="0" stop-color="#fff"/><stop offset=".22" stop-color="#e6e6ff" stop-opacity=".9"/><stop offset=".55" stop-color="#aeb0fb" stop-opacity=".45"/><stop offset="1" stop-color="#9c9cf5" stop-opacity="0"/></radialGradient>
      <linearGradient id="ow-s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".45" stop-color="#cfdcff"/><stop offset="1" stop-color="#9d8af4"/></linearGradient>
      <linearGradient id="ow-f"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
      <circle r="100" fill="url(#ow-h)"/>
      <rect x="-190" y="-1.2" width="380" height="2.4" fill="url(#ow-f)"/><rect x="-1.2" y="-150" width="2.4" height="300" fill="url(#ow-f)"/>
      <path d="${obStarPath(0, 0, 90, .13)}" fill="url(#ow-s)" stroke="#fff" stroke-width="1.6"/>
      <path d="${obStarPath(0, 0, 38, .18)}" fill="#fff" transform="rotate(45)" opacity=".85"/><circle r="9" fill="#fff"/></svg>
    <div class="ow-name"><small>${toSheet ? 'INVESTIGATOR' : 'SELECT YOUR INVESTIGATOR'}</small><b></b></div>`;
  ov.querySelector('.ow-name b').textContent = toSheet ? (c?.profile.name || '') : '探索者をえらぶ';
  document.body.appendChild(ov);
  const W = innerWidth, H = innerHeight, dpr = Math.min(2, devicePixelRatio || 1), cx = W / 2, cy = H / 2;
  const cv = ov.querySelector('.ow-cv'); cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const spr = obSprite(), R = Math.random, D = Math.hypot(W, H) / 2;
  // 吸いこまれる粒（外側の輪から、うずを巻いてまん中へ）
  const inn = Array.from({ length: Math.round(Math.min(160, W * H / 5000)) }, () => ({ a: R() * 6.283, d: D * (.55 + R() * .6), s: 2 + R() * 6, sp: .7 + R() * .6, delay: R() * 260 }));
  let out = [];
  const T = 1500, MID = 600, BURST = 760;
  let t0 = 0, switched = false, burst = false;
  const frame = now => {
    if (!t0) t0 = now;
    const t = now - t0;
    g.clearRect(0, 0, W, H);
    if (t < BURST) {
      inn.forEach(p => {
        const k = Math.max(0, Math.min(1, (t - p.delay) / (BURST - 120 - p.delay) * p.sp)), e = k * k * (3 - 2 * k);
        if (k <= 0 || k >= 1) return;
        const d = p.d * (1 - e), a = p.a + e * 2.2;
        g.globalAlpha = Math.min(1, k * 3) * (1 - e * .4); g.drawImage(spr, cx + Math.cos(a) * d - p.s, cy + Math.sin(a) * d * .7 - p.s, p.s * 2, p.s * 2);
      });
    }
    if (!burst && t >= BURST) {
      burst = true;
      out = Array.from({ length: 90 }, () => { const a = R() * 6.283, v = 4 + R() * 14; return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .75, s: 2 + R() * 9, life: 0, max: 30 + R() * 30 }; });
    }
    out.forEach(p => { p.life++; p.x += p.vx; p.y += p.vy; p.vx *= .955; p.vy *= .955; g.globalAlpha = Math.max(0, 1 - p.life / p.max); g.drawImage(spr, p.x - p.s, p.y - p.s, p.s * 2, p.s * 2); });
    g.globalAlpha = 1;
    if (!switched && t >= MID) { switched = true; try { mid(); } catch (e) { console.error(e); } }
    if (t < T) requestAnimationFrame(frame);
    else { ov.remove(); obWarpBusy = false; }
  };
  requestAnimationFrame(frame);
  const veil = ov.querySelector('.ow-veil'), star = ov.querySelector('.ow-star'), rings = ov.querySelector('.ow-rings'), name = ov.querySelector('.ow-name');
  // 動きのやわらかさ（easing）は、ひとつひとつの区切りに付ける（全体に付けると、時間の進み方がずれる）
  const ePop = 'cubic-bezier(.2, .9, .3, 1.15)', eOut = 'cubic-bezier(.2, .7, .2, 1)', eIn = 'cubic-bezier(.6, 0, .8, .4)';
  const lin = { duration: T, easing: 'linear', fill: 'forwards' };
  veil.animate([{ opacity: 0, easing: 'ease-out' }, { opacity: 1, offset: .3 }, { opacity: 1, offset: .53, easing: 'ease-in-out' }, { opacity: 0 }], lin);
  star.animate([
    { opacity: 0, transform: 'translate(-50%, -50%) scale(.05) rotate(-70deg)', easing: ePop },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(1) rotate(0deg)', offset: .36, easing: 'ease-in-out' },
    { opacity: 1, transform: 'translate(-50%, -50%) scale(.86) rotate(6deg)', offset: .5, easing: eOut },
    { opacity: 0, transform: 'translate(-50%, -50%) scale(3.4) rotate(24deg)' },
  ], lin);
  rings.querySelectorAll('g').forEach((r, i) => r.animate([
    { opacity: 0, transform: `rotate(${-30 + i * 16}deg) scale(.15)`, easing: eOut },
    { opacity: .95, transform: `rotate(${-14 + i * 16}deg) scale(1)`, offset: .4 + i * .03, easing: 'ease-in-out' },
    { opacity: .9, transform: `rotate(${-10 + i * 16}deg) scale(.95)`, offset: .5, easing: eOut },
    { opacity: 0, transform: `rotate(${-2 + i * 16}deg) scale(${2.3 + i * .35})` },
  ], lin));
  name.animate([
    { opacity: 0, transform: 'translate(-50%, 16px)' }, { opacity: 0, transform: 'translate(-50%, 16px)', offset: .26, easing: eOut },
    { opacity: 1, transform: 'translate(-50%, 0)', offset: .4 }, { opacity: 1, transform: 'translate(-50%, 0)', offset: .56, easing: eIn },
    { opacity: 0, transform: 'translate(-50%, -10px)', offset: .63 }, { opacity: 0 },
  ], lin);
  setTimeout(() => { if (!switched) { switched = true; try { mid(); } catch (e) { console.error(e); } } }, MID + 400);   // 画面が止まっていても、入れかえは必ずする
  setTimeout(() => { if (ov.isConnected) { ov.remove(); obWarpBusy = false; } }, T + 1500);
}

/* ---- 項目の窓：押した玉から光の円が広がってひらき、玉にもどるように閉じる ---- */
function obOrigin(fromEl) {
  const w = $('sao-win').getBoundingClientRect();
  if (!fromEl || !fromEl.getBoundingClientRect) return ['50%', '50%'];
  const r = fromEl.getBoundingClientRect();
  return [(r.left + r.width / 2 - w.left) + 'px', (r.top + r.height / 2 - w.top) + 'px'];
}
function orbisPanelOpen(ov, fromEl) {
  const [x, y] = obOrigin(fromEl);
  ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' });
  $('sao-win').animate([
    { clipPath: `circle(0px at ${x} ${y})`, transform: 'scale(.94)', opacity: .4 },
    { clipPath: `circle(60% at ${x} ${y})`, transform: 'scale(1.01)', opacity: 1, offset: .62 },
    { clipPath: `circle(150% at ${x} ${y})`, transform: 'scale(1)', opacity: 1 },
  ], { duration: 720, easing: 'cubic-bezier(.3, .7, .2, 1)' });
  $('sao-line').animate([{ opacity: 0 }, { opacity: 1, offset: .5 }, { opacity: 0 }], { duration: 900 });
  document.querySelectorAll('.sao-item').forEach((el, i) => el.animate(
    [{ opacity: 0, transform: 'translateY(-10px) scale(.7)' }, { opacity: 1, transform: 'none' }],
    { duration: 520, delay: 160 + i * 40, easing: 'cubic-bezier(.2, .9, .3, 1.3)', fill: 'backwards' }));
  if (fromEl) fxAt(fromEl, true);
}
function orbisPanelClose(ov, target) {
  const [x, y] = obOrigin(target);
  return [
    $('sao-win').animate([
      { clipPath: `circle(150% at ${x} ${y})`, transform: 'scale(1)', opacity: 1 },
      { clipPath: `circle(0px at ${x} ${y})`, transform: 'scale(.96)', opacity: .5 },
    ], { duration: 460, easing: 'cubic-bezier(.6, 0, .5, 1)', fill: 'forwards' }),
    ov.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 200, fill: 'forwards' }),
  ];
}

/* 効果音のオン・オフ（上の帯のスピーカー） */
function obSoundBtn() {
  const b = $('ob-sound'); if (!b) return;
  const on = state.sfx !== false;
  b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? '効果音をオフにする' : '効果音をオンにする'); b.title = on ? '効果音：オン' : '効果音：オフ';
  b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 9.5h3.2l4.3-3.8v12.6l-4.3-3.8H4.5z"/>${on ? '<path d="M15.5 9a4.2 4.2 0 0 1 0 6M17.8 6.6a7.6 7.6 0 0 1 0 10.8"/>' : '<path d="M15.5 9.5l5 5M20.5 9.5l-5 5"/>'}</svg>`;
}
