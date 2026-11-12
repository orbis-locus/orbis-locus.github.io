/* ================= ハブ（アイコンの周りに浮かぶ項目） ================= */
const SECTIONS = [
  { key: 'profile', jp: 'プロフィール', en: 'PROFILE', color: 'var(--sky)' },
  { key: 'abilities', jp: '能力値', en: 'ABILITIES', color: 'var(--cyan)' },
  { key: 'skills', jp: '技能', en: 'SKILLS', color: 'var(--pink)' },
  { key: 'weapons', jp: '武器', en: 'WEAPONS', color: 'var(--orange)' },
  { key: 'items', jp: '所持品', en: 'ITEMS', color: 'var(--lime)' },
  { key: 'money', jp: '財産', en: 'ASSETS', color: 'var(--yellow)' },
  { key: 'tomes', jp: '魔導書・遭遇', en: 'MYTHOS', color: 'var(--san)' },
  { key: 'scenarios', jp: '通過シナリオ', en: 'SCENARIOS', color: 'var(--mp)' },
  { key: 'story', jp: '経歴・メモ', en: 'STORY', color: 'var(--hp)' },
];
let panelKey = null;

function sumText(c, d, key) {
  const named = arr => arr.filter(x => String(x.name || '').trim()).length;
  switch (key) {
    case 'profile': return [c.profile.occupation, c.profile.age && c.profile.age + '歳'].filter(Boolean).join(' / ') || '未入力';
    case 'abilities': return `HP ${d.hp}・SAN ${d.san}`;
    case 'skills': return `残り ${d.jobPt - d.jobUsed} / ${d.hobbyPt - d.hobbyUsed}`;
    case 'weapons': return named(c.weapons) + '件';
    case 'items': return named(c.items) + '件';
    case 'money': return c.money.cash || '未入力';
    case 'tomes': return (c.tomes || c.entities) ? '記録あり' : 'なし';
    case 'scenarios': { const fr = playedWith(c).length; return named(c.scenarios) + '本' + (fr ? `・${fr}人と` : ''); }
    case 'story': return c.backstory ? '記入済み' : '未記入';
    default: return '';
  }
}

