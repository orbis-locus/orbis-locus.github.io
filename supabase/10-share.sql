-- ORBiS：キャラシをリンクで共有する。SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- char_shares に「合言葉（token）→ キャラ」を入れる。合言葉はサーバーが作る（32文字のランダム）。
-- 見る人はログインしていなくてもよい。get_shared_char に合言葉を渡したときだけ、そのキャラ1人分が返る（一覧は見えない）
create table if not exists public.char_shares (
  token text primary key default replace(gen_random_uuid()::text, '-', ''),
  char_id text not null unique references public.characters(id) on delete cascade,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint char_shares_token_ok check (token ~ '^[0-9a-f]{32}$')
);
alter table public.char_shares enable row level security;

drop policy if exists "shares read own" on public.char_shares;
create policy "shares read own" on public.char_shares for select to authenticated using (owner = auth.uid());
drop policy if exists "shares insert own" on public.char_shares;
create policy "shares insert own" on public.char_shares for insert to authenticated
  with check (owner = auth.uid() and exists (select 1 from public.characters c where c.id = char_id and c.owner = auth.uid()));
drop policy if exists "shares delete own" on public.char_shares;
create policy "shares delete own" on public.char_shares for delete to authenticated using (owner = auth.uid());

create or replace function public.get_shared_char(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('data', c.data, 'owner', p.username, 'updated_at', c.updated_at)
  from public.char_shares s
  join public.characters c on c.id = s.char_id and c.owner = s.owner
  left join public.profiles p on p.id = s.owner
  where s.token = t;
$$;
revoke all on function public.get_shared_char(text) from public;
grant execute on function public.get_shared_char(text) to anon, authenticated;
