-- ============================================================
-- ORBiS：権限（マスター・編集者）用の設定
--   マスター … 画面を編集できる ＋ みんなの権限を変えられる
--   編集者   … 画面を編集できる
-- Supabase の「SQL Editor」にこのファイルの中身を全部貼り付けて「Run」を押してください。
-- 何度実行しても大丈夫です。（04-ui-layout.sql を実行済みであることが前提です）
-- いま app_admins に登録されている人は、マスターになります。
-- ============================================================

alter table public.app_admins add column if not exists role text;
update public.app_admins set role = 'master' where role is null;
alter table public.app_admins alter column role set default 'editor';
alter table public.app_admins alter column role set not null;
alter table public.app_admins drop constraint if exists app_admins_role_check;
alter table public.app_admins add constraint app_admins_role_check check (role in ('master', 'editor'));

-- 自分の権限（'master' / 'editor' / なしなら null）
create or replace function public.my_app_role() returns text
language sql stable security definer set search_path = public as $$
  select a.role from public.app_admins a where a.user_id = auth.uid();
$$;
create or replace function public.is_app_master() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid() and a.role = 'master');
$$;
grant execute on function public.my_app_role() to anon, authenticated;
grant execute on function public.is_app_master() to anon, authenticated;

-- 全員のユーザー名と権限の一覧（マスターだけが見られる）
create or replace function public.app_users_list()
returns table (user_id uuid, username text, role text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, a.role
  from public.profiles p left join public.app_admins a on a.user_id = p.id
  where public.is_app_master()
  order by (a.role is null), a.role desc, lower(p.username);
$$;
grant execute on function public.app_users_list() to authenticated;

-- 権限を変える（マスターだけ）。new_role は 'master' / 'editor' / 'none'
create or replace function public.set_app_role(target uuid, new_role text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_master() then return 'マスターだけが権限を変えられます'; end if;
  if new_role not in ('master', 'editor', 'none') then return '権限の種類が正しくありません'; end if;
  -- マスターが1人もいなくなるのを防ぐ
  if new_role <> 'master'
     and exists (select 1 from public.app_admins where user_id = target and role = 'master')
     and (select count(*) from public.app_admins where role = 'master') <= 1 then
    return 'マスターが1人もいなくなるので変えられません';
  end if;
  if new_role = 'none' then
    delete from public.app_admins where user_id = target;
  else
    insert into public.app_admins (user_id, role) values (target, new_role)
      on conflict (user_id) do update set role = excluded.role;
  end if;
  return 'ok';
end;
$$;
grant execute on function public.set_app_role(uuid, text) to authenticated;