function toolsHtml(c) {
  const S = SYS[c.system];
  return `${c.sample ? '<span class="sample-tag">サンプル</span>' : ''}
      <span class="sys-badge">${esc(S.label)}</span>
      <button class="btn small lock-btn ${c.locked ? 'on' : ''}" type="button" data-act="lock" aria-pressed="${!!c.locked}" title="${c.locked ? 'フレンドから見えません（押すと公開）' : 'フレンドに公開中（押すと非公開）'}">${c.locked ? '<svg class="lk" viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 6 0V9"/></svg>非公開' : '<svg class="lk" viewBox="0 0 20 20" aria-hidden="true"><rect x="4.5" y="9" width="11" height="8" rx="2"/><path d="M7 9V6.5a3 3 0 0 1 5.8-1"/></svg>フレンドに公開'}</button>
      <button class="btn small share-btn" type="button" data-act="share" title="リンクを送って、ほかの人にこのキャラシを見せる"><svg class="lk" viewBox="0 0 20 20" aria-hidden="true"><circle cx="5.5" cy="10" r="2.2"/><circle cx="14.5" cy="5" r="2.2"/><circle cx="14.5" cy="15" r="2.2"/><path d="M7.4 9l5.2-3M7.4 11l5.2 3"/></svg>共有</button>
      <button class="btn small" type="button" data-act="dup">複製</button>
      <button class="btn small danger" type="button" data-act="del">削除</button>`;
}
function hubHtml(c) {
  const S = SYS[c.system], n = SECTIONS.length;
  const pos = SECTIONS.map((s, i) => {
    const t = -Math.PI / 2 + i / n * Math.PI * 2;
    return [50 + 41 * Math.cos(t), 50 + 40 * Math.sin(t)];
  });
  return `
    <div class="hub-top">
      ${toolsHtml(c)}
    </div>
    <div class="hub" id="hub">
      <svg class="hub-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <ellipse class="orb" cx="50" cy="50" rx="41" ry="40"/>
        <ellipse class="orb inner" cx="50" cy="50" rx="22" ry="22"/>
        ${pos.map(([x, y]) => `<line class="spoke" x1="50" y1="50" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}"/>`).join('')}
      </svg>
      <div class="hub-center">
        <button class="hub-core" type="button" data-stage aria-label="立ち絵を表示">${tokenHtml(c)}</button>
        <div class="hub-name"><b data-hub="name"></b><span class="kana" data-hub="kana"></span></div>
        <div class="hub-stats"><span>HP <b data-out="hpCur"></b></span><span>MP <b data-out="mpCur"></b></span><span>SAN <b data-out="sanCur"></b></span></div>
      </div>
      ${SECTIONS.map((s, i) => `
        <button class="bubble" type="button" data-open="${s.key}" style="--i:${i};--bc:${s.color};left:${pos[i][0].toFixed(2)}%;top:${pos[i][1].toFixed(2)}%">
          <span class="b-ic">${icon(s.key)}</span><span class="b-en">${s.en}</span><span class="b-jp">${s.jp}</span><span class="b-sum" data-sum="${s.key}"></span>
        </button>`).join('')}
    </div>`;
}

/* ---- 和風テーマのキャラシ：掛け軸に立ち絵、名前は縦書き、項目は「お知らせ」のような目次 ---- */
const isWa = () => (presetOf().look || '').split(' ').includes('wa');
const WA_NUM = ['壱', '弐', '参', '肆', '伍', '陸', '漆', '捌', '玖', '拾'];
const WA_EN = { profile: 'Profile', abilities: 'Abilities', skills: 'Skills', weapons: 'Weapons', items: 'Items', money: 'Assets', tomes: 'Mythos', scenarios: 'Scenarios', story: 'Story' };
function waHtml(c) {
  const src = portraitSrc(c);
  return `
    <div class="hub-top wa-tools">${toolsHtml(c)}</div>
    <div class="wa-sheet">
      <div class="wa-left">
        <button class="wa-kake" type="button" data-stage aria-label="立ち絵を表示">
          <i class="wa-rod" aria-hidden="true"></i>
          <span class="wa-kake-in">${src ? `<img src="${esc(imgSrc(src))}" alt="" draggable="false" onerror="this.remove()">` : ''}<span class="wa-kake-token">${tokenHtml(c)}</span></span>
          <i class="wa-rod bot" aria-hidden="true"></i><i class="wa-cord" aria-hidden="true"></i>
        </button>
        <div class="wa-tate"><b data-hub="name"></b><span data-hub="kana"></span></div>
      </div>
      <div class="wa-right">
        <p class="wa-sub" data-hub="sub"></p>
        <div class="wa-stats">${[['hp', '体力', 'HP'], ['mp', '魔力', 'MP'], ['san', '正気', 'SAN']].map(([k, jp, en]) => `<div class="wa-stat ${k}"><span class="wa-st-l"><b>${jp}</b><small>${en}</small></span><span class="wa-st-tr"><i data-bar="${k}"></i></span><span class="wa-st-v" data-out="${k}Cur"></span></div>`).join('')}</div>
        <div class="wa-head"><span class="wa-head-jp">目録</span><span class="wa-head-en">Contents</span></div>
        <ol class="wa-list">${SECTIONS.map((s, i) => `<li><button class="wa-row" type="button" data-open="${s.key}" style="--i:${i}">
          <span class="wa-no">${WA_NUM[i]}</span><span class="wa-jp">${s.jp}<small>${WA_EN[s.key] || s.en}</small></span><span class="wa-sum" data-sum="${s.key}"></span><span class="wa-go" aria-hidden="true">›</span></button></li>`).join('')}</ol>
      </div>
    </div>`;
}

/* ---- ドットテーマのキャラシ：光る枠のボックスを並べる（押すとその項目をひらく） ---- */
/* ドット絵のアイコン：1文字=1マス（. は透明、文字は色） */
const PIX = {
  star: ['....w....', '...wyw...', '...wyw...', 'wwwyyywww', '.wyyyyyw.', '..wyyyw..', '..wyw.yw.', '.wy....w.', '.w.......'],
  heart: ['.pp...pp.', 'pPPp.pPPp', 'pPwPpPPPp', 'pPPPPPPPp', '.pPPPPPp.', '..pPPPp..', '...pPp...', '....p....'],
  drop: ['....b....', '...bBb...', '..bBBBb..', '.bBwBBBb.', '.bBwBBBb.', '.bBBBBBb.', '..bBBBb..', '...bbb...'],
  brain: ['..pPpPp..', '.pPPpPPp.', 'pPwPpPPPp', 'pPPpPpPPp', 'pPPPpPPPp', '.pPpPPPp.', '..pp.pp..'],
  case: ['...www...', '..w...w..', 'wwwwwwwww', 'wBBBBBBBw', 'wBBByBBBw', 'wBBBBBBBw', 'wwwwwwwww'],
  box: ['.wwwwwww.', 'wBBBwBBBw', 'wwwwwwwww', 'wBBBwBBBw', 'wBByyyBBw', 'wBBBwBBBw', 'wwwwwwwww'],
  pen: ['......ww.', '.....wyw.', '....wBw..', '...wBw...', '..wBw....', '.wBw.....', 'www......'],
  note: ['wwwwwww..', 'wBBBBBw..', 'wBwwwBw..', 'wBBBBBww.', 'wBwwwBBw.', 'wBBBBBBw.', 'wwwwwwww.'],
  sword: ['.......ww', '......wBw', '.....wBw.', '.y..wBw..', '..ywBw...', '..yyw....', '.y.yy....', 'y........'],
  book: ['wwwwwwww.', 'wPPPPPPw.', 'wPwwwwPw.', 'wPPPPPPw.', 'wPwwwPPw.', 'wPPPPPPww', 'wwwwwwwww'],
  flag: ['w........', 'wyyyy....', 'wyyyyyy..', 'wyyyyy...', 'w........', 'w........', 'w........'],
};
const PIX_COL = { w: '#e8eeff', y: '#ffd36b', p: '#ff6fa8', P: '#ff9cc4', b: '#5aa8ff', B: '#2d5fd6' };
function pix(name, size = 18) {
  const rows = PIX[name]; if (!rows) return '';
  const w = Math.max(...rows.map(r => r.length)), h = rows.length;
  let r = '';
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PIX_COL[ch] || '#fff'}"/>`; }));
  return `<svg class="pix" viewBox="0 0 ${w} ${h}" width="${size}" height="${Math.round(size * h / w)}" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}
function dotHtml(c) {
  const d = compute(c), a = abilities(c), p = c.profile, S = SYS[c.system];
  const box = (key, ic, title, body, cls = '') => `<button class="dot-box ${cls}" type="button" data-open="${key}"><span class="dot-tab">${pix(ic)}<span>${title}</span></span><span class="dot-in">${body}</span></button>`;
  const line = (lbl, v) => `<span class="dot-line"><i>${lbl}</i><b>${esc(v || '')}</b></span>`;
  const skills = c.skills.filter(s => s.name && (skillTotal(s, a) !== skillInit(s, a) || s.isJob));
  const shown = (skills.length ? skills : c.skills.filter(s => ['目星', '聞き耳', '図書館', '回避', '応急手当', '心理学', '説得', '言いくるめ'].includes(s.name))).slice(0, 16);
  const items = c.items.filter(x => String(x.name || '').trim());
  const weapons = c.weapons.filter(x => String(x.name || '').trim());
  const scen = c.scenarios.filter(x => String(x.name || '').trim());
  const clip = (t, n) => { t = String(t || '').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
  return `
    <div class="hub-top dot-tools">${toolsHtml(c)}</div>
    <div class="dot-sheet">
      <div class="dot-col">
        <button class="dot-box dot-name" type="button" data-stage aria-label="立ち絵を表示"><span class="dot-tab">${pix('star')}<span>Name</span></span>
          <span class="dot-in dot-namein"><span class="dot-face">${tokenHtml(c)}</span><span class="dot-nm"><b data-hub="name"></b><small data-hub="kana"></small><small class="dot-sys">${esc(S.short)}</small></span></span></button>
        ${box('profile', 'star', 'Profile', `${line('職業', p.occupation)}${line('年齢', p.age && p.age + '歳')}${line('性別', p.sex)}${line('誕生日', p.birthday)}${line('出身', p.origin)}`, 'dot-prof')}
        ${box('skills', 'star', 'Skills', `<span class="dot-skills">${shown.map(s => `<span class="dot-sk"><i>◇</i><span>${esc(skillLabel(s))}</span><b>${skillTotal(s, a)}</b><small>%</small></span>`).join('')}</span><span class="dot-more">残り 職業 <b data-out="jobLeft"></b> ／ 興味 <b data-out="hobbyLeft"></b></span>`, 'dot-skillbox')}
        ${box('weapons', 'sword', 'Weapons', weapons.length ? weapons.slice(0, 4).map(w => `<span class="dot-line"><i>◇</i><b>${esc(w.name)}</b><small>${esc(w.rate || '')}% ${esc(w.damage || '')}</small></span>`).join('') : '<span class="dot-empty">— なし —</span>')}
      </div>
      <div class="dot-col">
        ${box('abilities', 'star', 'Status', `<span class="dot-status"><span class="dot-hmsan">${[['hp', 'heart', 'HP'], ['mp', 'drop', 'MP'], ['san', 'brain', 'SAN']].map(([k, ic, l]) => `<span class="dot-hm">${pix(ic, 22)}<i>${l}</i><b data-out="${k}Cur"></b><span class="dot-bar"><i data-bar="${k}"></i></span></span>`).join('')}</span>
          <span class="dot-abil">${Object.keys(c.abilities).map(k => `<span class="dot-ab"><i>${k}</i><b>${a[k] || 0}</b></span>`).join('')}</span></span>`, 'dot-statbox')}
        ${box('profile', 'case', 'Occupation', `<span class="dot-big">${esc(p.occupation || '— 未記入 —')}</span>`)}
        ${box('items', 'box', 'Possessions', (items.length ? `<span class="dot-chips">${items.slice(0, 8).map(x => `<span>${esc(x.name)}${x.count && x.count !== '1' ? ` ×${esc(x.count)}` : ''}</span>`).join('')}</span>` : '<span class="dot-empty">— なし —</span>') + `<span class="dot-line"><i>所持金</i><b>${esc(c.money.cash || '')}</b></span>`)}
        ${box('tomes', 'book', 'Mythos', c.tomes || c.entities ? `<span class="dot-txt">${esc(clip([c.tomes, c.entities].filter(Boolean).join(' / '), 80))}</span>` : '<span class="dot-empty">— なし —</span>')}
        ${box('scenarios', 'flag', 'Log', scen.length ? scen.slice(-4).reverse().map(x => `<span class="dot-line"><i>◇</i><b>${esc(x.name)}</b><small>${esc(x.date || '')}</small></span>`).join('') : '<span class="dot-empty">— まだ冒険していない —</span>')}
        ${box('story', 'pen', 'Memo', `<span class="dot-txt">${esc(clip(c.memo || c.backstory || '— 未記入 —', 120))}</span>`)}
      </div>
    </div>`;
}

/* 襖（ふすま）がしまって、ひらく画面の切りかえ。しまった瞬間に mid() を呼ぶ */
function waDoors(mid) {
  if (reduceMotion.matches) { mid(); return; }
  const ov = document.createElement('div'); ov.className = 'wa-doors'; ov.setAttribute('aria-hidden', 'true');
  ov.innerHTML = '<i class="wa-door l"><b></b></i><i class="wa-door r"><b></b></i>';
  document.body.appendChild(ov);
  const [l, r] = ov.children, ease = 'cubic-bezier(.7, 0, .3, 1)';
  const shut = [l.animate([{ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }], { duration: 420, easing: ease, fill: 'forwards' }),
    r.animate([{ transform: 'translateX(100%)' }, { transform: 'translateX(0)' }], { duration: 420, easing: ease, fill: 'forwards' })];
  shut[0].finished.then(() => {
    try { mid(); } catch (e) { console.error(e); }
    setTimeout(() => {
      const open = [l.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-102%)' }], { duration: 620, easing: ease, fill: 'forwards' }),
        r.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(102%)' }], { duration: 620, easing: ease, fill: 'forwards' })];
      open[0].finished.then(() => ov.remove(), () => ov.remove());
    }, 140);
  }, () => { ov.remove(); mid(); });
}

function skillTableHtml(c, cat) {
  const rows = c.skills.map((s, i) => [s, i]).filter(([s]) => s.cat === cat).map(([s, i]) => {
    const lbl = esc(skillLabel(s));
    const nameCell = s.custom
      ? inp(`skills.${i}.name`, s.name, { cls: 'c-in', ph: '技能名', label: '技能名' })
      : s.hasSub
        ? `${esc(s.name)}<span class="paren">（</span>${inp(`skills.${i}.sub`, s.sub, { cls: 'c-in', ph: '種類', label: `${s.name}の種類` })}<span class="paren">）</span>`
        : esc(s.name);
    const tail = (s.custom || s.dup)
      ? `<button class="icon-btn" type="button" data-del="skills" data-i="${i}" aria-label="${lbl}を削除">×</button>`
      : s.hasSub ? `<button class="icon-btn" type="button" data-act="dup-skill" data-i="${i}" title="同じ技能をもう1つ追加" aria-label="${esc(s.name)}をもう1つ追加">＋</button>` : '';
    return `<tr data-row="${i}">
      <td><input type="checkbox" class="chk" id="${pid(`skills.${i}.isJob`)}" data-p="skills.${i}.isJob" ${s.isJob ? 'checked' : ''} aria-label="${lbl} を職業技能にする"></td>
      <td><span class="skill-name">${nameCell}<button class="die-btn sk" type="button" data-act="check" data-i="${i}" title="${lbl}で判定（1D100）" aria-label="${lbl}で判定する"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="3.5"/><circle cx="7" cy="7" r="1.2"/><circle cx="13" cy="13" r="1.2"/><circle cx="10" cy="10" r="1.2"/></svg></button></span></td>
      <td class="out-num init" data-l="初期値">${s.custom ? inp(`skills.${i}.init`, s.init, { cls: 'c-in num', num: true, label: '初期値' }) : `<span data-out="sk-i-${i}"></span>`}</td>
      <td data-l="職業P">${inp(`skills.${i}.job`, s.job, { cls: 'c-in num', num: true, label: `${lbl} 職業P` })}</td>
      <td data-l="興味P">${inp(`skills.${i}.hobby`, s.hobby, { cls: 'c-in num', num: true, label: `${lbl} 興味P` })}</td>
      <td data-l="成長">${inp(`skills.${i}.grow`, s.grow, { cls: 'c-in num', num: true, label: `${lbl} 成長` })}</td>
      <td data-l="その他">${inp(`skills.${i}.other`, s.other, { cls: 'c-in num', num: true, label: `${lbl} その他` })}</td>
      <td class="out-num total" data-out="sk-t-${i}"></td>
      <td>${tail}</td>
    </tr>`;
  }).join('');
  return `<div class="tbl-wrap"><table class="tbl sk-tbl">
    <thead><tr><th title="職業技能">職業</th><th style="text-align:left">技能名</th><th>初期値</th><th>職業P</th><th>興味P</th><th>成長</th><th>その他</th><th>合計</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function listTableHtml(c, key, cols, labels, emptyText) {
  if (!c[key].length) return `<p class="empty">${emptyText}</p>`;
  return `<div class="tbl-wrap"><table class="tbl list-tbl">
    <thead><tr>${labels.map(([l, w]) => `<th style="min-width:${w}">${l}</th>`).join('')}<th></th></tr></thead>
    <tbody>${c[key].map((row, i) => `<tr>${cols.map((col, j) => `<td data-l="${labels[j][0]}">${inp(`${key}.${i}.${col}`, row[col], { cls: 'c-in', label: labels[j][0] })}</td>`).join('')}
      <td><button class="icon-btn" type="button" data-del="${key}" data-i="${i}" aria-label="行を削除">×</button></td></tr>`).join('')}</tbody>
  </table></div>`;
}

