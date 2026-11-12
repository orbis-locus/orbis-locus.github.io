-- ORBiS：荒らし対策（通報と、マスターの対応）。SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- （05-app-roles.sql・07-avatars.sql を先に実行しておくこと）
-- ・ログインした人が、ほかの人のユーザー名・アイコン・グループの名前を通報できる（report_user。1日20件まで、同じ内容は1回だけ）
-- ・通報の一覧を見られるのはマスターだけ（report_list）。通報した人の名前は、相手には伝わらない
-- ・マスターの対応（mod_action）：名前をリセット（user_ランダム）・アイコンを消す・グループの名前を消す・問題なしで閉じる
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null,
  target uuid not null,
  kind text not null check (kind in ('username', 'avatar', 'group', 'other')),
  ref text,
  note text not null default '' check (char_length(note) <= 500),
  snap_name text,
  status text not null default 'open' check (status in ('open', 'done')),
  action text,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create unique index if not exists reports_once on public.reports (reporter, target, kind, coalesce(ref, '')) where status = 'open';
create index if not exists reports_open on public.reports (created_at) where status = 'open';
alter table public.reports enable row level security;
revoke all on public.reports from public, anon, authenticated;

-- 通報する。返り値：'ok' / 'login' / 'self' / 'kind' / 'nouser' / 'nogroup' / 'toomany'
create or replace function public.report_user(target uuid, kind text, ref text, note text) returns text
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if auth.uid() is null then return 'login'; end if;
  if target is null or target = auth.uid() then return 'self'; end if;
  if kind is null or kind not in ('username', 'avatar', 'group', 'other') then return 'kind'; end if;
  select p.username into nm from public.profiles p where p.id = target;
  if nm is null then return 'nouser'; end if;
  if kind = 'group' then
    select g.data->>'name' into nm from public.groups g where g.id = ref and g.owner = target;
    if not found then return 'nogroup'; end if;
  else
    ref := null;
  end if;
  if (select count(*) from public.reports r where r.reporter = auth.uid() and r.created_at > now() - interval '1 day') >= 20 then
    return 'toomany';
  end if;
  insert into public.reports (reporter, target, kind, ref, note, snap_name)
  values (auth.uid(), target, kind, ref, left(coalesce(note, ''), 500), left(coalesce(nm, ''), 200))
  on conflict do nothing;
  return 'ok';
end $$;
revoke all on function public.report_user(uuid, text, text, text) from public, anon;
grant execute on function public.report_user(uuid, text, text, text) to authenticated;

-- まだ対応していない通報の一覧（マスターだけ）
create or replace function public.report_list()
returns table (id uuid, created_at timestamptz, kind text, ref text, note text, snap_name text,
               target uuid, target_name text, target_avatar text, reporter_name text, group_name text)
language sql stable security definer set search_path = public as $$
  select r.id, r.created_at, r.kind, r.ref, r.note, r.snap_name,
         r.target, tp.username, tp.avatar, rp.username, g.data->>'name'
  from public.reports r
  left join public.profiles tp on tp.id = r.target
  left join public.profiles rp on rp.id = r.reporter
  left join public.groups g on g.id = r.ref and r.kind = 'group'
  where r.status = 'open' and public.is_app_master()
  order by r.created_at desc
  limit 200;
$$;
revoke all on function public.report_list() from public, anon;
grant execute on function public.report_list() to authenticated;

-- マスターの対応。act：'reset_name' / 'clear_avatar' / 'rename_group' / 'dismiss'。同じ相手・同じ内容の通報はまとめて閉じる
create or replace function public.mod_action(report_id uuid, act text) returns text
language plpgsql security definer set search_path = public as $$
declare r public.reports;
begin
  if not public.is_app_master() then return 'only master'; end if;
  if act is null or act not in ('reset_name', 'clear_avatar', 'rename_group', 'dismiss') then return 'bad action'; end if;
  select * into r from public.reports where id = report_id;
  if not found then return 'not found'; end if;
  if act = 'reset_name' then
    update public.profiles set username = 'user_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10) where id = r.target;
  elsif act = 'clear_avatar' then
    update public.profiles set avatar = null where id = r.target;
  elsif act = 'rename_group' then
    update public.groups set data = jsonb_set(data, '{name}', to_jsonb('（名前を消しました）'::text)) where id = r.ref and owner = r.target;
  end if;
  update public.reports set status = 'done', action = act, closed_at = now()
  where status = 'open' and target = r.target and kind = r.kind and coalesce(ref, '') = coalesce(r.ref, '');
  return 'ok';
end $$;
revoke all on function public.mod_action(uuid, text) from public, anon;
grant execute on function public.mod_action(uuid, text) to authenticated;
