create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  dob date not null,
  events text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists dob date;

update public.profiles
set username = lower(regexp_replace(coalesce(username, 'athlete_' || left(user_id::text, 8)), '[^a-z0-9_]+', '_', 'g'))
where username is null;

update public.profiles
set dob = date '2000-01-01'
where dob is null;

alter table public.profiles alter column username set not null;
alter table public.profiles alter column dob set not null;
alter table public.profiles drop column if exists name;

create unique index if not exists profiles_username_unique_idx
on public.profiles (username);

create table if not exists public.evaluations (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  event_type text not null check (event_type in ('long-jump', 'triple-jump')),
  test_id text not null,
  created_at timestamptz not null,
  inputs jsonb not null default '{}'::jsonb,
  result_value numeric not null,
  result_unit text not null,
  score integer not null check (score >= 0 and score <= 100),
  z_score numeric not null,
  rating text not null check (rating in ('Needs focus', 'Developing', 'Strong', 'Excellent')),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.training_plans (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  template_json jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.todo_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  plan_id text not null,
  item_id text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.todo_section_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  section_id text not null,
  collapsed boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.profiles enable row level security;
alter table public.evaluations enable row level security;
alter table public.training_plans enable row level security;
alter table public.todo_progress enable row level security;
alter table public.todo_section_preferences enable row level security;

drop policy if exists "profiles_own_rows" on public.profiles;
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_all_authenticated" on public.profiles;
create policy "profiles_update_all_authenticated"
on public.profiles
for update
to authenticated
using (true)
with check (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "evaluations_own_rows" on public.evaluations;
create policy "evaluations_own_rows"
on public.evaluations
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "training_plans_own_rows" on public.training_plans;
create policy "training_plans_own_rows"
on public.training_plans
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "todo_progress_own_rows" on public.todo_progress;
create policy "todo_progress_own_rows"
on public.todo_progress
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "todo_section_preferences_own_rows" on public.todo_section_preferences;
create policy "todo_section_preferences_own_rows"
on public.todo_section_preferences
for all
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

notify pgrst, 'reload schema';
