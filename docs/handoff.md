# 引き継ぎメモ（新しいチャットで最初に読む）

最終更新：2026-11-12（公開前リストの 1〜9 を Claude 側はすべて終えたチャット）
前のチャットでやったこと・決まったこと・残っていることのまとめ。
細かい変更の一覧は `docs/history.md`、作業のルールは `CLAUDE.md` を見る。

---

## 1. いまの状態

- アプリ名：**ORBiS**（旧：キャラシ工房。2026-11-06 に改名）
- 公開URL：https://orbis-locus.github.io/ （GitHub Pages。`orbis-locus/orbis-locus.github.io` の main に push すると数分で反映）。前の住所 https://kanno-925.github.io/charasheet/ （`kanno-925/charasheet`）は引っ越しページ。これまでの履歴は前のリポジトリにある
- **公開サイトは無料サンプル版**（03-state.js の FREE_EDITION = true。テーマは ORBiS だけ・探索者3人まで・グループとフレンドのキャラシを見るのは鍵）。マスター・編集者・テスターは鍵なし。
- 1ファイル版：`dist/ORBiS.html`（ダブルクリックで動く。画像・音も中に入っている）。BOOTH では、これと `dist/はじめにお読みください.txt` を zip にまとめた `dist/ORBiS.zip` を配る（build.py が作る）。
- Claude の公開版（Artifact）：https://claude.ai/artifact/ULwQZd62EkbS88ZrvJv96v （`dist/claude-artifact.html` を公開。git には入れない）
- サーバー：Supabase（プロジェクト `umrouqvbmnttirdzixvc`）。SQL Editor：https://supabase.com/dashboard/project/umrouqvbmnttirdzixvc/sql/new
  - メール：ORBiS 用の Gmail（オーナーの ORBiS 用アカウント・アプリ パスワード。アドレスは公開のリポジトリには書かない）から SMTP で送る。新規登録の確認メールはオン（`/auth/v1/settings` の mailer_autoconfirm が false）。Site URL は https://orbis-locus.github.io/ 。手順は docs/mail-setup.md。Gmail の送信は1日500通くらいまで。
  - 無料プロジェクトが止まらないように、GitHub Actions が2日に1回見回る（`.github/workflows/keep-server-awake.yml`。2026-11-12 に手で1回動かして成功）。
- 共有リンクのカード：Cloudflare Workers の `orbis-share`（https://orbis-share.masakawwwww.workers.dev 、オーナーの Cloudflare アカウント）。`cloudflare/share-worker.js` を変えたら、オーナーに Cloudflare の「Edit code」で貼りかえて Deploy してもらう（自動では反映されない）。
- 保存データの内部の名前（`charasheet-kobo…`）とバックアップの `app: 'charasheet-kobo'` は**改名後も変えていない**（変えると今のデータが読めなくなる）。

## 2. Supabase の SQL（オーナーが SQL Editor で手で実行する）

**01〜21 はすべて実行済み**（2026-11-12 時点）。

| ファイル | 内容 | 実行 |
|---|---|---|
| 01〜06 | アカウント・フレンド・グループ・招待・編集モード・権限・仮保存 | 済み |
| 07-avatars.sql | アカウントのアイコン画像（profiles.avatar） | 済み |
| 08-group-transfer.sql | グループの代表をゆずる（transfer_group） | 済み |
| 09-dice-limit.sql | ダイスの上限（group_members.dice_limit / dice_reset） | 済み |
| 10-share.sql | キャラシの共有リンク（char_shares・get_shared_char。anon にも実行権） | 済み |
| 11-share-card.sql | 共有リンクのカード（get_share_card・Storage の share-og） | 済み |
| 12-char-secrets.sql | キャラシの秘匿欄（char_secrets・can_read_secret） | 済み |
| 13-secret-open.sql | 秘匿の「公開する／しない」（char_secrets.is_open） | 済み |
| 14-deleted-chars.sql | 削除したキャラが復活しないように（deleted_chars とトリガー） | 済み |
| 15-feature-wants.sql | 無料版の「欲しい！」の数（feature_wants・add_want は anon も可・want_counts はマスター/編集者） | 済み |
| 16-testers.sql | テスター（app_testers・am_unlocked） | 済み |
| 17-want-friendview.sql | 「欲しい！」に friendview を足す | 済み（2026-11-12 にオーナーが実行。こちらからは確かめられない） |
| 18-char-images.sql | 画像の置き場所 char-images（1枚5MB・1人100MB） | 済み |
| 19-limits.sql | 大きさの上限（キャラシ1MB・60人、グループ200KB、画面の編集2MB、ui-assets 5MB） | 済み |
| 20-reports.sql | 通報（reports・report_user・report_list・mod_action） | 済み |
| 21-contacts.sql | お問い合わせ（contacts・send_contact は anon も可・contact_list と contact_close はマスターだけ） | 済み（2026-11-12 に確認。オーナーがテストで送って一覧に出ることも確認） |

