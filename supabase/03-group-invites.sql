-- ============================================================
-- ORBiS：グループの「招待・参加」用の追加設定
-- Supabase の「SQL Editor」にこのファイルの中身を全部貼り付けて「Run」を押してください。
-- 何度実行しても大丈夫です。（01-setup.sql と 02-groups.sql を実行済みであることが前提です）
-- ============================================================

-- グループの参加者（招待中／参加中、キーパーか探索者か、使うキャラ）
create table if not exists public.group_members (
  group_id text not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'joined')),
  role text check (role in ('kp', 'pl')),
  char_id text,
  char_name text,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user on public.group_members (user_id);
alter table public.group_members enable row level security;

create or replace function public.is_group_member(gid text, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members m where m.group_id = gid and m.user_id = uid);
$$;
create or replace function public.group_owner(gid text) returns uuid
language sql stable security definer set search_path = public as $$
  select g.owner from public.groups g where g.id = gid;
$$;
create or replace function public.can_see_group(gid text, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.groups g
    where g.id = gid and (g.owner = uid or (not g.locked and public.is_friend(uid, g.owner)))
  ) or public.is_group_member(gid, uid);
$$;
grant execute on function public.is_group_member(text, uuid) to authenticated;
grant execute on function public.group_owner(text) to authenticated;
grant execute on function public.can_see_group(text, uuid) to authenticated;

-- グループ：代表者・参加者（招待中も含む）は非公開でも見える。フレンドは公開のものだけ
drop policy if exists "groups read" on public.groups;
create policy "groups read" on public.groups for select to authenticated
  using (owner = auth.uid() or public.is_group_member(id, auth.uid()) or (not locked and public.is_friend(auth.uid(), owner)));

-- 参加者の一覧：そのグループが見える人だけ
drop policy if exists "members read" on public.group_members;
create policy "members read" on public.group_members for select to authenticated
  using (public.can_see_group(group_id, auth.uid()));
-- 招待できるのは代表者だけ。招待先は代表者のフレンド（自分自身の参加登録も可）
drop policy if exists "members invite" on public.group_members;
create policy "members invite" on public.group_members for insert to authenticated
  with check (public.group_owner(group_id) = auth.uid() and (user_id = auth.uid() or (status = 'invited' and public.is_friend(auth.uid(), user_id))));
-- 参加・役割・キャラの変更は本人だけ
drop policy if exists "members update self" on public.group_members;
create policy "members update self" on public.group_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
-- 抜ける・断るのは本人、外すのは代表者
drop policy if exists "members remove" on public.group_members;
create policy "members remove" on public.group_members for delete to authenticated
  using (user_id = auth.uid() or public.group_owner(group_id) = auth.uid());
