/* ================= アイコンの調整（拡大・位置） ================= */
let iconEd = null;
function renderIconPreview() {
  const c = active(), src = iconEd.src;
  $('ico-stage').innerHTML = src ? `<img id="ico-img" src="${esc(imgSrc(src))}" alt="" draggable="false" style="${cropStyle(iconEd.crop)}">` : `<span class="ico-none">画像がありません。<br>下の「アイコン用の画像を選ぶ」か、プロフィールで立ち絵を設定してください。</span>`;
  $('ico-zoom').value = iconEd.crop.z; $('ico-zoom-v').textContent = Math.round(iconEd.crop.z * 100) + '%';
  $('ico-mini').innerHTML = [56, 34, 22].map(sz => `<span class="token" style="--tc:${cssColor(c.profile.color)};width:${sz}px;height:${sz}px">${src ? `<img src="${esc(imgSrc(src))}" alt="" style="${cropStyle(iconEd.crop)}">` : esc(initial(c))}</span>`).join('');
  $('ico-own').hidden = !iconEd.src || iconEd.src !== iconEd.own;
}
function openIconEditor() {
  const c = active();
  iconEd = { own: c.icon || '', src: iconSrc(c), crop: Object.assign({ x: 50, y: 15, z: 1 }, c.iconCrop || {}) };
  renderIconPreview(); openModal('modal-icon');
}
function updateIconImg() { const im = $('ico-img'); if (im) im.setAttribute('style', cropStyle(iconEd.crop)); renderIconMini(); $('ico-zoom-v').textContent = Math.round(iconEd.crop.z * 100) + '%'; }
function renderIconMini() { $('ico-mini').querySelectorAll('img').forEach(im => im.setAttribute('style', cropStyle(iconEd.crop))); }
(() => {
  const st = $('ico-stage'); let drag = null;
  st.addEventListener('pointerdown', e => { if (!iconEd || !iconEd.src) return; drag = { x: e.clientX, y: e.clientY, cx: iconEd.crop.x, cy: iconEd.crop.y }; st.setPointerCapture(e.pointerId); st.classList.add('drag'); });
  st.addEventListener('pointermove', e => {
    if (!drag) return;
    const w = st.clientWidth, k = 100 / (w * iconEd.crop.z) * 1.6;
    iconEd.crop.x = Math.max(0, Math.min(100, drag.cx - (e.clientX - drag.x) * k));
    iconEd.crop.y = Math.max(0, Math.min(100, drag.cy - (e.clientY - drag.y) * k));
    updateIconImg();
  });
  const end = () => { drag = null; st.classList.remove('drag'); };
  st.addEventListener('pointerup', end); st.addEventListener('pointercancel', end);
  st.addEventListener('wheel', e => { if (!iconEd || !iconEd.src) return; e.preventDefault(); iconEd.crop.z = Math.max(1, Math.min(5, +(iconEd.crop.z - e.deltaY * .002).toFixed(2))); $('ico-zoom').value = iconEd.crop.z; updateIconImg(); }, { passive: false });
  st.addEventListener('keydown', e => {
    if (!iconEd || !iconEd.src) return;
    const step = e.shiftKey ? 5 : 1, m = { ArrowLeft: ['x', step], ArrowRight: ['x', -step], ArrowUp: ['y', step], ArrowDown: ['y', -step] }[e.key];
    if (!m) return; e.preventDefault();
    iconEd.crop[m[0]] = Math.max(0, Math.min(100, iconEd.crop[m[0]] + m[1])); updateIconImg();
  });
})();
$('ico-zoom').addEventListener('input', e => { iconEd.crop.z = +e.target.value; updateIconImg(); });
$('ico-reset').addEventListener('click', () => { iconEd.crop = { x: 50, y: 15, z: 1 }; renderIconPreview(); });
$('ico-own').addEventListener('click', () => { iconEd.own = ''; iconEd.src = portraitSrc(active()); iconEd.crop = { x: 50, y: 15, z: 1 }; renderIconPreview(); });
$('ico-file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { iconEd.own = await loadImageData(f, 600, .86); iconEd.src = iconEd.own; iconEd.crop = { x: 50, y: 50, z: 1 }; renderIconPreview(); }
  catch (er) { toast(er.message); }
});
function renderAvatar(src, crop, size = 128) {
  return new Promise(res => {
    if (!src) return res('');
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => {
      try {
        const cv = document.createElement('canvas'); cv.width = cv.height = size;
        const g = cv.getContext('2d');
        const sc = Math.max(size / im.width, size / im.height);
        const w = im.width * sc, h = im.height * sc;
        const ox = (size - w) * crop.x / 100, oy = (size - h) * crop.y / 100;
        const px = size * crop.x / 100, py = size * crop.y / 100;
        g.translate(px, py); g.scale(crop.z, crop.z); g.translate(-px, -py);
        g.drawImage(im, ox, oy, w, h);
        let url = cv.toDataURL('image/webp', .85);
        if (!url.startsWith('data:image/webp')) url = cv.toDataURL('image/png');
        res(url);
      } catch (e) { res(''); }
    };
    im.onerror = () => res('');
    im.src = imgSrc(src);
  });
}
$('ico-save').addEventListener('click', async () => {
  const c = active();
  c.icon = iconEd.own || '';
  c.iconCrop = { x: +iconEd.crop.x.toFixed(1), y: +iconEd.crop.y.toFixed(1), z: +(+iconEd.crop.z).toFixed(2) };
  c.avatar = await renderAvatar(iconEd.src, c.iconCrop);
  touch(); renderAll(); closeModals();
  toast('アイコンを保存しました。');
});