- SQL を渡すときの注意：オーナーがコピーで**途中で切れた**ことがある。日本語のコメントを外した英数字だけの版を渡し、「全部消してから貼る」「文字を選択していない状態で Run」と伝える。
- 新しいサーバー関数は Supabase が anon（ログインしていない人）にも実行権を付ける。`revoke ... from public, anon` と、関数の中で `auth.uid() is null` を止めることを必ず入れる。
- この作業環境から Supabase に接続できる。確認は publishable key で REST を呼ぶ（中身は見えない。関数や表があるか・anon で断られるかだけ確かめる）。
- この作業環境には PostgreSQL 16 がある（`/usr/lib/postgresql/16/bin`）。新しい SQL は、`/var/tmp` などに一時のデータベースを作り、auth.uid() などをまねして動きを確かめてから渡すとよい（21 はこれで確認した）。

## 3. 公開前リスト（docs/release-checklist.md）の進み具合

| | 内容 | 状態 |
|---|---|---|
| 1 | 権利表記・非公式の表記 | ✅ アプリの中に（探索者をえらぶ画面の下・「権利表記・このアプリについて」） |
| 2 | サーバー容量（画像を Storage に） | ✅ |
| 3 | 守り（XSS・大きさの上限） | ✅ |
| 4 | 荒らし対策（通報・マスターの対応） | ✅ |
| 5 | 無料版の制限と「欲しい！」 | ✅ |
| 6 | 利用規約・プライバシーポリシー・お問い合わせ | ✅ アプリの中に（modal-legal・36-legal.js）。お問い合わせはアプリの入力欄。**文はオーナーの確認待ち** |
| 7 | メールとサーバーの設定 | ✅（docs/mail-setup.md） |
| 8 | 動作確認 | Claude の自動の点検は ✅。**実機はオーナー待ち**（docs/device-check.md） |
| 9 | BOOTH で配る準備 | ✅ booth/（説明書・商品ページの文・画像）。**BOOTH への登録はオーナー** |

## 4. 残っていること・確認待ち

- **実機の確認（オーナー待ち）**：`docs/device-check.md`（iPhone・Android・パソコン・1ファイル版のログイン・共有リンクのカード）。おかしな所があれば、端末・テーマ・場所・様子を聞いて直す。
- **BOOTH への登録（オーナー）**：配るのは `dist/ORBiS.zip`（ORBiS.html と説明書を zip にしたもの。BOOTH は .html・.txt をそのまま置けない）。文と画像は `booth/商品ページ.md`・`booth/images/`。カテゴリと公開日はオーナーが決める。**BOOTH のページの URL が決まったら、説明書（booth/はじめにお読みください.txt）とアプリ（利用規約の第2条・お問い合わせなど）に「正しい手に入れ先」として書く。**
- **規約・プライバシーポリシーの文**：オーナーが読んで直したい所があれば直す（index.html の modal-legal。大事な変更をしたら日付も）。
- 【推奨】TRPGライツ事務局に「無料のキャラシ作成ツールを BOOTH で配ってよいか」確かめる（オーナー）。
- 【推奨】で残っているもの（release-checklist.md）：アカウントを自分で消せる機能（いまはお問い合わせ→オーナーが Supabase の Authentication → Users で消す）、ブロック、申請・招待の連打の上限、新規登録のボット対策（CAPTCHA）、ユーザー名の禁止語、RLS の見直し、パスワードの設定の確認、バックアップ、料金の目安、バックアップの書き出しを目立たせる、使い方の案内。
- **メインテーマ「ORBiS」**：オーナーの感想待ち（前から）。
- （古い）「なんか開けない」の報告：オーナーの返事待ちのまま。ログイン中だけ起きる不具合の可能性もある。
- 未定のこと：ダイスの上限で技能の判定も数えるか（いまは数えない）。オープニングでロゴ（`assets/brand/logo-full.webp`）を使う案。
- 有料版（プレミアム）：**保留中**（docs/premium-plan.md）。オーナーが作ると言うまで作らない。

