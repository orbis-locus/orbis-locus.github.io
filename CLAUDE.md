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
- 変更したら必ず `python3 build.py` を実行し、生成物もいっしょに commit する（しないと公開版に反映されない）。
- 外部ライブラリやビルドツール（npm 等）は増やさない。素のHTML/CSS/JS + build.py の構成を保つ。
- 1ファイル版（`dist/ORBiS.html`）はダブルクリックで動く必要がある。画像・音は `assets/テーマ名/`（魔導書は `book/`、和風は `wa/`、アクアリウムは `aqua/`、アプリのロゴ・アイコンは `brand/`。新しいテーマならフォルダを足す）に置き、CSSでは `../assets/book/名前`、JSでは `'assets/book/名前'` の形で書く（build.py がこの形だけを埋め込む。ファイルが無いとビルドが止まる）。
- 作業の最後に、決まったこと・新機能を `docs/history.md` に1〜2行で追記する。
- 作業が終わって「main に入れる（公開サイトに出す）か」を聞くときは、文章で聞かずに**ボタンで選べる質問（AskUserQuestion）**にする（2026-11-07 にオーナーが希望）。選択肢は「main に入れる」「まだ入れない」など。オーナーが先に「そのまま main に」と言っているときは聞かずに入れてよい。

## 仕組み
- JS は `src/files.txt` の順に連結され、全体が1つの即時関数で包まれる。ファイルをまたいで同じ変数・関数を使えるので**順番が大事**。新しいファイルは番号を付けて files.txt にも追加する。
- データは `state`（03-state.js）に集まり、IndexedDB（データベース `charasheet-kobo-data` の `kv`。キャラ以外は `meta`、キャラは1人ずつ `c:id` で、変わったキャラだけ書く）に保存。localStorage のキー `charasheet-kobo.v2` にも入りきるうちは予備として保存し、読み込むときは `savedAt` が新しいほうを使う（04-import.js の load/saveNow。v1 からの移行処理あり）。キャラ1人分の形は `blank()` を参照。
- ルール（6版 `coc6`／7版 `coc7`）の能力値・技能・DB計算は `01-rules.js` の `SYS`。
- 主な機能とファイル：取り込み（いあきゃら・ココフォリア・テキスト）04 / ココフォリア出力 06 / 魔導書テーマ 09・11-book.css（本）・18-book-ui.css（本のまわりの画面） / テーマ 15 / BGM 19 / フレンド 20 / クラウド同期 21 / ダイス 22 / グループ 25 / 探索者選択 26 / オープニング 27（ORBiS 版と魔法陣。localStorage の charasheet-kobo.intro で切りかえ。ORBiS 版の曲と、全体の音量 VOL もここ） / 画面の編集モード 28・15-ui-editor.css / アクアリウムテーマ 29・19-aqua.css / キャラシの共有リンク 30（リンクのカードは cloudflare/share-worker.js を Cloudflare Workers で動かす）/ ORBiS テーマ（メイン・初めて開いた人のテーマ）31・20-orbis.css / 効果音（テーマごと）32 / 引っ越しの受け取り 33 / 無料版の鍵と「欲しい！」34（制限の決まりは 03-state.js の FREE_EDITION） / 通報とマスターの対応 35 / 利用規約・プライバシーポリシー・お問い合わせ 36（文は index.html の modal-legal。お問い合わせはアプリの中の入力欄からサーバーの contacts へ、マスターはアカウントの小窓で一覧） / 起動 37（いちばん最後）。
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
- 無料のサンプル版（機能をしぼる＋「欲しい！」ボタン）：2026-11-11 に作成（テーマは ORBiS だけ・3人まで・グループとフレンドのキャラシを見るのは鍵、アカウント・フレンドの申請と一覧は残す）。有料版を出すときは 03-state.js の FREE_EDITION を false に。
- 有料版（プレミアム）：設計は同じメモ。**保留中**。オーナーが作ると言うまで作らない。
