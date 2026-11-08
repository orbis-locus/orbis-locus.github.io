-- ORBiS：共有リンクを LINE・Discord・X に貼ったとき、立ち絵入りのカード（プレビュー）を出すための準備。
-- SQL Editor に全部貼り付けて Run。何度実行しても大丈夫。10-share.sql を先に実行しておくこと
-- ・get_share_card：合言葉から、カードに書く文字（名前・職業など）だけを返す（立ち絵などの大きいデータは返さない）
-- ・Storage の share-og：カードの画像（合言葉.jpg）。持ち主が共有しているキャラの分だけ置ける。だれでも URL で見られる
create or replace function public.get_share_card(t text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'name', c.data->'profile'->>'name',
    'kana', c.data->'profile'->>'kana',
    'occupation', c.data->'profile'->>'occupation',
    'system', c.data->>'system',
    'owner', p.username)
  from public.char_shares s
  join public.characters c on c.id = s.char_id and c.owner = s.owner
  left join public.profiles p on p.id = s.owner
  where s.token = t;
$$;
revoke all on function public.get_share_card(text) from public;
grant execute on function public.get_share_card(text) to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('share-og', 'share-og', true, 1048576, array['image/jpeg'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/jpeg'];

drop policy if exists "share og read own" on storage.objects;
create policy "share og read own" on storage.objects for select to authenticated
  using (bucket_id = 'share-og' and exists (select 1 from public.char_shares s where s.owner = auth.uid() and storage.objects.name = s.token || '.jpg'));
drop policy if exists "share og upload" on storage.objects;
create policy "share og upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'share-og' and exists (select 1 from public.char_shares s where s.owner = auth.uid() and storage.objects.name = s.token || '.jpg'));
drop policy if exists "share og update" on storage.objects;
create policy "share og update" on storage.objects for update to authenticated
  using (bucket_id = 'share-og' and exists (select 1 from public.char_shares s where s.owner = auth.uid() and storage.objects.name = s.token || '.jpg'));
drop policy if exists "share og delete" on storage.objects;
create policy "share og delete" on storage.objects for delete to authenticated
  using (bucket_id = 'share-og' and owner = auth.uid());
