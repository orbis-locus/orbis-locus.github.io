# ORBiS（旧：キャラシ工房）— Claude向けメモ

クトゥルフ神話TRPG（6版・7版）のキャラシを作り、ココフォリアのコマに貼り付けられるWebアプリ。
公開URL：https://orbis-locus.github.io/ （GitHub Pages。リポジトリ `orbis-locus/orbis-locus.github.io` の main に push すると反映）
- 2026-11-08 に `kanno-925/charasheet`（前の住所 https://kanno-925.github.io/charasheet/）から引っ越した。前のリポジトリには、これまでの履歴と「引っ越しページ」（move/index.html と同じもの）が残っている。

## ロゴと文字
- ORBiS のロゴ・アイコン・題字は **`docs/brand.md`（見本 `docs/brand/orbis-logo-guide.png`）のデザインを使う**（2026-11-07 にオーナーが決定。青→紫の惑星と輪＋四つの光の星、細身の「ORBIS」）。ロゴ・アイコン・題字・共有カードなど、ロゴが出る所を作る・直すときは必ずこれに合わせる。
- `assets/brand/` の画像（左上のロゴ・タブ・ホーム画面のアイコン）はこのデザインに差しかえ済み。ファイルの一覧は docs/brand.md。

## 作業のルール
- オーナーは開発者ではないので、説明・コミットメッセージ・コード内コメントは**やさしい日本語**で書く。
- 編集するのは `src/` だけ。直下の `index.html` / `css/app.css` / `js/app.js` と `dist/` は `python3 build.py` が作る生成物なので**直接編集しない**。
- **検証版 → 本番の流れ（2026-11-13 にオーナーが決定）**：
  - 作っている途中は `python3 build.py staging` だけを実行する。検証版（`staging/`）と管理ページ（`admin/`）だけが作られ、**本番のファイル（直下の index.html・css/app.css・js/app.js・dist/）は変わらない**。生成物もいっしょに commit して main に push してよい（本番のアプリは変わらないため）。オーナーは管理ページ https://orbis-locus.github.io/admin/ の「検証版」タブで確かめる。
  - 検証版で変えたことは `src/staging-notes.md` に、オーナー向けのやさしい言葉で書く（管理ページに出る）。
  - オーナーが「本番に入れて」と言ったら、`python3 build.py`（本番）を実行して commit・push する。本番を作ると dist/ORBiS.zip も変わる（BOOTH の差しかえは、オーナーが決めた時にまとめて）。
  - src/ は本番より先に進んでいることがある。**オーナーに頼まれていないのに `python3 build.py`（本番）を実行しない**（検証中の変更が本番に出てしまう）。
  - 検証版は、この端末の保存場所（`orbis-stg.〜`・IndexedDB `orbis-stg-data`）とログイン（`orbis-stg-auth`）を本番と分けてある（03-state.js の STAGING を build.py が true にする）。サーバー（Supabase）は本番と同じなので、SQL は本番を壊さない書き方にする。
- 外部ライブラリやビルドツール（npm 等）は増やさない。素のHTML/CSS/JS + build.py の構成を保つ。
- 1ファイル版（`dist/ORBiS.html`）はダブルクリックで動く必要がある。画像・音は `assets/テーマ名/`（魔導書は `book/`、和風は `wa/`、アクアリウムは `aqua/`、アプリのロゴ・アイコンは `brand/`。新しいテーマならフォルダを足す）に置き、CSSでは `../assets/book/名前`、JSでは `'assets/book/名前'` の形で書く（build.py がこの形だけを埋め込む。ファイルが無いとビルドが止まる）。
- 作業の最後に、決まったこと・新機能を `docs/history.md` に1〜2行で追記する。
- 「本番に入れるか」を聞くとき：オーナーは 2026-11-12 に「確認形式（ボタン）じゃなくてチャット形式で」と希望した。ふつうの文章で聞く。オーナーが先に「本番に入れて」と言っているときは聞かずに入れてよい。

