-- ORBiS：立ち絵・差分・アイコン・キャラの背景の画像を、キャラシ本体（characters.data）から Storage の char-images に分ける。
-- SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- ・データベース（無料枠は約500MB）がすぐにいっぱいにならないように（Storage の無料枠は別に約1GB）
-- ・置き場所は「持ち主の id/画像の中身から作った名前.webp」。自分のフォルダにだけ置ける・消せる
-- ・だれでも URL で見られる（フレンドや共有リンクで見る人も画像を見られるように）。URL はキャラシを見られる人にしか分からない
-- ・1枚 5MB まで、画像だけ。1人あたり合計 100MB まで（char_images_used）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('char-images', 'char-images', true, 5242880, array['image/webp', 'image/png', 'image/jpeg', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg', 'image/gif'];

-- 1人が置いている画像の合計（バイト）
create or replace function public.char_images_used(uid uuid) returns bigint
language sql stable security definer set search_path = public, storage as $$
  select coalesce(sum((o.metadata->>'size')::bigint), 0) from storage.objects o
  where o.bucket_id = 'char-images' and (storage.foldername(o.name))[1] = uid::text;
$$;
revoke all on function public.char_images_used(uuid) from public, anon;
grant execute on function public.char_images_used(uuid) to authenticated;

drop policy if exists "char images read own" on storage.objects;
create policy "char images read own" on storage.objects for select to authenticated
  using (bucket_id = 'char-images' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "char images upload own" on storage.objects;
create policy "char images upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'char-images' and (storage.foldername(name))[1] = auth.uid()::text
    and public.char_images_used(auth.uid()) < 104857600);
drop policy if exists "char images delete own" on storage.objects;
create policy "char images delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'char-images' and (storage.foldername(name))[1] = auth.uid()::text);