function sectionBody(key, c) {
  const S = SYS[c.system], p = c.profile, is7 = c.system === 'coc7';
  const out = k => `<span data-out="${k}"></span>`;
  const bar = (hint, tools = '') => `<div class="sec-title">${hint ? `<span class="hint">${hint}</span>` : ''}${tools ? `<div class="tools">${tools}</div>` : ''}</div>`;
  const sub = (t, hint = '') => `<div class="sec-title"><h3>${t}</h3>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  switch (key) {
    case 'profile': return `<section class="sec"><div class="fields">
      ${field('名前', 'profile.name', p.name, { wrap: 'half', ph: '探索者の名前' })}
      ${field('ふりがな', 'profile.kana', p.kana, { wrap: 'half' })}
      ${field('職業', 'profile.occupation', p.occupation)}
      ${field('年齢', 'profile.age', p.age)}
      ${field('誕生日', 'profile.birthday', p.birthday || '', { ph: '例：3月14日' })}
      ${field('性別', 'profile.sex', p.sex)}
      ${field('身長', 'profile.height', p.height)}
      ${field('体重', 'profile.weight', p.weight)}
      ${field('出身', 'profile.origin', p.origin)}
      ${field('髪の色', 'profile.hair', p.hair)}
      ${field('瞳の色', 'profile.eyes', p.eyes)}
      ${field('肌の色', 'profile.skin', p.skin)}
      ${field('プレイヤー名', 'profile.player', p.player)}
      <div class="field"><label for="f-profile-color">コマの色</label><input class="inp" id="f-profile-color" type="color" data-p="profile.color" value="${esc(p.color || '#1f7cf2')}"></div>
      ${field('タグ', 'profile.tags', p.tags, { ph: '例：古書 / 眼鏡' })}
      <div class="field wide"><span class="lbl">立ち絵（真ん中のアイコンを押すと表示）</span>
        <div class="portrait-row">
          <div class="portrait-thumb">${basePortrait(c) ? `<img src="${esc(imgSrc(basePortrait(c)))}" alt="立ち絵のプレビュー">` : '未設定'}</div>
          <div class="portrait-actions">
            <div class="row"><label class="btn small" for="f-portrait-file">画像を選ぶ</label><button class="btn small" type="button" data-act="icon-edit">アイコンを調整</button><input type="file" id="f-portrait-file" accept="image/*" hidden>${c.portrait ? '<button class="btn small danger" type="button" data-act="portrait-remove">画像を外す</button>' : ''}</div>
            <p>PNG・JPGなど。このブラウザ内に保存されます。画像を選ばない場合は、下の画像URLの画像を使います。</p>
          </div>
        </div>
        ${portraitFacesHtml(c)}
      </div>
      <div class="field wide"><span class="lbl">BGM（このキャラを開いたときに流れる曲）</span>
        <div class="bgm-set">
          <div class="bgm-now ${c.bgm ? 'on' : ''}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M8 15.5V5.2l8-1.7v10"/><circle cx="5.8" cy="15.5" r="2.3"/><circle cx="13.8" cy="13.5" r="2.3"/></svg><span id="bgm-now-name">${c.bgm ? esc(c.bgm.name || 'BGM') : '未設定'}</span>${c.bgm ? `<small class="bgm-kind">${c.bgm.src === 'yt' ? 'YouTube' : c.bgm.src === 'url' ? 'URL' : 'ファイル'}</small>` : ''}</div>
          <div class="row"><label class="btn small" for="f-bgm-file">音楽ファイルを選ぶ</label><input type="file" id="f-bgm-file" accept="audio/*,.mp3,.m4a,.ogg,.wav" hidden>${c.bgm ? '<button class="btn small" type="button" data-act="bgm-play">再生</button><button class="btn small danger" type="button" data-act="bgm-remove">BGMを外す</button>' : ''}</div>
          <div class="row"><input class="inp" id="f-bgm-url" placeholder="YouTubeのURL、または音楽ファイルのURL" value="${(c.bgm?.src === 'url' || c.bgm?.src === 'yt') ? esc(c.bgm.url) : ''}"><button class="btn small" type="button" data-act="bgm-url">URLで設定</button></div>
          ${c.bgm ? `<label class="bg-slider" for="f-bgm-vol">音量<input type="range" id="f-bgm-vol" min="0" max="100" value="${cropNum(c.bgm.volume ?? 60, 60, 0, 100)}"><output id="f-bgm-vol-v">${cropNum(c.bgm.volume ?? 60, 60, 0, 100)}%</output></label>` : ''}
          <p>YouTubeは動画ページのURL（https://www.youtube.com/watch?v=… や https://youtu.be/…）をそのまま貼れます。再生中は左下に小さく動画が出ます。音楽ファイル（mp3・m4a・oggなど）はこのブラウザ内に保存され、バックアップには含まれません。</p>
        </div>
      </div>
      ${field('画像URL（ココフォリアのコマ画像）', 'profile.iconUrl', p.iconUrl, { wrap: 'wide', ph: 'https://…（空欄ならココフォリアで後から設定）' })}
      ${field('参照URL', 'profile.externalUrl', p.externalUrl, { wrap: 'wide', ph: 'https://…' })}
      <div class="field wide"><span class="lbl">このキャラの背景画像（シートを開いているときの背景）</span>
        <div class="portrait-row">
          <div class="bg-thumb sm" style="${c.bgImage ? `background-image:url('${esc(imgSrc(c.bgImage))}')` : ''}">${c.bgImage ? '' : '共通の画像'}</div>
          <div class="portrait-actions"><div class="row"><label class="btn small" for="f-charbg-file">画像を選ぶ</label><input type="file" id="f-charbg-file" accept="image/*" hidden>${c.bgImage ? '<button class="btn small danger" type="button" data-act="charbg-remove">画像を外す</button>' : ''}</div>
          <p>未設定のときは、カラー設定の「共通」の背景が使われます。</p></div>
        </div>
      </div>
    </div></section>`;

    case 'abilities': {
      const rows = S.abil.map(([k, dice, , jp]) => {
        const v = c.abilities[k], nm = jp || k;
        return `<tr>
          <td class="ab-name"><span class="ab-n">${nm}<button class="die-btn" type="button" data-act="roll-one" data-k="${k}" title="${nm}だけ振る（${dice}）" aria-label="${nm}をダイスで振る"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="3.5"/><circle cx="7" cy="7" r="1.2"/><circle cx="13" cy="13" r="1.2"/><circle cx="10" cy="10" r="1.2"/></svg></button></span></td><td class="dice">${dice}</td>
          <td data-l="初期値">${inp(`abilities.${k}.base`, v.base, { cls: 'c-in num', num: true, label: `${nm} 初期値` })}</td>
          <td data-l="増減">${inp(`abilities.${k}.adj`, v.adj, { cls: 'c-in num', num: true, label: `${nm} 増減` })}</td>
          <td data-l="一時的増減">${inp(`abilities.${k}.tmp`, v.tmp, { cls: 'c-in num', num: true, label: `${nm} 一時的増減` })}</td>
          <td class="out-num total" data-l="現在値" data-out="ab-${k}"></td>
          ${is7 ? `<td class="out-num init" data-l="½" data-out="ab-${k}-h"></td><td class="out-num init" data-l="⅕" data-out="ab-${k}-f"></td>` : `<td class="out-num init" data-l="×5" data-out="ab-${k}-x5"></td>`}
        </tr>`;
      }).join('');
      return `<section class="sec">
        ${bar('現在値 ＝ 初期値 ＋ 増減 ＋ 一時的増減。各行のサイコロで1つずつ振れます', '<button class="btn small die-all" type="button" data-act="roll"><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="3.5"/><circle cx="7" cy="7" r="1.2"/><circle cx="13" cy="13" r="1.2"/><circle cx="10" cy="10" r="1.2"/></svg>全部まとめて振る</button>' + diceBoxHtml(c) + '')}
        <div class="ab-viz">
          <figure class="chart-fig radar-fig"><figcaption>能力値チャート <span>現在値</span></figcaption><div class="radar" id="ab-radar"></div></figure>
          <div class="derived">
          <div class="dv hp"><span class="lbl">HP（耐久力）</span><span class="val"><input id="f-hp" data-p="hp" value="${esc(c.hp)}" class="num" inputmode="numeric" aria-label="現在HP" data-ph="hpMax"><small>/ ${out('hpMax')}</small></span></div>
          <div class="dv mp"><span class="lbl">MP</span><span class="val"><input id="f-mp" data-p="mp" value="${esc(c.mp)}" class="num" inputmode="numeric" aria-label="現在MP" data-ph="mpMax"><small>/ ${out('mpMax')}</small></span></div>
          <div class="dv san"><span class="lbl">SAN（正気度）</span><span class="val"><input id="f-san" data-p="san" value="${esc(c.san)}" class="num" inputmode="numeric" aria-label="現在SAN" data-ph="sanStart"><small>/ ${out('sanMax')}</small></span></div>
          <div class="dv"><span class="lbl">初期SAN</span><span class="val">${out('sanStart')}</span></div>
          <div class="dv"><span class="lbl">不定の狂気</span><span class="val">${out('indef')}<small>以下で</small></span></div>
          <div class="dv"><span class="lbl">アイデア</span><span class="val">${out('idea')}</span></div>
          <div class="dv"><span class="lbl">幸運</span><span class="val">${out('luck')}</span></div>
          <div class="dv"><span class="lbl">知識</span><span class="val">${out('know')}</span></div>
          <div class="dv"><span class="lbl">ダメージ・ボーナス</span><span class="val">${out('db')}</span></div>
          ${is7 ? `<div class="dv"><span class="lbl">ビルド</span><span class="val">${out('build')}</span></div><div class="dv"><span class="lbl">MOV</span><span class="val">${out('mov')}</span></div>` : ''}
        </div>
        </div>
        <div class="tbl-wrap"><table class="tbl ab-tbl">
          <thead><tr><th style="text-align:left">能力値</th><th>ダイス</th><th>初期値</th><th>増減</th><th>一時的増減</th><th>現在値</th>${is7 ? '<th>ハード（½）</th><th>イクストリーム（⅕）</th>' : '<th>×5</th>'}</tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </section>`;
    }

    case 'skills': {
      const jobFormula = is7
        ? `<select id="f-jobFormula" data-p="jobFormula" aria-label="職業技能ポイントの計算式">${Object.entries(S.jobFormulas).map(([k, v]) => `<option value="${k}" ${k === c.jobFormula ? 'selected' : ''}>${v}</option>`).join('')}</select>`
        : 'EDU×20';
      return `<section class="sec">
        ${bar('左のチェックを入れた技能が職業技能です')}
        <figure class="chart-fig sk-fig"><figcaption>技能グラフ ${SK_LEGEND}</figcaption><div id="sk-chart"></div></figure>
        <div class="points">
          <span class="pt" data-pt="job">職業P（${jobFormula}） 残り <b data-out="jobLeft"></b> / <span data-out="jobPt"></span></span>
          <span class="pt" data-pt="hobby">興味P（INT×${is7 ? 2 : 10}） 残り <b data-out="hobbyLeft"></b> / <span data-out="hobbyPt"></span></span>
        </div>
        <div class="skill-tables">
          ${CATS.map(([cat, label]) => `
            <div class="skill-block" data-cat="${cat}">
              <div class="sub-title">${label}<button class="btn small" type="button" data-act="add-skill" data-cat="${cat}">＋ 技能を追加</button></div>
              ${skillTableHtml(c, cat)}
            </div>`).join('')}
        </div>
      </section>`;
    }

    case 'weapons': return `<section class="sec">
      ${bar('ダメージの「DB」はダメージ・ボーナスに置き換えて出力します', '<button class="btn small" type="button" data-act="add-weapon">＋ 追加</button>')}
      ${listTableHtml(c, 'weapons', ['name', 'rate', 'damage', 'range', 'attacks', 'ammo', 'durability', 'note'],
        [['名称', '9em'], ['成功率', '4em'], ['ダメージ', '6em'], ['射程', '4em'], ['攻撃回数', '4em'], ['装弾数', '4em'], ['耐久力', '4em'], ['その他', '8em']], '武器はありません。')}
    </section>`;

    case 'items': return `<section class="sec">
      ${bar('', '<button class="btn small" type="button" data-act="add-item">＋ 追加</button>')}
      ${listTableHtml(c, 'items', ['name', 'count', 'price', 'note'], [['名称', '10em'], ['個数', '3em'], ['価格', '5em'], ['効果・備考', '12em']], '所持品はありません。')}
    </section>`;

    case 'money': return `<section class="sec"><div class="fields">
      ${field('収入', 'money.income', c.money.income)}
      ${field('現金', 'money.cash', c.money.cash)}
      ${field('預金・借金', 'money.deposit', c.money.deposit)}
      ${field('個人資産・不動産', 'money.assets', c.money.assets)}
    </div></section>`;

    case 'tomes': return `<section class="sec">
      ${sub('魔導書・呪文・アーティファクト')}
      ${area('tomes', c.tomes, '魔導書・呪文・アーティファクト', 5)}
      ${sub('遭遇した超自然の存在')}
      ${area('entities', c.entities, '遭遇した超自然の存在', 5)}
    </section>`;

    case 'scenarios': return scenariosHtml(c);

    case 'story': return `<section class="sec">
      ${sub('経歴')}
      ${area('backstory', c.backstory, '経歴', 6)}
      ${secretBox(c, 5)}
      ${sub('メモ', 'プロフィールと一緒にコマのメモ欄に入ります')}
      ${area('memo', c.memo, 'メモ', 4)}
      ${sub('追加コマンド', '1行に1コマンド。チャットパレットの末尾に入ります')}
      ${area('extra', c.extra, '追加コマンド', 3, 'inp mono')}
    </section>`;
    default: return '';
  }
}