## 仕組み
- JS は `src/files.txt` の順に連結され、全体が1つの即時関数で包まれる。ファイルをまたいで同じ変数・関数を使えるので**順番が大事**。新しいファイルは番号を付けて files.txt にも追加する。
- データは `state`（03-state.js）に集まり、IndexedDB（データベース `charasheet-kobo-data` の `kv`。キャラ以外は `meta`、キャラは1人ずつ `c:id` で、変わったキャラだけ書く）に保存。localStorage のキー `charasheet-kobo.v2` にも入りきるうちは予備として保存し、読み込むときは `savedAt` が新しいほうを使う（04-import.js の load/saveNow。v1 からの移行処理あり）。キャラ1人分の形は `blank()` を参照。
- ルール（6版 `coc6`／7版 `coc7`）の能力値・技能・DB計算は `01-rules.js` の `SYS`。
- 主な機能とファイル：取り込み（いあきゃら・ココフォリア・テキスト）04 / ココフォリア出力 06 / 魔導書テーマ 09・11-book.css（本）・18-book-ui.css（本のまわりの画面） / テーマ 15 / BGM 19 / フレンド 20 / クラウド同期 21 / ダイス 22 / グループ 25 / 探索者選択 26 / オープニング 27（ORBiS 版と魔法陣。localStorage の charasheet-kobo.intro で切りかえ。ORBiS 版の曲と、全体の音量 VOL もここ） / 画面の編集モード 28・15-ui-editor.css / アクアリウムテーマ 29・19-aqua.css / キャラシの共有リンク 30（リンクのカードは cloudflare/share-worker.js を Cloudflare Workers で動かす）/ ORBiS テーマ（メイン・初めて開いた人のテーマ）31・20-orbis.css / 効果音（テーマごと）32 / 引っ越しの受け取り 33 / 無料版の鍵と「欲しい！」34（制限の決まりは 03-state.js の FREE_EDITION） / 通報とマスターの対応 35 / 管理ページ src/admin/（admin.html・admin.css・admin.js → build.py が admin/index.html に。マスターだけ。タブ：検証版・本番・通報・お問い合わせ・欲しい！・利用者と権限）/ 利用規約・プライバシーポリシー・お問い合わせ 36（文は index.html の modal-legal。お問い合わせはアプリの中の入力欄からサーバーの contacts へ、マスターはアカウントの小窓で一覧） / 起動 37（いちばん最後）。
- サーバーは Supabase（接続先は 21-cloud.js。公開してよい publishable key）。見える範囲は RLS でサーバー側に強制している。キャラシの画像（立ち絵・差分・アイコン・背景）は、サーバーでは Storage の `char-images` に分けて置き、characters.data には URL だけ入れる（21-cloud.js の cloudCopy。この端末の中は data URL のことも URL のこともある）。
- 権限は `app_admins.role`（'master' / 'editor'）。ほかに「テスター」（別の表 `app_testers`、16-testers.sql）：無料版の鍵が外れるだけで、編集の権限はない。画面の編集はどちらもできる。公開（`ui_layout` への書きこみ）と権限の変更（`set_app_role` 関数）はマスターだけ。編集者は `ui_drafts` に仮保存し、マスターがそれを読み込んで公開する。編集で使う画像は Storage の `ui-assets`。
- 編集できる項目は 28-ui-editor.js の `UE_SECS` にまとめてある（項目を増やすときはここに1行足す）。
- 画面の編集モードで公開した見た目の変更は、コードではなく Supabase の `ui_layout` に入っている（CSSを上書き）。コードで見た目を直しても変わらないときはそちらを疑う。編集パネルの「書き出し」の内容を貼ってもらえば、コードに組み込める。
- DB を変えるときは `supabase/` に**番号付きの新しいSQLファイルを追加**し、何度実行しても大丈夫な書き方（`if not exists`、`create or replace`、policy は drop してから create）にする。オーナーが SQL Editor で手動実行するので、実行が必要なことを必ず伝える。

## 前のチャットからの引き継ぎ
- 新しいチャットでは、まず `docs/handoff.md`（いまの状態・SQLの実行状況・残っていること）を読む。

## 詳しい経緯
@docs/history.md

## 作りかけ・予定
- 公開・BOOTH配布の前に直すこと：docs/release-checklist.md（終わったら ✅ を付ける）。
- BOOTH で配るもの：booth/（説明書 はじめにお読みください.txt・商品ページ.md・images/）。説明書は build.py が dist/ に書き出す。アプリの使い方や無料版の中身を変えたら、説明書と商品ページの文も直す。
- 無料のサンプル版（機能をしぼる＋「欲しい！」ボタン）：2026-11-11 に作成（テーマは ORBiS だけ・3人まで・グループとフレンドのキャラシを見るのは鍵、アカウント・フレンドの申請と一覧は残す）。有料版を出すときは 03-state.js の FREE_EDITION を false に。
- 有料版（プレミアム）：設計は同じメモ。**保留中**。オーナーが作ると言うまで作らない。
