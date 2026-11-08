-- ============================================================
-- ORBiS：アカウント・フレンド・キャラシ共有用の設定
-- Supabase の「SQL Editor」にこのファイルの中身を全部貼り付けて「Run」を押してください。
-- 何度実行しても大丈夫です。
-- ============================================================

-- ユーザー名（ログインIDはメールアドレス、パスワードは Supabase が安全に管理します）
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null check (char_length(username) between 2 and 20),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));

-- キャラシ本体（locked = true のものはフレンドから見えない）
create table if not exists public.characters (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null default '',
  locked boolean not null default false,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists characters_owner on public.characters (owner);

-- フレンド（申請 → 相手が承認するとフレンド）
create table if not exists public.friendships (
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- 2人がフレンドかどうか
create or replace function public.is_friend(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendships f
    where f.status = 'accepted'
      and ((f.requester = a and f.addressee = b) or (f.requester = b and f.addressee = a))
  );
$$;

-- 新規登録の前に、ユーザー名が空いているか確かめる
create or replace function public.username_available(name text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles p where lower(p.username) = lower(trim(name)));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- 登録したら自動でユーザー名を保存する
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data->>'username'), ''), 'user_' || left(new.id::text, 8)));
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== 見える範囲のルール（サーバー側で強制） =====
alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.friendships enable row level security;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select to authenticated using (true);
drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- 自分のキャラシは全部、フレンドのキャラシは「非公開（ロック）でないもの」だけ見える
drop policy if exists "chars read" on public.characters;
create policy "chars read" on public.characters for select to authenticated
  using (owner = auth.uid() or (not locked and public.is_friend(auth.uid(), owner)));
drop policy if exists "chars insert own" on public.characters;
create policy "chars insert own" on public.characters for insert to authenticated with check (owner = auth.uid());
drop policy if exists "chars update own" on public.characters;
create policy "chars update own" on public.characters for update to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "chars delete own" on public.characters;
create policy "chars delete own" on public.characters for delete to authenticated using (owner = auth.uid());

drop policy if exists "friends read mine" on public.friendships;
create policy "friends read mine" on public.friendships for select to authenticated
  using (requester = auth.uid() or addressee = auth.uid());
drop policy if exists "friends request" on public.friendships;
create policy "friends request" on public.friendships for insert to authenticated
  with check (requester = auth.uid() and status = 'pending');
drop policy if exists "friends accept" on public.friendships;
create policy "friends accept" on public.friendships for update to authenticated
  using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
drop policy if exists "friends remove" on public.friendships;
create policy "friends remove" on public.friendships for delete to authenticated
  using (requester = auth.uid() or addressee = auth.uid());

-- ===== グループ =====
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
