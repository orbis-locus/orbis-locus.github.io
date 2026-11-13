-- ORBiS：ブロック。SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- （01-setup.sql・03-group-invites.sql・23-request-limits.sql を先に実行しておくこと）
-- ・ブロックすると：その人とのフレンドと申請を消す・その人のグループからの招待を消す
-- ・ブロックしたあと：相手からのフレンド申請は、こちらには見えない（相手の画面では「承認待ち」のまま。ブロックしたことは伝わりにくい）
--   相手のグループからの招待は届かない（そっと捨てる）
-- ・自分がブロックしている人には、申請・招待を送れない（ORBIS_YOU_BLOCKED。先に解除する）
-- ・一覧はブロックした本人だけが見られる（my_blocks）
create table if not exists public.user_blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index if not exists user_blocks_blocked on public.user_blocks (blocked);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;

-- a が b をブロックしているか（サーバーの中だけで使う。だれでも呼べると「自分がブロックされているか」が分かってしまうため）
create or replace function public.is_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks u where u.blocker = a and u.blocked = b);
$$;
revoke all on function public.is_blocked(uuid, uuid) from public, anon, authenticated;
-- 自分がその人をブロックしているか（フレンドの一覧の決まりで使う。自分のことしか分からない）
create or replace function public.blocked_by_me(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks u where u.blocker = auth.uid() and u.blocked = other);
$$;
revoke all on function public.blocked_by_me(uuid) from public, anon;
grant execute on function public.blocked_by_me(uuid) to authenticated;

-- ブロックする。返り値：'ok' / 'login' / 'self' / 'nouser' / 'toomany'
create or replace function public.block_user(target uuid) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return 'login'; end if;
  if target is null or target = uid then return 'self'; end if;
  if not exists (select 1 from public.profiles p where p.id = target) then return 'nouser'; end if;
  if (select count(*) from public.user_blocks where blocker = uid) >= 500 then return 'toomany'; end if;
  insert into public.user_blocks (blocker, blocked) values (uid, target) on conflict do nothing;
  delete from public.friendships where (requester = uid and addressee = target) or (requester = target and addressee = uid);
  delete from public.group_members m where m.user_id = uid and m.status = 'invited'
    and exists (select 1 from public.groups g where g.id = m.group_id and g.owner = target);
  return 'ok';
end $$;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- ブロックを解除する
create or replace function public.unblock_user(target uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return 'login'; end if;
  delete from public.user_blocks where blocker = auth.uid() and blocked = target;
  return 'ok';
end $$;
revoke all on function public.unblock_user(uuid) from public, anon;
grant execute on function public.unblock_user(uuid) to authenticated;

-- 自分がブロックしている人の一覧
create or replace function public.my_blocks()
returns table (user_id uuid, username text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select u.blocked, p.username, u.created_at
  from public.user_blocks u left join public.profiles p on p.id = u.blocked
  where u.blocker = auth.uid()
  order by u.created_at desc;
$$;
revoke all on function public.my_blocks() from public, anon;
grant execute on function public.my_blocks() to authenticated;

-- フレンドの一覧：ブロックしている人から届いた申請は、自分には見せない
drop policy if exists "friends read mine" on public.friendships;
create policy "friends read mine" on public.friendships for select to authenticated
  using (requester = auth.uid() or (addressee = auth.uid() and not public.blocked_by_me(requester)));

-- フレンド申請：自分がブロックしている人には送れない
create or replace function public.check_block_friend() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_blocked(new.requester, new.addressee) then raise exception 'ORBIS_YOU_BLOCKED'; end if;
  return new;
end $$;
revoke all on function public.check_block_friend() from public, anon;
drop trigger if exists check_block_friend on public.friendships;
create trigger check_block_friend before insert on public.friendships
  for each row execute function public.check_block_friend();

-- グループの招待：招待された人がブロックしている人からの招待は、そっと捨てる。自分がブロックしている人は招待できない
-- （名前の順で、23 の limit_group_invite より先に動く。捨てた招待は数えない）
create or replace function public.check_block_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid := coalesce(auth.uid(), new.invited_by);
begin
  if who is null or new.user_id = who then return new; end if;
  if public.is_blocked(new.user_id, who) then return null; end if;
  if public.is_blocked(who, new.user_id) then raise exception 'ORBIS_YOU_BLOCKED'; end if;
  return new;
end $$;
revoke all on function public.check_block_invite() from public, anon;
drop trigger if exists check_block_invite on public.group_members;
create trigger check_block_invite before insert on public.group_members
  for each row execute function public.check_block_invite();
