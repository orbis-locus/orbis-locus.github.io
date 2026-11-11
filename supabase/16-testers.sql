-- ORBiS：テスター（無料版の鍵なしで全部使える人。画面の編集の権限は付かない）。SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- （05-app-roles.sql を先に実行しておくこと）
-- ・テスターは app_admins とは別の表 app_testers に入れる（編集・公開・「欲しい！」の数には関係しない）
-- ・マスターが編集パネルの「権限」タブで「テスター」を選べる
create table if not exists public.app_testers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_by uuid,
  created_at timestamptz not null default now()
);
alter table public.app_testers enable row level security;
revoke all on public.app_testers from public, anon, authenticated;

-- 自分が鍵なしで使えるか（マスター・編集者・テスター）
create or replace function public.am_unlocked() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from public.app_admins a where a.user_id = auth.uid())
    or exists (select 1 from public.app_testers t where t.user_id = auth.uid()));
$$;
revoke all on function public.am_unlocked() from public, anon;
grant execute on function public.am_unlocked() to authenticated;

-- 全員のユーザー名と権限の一覧（マスターだけ）。テスターは 'tester'
create or replace function public.app_users_list()
returns table (user_id uuid, username text, role text)
language sql stable security definer set search_path = public as $$
  select x.id, x.username, x.role from (
    select p.id, p.username, coalesce(a.role, case when t.user_id is not null then 'tester' end) as role
    from public.profiles p
    left join public.app_admins a on a.user_id = p.id
    left join public.app_testers t on t.user_id = p.id
    where public.is_app_master()
  ) x
  order by case x.role when 'master' then 0 when 'editor' then 1 when 'tester' then 2 else 3 end, lower(x.username);
$$;
grant execute on function public.app_users_list() to authenticated;

-- 権限を変える（マスターだけ）。new_role は 'master' / 'editor' / 'tester' / 'none'
create or replace function public.set_app_role(target uuid, new_role text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_master() then return 'マスターだけが権限を変えられます'; end if;
  if new_role not in ('master', 'editor', 'tester', 'none') then return '権限の種類が正しくありません'; end if;
  if new_role <> 'master'
     and exists (select 1 from public.app_admins where user_id = target and role = 'master')
     and (select count(*) from public.app_admins where role = 'master') <= 1 then
    return 'マスターが1人もいなくなるので変えられません';
  end if;
  if new_role in ('master', 'editor') then
    insert into public.app_admins (user_id, role) values (target, new_role)
      on conflict (user_id) do update set role = excluded.role;
    delete from public.app_testers where user_id = target;
  else
    delete from public.app_admins where user_id = target;
    if new_role = 'tester' then
      insert into public.app_testers (user_id, added_by) values (target, auth.uid()) on conflict (user_id) do nothing;
    else
      delete from public.app_testers where user_id = target;
    end if;
  end if;
  return 'ok';
end;
$$;
grant execute on function public.set_app_role(uuid, text) to authenticated;
