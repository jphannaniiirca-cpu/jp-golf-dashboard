-- Chase 54 · 9-Hole Round Support Migration
-- Run this in the Supabase SQL Editor if you already have the schema set up.
-- Safe to run multiple times — uses IF NOT EXISTS and conditional updates.

-- 1. Add round_type column (stores: '18', 'front9', 'back9')
alter table rounds add column if not exists round_type text not null default 'full18';

-- 2. Add holes_played column
alter table rounds add column if not exists holes_played integer not null default 18;

-- 3. Make front/back nine scores nullable (9-hole rounds only play one side)
alter table rounds alter column front_nine_score drop not null;
alter table rounds alter column back_nine_score drop not null;

-- 4. Normalize all legacy 'full18' values to '18'
update rounds set round_type = '18' where round_type = 'full18' or round_type is null;

-- 5. Update default for new rows
alter table rounds alter column round_type set default '18';

-- 6. Set holes_played for any existing rows that have the wrong value
update rounds set holes_played = 9  where round_type in ('front9', 'back9') and holes_played = 18;
update rounds set holes_played = 18 where round_type = '18' and holes_played is null;

-- Done. Verify:
-- select id, date, round_type, holes_played, total_score, total_par from rounds order by date desc limit 10;
