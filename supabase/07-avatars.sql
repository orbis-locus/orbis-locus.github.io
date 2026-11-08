-- ============================================================
-- ORBiS：ユーザーのアイコン画像（アカウント画面で設定 → フレンドやグループの人に見える）
-- Supabase の「SQL Editor」にこのファイルの中身を全部貼り付けて「Run」を押してください。
-- 何度実行しても大丈夫です。
-- ============================================================

-- 画像は小さな正方形（160×160くらい）にしてから、文字（data URL）として保存します。
alter table public.profiles add column if not exists avatar text;

-- 画像以外のものや、大きすぎるデータは入れられないようにする
alter table public.profiles drop constraint if exists profiles_avatar_ok;
alter table public.profiles add constraint profiles_avatar_ok check (
  avatar is null
  or (char_length(avatar) <= 80000 and avatar ~ '^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$')
);

-- 読み取り（ログインしている人は誰でも見える）と、自分の行だけ書きかえられるルールは 01-setup.sql のまま使います。
