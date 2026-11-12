# 引き継ぎメモ（新しいチャットで最初に読む）

最終更新：2026-11-12
前のチャットでやったこと・決まったこと・残っていることのまとめ。
細かい変更の一覧は `docs/history.md`、作業のルールは `CLAUDE.md` を見る。

---

## 1. いまの状態

- アプリ名：**ORBiS**（旧：キャラシ工房。2026-11-06 に改名）
- 公開URL：https://orbis-locus.github.io/ （GitHub Pages。`orbis-locus/orbis-locus.github.io` の main に push すると数分で反映）。前の住所 https://kanno-925.github.io/charasheet/ （`kanno-925/charasheet`）は引っ越しページ。これまでの履歴は前のリポジトリにある
- 1ファイル版：`dist/ORBiS.html`（ダブルクリックで動く。画像・音も中に入っている）
- Claude の公開版（Artifact）：https://claude.ai/artifact/ULwQZd62EkbS88ZrvJv96v （`dist/claude-artifact.html` を公開。git には入れない）
- サーバー：Supabase（プロジェクト `umrouqvbmnttirdzixvc`）。SQL Editor：https://supabase.com/dashboard/project/umrouqvbmnttirdzixvc/sql/new
- 保存データの内部の名前（`charasheet-kobo…`）とバックアップの `app: 'charasheet-kobo'` は**改名後も変えていない**（変えると今のデータが読めなくなる）。

## 2. Supabase の SQL（オーナーが SQL Editor で手で実行する）

| ファイル | 内容 | 実行 |
|---|---|---|
| 01〜06 | アカウント・フレンド・グループ・招待・編集モード・権限・仮保存 | 済み |
| 07-avatars.sql | アカウントのアイコン画像（profiles.avatar） | 済み（確認済み） |
| 08-group-transfer.sql | グループの代表をゆずる（transfer_group） | 済み（安全版に直して再実行・確認済み） |
| 09-dice-limit.sql | ダイスの上限（group_members.dice_limit / dice_reset） | 済み（2026-11-07 に列があることを確認） |
| 10-share.sql | キャラシの共有リンク（char_shares・get_shared_char。見る人はログイン不要なので anon にも実行権を付けている） | 済み（2026-11-07 に確認） |
| 11-share-card.sql | 共有リンクのカード（get_share_card・Storage の share-og） | 済み（2026-11-07 に確認） |
| 12-char-secrets.sql | キャラシの秘匿欄（char_secrets・can_read_secret。持ち主とグループのKPだけ読める） | 済み（2026-11-08 にエラーなしで実行） |
| 13-secret-open.sql | 秘匿の「公開する／しない」（char_secrets.is_open、公開中は「キャラシを読める人」も読める、共有リンクにも出す） | 済み（2026-11-08 に列があることを確認） |
| 14-deleted-chars.sql | 削除したキャラが復活しないように（deleted_chars と、characters の削除・追加のトリガー） | 済み（2026-11-11 に再実行。表があり anon から読めないことを確認） |
| 16-testers.sql | テスター（app_testers・am_unlocked。app_users_list と set_app_role に 'tester' を足した） | 済み（2026-11-11 に確認。チャットで渡した版はお知らせの文が英語） |
| 17-want-friendview.sql | 「欲しい！」に friendview（フレンドのキャラシを見る）を足す（add_want を作り直す） | 済み（2026-11-12 にオーナーが実行） |
| 18-char-images.sql | 画像の置き場所 char-images（公開・1枚5MB・1人100MB。char_images_used） | 済み（2026-11-12 に確認：置き場所あり・ログインなしでは置けない） |
| 19-limits.sql | 大きさの上限（キャラシ1MB・60人、グループ200KB、画面の編集2MB、ui-assets 5MB） | 済み（2026-11-12 に確認：大きすぎるキャラシ・グループが断られる） |
| 20-reports.sql | 通報（reports・report_user・report_list・mod_action。一覧と対応はマスターだけ） | 済み（2026-11-12 に確認：表と3つの関数があり、ログインなしでは使えない。貼り付け用の版は、消したグループ名が「(removed)」） |
| 21-contacts.sql | お問い合わせ（contacts・send_contact は anon も可・contact_list と contact_close はマスターだけ） | 済み（2026-11-12 に確認：関数があり、ログインなしでは一覧・閉じる・表の読み取りができない） |
| 15-feature-wants.sql | 無料版の「欲しい！」の数（feature_wants・add_want は anon も可・want_counts はマスター/編集者だけ） | 済み（2026-11-11 に確認：表は anon から読めない・数は anon から見られない・add_want は呼べる） |

