"""ORBiS（旧キャラシ工房）のビルド。

src/ にあるソース（index.html・css/・js/）を組み立てて、次の3つを作ります。

  index.html, css/app.css, js/app.js   GitHub Pages で公開するもの（このフォルダの直下）
  dist/ORBiS.html                      ダブルクリックで開ける1ファイル版
  dist/claude-artifact.html             Claude の公開版（Artifact）用（git には入れない）

使い方：  python3 build.py

結合の順番は src/files.txt に書いてあります。JS は全体を1つの即時関数で包むので、
ファイルをまたいで同じ変数・関数を使えます（順番は大事です）。
"""
import base64
import json
import re
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / 'src'

order = [l.strip() for l in (SRC / 'files.txt').read_text(encoding='utf-8').splitlines() if l.strip() and not l.startswith('#')]
css = '\n'.join((SRC / f).read_text(encoding='utf-8') for f in order if f.startswith('css/'))
js = "(() => {\n'use strict';\n\n" + '\n'.join((SRC / f).read_text(encoding='utf-8') for f in order if f.startswith('js/')) + '})();\n'
shell = (SRC / 'index.html').read_text(encoding='utf-8')
head, rest = shell.split('<!-- build:css -->', 1)
markup, _ = rest.split('<!-- build:js -->', 1)
head, markup = head.strip(), markup.strip()

META = '''<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="クトゥルフ神話TRPGのキャラクターシートを作って、ココフォリアのコマにそのまま貼り付けられるツール">
<meta name="theme-color" content="#12133a">
<meta name="apple-mobile-web-app-title" content="ORBiS">
<meta name="application-name" content="ORBiS">
{ICONS}'''
# アプリのアイコン（ブラウザのタブ・スマホのホーム画面）。画像は assets/brand/
ICONS_SITE = '''<link rel="icon" type="image/png" sizes="64x64" href="assets/brand/favicon-64.png">
<link rel="icon" type="image/png" sizes="32x32" href="assets/brand/favicon-32.png">
<link rel="apple-touch-icon" sizes="180x180" href="assets/brand/apple-touch-icon.png">
<link rel="manifest" href="manifest.webmanifest">'''
RESET = '''<style>
html { color-scheme: light; }
body { margin: 0; }
img { max-width: 100%; }
[hidden] { display: none !important; }
</style>'''


def page(css_part, js_part, icons=ICONS_SITE):
    return f"""<!doctype html>
<html lang="ja">
<head>
{META.replace('{ICONS}', icons)}
{head}
{RESET}
{css_part}
</head>
<body>
{markup}
{js_part}
</body>
</html>
"""


# GitHub Pages: separate, cacheable files
site = ROOT
(site / 'css').mkdir(parents=True, exist_ok=True)
(site / 'js').mkdir(parents=True, exist_ok=True)
(site / 'css' / 'app.css').write_text(css, encoding='utf-8')
(site / 'js' / 'app.js').write_text(js, encoding='utf-8')
(site / 'index.html').write_text(page('<link rel="stylesheet" href="css/app.css">', '<script src="js/app.js"></script>'), encoding='utf-8')

# スマホの「ホーム画面に追加」で使う、アプリの名前とアイコン
(site / 'manifest.webmanifest').write_text(json.dumps({
    'name': 'ORBiS', 'short_name': 'ORBiS', 'description': 'クトゥルフ神話TRPGのキャラクターシート',
    'start_url': './', 'scope': './', 'display': 'browser', 'background_color': '#12133a', 'theme_color': '#12133a',
    'icons': [{'src': 'assets/brand/icon-192.png', 'sizes': '192x192', 'type': 'image/png', 'purpose': 'any maskable'},
              {'src': 'assets/brand/icon-512.png', 'sizes': '512x512', 'type': 'image/png', 'purpose': 'any maskable'}],
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# single-file versions
dist = ROOT / 'dist'
dist.mkdir(exist_ok=True)
MIME = {'.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg'}


def data_uri(name):
    f = ROOT / 'assets' / name
    if not f.is_file():
        raise SystemExit(f'assets/{name} が見つかりません（CSS・JS に書いた画像・音の場所を確かめてください）')
    return f'data:{MIME[f.suffix]};base64,' + base64.b64encode(f.read_bytes()).decode()


# 1ファイル版は assets/ の画像・音も中に埋め込む（assets/book/〜 のようにテーマごとのフォルダに分けてある）
css1 = re.sub(r'\.\./assets/([\w./-]+)', lambda m: data_uri(m.group(1)), css)
js1 = re.sub(r'(?<=[\'"])assets/([\w./-]+)(?=[\'"])', lambda m: data_uri(m.group(1)), js)
inline_css, inline_js = f'<style>\n{css1}</style>', f'<script>\n{js1}</script>'
icons1 = f'<link rel="icon" type="image/png" href="{data_uri("brand/favicon-64.png")}">\n<link rel="apple-touch-icon" href="{data_uri("brand/apple-touch-icon.png")}">'
(dist / 'ORBiS.html').write_text(page(inline_css, inline_js, icons1), encoding='utf-8')
(dist / 'claude-artifact.html').write_text(f'{head}\n{icons1}\n{inline_css}\n\n{markup}\n{inline_js}\n', encoding='utf-8')

# BOOTH でいっしょに配る説明書。Windows のメモ帳でも文字化けしないよう、BOM つき・改行は CRLF にする
readme = (ROOT / 'booth' / 'はじめにお読みください.txt').read_text(encoding='utf-8').replace('\r\n', '\n').replace('\n', '\r\n')
(dist / 'はじめにお読みください.txt').write_text(readme, encoding='utf-8-sig', newline='')

# BOOTH は .html と .txt をそのまま置けないので、2つを ORBiS フォルダに入れた zip にまとめる。
# 日付は決まった日にする（毎回ちがう日付だと、中身が同じでも zip が変わってしまうため）
import zipfile
with zipfile.ZipFile(dist / 'ORBiS.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name in ('ORBiS.html', 'はじめにお読みください.txt'):
        info = zipfile.ZipInfo('ORBiS/' + name, date_time=(2026, 11, 12, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, (dist / name).read_bytes())

print(f'built: index.html ({len(css) // 1024}KB css, {len(js) // 1024}KB js), dist/ORBiS.html, dist/はじめにお読みください.txt, dist/ORBiS.zip, dist/claude-artifact.html')
