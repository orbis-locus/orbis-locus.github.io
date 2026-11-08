-- ============================================================
-- ORBiS：グループ（シナリオ・KP・探索者の記録）用の追加設定
-- Supabase の「SQL Editor」にこのファイルの中身を全部貼り付けて「Run」を押してください。
-- 何度実行しても大丈夫です。（01-setup.sql を実行済みであることが前提です）
-- ============================================================
create table if not exists public.groups (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  locked boolean not null default false,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists groups_owner on public.groups (owner);
alter table public.groups enable row level security;

-- 自分のグループは全部、フレンドのグループは「非公開（ロック）でないもの」だけ見える
drop policy if exists "groups read" on public.groups;
create policy "groups read" on public.groups for select to authenticated
  using (owner = auth.uid() or (not locked and public.is_friend(auth.uid(), owner)));
drop policy if exists "groups insert own" on public.groups;
create policy "groups insert own" on public.groups for insert to authenticated with check (owner = auth.uid());
drop policy if exists "groups update own" on public.groups;
create policy "groups update own" on public.groups for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "groups delete own" on public.groups;
create policy "groups delete own" on public.groups for delete to authenticated using (owner = auth.uid());