- SQL を渡すときの注意：オーナーがコピーで**途中で切れた**ことがある。短く・英数字だけで書き、「全部消してから貼る」「文字を選択していない状態で Run」と伝える。
- 新しいサーバー関数は Supabase が anon（ログインしていない人）にも実行権を付ける。`revoke ... from public, anon` と、関数の中で `auth.uid() is null` を止めることを必ず入れる。
- この作業環境から Supabase に接続できるようにしてある（オーナーが環境の許可に追加）。確認は publishable key で REST を呼ぶ（中身は見えない。列や関数があるかだけ確かめる）。

## 3. 前のチャットで作ったもの（新しい順・ざっくり）

- **改名**：キャラシ工房 → ORBiS（題名・オープニング・ロゴ下の文字・ホーム画面名・dist のファイル名）。
- **ロゴとアイコン**：オーナーの画像から `assets/brand/` に切り出し（favicon・apple-touch-icon・manifest.webmanifest・左上のロゴ。明るいテーマは濃い色、暗いテーマは光る色）。manifest の display は `browser`（開き方は変えない）。
- **ダイスの上限回数**：能力値を振るボタンだけ数える（まとめて＝1回、1つずつ＝1回ずつ。技能の判定は数えない）。キャラごとの上限（c.dice）、グループで使うキャラはキーパーの上限が優先（数字は見えるがグレーで触れない）。KPはグループのカードで上限とリセット。
- **技能グラフの色分け**：初期値・職業P・興味P・成長とその他。
- **探索者を全部削除できる**：0人なら探索者をえらぶ画面。削除したキャラを使っていたグループの参加情報は「キャラ未設定」に戻す。
- **グループの代表をゆずる**。
- **ドットテーマ**（星空と夜の街のドット絵、光る枠のボックス、モザイクの切りかえ）。
- **和風テーマ**（和紙・墨・金、舞う桜、掛け軸＋縦書き＋目録、巻物の窓、襖の切りかえ）。
- **いあきゃらのテキスト出力（.txt）を丸ごと取り込み**（技能の内訳・武器・所持品・財産・経歴・シナリオ・メモ）。「ココフォリア駒出力」には合計値しか入っていない。
- **アカウントのアイコン画像**、**探索者は最大50人**、**スライド表示**、**スマホ・iPad対応の修正**、**魔導書テーマの作り込み**（写真の質感・録音の効果音・見開き・頁内スクロール）。
- 別のチャット（同じリポジトリ）でも作業が進むことがある（例：秘匿欄は別のチャットで作られた）。push の前に `git fetch origin main` して、進んでいたら `git pull --rebase origin main` を忘れずに。
- 2026-11-07〜08 のこのチャット：共有リンク・共有カード（Cloudflare）・立ち絵の差分・同期の直し・ORBiS テーマ・ロゴ・テーマごとの画面と効果音・オープニングの ORBiS 版と曲・音量・秘匿の公開。詳しくは history.md。

## 4. 残っていること・確認待ち

- **BOOTH の無料サンプル版（2026-11-11〜）**：無料版の中身は決定・制限は作成済み（history.md の 2026-11-11）。2026-11-11 に main に入れて公開済み（同期ズレの直し・テスターもいっしょ）。公開サイトはもう無料版。お友達はマスターが「権限」タブでテスターにする。権利表記はアプリの中に入れた（2026-11-12）。規約・プライバシーポリシーもアプリに入れた（2026-11-12）。お問い合わせはアプリの中の入力欄（21-contacts.sql）。残りは docs/release-checklist.md の【必須】（確認メール・動作確認・配る物）。

