-- ORBiS：サーバーに入るデータの大きさの上限（荒らしや、まちがいで大きなデータを入れられてサーバーがいっぱいになるのを防ぐ）。
-- SQL Editor に全部貼り付けて Run。何度実行しても大丈夫（18-char-images.sql を先に実行しておくこと）
-- ・キャラシ1人分：1MB まで（画像は char-images に分けたので、ふつうは 10KB くらい）。1人が持てるキャラは 60人まで（アプリは50人まで）
-- ・グループ1つ：200KB まで　・画面の編集（公開版・仮保存）：2MB まで
-- ・画面の編集で使う画像（ui-assets）：1枚 5MB まで、画像だけ
-- ・エラーの名前（ORBIS_…）はアプリが日本語のお知らせに直す（21-cloud.js の jaErr）
-- ・今ある大きなデータはそのまま（次に書きかえるときに確かめる）

-- キャラシ：大きさと人数
create or replace function public.chars_limits() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if octet_length(new.data::text) > 1048576 then
    raise exception 'ORBIS_CHAR_TOO_LARGE' using errcode = '22023';
  end if;
  if char_length(coalesce(new.name, '')) > 200 then new.name := left(new.name, 200); end if;
  if tg_op = 'INSERT'
     and not exists (select 1 from public.characters where id = new.id)
     and (select count(*) from public.characters where owner = new.owner) >= 60 then
    raise exception 'ORBIS_TOO_MANY_CHARS' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function public.chars_limits() from public, anon;
drop trigger if exists chars_limits on public.characters;
create trigger chars_limits before insert or update on public.characters
  for each row execute function public.chars_limits();

-- グループ・画面の編集：data の大きさ（上限のバイト数を引数で受け取る）
create or replace function public.data_size_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if octet_length(new.data::text) > tg_argv[0]::int then
    raise exception 'ORBIS_DATA_TOO_LARGE' using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function public.data_size_limit() from public, anon;
drop trigger if exists groups_size_limit on public.groups;
create trigger groups_size_limit before insert or update on public.groups
  for each row execute function public.data_size_limit('204800');
drop trigger if exists ui_layout_size_limit on public.ui_layout;
create trigger ui_layout_size_limit before insert or update on public.ui_layout
  for each row execute function public.data_size_limit('2097152');
drop trigger if exists ui_drafts_size_limit on public.ui_drafts;
create trigger ui_drafts_size_limit before insert or update on public.ui_drafts
  for each row execute function public.data_size_limit('2097152');

-- グループの参加者のキャラ名：200文字まで
alter table public.group_members drop constraint if exists group_members_char_name_len;
alter table public.group_members add constraint group_members_char_name_len
  check (char_name is null or char_length(char_name) <= 200) not valid;

-- 画面の編集で使う画像：1枚 5MB まで、画像だけ
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg', 'image/gif']
where id = 'ui-assets';
