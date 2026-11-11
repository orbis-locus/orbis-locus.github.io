-- ORBiS：「欲しい！」に「フレンドのキャラシを見る」（friendview）を足す。SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- （15-feature-wants.sql を先に実行しておくこと）
create or replace function public.add_want(f text, v text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if f is null or f !~ '^(group|chars|friendview|theme:(sky|sakura|book|aqua|dot))$' then return; end if;
  if auth.uid() is not null then v := auth.uid()::text; end if;
  if v is null or length(v) < 8 or length(v) > 64 then return; end if;
  insert into public.feature_wants (feature, voter, user_id) values (f, v, auth.uid())
  on conflict do nothing;
end $$;
revoke all on function public.add_want(text, text) from public;
grant execute on function public.add_want(text, text) to anon, authenticated;
