-- ============================================================
-- ORBiS：画面の編集モード（マスターだけが編集でき、全員がその画面を見る）用の設定
-- Supabase の「SQL Editor」にこのファイルの中身を全部貼り付けて「Run」を押してください。
-- 何度実行しても大丈夫です。（01-setup.sql を実行済みであることが前提です）
-- ============================================================

-- マスター（画面を編集できる人）の一覧
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
drop policy if exists "admins read own" on public.app_admins;
create policy "admins read own" on public.app_admins for select to authenticated using (user_id = auth.uid());

-- ログイン中の人がマスターかどうか
create or replace function public.is_app_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;
grant execute on function public.is_app_admin() to anon, authenticated;

-- 公開中の画面の編集内容（1行だけ。id = 'main'）
create table if not exists public.ui_layout (
  id text primary key,
  data jsonb not null default '{"v":1,"items":{}}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
alter table public.ui_layout enable row level security;
-- だれでも（ログインしていなくても）読める
drop policy if exists "layout read" on public.ui_layout;
create policy "layout read" on public.ui_layout for select to anon, authenticated using (true);
-- 書きこめるのはマスターだけ
drop policy if exists "layout insert admin" on public.ui_layout;
create policy "layout insert admin" on public.ui_layout for insert to authenticated with check (public.is_app_admin());
drop policy if exists "layout update admin" on public.ui_layout;
create policy "layout update admin" on public.ui_layout for update to authenticated
  using (public.is_app_admin()) with check (public.is_app_admin());
insert into public.ui_layout (id) values ('main') on conflict (id) do nothing;

-- ===== マスターの登録 =====
-- 下の「ここにユーザー名」を、ORBiS での自分のユーザー名に書き換えてから実行してください（$$ は消さない）。
-- （書き換えずに実行しても何も起きないので大丈夫です）
insert into public.app_admins (user_id)
  select id from public.profiles where lower(username) = lower($$ここにユーザー名$$)
  on conflict (user_id) do nothing;