## 5. このチャット（2026-11-12）でやったこと

- 利用規約・プライバシーポリシー・お問い合わせの小窓（3つのタブ）。新規登録は「同意します」のチェックが必要。
- お問い合わせ：Google フォームは Claude には作れないので、アプリの中の入力欄に（21-contacts.sql）。マスターはアカウントの小窓の「お問い合わせを見る」で一覧・メールで返事・対応済み。ログイン中に送られたものは登録メールが出る（アカウント削除の本人確認に使う）。
- メールの設定（オーナーと一緒に）：Supabase の標準のメールは運営チームにしか届かず1時間2通まで、と分かった → ORBiS 用 Gmail を SMTP に、日本語の文、**Site URL が前の住所のままだった**のを直した（メールのリンクが引っ越しページに行っていた）、Confirm email をオン。メールを送れないときは日本語のお知らせ（jaErr）。
- サーバーの見回り（GitHub Actions）。
- 動作確認：全テーマ×パソコン・iPhone・Android の大きさで自動の点検（エラー0）。魔導書のパソコンで、回る魔法陣の角が右にはみ出していたのを直した。1ファイル版からサーバーにつながることも確認。
- BOOTH で配る準備（booth/）。build.py が説明書を dist/ に BOM つき・CRLF で書き出す。

## 6. オーナーとのやりとりのコツ

- 開発者ではない。日本語・やさしい言葉で、結果と「何をすればいいか」を先に書く。
- **設定の作業は1ステップずつ**、リンク・押す場所・入れる値を表にして渡す（一度にたくさん書くと「よくわかんない」となる）。画面の画像を送ってもらって確かめながら進めるとよい。
- 画像を送って「この見た目に」と頼まれることが多い。テーマは**画面の作りごと変える**のが好み（色だけでなく、配置・フォント・切りかえの動きまで）。
- SQL や設定が必要なときは、そのまま貼れる形とリンクを渡す。
- パスワードやメールのリンク（合言葉が入っている）は、チャットに貼らないよう伝える。
- 「main に入れるか」はボタンで選べる質問（AskUserQuestion）で聞く。
- 返事は短めに、と頼まれることがある（ユーザー向けのお知らせ文など）。

## 7. 作業と確認のしかた

- 編集は `src/` だけ → `python3 build.py` → 生成物もいっしょに commit → push。チャットごとに決められた作業ブランチに push し、オーナーが「main に入れる」を選んだら `git push origin HEAD:main`。
- 別のチャット（同じリポジトリ）でも作業が進むことがある。push の前に `git fetch origin main` して、進んでいたら `git pull --rebase origin main`。
- コミットの最後に次の2行を付ける：
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: （そのチャットの値）`
- 動作確認は Playwright（`require('playwright')`、`chromium.launch()`）で `dist/ORBiS.html` を開く。
  - 中の関数を外から呼ぶには、一時フォルダに `dist/ORBiS.html` を写し、37-main.js の最後の行（`if (!$('intro')) document.documentElement.style.overflow = 'hidden';`）のあとに `window.__T = { state, openPanel, closePanel, applyTheme, renderAll, renderSelect, showSelect, openModal, closeModals, SECTIONS, setSel: v => { selTab = v; } };` を差しこんだテスト版を作る（公開するファイルは変えない）。
  - 全テーマを見るときは `localStorage` の `charasheet-kobo.unlock` を `'1'` に（無料版の鍵を外す）、`__T.state.themePreset` を変えて `applyTheme()`。
  - サーバーの返事をまねるときは `page.route('**/rest/v1/rpc/関数名', ...)`。
- 公開サイト（github.io）・GitHub の API（公開リポジトリの Actions の結果）にもこの環境から接続できる。
- 作業の最後に `docs/history.md` へ1〜2行追記する。
