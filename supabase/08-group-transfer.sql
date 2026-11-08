-- ORBiS：グループの代表をゆずる（SQL Editor に全部貼り付けて Run。何度実行しても大丈夫）
-- エラーの言葉は短い英語の記号にして、アプリ側で日本語に直して表示する（コピーで文字化け・途中切れしにくくするため）
-- ログインしていない人（auth.uid() が空）は必ず止める。Supabase は新しい関数を anon にも使わせるので、anon からも外す。
create or replace function public.transfer_group(gid text, new_owner uuid) returns void
language plpgsql security definer set search_path = public as $f$
declare cur uuid;
begin
  if auth.uid() is null then raise exception 'not_owner'; end if;
  select owner into cur from groups where id = gid for update;
  if cur is null then raise exception 'not_found'; end if;
  if cur is distinct from auth.uid() then raise exception 'not_owner'; end if;
  if new_owner is null or new_owner = cur then raise exception 'bad_target'; end if;
  if not exists (select 1 from group_members where group_id = gid and user_id = new_owner and status = 'joined') then raise exception 'not_member'; end if;
  insert into group_members (group_id, user_id, status, role) values (gid, cur, 'joined', 'pl') on conflict (group_id, user_id) do update set status = 'joined';
  update groups set owner = new_owner, updated_at = now() where id = gid;
end $f$;
revoke all on function public.transfer_group(text, uuid) from public, anon;
grant execute on function public.transfer_group(text, uuid) to authenticated;
