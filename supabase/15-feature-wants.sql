-- ORBiS：無料版の「欲しい！」ボタンの数を数える。SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- ・1人（ログインしていない人は1つの端末）1機能1回だけ数える
-- ・ログインしていない人も押せるので、add_want だけは anon にも実行権を付ける（中で機能の名前と長さを確かめる）
-- ・数を見られるのはマスター・編集者だけ（want_counts）
create table if not exists public.feature_wants (
  feature text not null,
  voter text not null,
  user_id uuid,
  created_at timestamptz not null default now(),
  primary key (feature, voter)
);
alter table public.feature_wants enable row level security;
revoke all on public.feature_wants from public, anon, authenticated;

create or replace function public.add_want(f text, v text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if f is null or f !~ '^(group|chars|theme:(sky|sakura|book|aqua|dot))$' then return; end if;
  if auth.uid() is not null then v := auth.uid()::text; end if;
  if v is null or length(v) < 8 or length(v) > 64 then return; end if;
  insert into public.feature_wants (feature, voter, user_id) values (f, v, auth.uid())
  on conflict do nothing;
end $$;
revoke all on function public.add_want(text, text) from public;
grant execute on function public.add_want(text, text) to anon, authenticated;

create or replace function public.want_counts() returns table (feature text, n bigint)
language sql stable security definer set search_path = public as $$
  select w.feature, count(*) from public.feature_wants w
  where exists (select 1 from public.app_admins a where a.user_id = auth.uid())
  group by w.feature;
$$;
revoke all on function public.want_counts() from public, anon;
grant execute on function public.want_counts() to authenticated;
