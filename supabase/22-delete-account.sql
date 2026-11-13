-- ORBiS：アカウントを自分で消す（アカウントの小窓の「アカウントを削除」から）。SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- （05-app-roles.sql・14-deleted-chars.sql・20-reports.sql・21-contacts.sql を先に実行しておくこと）
-- ・消えるもの：アカウント（ログイン）・ユーザー名とアイコン・キャラシ・秘匿・共有リンク・フレンド・自分が代表のグループ・参加しているグループの記録
--   （auth.users を消すと、つながっている表は自動で消える。on delete cascade）
-- ・画像（char-images）と共有カード（share-og）は、アプリがこの関数を呼ぶ前に Storage から消す（SQL からは消せないため）
-- ・お問い合わせと「欲しい！」は、だれが送ったかだけ消して、中身と数は残す
-- ・マスターが1人しかいないときは、そのマスターは消せない（だれも管理できなくなるため）
-- check_only = true のときは、消してよいかだけ確かめる（何も消さない）。アプリは先にこれを呼び、OK なら画像を消してから本番を呼ぶ
-- 返り値：'ok' / 'login'（ログインしていない） / 'last_master'（最後のマスター）
drop function if exists public.delete_my_account();   -- 引数なしの古い形があれば消す（同じ名前が2つあると呼び分けられないため）
create or replace function public.delete_my_account(check_only boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return 'login'; end if;
  if public.is_app_master() and (select count(*) from public.app_admins a where a.role = 'master') <= 1 then
    return 'last_master';
  end if;
  if check_only then return 'ok'; end if;
  delete from public.characters where owner = uid;
  delete from public.deleted_chars where owner = uid;   -- キャラを消すと増える「削除したしるし」も要らない
  delete from public.reports where reporter = uid or target = uid;
  update public.contacts set user_id = null, user_name = null where user_id = uid;
  update public.feature_wants set user_id = null where user_id = uid;
  delete from auth.users where id = uid;
  return 'ok';
end $$;
revoke all on function public.delete_my_account(boolean) from public, anon;
grant execute on function public.delete_my_account(boolean) to authenticated;
