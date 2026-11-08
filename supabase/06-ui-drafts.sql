-- ============================================================
-- ORBiS：編集者の「仮保存」と、画面に使う画像の置き場所
--   ・みんなに公開できるのはマスターだけにする
--   ・編集者は仮保存（ui_drafts）だけできる。仮保存はマスターが見られる
--   ・編集で使う画像は Storage の「ui-assets」に置く
-- Supabase の「SQL Editor」にこのファイルの中身を全部貼り付けて「Run」を押してください。
-- 何度実行しても大丈夫です。（05-app-roles.sql を実行済みであることが前提です）
-- ============================================================

-- 公開版（ui_layout）を書きかえられるのはマスターだけ
drop policy if exists "layout insert admin" on public.ui_layout;
create policy "layout insert admin" on public.ui_layout for insert to authenticated with check (public.is_app_master());
drop policy if exists "layout update admin" on public.ui_layout;
create policy "layout update admin" on public.ui_layout for update to authenticated
  using (public.is_app_master()) with check (public.is_app_master());

-- 仮保存（1人1つ）
create table if not exists public.ui_drafts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"v":1,"items":{}}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.ui_drafts enable row level security;
-- 自分の仮保存と、マスターはみんなの仮保存が見られる
drop policy if exists "drafts read" on public.ui_drafts;
create policy "drafts read" on public.ui_drafts for select to authenticated
  using (user_id = auth.uid() or public.is_app_master());
-- 書けるのは、編集者かマスターが自分の分だけ
drop policy if exists "drafts insert" on public.ui_drafts;
create policy "drafts insert" on public.ui_drafts for insert to authenticated
  with check (user_id = auth.uid() and public.is_app_admin());
drop policy if exists "drafts update" on public.ui_drafts;
create policy "drafts update" on public.ui_drafts for update to authenticated
  using (user_id = auth.uid() and public.is_app_admin()) with check (user_id = auth.uid() and public.is_app_admin());
-- 消せるのは、自分の分か、マスター
drop policy if exists "drafts delete" on public.ui_drafts;
create policy "drafts delete" on public.ui_drafts for delete to authenticated
  using (user_id = auth.uid() or public.is_app_master());

-- 画像の置き場所（だれでも見られる。置けるのは編集者とマスターだけ）
insert into storage.buckets (id, name, public) values ('ui-assets', 'ui-assets', true)
  on conflict (id) do update set public = true;
drop policy if exists "ui assets upload" on storage.objects;
create policy "ui assets upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'ui-assets' and public.is_app_admin());
drop policy if exists "ui assets delete" on storage.objects;
create policy "ui assets delete" on storage.objects for delete to authenticated
  using (bucket_id = 'ui-assets' and (owner = auth.uid() or public.is_app_master()));
