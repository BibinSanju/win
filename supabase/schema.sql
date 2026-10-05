create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  dob date not null,
  events text[] not null default '{}',
  role text not null default 'athlete',
  morning_sessions_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists dob date;
alter table public.profiles add column if not exists events text[] not null default '{}';
alter table public.profiles add column if not exists role text not null default 'athlete';
alter table public.profiles add column if not exists morning_sessions_enabled boolean not null default false;

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

-- Profiles: Allow ALL authenticated and anon clients to view student profiles for Coach management
drop policy if exists "profiles_own_rows" on public.profiles;
drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all"
on public.profiles
for select
to authenticated, anon
using (true);

-- Profiles: Allow authenticated users to update (e.g. coach toggling morning session or user editing bio)
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_update_all_authenticated" on public.profiles;
create policy "profiles_update_all_authenticated"
on public.profiles
for update
to authenticated
using (true)
with check (true);

-- Profiles: Allow users to insert their own profile
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

-- Training plans: Allow ALL authenticated and anon clients to view squad workouts
drop policy if exists "training_plans_own_rows" on public.training_plans;
drop policy if exists "training_plans_select_all" on public.training_plans;
create policy "training_plans_select_all"
on public.training_plans
for select
to authenticated, anon
using (true);

-- Allow authenticated users to insert/update training plans
drop policy if exists "training_plans_all_authenticated" on public.training_plans;
create policy "training_plans_all_authenticated"
on public.training_plans
for all
to authenticated
using (true)
with check (true);

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

-- Auto-create / sync profile row whenever a user signs up via Supabase Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, username, dob, events, role, morning_sessions_enabled)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', 'athlete_' || left(new.id::text, 8)),
    coalesce((new.raw_user_meta_data->>'dob')::date, date '2000-01-01'),
    case 
      when jsonb_typeof(new.raw_user_meta_data->'events') = 'array' 
      then array(select jsonb_array_elements_text(new.raw_user_meta_data->'events'))
      else '{}'::text[]
    end,
    coalesce(new.raw_user_meta_data->>'role', 'athlete'),
    coalesce((new.raw_user_meta_data->>'morningSessionsEnabled')::boolean, false)
  )
  on conflict (user_id) do update set
    username = coalesce(excluded.username, public.profiles.username),
    dob = coalesce(excluded.dob, public.profiles.dob),
    events = coalesce(excluded.events, public.profiles.events),
    role = coalesce(excluded.role, public.profiles.role),
    morning_sessions_enabled = coalesce(excluded.morning_sessions_enabled, public.profiles.morning_sessions_enabled),
    updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();

-- Backfill all existing auth.users into public.profiles
insert into public.profiles (user_id, username, dob, events, role, morning_sessions_enabled)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'username', 'athlete_' || left(u.id::text, 8)),
  coalesce((u.raw_user_meta_data->>'dob')::date, date '2000-01-01'),
  case 
    when jsonb_typeof(u.raw_user_meta_data->'events') = 'array' 
    then array(select jsonb_array_elements_text(u.raw_user_meta_data->'events'))
    else '{}'::text[]
  end,
  coalesce(u.raw_user_meta_data->>'role', 'athlete'),
  coalesce((u.raw_user_meta_data->>'morningSessionsEnabled')::boolean, false)
from auth.users u
on conflict (user_id) do update set
  role = coalesce(excluded.role, public.profiles.role, 'athlete'),
  morning_sessions_enabled = coalesce(excluded.morning_sessions_enabled, public.profiles.morning_sessions_enabled, false);

notify pgrst, 'reload schema';
