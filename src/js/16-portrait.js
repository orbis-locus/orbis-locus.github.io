/* ================= 立ち絵 ================= */
const blobUrls = new Map();
function imgSrc(u) {
  if (!u || !u.startsWith('data:')) return u;
  let b = blobUrls.get(u);
  if (!b) {
    try {
      const [head, data] = u.split(',');
      const bin = atob(data), arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      b = URL.createObjectURL(new Blob([arr], { type: head.slice(5).split(';')[0] }));
    } catch (e) { b = u; }
    blobUrls.set(u, b);
  }
  return b;
}
function loadPortrait(file) { return loadImageData(file, 1200, .86); }
function loadImageData(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('画像ファイル（PNG・JPGなど）を選んでください。')); return; }
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('画像を読み込めませんでした。別の画像で試してください。'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('画像を読み込めませんでした。別の画像で試してください。'));
      img.onload = () => {
        const k = Math.min(1, maxSide / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        let url = cv.toDataURL('image/webp', quality);
        if (!url.startsWith('data:image/webp')) url = cv.toDataURL('image/png');
        resolve(url);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function renderStage() {
  const c = active(), p = c.profile, src = portraitSrc(c);
  $('stage-figure').innerHTML = src
    ? `<img src="${esc(imgSrc(src))}" alt="${esc(p.name || '探索者')}の立ち絵" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'stage-empty',innerHTML:'<span><b>画像を表示できません</b>URLが正しいか確認するか、画像ファイルを選んでください。</span>'}))">`
    : `<div class="stage-empty"><span><b>立ち絵が未設定です</b>右上の「画像を選ぶ」から、PNGやJPGの画像を設定できます。</span></div>`;
  $('stage-name').textContent = p.name || '名無し';
  $('stage-kana').textContent = p.kana;
  $('stage-sub').textContent = [p.occupation, p.age && p.age + '歳', p.birthday && '誕生日 ' + p.birthday, p.sex].filter(Boolean).join(' / ');
  $('stage-remove').hidden = !(curFace(c) || c.portrait);
  $('stage-remove').textContent = curFace(c) ? 'この差分を消す' : '画像を外す';
  $('stage-faces').innerHTML = stageFacesHtml(c);
  $('stage-faces').hidden = !(c.faces || []).length;
}
function openStage(fromEl) {
  renderStage();
  const ov = $('stage-ov'); ov.hidden = false;
  if (!reduceMotion.matches) {
    if (fromEl) fxAt(fromEl, true);
    ov.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 360, easing: 'ease-out' });
    $('stage-figure').animate([
      { opacity: 0, transform: 'translateY(48px) scale(.9)', filter: 'blur(12px) brightness(1.8)' },
      { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0) brightness(1)' },
    ], { duration: 900, easing: 'cubic-bezier(.2, .8, .2, 1)' });
    document.querySelectorAll('.stage-ring, .stage-rays').forEach((el, i) => el.animate(
      [{ opacity: 0, scale: .4 }, { opacity: 1, scale: 1 }], { duration: 900, delay: i * 90, easing: 'cubic-bezier(.2, .8, .2, 1)', fill: 'backwards' }));
    $('stage-plate').animate([{ opacity: 0, transform: 'translateX(-40px)' }, { opacity: 1, transform: 'translateX(0)' }],
      { duration: 520, delay: 380, easing: 'cubic-bezier(.2, .9, .3, 1.15)', fill: 'backwards' });
  }
  $('stage-close').focus({ preventScroll: true });
}
function closeStage() {
  const ov = $('stage-ov'); if (ov.hidden) return;
  const done = a => { ov.hidden = true; a?.cancel(); document.querySelector('#sheet .hub-core')?.focus({ preventScroll: true }); };
  if (reduceMotion.matches) return done();
  const a = ov.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(1.03)' }], { duration: 300, easing: 'ease-in', fill: 'forwards' });
  a.onfinish = () => done(a);
}
$('stage-ov').addEventListener('click', e => {
  if (e.target.closest('#stage-close')) { closeStage(); return; }
  if (e.target.closest('#stage-profile')) { closeStage(); openPanel('profile', document.querySelector('#sheet [data-open="profile"]')); return; }
  if (e.target.closest('#stage-remove')) {
    const c = active();
    if (curFace(c)) { if (!arm(e.target.closest('#stage-remove'), 'もう一度押すと消す')) return; c.faces.splice(c.face, 1); c.face = -1; }
    else c.portrait = '';
    touch(); renderSheet(); renderStage(); return;
  }
  const fb = e.target.closest("[data-sface]");
  if (fb) { pickFace(active(), +fb.dataset.sface); return; }
  if (!e.target.closest('.stage-tools, .stage-plate, .stage-empty, .stage-faces')) closeStage();
});
document.addEventListener('change', async e => {
  if (e.target.id === 'f-charbg-file') {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const c = active(); c.bgImage = await loadImageData(f, 1600, .78); touch(); renderSheet(); applyBg(); toast('このキャラの背景画像を設定しました。'); }
    catch (err) { toast(err.message); }
    return;
  }
  if (e.target.id !== 'f-portrait-file' && e.target.id !== 'stage-file') return;
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const url = await loadPortrait(f);
    const c = active(); c.portrait = url; c.face = -1;
    if (!c.icon) c.avatar = await renderAvatar(url, Object.assign({ x: 50, y: 15, z: 1 }, c.iconCrop || {}));
    touch(); renderSheet();
    if (!$('stage-ov').hidden) renderStage();
    toast('立ち絵を設定しました。');
  } catch (err) { toast(err.message); }
});

