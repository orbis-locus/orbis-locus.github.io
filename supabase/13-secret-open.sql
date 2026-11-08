-- ORBiS：秘匿を「公開する／しない」をキャラごとに選べるようにする。SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- （12-char-secrets.sql と 10-share.sql を先に実行しておくこと）
-- ・公開しない（ふつう）：今までどおり、持ち主と、そのキャラで参加しているグループのキーパーだけが読める
-- ・公開する：そのキャラシを見られる人（鍵をかけていないキャラのフレンド、共有リンクを開いた人）も秘匿を読める
alter table public.char_secrets add column if not exists is_open boolean not null default false;

-- 公開している秘匿は、そのキャラシそのものを読める人なら読める（キャラシを読めるかどうかは characters の決まりに従う）
drop policy if exists "secrets read open" on public.char_secrets;
create policy "secrets read open" on public.char_secrets for select to authenticated
  using (is_open and exists (select 1 from public.characters c where c.id = char_secrets.char_id));

-- 共有リンク：公開している秘匿だけ、いっしょに返す
create or replace function public.get_shared_char(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('data', c.data, 'owner', p.username, 'updated_at', c.updated_at,
    'secret', (select cs.body from public.char_secrets cs where cs.char_id = c.id and cs.is_open))
  from public.char_shares s
  join public.characters c on c.id = s.char_id and c.owner = s.owner
  left join public.profiles p on p.id = s.owner
  where s.token = t;
$$;
revoke all on function public.get_shared_char(text) from public;
grant execute on function public.get_shared_char(text) to anon, authenticated;
