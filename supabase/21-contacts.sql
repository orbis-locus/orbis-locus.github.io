-- ORBiS：お問い合わせ（アプリの中の入力欄から送る）。SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- （05-app-roles.sql を先に実行しておくこと）
-- ・ログインしていない人も送れる（send_contact は anon にも実行権を付ける。中で長さと回数を確かめる）
-- ・1つの端末（ログイン中は1人）1日5件まで。ログインしていない人の分は、全体で1時間30件まで（いたずらの連打を止める）
-- ・一覧を見られるのはマスターだけ（contact_list）。対応したら contact_close で閉じる
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('bug', 'delete', 'privacy', 'rights', 'idea', 'other')),
  body text not null check (char_length(body) between 1 and 2000),
  reply_to text check (reply_to is null or char_length(reply_to) <= 200),
  info text check (info is null or char_length(info) <= 300),
  user_id uuid,
  user_name text,
  voter text not null,
  status text not null default 'open' check (status in ('open', 'done')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists contacts_voter on public.contacts (voter, created_at);
create index if not exists contacts_open on public.contacts (created_at) where status = 'open';
alter table public.contacts enable row level security;
revoke all on public.contacts from public, anon, authenticated;

-- 送る。返り値：'ok' / 'kind' / 'short' / 'long' / 'mail' / 'toomany' / 'busy'
create or replace function public.send_contact(kind text, body text, reply text, info text, v text) returns text
language plpgsql security definer set search_path = public as $$
declare nm text;
begin
  if kind is null or kind not in ('bug', 'delete', 'privacy', 'rights', 'idea', 'other') then return 'kind'; end if;
  body := btrim(coalesce(body, ''));
  if char_length(body) < 5 then return 'short'; end if;
  if char_length(body) > 2000 then return 'long'; end if;
  reply := nullif(btrim(coalesce(reply, '')), '');
  if reply is not null and (char_length(reply) > 200 or reply !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') then return 'mail'; end if;
  if auth.uid() is not null then
    v := auth.uid()::text;
    select p.username into nm from public.profiles p where p.id = auth.uid();
  else
    if v is null or length(v) < 8 or length(v) > 64 then return 'kind'; end if;
    if (select count(*) from public.contacts c where c.user_id is null and c.created_at > now() - interval '1 hour') >= 30 then
      return 'busy';
    end if;
  end if;
  if (select count(*) from public.contacts c where c.voter = v and c.created_at > now() - interval '1 day') >= 5 then
    return 'toomany';
  end if;
  insert into public.contacts (kind, body, reply_to, info, user_id, user_name, voter)
  values (kind, body, reply, left(nullif(btrim(coalesce(info, '')), ''), 300), auth.uid(), nm, v);
  return 'ok';
end $$;
revoke all on function public.send_contact(text, text, text, text, text) from public;
grant execute on function public.send_contact(text, text, text, text, text) to anon, authenticated;

-- まだ対応していないお問い合わせの一覧（マスターだけ）。ログインして送った人は、いまの名前と登録したメールアドレスも出す（本人の確認のため）
create or replace function public.contact_list()
returns table (id uuid, created_at timestamptz, kind text, body text, reply_to text, info text,
               user_id uuid, user_name text, now_name text, user_email text)
language sql stable security definer set search_path = public as $$
  select c.id, c.created_at, c.kind, c.body, c.reply_to, c.info,
         c.user_id, c.user_name, p.username, u.email::text
  from public.contacts c
  left join public.profiles p on p.id = c.user_id
  left join auth.users u on u.id = c.user_id
  where c.status = 'open' and public.is_app_master()
  order by c.created_at desc
  limit 200;
$$;
revoke all on function public.contact_list() from public, anon;
grant execute on function public.contact_list() to authenticated;

-- 対応したら閉じる（マスターだけ）
create or replace function public.contact_close(contact_id uuid) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_master() then return 'only master'; end if;
  update public.contacts set status = 'done', closed_at = now() where id = contact_id and status = 'open';
  return 'ok';
end $$;
revoke all on function public.contact_close(uuid) from public, anon;
grant execute on function public.contact_close(uuid) to authenticated;