/* ---- 立ち絵の差分（表情など） ---- */
/* プロフィールの立ち絵の下に出す：基本＋差分の一覧（押すとその絵を表示）、名前、消す、追加 */
function portraitFacesHtml(c) {
  const faces = c.faces || [], cur = curFace(c) ? c.face : -1, base = basePortrait(c);
  const thumb = src => src ? `<img src="${esc(imgSrc(src))}" alt="" loading="lazy" onerror="this.remove()">` : '<i>未設定</i>';
  return `<div class="faces">
    <span class="lbl">差分（表情・服装など）<small>${faces.length} / ${MAX_FACES}</small></span>
    <div class="face-list">
      <div class="face-item ${cur < 0 ? 'on' : ''}"><button class="face-pic" type="button" data-act="face-pick" data-i="-1" aria-pressed="${cur < 0}" title="基本の立ち絵を表示">${thumb(base)}</button><span class="face-name">基本</span></div>
      ${faces.map((f, i) => `<div class="face-item ${cur === i ? 'on' : ''}">
        <button class="face-pic" type="button" data-act="face-pick" data-i="${i}" aria-pressed="${cur === i}" title="この差分を表示">${thumb(f.src)}</button>
        <input class="inp face-label" id="f-face-${i}" data-p="faces.${i}.label" value="${esc(f.label || '')}" placeholder="名前（例：笑顔）" aria-label="差分${i + 1}の名前" maxlength="20">
        <button class="face-del" type="button" data-act="face-del" data-i="${i}" title="この差分を消す" aria-label="差分${i + 1}を消す">×</button>
      </div>`).join('')}
    </div>
    <div class="row"><label class="btn small" for="f-face-file">＋ 差分を追加</label><input type="file" id="f-face-file" accept="image/*" multiple hidden><input class="inp face-url" id="f-face-url" placeholder="または画像のURL（https://…）"><button class="btn small" type="button" data-act="face-url">URLで追加</button></div>
    <p>押した絵が立ち絵として表示されます（アイコンは変わりません）。真ん中のアイコンを押して立ち絵を大きく出したときも、下のボタンで切りかえられます。差分はこのアプリの中だけで使います（ココフォリアへは送れません）。</p>
  </div>`;
}
/* 差分を選ぶ（-1 は基本の立ち絵） */
function pickFace(c, i) {
  c.face = (c.faces && c.faces[i]) ? i : -1;
  c.updatedAt = Date.now(); save(); renderShelf(); renderOutput();
  renderSheet();
  if (!$('stage-ov').hidden) renderStage();
}
function addFaces(c, list) {
  c.faces = c.faces || [];
  const room = MAX_FACES - c.faces.length;
  if (room <= 0) { toast(`差分は${MAX_FACES}枚までです。いらない差分を消してから追加してください。`); return false; }
  const add = list.slice(0, room);
  c.faces.push(...add);
  c.face = c.faces.length - 1;
  c.updatedAt = Date.now(); save(); renderAll();
  if (!$('stage-ov').hidden) renderStage();
  toast(list.length > room ? `差分は${MAX_FACES}枚までなので、${add.length}枚だけ追加しました。` : `差分を${add.length}枚追加しました。`);
  return true;
}
document.addEventListener('change', async e => {
  if (e.target.id !== 'f-face-file' && e.target.id !== 'stage-face-file') return;
  const files = [...e.target.files]; e.target.value = '';
  if (!files.length) return;
  const c = active(), list = [];
  for (const f of files) {
    try { list.push({ label: f.name.replace(/\.[^.]+$/, '').slice(0, 20), src: await loadPortrait(f) }); }
    catch (err) { toast(err.message); }
  }
  if (list.length) addFaces(c, list);
});
/* 立ち絵を大きく出す画面の下に、差分を切りかえるボタンを並べる */
function stageFacesHtml(c) {
  const faces = c.faces || [], cur = curFace(c) ? c.face : -1;
  if (!faces.length) return '';
  return [['基本', -1], ...faces.map((f, i) => [f.label || `差分${i + 1}`, i])]
    .map(([l, i]) => `<button class="btn small ${cur === i ? 'primary' : ''}" type="button" data-sface="${i}" aria-pressed="${cur === i}">${esc(l)}</button>`).join('');
}
