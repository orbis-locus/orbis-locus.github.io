-- ============================================================
-- キャラシ工房：キャラシの「秘匿」欄
--   秘匿はキャラシ本体（characters.data）とは別の表に入れる。
--   読めるのは、持ち主と、そのキャラで参加しているグループのキーパー（KP）だけ。
--   フレンドの閲覧・共有リンクには入らない。
-- Supabase の「SQL Editor」にこのファイルの中身を全部貼り付けて「Run」を押してください。
-- 何度実行しても大丈夫です。（01〜03 のSQLを実行済みであることが前提です）
-- ============================================================
create table if not exists public.char_secrets (
  char_id text primary key references public.characters(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now()
);
alter table public.char_secrets enable row level security;

-- このキャラの秘匿を、ログイン中の人が読めるか（持ち主か、そのキャラで参加しているグループのKP）
create or replace function public.can_read_secret(cid text, own uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    own = auth.uid() or exists (
      select 1 from public.group_members pl
      join public.group_members kp on kp.group_id = pl.group_id
      where pl.char_id = cid and pl.user_id = own and pl.status = 'joined'
        and kp.user_id = auth.uid() and kp.role = 'kp' and kp.status = 'joined'
    )
  );
$$;
revoke all on function public.can_read_secret(text, uuid) from public, anon;
grant execute on function public.can_read_secret(text, uuid) to authenticated;

drop policy if exists "secrets read" on public.char_secrets;
create policy "secrets read" on public.char_secrets for select to authenticated
  using (public.can_read_secret(char_id, owner));
drop policy if exists "secrets insert own" on public.char_secrets;
create policy "secrets insert own" on public.char_secrets for insert to authenticated
  with check (owner = auth.uid() and exists (select 1 from public.characters c where c.id = char_id and c.owner = auth.uid()));
drop policy if exists "secrets update own" on public.char_secrets;
create policy "secrets update own" on public.char_secrets for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "secrets delete own" on public.char_secrets;
create policy "secrets delete own" on public.char_secrets for delete to authenticated using (owner = auth.uid());
