-- ORBiS：削除したキャラが、ほかの端末から復活しないようにする。SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- ・キャラを削除すると「削除したしるし」（deleted_chars）が自動で残る
-- ・古いデータを持った端末が、削除したあとのキャラを送ってきても、サーバーは受け取らない（削除より新しく書きかえたものだけ受け取る）
-- ・アプリはこのしるしを見て、その端末からも削除したキャラを片付ける
create table if not exists public.deleted_chars (
  id text primary key,
  owner uuid not null,
  deleted_at timestamptz not null default now()
);
create index if not exists deleted_chars_owner on public.deleted_chars (owner);
alter table public.deleted_chars enable row level security;
drop policy if exists "deleted read own" on public.deleted_chars;
create policy "deleted read own" on public.deleted_chars for select to authenticated using (owner = auth.uid());
revoke all on public.deleted_chars from public, anon;
grant select on public.deleted_chars to authenticated;

create or replace function public.chars_mark_deleted() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.deleted_chars (id, owner, deleted_at) values (old.id, old.owner, now())
  on conflict (id) do update set owner = excluded.owner, deleted_at = excluded.deleted_at;
  return old;
end $$;

create or replace function public.chars_block_deleted() returns trigger
language plpgsql security definer set search_path = public as $$
declare d timestamptz;
begin
  select deleted_at into d from public.deleted_chars where id = new.id;
  if d is null then return new; end if;
  if new.updated_at > d then
    delete from public.deleted_chars where id = new.id;
    return new;
  end if;
  return null;
end $$;

revoke all on function public.chars_mark_deleted() from public, anon;
revoke all on function public.chars_block_deleted() from public, anon;

drop trigger if exists chars_mark_deleted on public.characters;
create trigger chars_mark_deleted after delete on public.characters
  for each row execute function public.chars_mark_deleted();
drop trigger if exists chars_block_deleted on public.characters;
create trigger chars_block_deleted before insert on public.characters
  for each row execute function public.chars_block_deleted();
