-- Chase 54 · Supabase Schema
-- Run this in the Supabase SQL Editor:
--   https://supabase.com/dashboard → your project → SQL Editor
--
-- Row Level Security is enabled with open anon policies for personal use.
-- For a multi-user setup, replace `using (true)` with `using (auth.uid() = user_id)`.

-- 1. Courses (static reference data — seeded by the app on first load)
create table if not exists courses (
  id        text    primary key,
  name      text    not null,
  total_par integer not null
);

-- 2. Course holes (static reference data)
create table if not exists course_holes (
  id        uuid    primary key default gen_random_uuid(),
  course_id text    not null references courses(id) on delete cascade,
  hole      integer not null,
  par       integer not null,
  unique (course_id, hole)
);

-- 3. Rounds
create table if not exists rounds (
  id               text        primary key,
  date             date        not null,
  course_id        text        not null references courses(id),
  round_type       text        not null default '18',
  holes_played     integer     not null default 18,
  total_score      integer     not null,
  total_par        integer     not null,
  score_to_par     integer     not null,
  front_nine_score integer,
  back_nine_score  integer,
  notes            text,
  created_at       timestamptz not null default now()
);

-- For existing databases: run supabase-9hole-migration.sql in the SQL Editor.

-- 4. Hole scores
create table if not exists hole_scores (
  id           uuid    primary key default gen_random_uuid(),
  round_id     text    not null references rounds(id) on delete cascade,
  course_id    text    not null references courses(id),
  hole         integer not null,
  par          integer not null,
  score        integer not null,
  score_to_par integer not null,
  result       text    not null
);

-- ── Row Level Security ──────────────────────────────────────────────────────
-- These policies let the anon/publishable key read and write all data.

alter table courses     enable row level security;
alter table course_holes enable row level security;
alter table rounds      enable row level security;
alter table hole_scores  enable row level security;

create policy "anon_select_courses"      on courses      for select using (true);
create policy "anon_insert_courses"      on courses      for insert with check (true);

create policy "anon_select_course_holes" on course_holes for select using (true);
create policy "anon_insert_course_holes" on course_holes for insert with check (true);

create policy "anon_select_rounds"       on rounds       for select using (true);
create policy "anon_insert_rounds"       on rounds       for insert with check (true);
create policy "anon_update_rounds"       on rounds       for update using (true);

create policy "anon_select_hole_scores"  on hole_scores  for select using (true);
create policy "anon_insert_hole_scores"  on hole_scores  for insert with check (true);
create policy "anon_delete_hole_scores"  on hole_scores  for delete using (true);