- **公開サイトの引っ越し（2026-11-08・完了）**：新しい住所は https://orbis-locus.github.io/ （GitHub アカウント orbis-locus、リポジトリ orbis-locus.github.io）。済み：新しいリポジトリへ push・GitHub Pages 公開、前の住所 https://kanno-925.github.io/charasheet/ を引っ越しページに（オーナーが kanno-925/charasheet の main の index.html を move/index.html に差しかえ。表示を確認済み）、Supabase の URL Configuration（オーナーが設定。こちらからは確かめられない）。Cloudflare の入口（orbis-share）も貼りかえ済み（新しい住所へ移動することを確認）。
  - Claude につながる GitHub は orbis-locus に変わったので、**kanno-925/charasheet にはもう書きこめない**。前のリポジトリで何かするときは、オーナーに GitHub のサイトからアップロードしてもらう。

- **メインテーマ「ORBiS」**（31-orbis.js・20-orbis.css）：初めて開いた人のテーマ。販売に向けた「サービスの顔」。オーナーの感想待ち。オープニングは ORBiS 版が標準（魔法陣は小窓で選べる）。
- **ロゴを新しいデザインに決定・差しかえ済み**（docs/brand.md）。左上ロゴ・favicon・ホーム画面アイコン・共有カードの右下。スマホのホーム画面に前のアイコンで追加済みの人は、追加しなおすと新しいアイコンになる。

0. **共有リンクのカード（立ち絵のプレビュー）**：動いている。中継の入口は Cloudflare Workers の `orbis-share`（https://orbis-share.masakawwwww.workers.dev 、オーナーの Cloudflare アカウント）。cloudflare/share-worker.js を変えたときは、オーナーに Cloudflare の「Edit code」で貼りかえて Deploy してもらう必要がある（自動では反映されない）。LINE などで本当にカードが出るかは、オーナーに実際に貼って確かめてもらう。

1. （古い）**「なんか開けない」の報告**：こちらでは公開サイトをPC・iPhoneのサイズ、全テーマで開けてエラーなし。キャッシュ、古い `キャラシ工房.html`（改名で消えた）、ホーム画面のアイコンからの起動などを疑い、オーナーに「端末・どこから開いたか・どうなるか・ログインしているか・スクショ」を聞いている。**返事を待っている状態**。ログイン中だけ起きる不具合の可能性もある（テストでは確かめられない）。
2. ~~09-dice-limit.sql を実行したか確認~~ → 済み（列があることを確認）。
3. 改名の続き：URL（リポジトリ名 charasheet）は変えていない。変えるならオーナーに確認してから。オープニングでロゴ（`assets/brand/logo-full.webp`、キャッチコピー付き）を使う案もある。
4. ダイスの上限で技能の判定も数えるかは未定（いまは数えない）。
5. スマホサイズの魔導書の古いテスト（p20t・p25t）は、画面下のバー（#mbar）がボタンに重なって失敗する。改名前の版でも同じ。実機で目次が押しにくくないか、オーナーに聞いてもよい。
6. `docs/release-checklist.md`（公開前に直すこと）と `docs/premium-plan.md`（無料サンプル版・有料版。有料版は保留）。

## 5. オーナーとのやりとりのコツ

- 開発者ではない。日本語・やさしい言葉で、結果と「何をすればいいか」を先に書く。
- 画像を送って「この見た目に」と頼まれることが多い。テーマは**画面の作りごと変える**のが好み（色だけでなく、配置・フォント・切りかえの動きまで）。
- SQL や設定が必要なときは、そのまま貼れる形とリンクを渡す。
- 返事は短めに、と頼まれることがある（ユーザー向けのお知らせ文など）。

## 6. 作業と確認のしかた

- 編集は `src/` だけ → `python3 build.py` → 生成物もいっしょに commit → `git push -u origin main`。
- コミットの最後に次の2行を付ける：
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01HJEQmTTefnuMkSFKU9yVTY`（新しいチャットではそのチャットの値）
- 動作確認は Playwright（`require('playwright')`、`chromium.launch()`）で `dist/ORBiS.html` を開く。Supabase のテストは偽物のサーバー（mock）を `addInitScript` で入れて、2人のユーザー（alice・bob）で流れを確かめていた。mock は一時フォルダにあったので新しいチャットでは作り直しになる。
- 公開サイト（github.io）にもこの環境から接続できる。
- 作業の最後に `docs/history.md` へ1〜2行追記し、Artifact も更新する。
