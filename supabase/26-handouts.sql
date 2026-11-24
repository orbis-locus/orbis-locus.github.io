-- ORBiS：グループの「ハンドアウト」（KPと探索者の、1通ずつの手紙）。SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- （03-group-invites.sql を先に実行しておくこと）
-- ・KP → 探索者（ひとり宛て、または探索者みんな宛て）
-- ・探索者 → KP（ひとり宛て）
-- ・読めるのは、送った人と受け取った人（みんな宛ては、そのグループに参加している人）だけ。ココフォリアには出ない
-- ・送った人は、あとから書き直したり取り消したりできる（書き直すと、相手には「新着」にもどる）
-- ・ひとり宛ては、読まれたかどうか（既読）が送った人に見える。みんな宛ては既読を数えない
-- ・1人が1つのグループで送れるのは100通まで（ORBIS_HANDOUT_LIMIT）
create table if not exists public.group_handouts (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references public.groups(id) on delete cascade,
  from_user uuid not null default auth.uid() references auth.users(id) on delete cascade,
  to_user uuid references auth.users(id) on delete cascade,   -- null ＝ 探索者みんな宛て（KPだけが送れる）
  title text not null default '' check (char_length(title) <= 100),
  body text not null default '' check (char_length(body) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists group_handouts_group on public.group_handouts (group_id, created_at desc);
create index if not exists group_handouts_to on public.group_handouts (to_user);
alter table public.group_handouts enable row level security;

-- 使える操作をしぼる（書きかえられるのは題名と本文だけ。既読は下の関数だけが書く）
revoke all on public.group_handouts from public, anon, authenticated;
grant select, insert, delete on public.group_handouts to authenticated;
grant update (title, body, updated_at) on public.group_handouts to authenticated;

-- そのグループに「参加中」で、役割が role（'kp' か 'pl'）か
create or replace function public.is_group_role(gid text, uid uuid, r text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members m
    where m.group_id = gid and m.user_id = uid and m.status = 'joined' and m.role = r);
$$;
revoke all on function public.is_group_role(text, uuid, text) from public, anon;
grant execute on function public.is_group_role(text, uuid, text) to authenticated;
create or replace function public.is_group_joined(gid text, uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members m
    where m.group_id = gid and m.user_id = uid and m.status = 'joined');
$$;
revoke all on function public.is_group_joined(text, uuid) from public, anon;
grant execute on function public.is_group_joined(text, uuid) to authenticated;

drop policy if exists "handouts read" on public.group_handouts;
create policy "handouts read" on public.group_handouts for select to authenticated
  using (
    public.is_group_joined(group_id, auth.uid())
    and (from_user = auth.uid() or to_user = auth.uid() or to_user is null)
  );
drop policy if exists "handouts send" on public.group_handouts;
create policy "handouts send" on public.group_handouts for insert to authenticated
  with check (
    from_user = auth.uid() and read_at is null and (
      (public.is_group_role(group_id, auth.uid(), 'kp') and (to_user is null or public.is_group_role(group_id, to_user, 'pl')))
      or (public.is_group_role(group_id, auth.uid(), 'pl') and to_user is not null and public.is_group_role(group_id, to_user, 'kp'))
    )
  );
drop policy if exists "handouts edit own" on public.group_handouts;
create policy "handouts edit own" on public.group_handouts for update to authenticated
  using (from_user = auth.uid() and public.is_group_joined(group_id, auth.uid()))
  with check (from_user = auth.uid());
drop policy if exists "handouts delete own" on public.group_handouts;
create policy "handouts delete own" on public.group_handouts for delete to authenticated
  using (from_user = auth.uid());

-- 送れる数の上限（1人・1グループで100通）
create or replace function public.handout_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.group_handouts h where h.group_id = new.group_id and h.from_user = new.from_user) >= 100 then
    raise exception 'ORBIS_HANDOUT_LIMIT';
  end if;
  return new;
end $$;
drop trigger if exists handout_limit_t on public.group_handouts;
create trigger handout_limit_t before insert on public.group_handouts for each row execute function public.handout_limit();

-- 書き直したら、相手には未読（新着）にもどす
create or replace function public.handout_touch() returns trigger
language plpgsql as $$
begin
  if new.title is distinct from old.title or new.body is distinct from old.body then
    new.read_at := null;
    new.updated_at := now();
  end if;
  return new;
end $$;
drop trigger if exists handout_touch_t on public.group_handouts;
create trigger handout_touch_t before update on public.group_handouts for each row execute function public.handout_touch();

-- 読んだしるしをつける（ひとり宛ての受け取った人だけ）
create or replace function public.mark_handout_read(hid uuid) returns void
language sql security definer set search_path = public as $$
  update public.group_handouts h set read_at = now()
  where h.id = hid and h.to_user = auth.uid() and h.read_at is null
    and public.is_group_joined(h.group_id, auth.uid());
$$;
revoke all on function public.mark_handout_read(uuid) from public, anon;
grant execute on function public.mark_handout_read(uuid) to authenticated;
