/* ORBiS：共有リンクの「中継の入口」（Cloudflare Workers に貼り付けて使う）
   LINE・Discord・X は、リンクを貼るとそのページの中の「カードの情報（og:〜）」を読んでプレビューを作る。
   公開サイト（GitHub Pages）は全員に同じページを返すので、キャラごとのカードを出せない。
   そこで、このプログラムが合言葉ごとに「名前と立ち絵の画像」を書いた小さなページを返し、
   人が開いたときはすぐ公開サイトの共有画面（?share=合言葉）へ移動させる。
   使い方：https://<この入口>/s/<合言葉>
   ここに書いてあるサーバーの鍵は publishable key（公開してよいもの）。 */
const SUPA = 'https://umrouqvbmnttirdzixvc.supabase.co';
const KEY = 'sb_publishable_9GwpXgDVVrzCeWjihR6yzQ_uKQsxbia';
const APP = 'https://orbis-locus.github.io/';
const SYS_LABEL = { coc6: 'クトゥルフ神話TRPG（6版）', coc7: 'クトゥルフ神話TRPG（7版）' };

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/s\/([0-9a-f]{32})\/?$/) || [null, url.searchParams.get('share')];
    const token = m[1] && /^[0-9a-f]{32}$/.test(m[1]) ? m[1] : '';
    if (!token) return Response.redirect(APP, 302);
    const dest = APP + '?share=' + token;

    let card = null;
    try {
      const r = await fetch(SUPA + '/rest/v1/rpc/get_share_card', {
        method: 'POST',
        headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: token }),
      });
      if (r.ok) card = await r.json();
    } catch (e) { card = null; }

    // カードの画像があるか確かめる（なければアプリのアイコン）
    const img = SUPA + '/storage/v1/object/public/share-og/' + token + '.jpg';
    let hasImg = false;
    try { const h = await fetch(img, { method: 'HEAD' }); hasImg = h.ok; } catch (e) { hasImg = false; }

    const name = card && card.name ? card.name : '';
    const title = card ? `${name || '名無し'}｜ORBiS` : 'ORBiS｜共有されたキャラシ';
    const desc = card
      ? [card.owner ? `${card.owner}さんが共有した探索者` : '共有された探索者', SYS_LABEL[card.system] || '', card.occupation || ''].filter(Boolean).join(' ・ ')
      : 'このリンクのキャラシは見つかりませんでした。';
    const image = hasImg ? img : APP + 'assets/brand/icon-512.png';

    const html = `<!doctype html>
<html lang="ja"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ORBiS">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url.origin + '/s/' + token)}">
<meta property="og:image" content="${esc(image)}">
${hasImg ? '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">' : ''}
<meta name="twitter:card" content="${hasImg ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0; url=${esc(dest)}">
<script>location.replace(${JSON.stringify(dest)});</script>
</head><body style="font-family:sans-serif;padding:24px">
<p><a href="${esc(dest)}">${esc(name || 'キャラシ')} を開く</a></p>
</body></html>`;
    return new Response(request.method === 'HEAD' ? null : html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
    });
  },
};
