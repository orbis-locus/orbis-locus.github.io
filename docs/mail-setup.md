# メールとサーバーの設定（オーナーの作業）

2026-11-12 作成。公開前リストの 7。上から順にやる。

## いまの状態（2026-11-12 に確認）
- 新規登録は「確認メールなし」（Confirm email がオフ）。だれでもすぐ登録できるが、他人のメールアドレスや打ちまちがいでも登録できてしまう。
- Supabase の標準のメールは、**運営チームのアドレスにしか送れない・1時間2通まで**。ふつうの利用者が「パスワードを忘れたとき」を押しても、メールは届かない。
- → 自分のメールの送り口（SMTP）を Supabase に設定すれば、だれにでも届くようになる。独自ドメインがないので、**ORBiS 用の Gmail から送る**形にする（1日500通くらいまで。小さなアプリなら足りる）。

## 1. ORBiS 用の Gmail を用意する
- お問い合わせのお返事にも使えるので、本名でない「ORBiS 用」のアカウントがおすすめ。
- そのアカウントで「2段階認証」をオンにする：https://myaccount.google.com/signinoptions/two-step-verification
- 「アプリ パスワード」を作る：https://myaccount.google.com/apppasswords （名前は「Supabase」など）。16文字のパスワードが出る。
  - **このパスワードはチャットに貼らない**。次の 2 で Supabase に入れるだけ。

## 2. Supabase にメールの送り口を入れる
Authentication → Emails → SMTP Settings（https://supabase.com/dashboard/project/umrouqvbmnttirdzixvc/auth/smtp ）
- Enable custom SMTP：オン
- Sender email：ORBiS 用の Gmail のアドレス
- Sender name：ORBiS
- Host：smtp.gmail.com
- Port：465
- Username：ORBiS 用の Gmail のアドレス
- Password：1 で作ったアプリ パスワード（空白は入れない）
- Save

## 3. メールの文を日本語にする
Authentication → Emails → Templates（https://supabase.com/dashboard/project/umrouqvbmnttirdzixvc/auth/templates ）

**Confirm signup**
- Subject：`【ORBiS】メールアドレスの確認`
- Body：
```html
<h2>ORBiS へようこそ</h2>
<p>ORBiS にアカウントを登録していただき、ありがとうございます。</p>
<p>下のリンクを押して、メールアドレスの確認を終えてください。</p>
<p><a href="{{ .ConfirmationURL }}">メールアドレスを確認する</a></p>
<p>このメールに心当たりがないときは、何もせずに削除してください。</p>
<p>ORBiS（クトゥルフ神話TRPG のキャラクターシート作成ツール・非公式）</p>
```

**Reset password**（Reset Password / Recovery）
- Subject：`【ORBiS】パスワードの再設定`
- Body：
```html
<h2>パスワードの再設定</h2>
<p>ORBiS のパスワードを変えるためのメールです。</p>
<p>下のリンクを押すと、新しいパスワードを決める画面が開きます。</p>
<p><a href="{{ .ConfirmationURL }}">新しいパスワードを決める</a></p>
<p>パスワードの再設定をしていないときは、何もせずに削除してください。パスワードは変わりません。</p>
<p>ORBiS（クトゥルフ神話TRPG のキャラクターシート作成ツール・非公式）</p>
```

## 4. 届くか試す
- 公開サイトで、ログイン → 「パスワードを忘れたとき」に自分のアドレスを入れて送る。
- メールが届く・差出人が ORBiS・リンクを押すと https://orbis-locus.github.io/ で「新しいパスワードを決めてください」が出る、を確かめる。
- 届かない・「メールを送れませんでした」と出るときは、2 の入力（とくにアプリ パスワード）を見直す。

## 5. 新規登録の確認メールをオンにする（4 で届いたあとだけ）
Authentication → Sign In / Providers → Email（https://supabase.com/dashboard/project/umrouqvbmnttirdzixvc/auth/providers ）
- 「Confirm email」をオン → Save
- 試す：ふだんと別のメールアドレスで新規登録 → 「確認メールを送りました」と出る → メールのリンクを押す → ログインできる。
- **2〜4 が終わる前にオンにしないこと**（だれも登録できなくなる）。
- いま登録している人は、そのまま使える（確認済みのあつかい）。

## 6. 住所の設定を確かめる
Authentication → URL Configuration（https://supabase.com/dashboard/project/umrouqvbmnttirdzixvc/auth/url-configuration ）
- Site URL：`https://orbis-locus.github.io/`
- Redirect URLs：`https://orbis-locus.github.io/**` が入っている

## 7. サーバーが止まったとき
- 無料のプロジェクトは、7日ほど使われないと止まる。止まる約1週間前と、止まったあとに Supabase からメールが来る（Supabase に登録したアドレスあて）。
- 止まらないように、GitHub が2日に1回サーバーを見回る（`.github/workflows/keep-server-awake.yml`）。GitHub のリポジトリの「Actions」で動いているか見られる。
- それでも止まったら：Supabase のダッシュボードでプロジェクトを選び「Resume project」→ 確認。データと設定は元のまま戻る（止まってから1年以内）。
- 止まっているあいだも、アプリはこの端末の中だけで使える（ログイン・フレンド・クラウド保存・共有リンクは使えない）。
