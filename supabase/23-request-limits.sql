-- ORBiS：フレンド申請・グループ招待の連打を止める。SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- （01-setup.sql・03-group-invites.sql を先に実行しておくこと）
-- ・フレンド申請：1人1日30件まで、同じ相手へは1日3回まで（断られて送り直す分もふくむ）
-- ・グループ招待：1人1日60人まで、同じ人を同じグループへは1日3回まで
-- ・申請や招待を消しても数えられるように、送った記録（だれが・だれに・いつ）を別の表に7日だけ残す（だれも読めない）
-- ・上限をこえたら ORBIS_… というエラーで断る（アプリが日本語のお知らせにする）
create table if not exists public.request_log (
  kind text not null check (kind in ('friend', 'invite')),
  sender uuid not null,
  target text not null,
  created_at timestamptz not null default now()
);
create index if not exists request_log_sender on public.request_log (sender, kind, created_at);
alter table public.request_log enable row level security;
revoke all on public.request_log from public, anon, authenticated;

-- フレンド申請を送る前に数える
create or replace function public.limit_friend_request() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.request_log where sender = new.requester and created_at < now() - interval '7 days';
  if (select count(*) from public.request_log l where l.sender = new.requester and l.kind = 'friend' and l.created_at > now() - interval '1 day') >= 30 then
    raise exception 'ORBIS_FRIEND_LIMIT';
  end if;
  if (select count(*) from public.request_log l where l.sender = new.requester and l.kind = 'friend' and l.target = new.addressee::text and l.created_at > now() - interval '1 day') >= 3 then
    raise exception 'ORBIS_FRIEND_SAME';
  end if;
  insert into public.request_log (kind, sender, target) values ('friend', new.requester, new.addressee::text);
  return new;
end $$;
revoke all on function public.limit_friend_request() from public, anon;
drop trigger if exists limit_friend_request on public.friendships;
create trigger limit_friend_request before insert on public.friendships
  for each row execute function public.limit_friend_request();

-- グループに招待する前に数える（自分が参加する行は数えない）
create or replace function public.limit_group_invite() returns trigger
language plpgsql security definer set search_path = public as $$
declare who uuid := coalesce(auth.uid(), new.invited_by);
begin
  if who is null or new.user_id = who then return new; end if;
  delete from public.request_log where sender = who and created_at < now() - interval '7 days';
  if (select count(*) from public.request_log l where l.sender = who and l.kind = 'invite' and l.created_at > now() - interval '1 day') >= 60 then
    raise exception 'ORBIS_INVITE_LIMIT';
  end if;
  if (select count(*) from public.request_log l where l.sender = who and l.kind = 'invite' and l.target = new.group_id || ':' || new.user_id::text and l.created_at > now() - interval '1 day') >= 3 then
    raise exception 'ORBIS_INVITE_SAME';
  end if;
  insert into public.request_log (kind, sender, target) values ('invite', who, new.group_id || ':' || new.user_id::text);
  return new;
end $$;
revoke all on function public.limit_group_invite() from public, anon;
drop trigger if exists limit_group_invite on public.group_members;
create trigger limit_group_invite before insert on public.group_members
  for each row execute function public.limit_group_invite();
