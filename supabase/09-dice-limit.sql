-- ORBiS：ダイスの上限回数（キーパーがグループごとに決める）。SQL Editor に全部貼り付けて Run。何度実行しても大丈夫
-- キーパーは自分の参加行（group_members）に上限と「回数リセット」の時刻を書く。自分の行は自分で書きかえられるので、新しい権限は要らない
alter table public.group_members add column if not exists dice_limit integer;
alter table public.group_members add column if not exists dice_reset timestamptz;
alter table public.group_members drop constraint if exists group_members_dice_limit_ok;
alter table public.group_members add constraint group_members_dice_limit_ok check (dice_limit is null or dice_limit between 0 and 999);
