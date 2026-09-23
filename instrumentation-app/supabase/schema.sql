-- Instrumentation Engineering Operations & Maintenance System
-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query)

-- ============ ENUMS ============
create type user_role as enum ('admin', 'engineer', 'technician');
create type breakdown_priority as enum ('low', 'medium', 'high', 'critical');
create type breakdown_status as enum (
  'reported', 'assigned', 'investigation', 'repair', 'testing', 'restored', 'closed'
);

-- ============ PROFILES (extends Supabase auth.users) ============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'technician',
  phone text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ EQUIPMENT ============
create table equipment (
  id uuid primary key default gen_random_uuid(),
  tag_number text not null unique,
  name text not null,
  type text not null,               -- e.g. 'transmitter', 'control_valve', 'plc_io'
  location text,
  plant_section text,
  manufacturer text,
  model text,
  install_date date,
  status text not null default 'operational', -- operational | under_maintenance | decommissioned
  created_at timestamptz not null default now(),
  created_by uuid references profiles(id)
);

-- ============ BREAKDOWNS ============
create table breakdowns (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references equipment(id),
  reported_by uuid not null references profiles(id),
  assigned_to uuid references profiles(id),
  location text,
  fault_description text not null,
  alarm_code text,
  priority breakdown_priority not null default 'medium',
  status breakdown_status not null default 'reported',
  findings text,
  root_cause text,
  corrective_action text,
  ai_suggestion text,               -- AI output kept separate from technician-confirmed fields
  start_time timestamptz not null default now(),
  end_time timestamptz,
  downtime_minutes integer generated always as (
    case when end_time is not null
      then extract(epoch from (end_time - start_time)) / 60
      else null end
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table breakdown_photos (
  id uuid primary key default gen_random_uuid(),
  breakdown_id uuid not null references breakdowns(id) on delete cascade,
  storage_path text not null,
  created_at timestamptz not null default now()
);

-- ============ SPARE PARTS ============
create table spare_parts (
  id uuid primary key default gen_random_uuid(),
  part_number text not null unique,
  name text not null,
  equipment_compatible text[],
  stock_qty integer not null default 0,
  min_stock_qty integer not null default 0,
  created_at timestamptz not null default now()
);

create table breakdown_spare_parts (
  id uuid primary key default gen_random_uuid(),
  breakdown_id uuid not null references breakdowns(id) on delete cascade,
  part_id uuid not null references spare_parts(id),
  qty_used integer not null default 1
);

-- ============ PM & CALIBRATION ============
create table pm_schedules (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid references equipment(id),
  equipment_description text,
  location text,
  task_name text not null,
  frequency_days integer not null,
  last_done date,
  next_due date not null,
  created_at timestamptz not null default now()
);

create table calibrations (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references equipment(id),
  calibration_date date not null,
  result text,
  next_due_date date,
  performed_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============ SHIFT HANDOVER ============
create table shift_handovers (
  id uuid primary key default gen_random_uuid(),
  shift_date date not null default current_date,
  shift_type text not null,        -- morning | afternoon | night
  outstanding_breakdowns text,
  equipment_under_observation text,
  temp_repairs text,
  safety_concerns text,
  bypassed_instruments text,
  notes text,
  handed_over_by uuid references profiles(id),
  received_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ============ COMMENTS (work-order discussion) ============
create table comments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,       -- 'breakdown' | 'equipment'
  entity_id uuid not null,
  user_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

-- ============ AI KNOWLEDGE BASE ============
create table ai_knowledge_cases (
  id uuid primary key default gen_random_uuid(),
  breakdown_id uuid references breakdowns(id),
  problem_summary text not null,
  solution_summary text not null,
  created_at timestamptz not null default now()
);

-- ============ updated_at trigger ============
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger breakdowns_updated_at before update on breakdowns
  for each row execute function set_updated_at();

-- ============ ROW LEVEL SECURITY ============
alter table profiles enable row level security;
alter table equipment enable row level security;
alter table breakdowns enable row level security;
alter table breakdown_photos enable row level security;
alter table spare_parts enable row level security;
alter table breakdown_spare_parts enable row level security;
alter table pm_schedules enable row level security;
alter table calibrations enable row level security;
alter table shift_handovers enable row level security;
alter table comments enable row level security;
alter table ai_knowledge_cases enable row level security;

-- helper: is the current user an admin or engineer?
create or replace function is_admin_or_engineer() returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role in ('admin', 'engineer')
  );
$$ language sql stable security definer;

-- helper: is the current user an admin? (security definer avoids RLS self-recursion)
create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql stable security definer;

-- profiles: everyone logged in can read; only admin can write
create policy "profiles_select" on profiles for select using (auth.uid() is not null);
create policy "profiles_admin_write" on profiles for update using (is_admin());

-- equipment: everyone reads; engineer/admin write; admin-only delete
create policy "equipment_select" on equipment for select using (auth.uid() is not null);
create policy "equipment_write" on equipment for insert with check (is_admin_or_engineer());
create policy "equipment_update" on equipment for update using (is_admin_or_engineer());
create policy "equipment_delete" on equipment for delete using (is_admin());

-- breakdowns: everyone reads; anyone logged in can create; assigned tech/engineer/admin can update; admin-only delete
create policy "breakdowns_select" on breakdowns for select using (auth.uid() is not null);
create policy "breakdowns_insert" on breakdowns for insert with check (auth.uid() is not null);
create policy "breakdowns_update" on breakdowns for update using (
  auth.uid() = assigned_to or auth.uid() = reported_by or is_admin_or_engineer()
);
create policy "breakdowns_delete" on breakdowns for delete using (is_admin());

-- generic read-for-all, write-for-engineer/admin on the remaining operational tables
create policy "photos_select" on breakdown_photos for select using (auth.uid() is not null);
create policy "photos_insert" on breakdown_photos for insert with check (auth.uid() is not null);
create policy "photos_delete" on breakdown_photos for delete using (auth.uid() is not null);

create policy "parts_select" on spare_parts for select using (auth.uid() is not null);
create policy "parts_write" on spare_parts for all using (is_admin_or_engineer());
create policy "parts_delete" on spare_parts for delete using (is_admin());

create policy "bsp_select" on breakdown_spare_parts for select using (auth.uid() is not null);
create policy "bsp_insert" on breakdown_spare_parts for insert with check (auth.uid() is not null);

create policy "pm_select" on pm_schedules for select using (auth.uid() is not null);
create policy "pm_write" on pm_schedules for all using (is_admin_or_engineer());
create policy "pm_delete" on pm_schedules for delete using (is_admin());

-- allow deleting equipment even when it's referenced elsewhere: keep the historical
-- record but clear the link, instead of blocking the delete entirely
alter table pm_schedules drop constraint if exists pm_schedules_equipment_id_fkey;
alter table pm_schedules
  add constraint pm_schedules_equipment_id_fkey
  foreign key (equipment_id) references equipment(id) on delete set null;

alter table calibrations drop constraint if exists calibrations_equipment_id_fkey;
alter table calibrations
  add constraint calibrations_equipment_id_fkey
  foreign key (equipment_id) references equipment(id) on delete set null;

alter table breakdowns drop constraint if exists breakdowns_equipment_id_fkey;
alter table breakdowns
  add constraint breakdowns_equipment_id_fkey
  foreign key (equipment_id) references equipment(id) on delete set null;

create policy "cal_select" on calibrations for select using (auth.uid() is not null);
create policy "cal_write" on calibrations for all using (is_admin_or_engineer());

create policy "handover_select" on shift_handovers for select using (auth.uid() is not null);
create policy "handover_insert" on shift_handovers for insert with check (auth.uid() is not null);

create policy "comments_select" on comments for select using (auth.uid() is not null);
create policy "comments_insert" on comments for insert with check (auth.uid() is not null);

create policy "aikb_select" on ai_knowledge_cases for select using (auth.uid() is not null);
create policy "aikb_insert" on ai_knowledge_cases for insert with check (auth.uid() is not null);

-- ============ auto-create profile row when a user signs up ============
-- The very first user ever created becomes admin automatically.
-- Every user after that defaults to technician, and roles are then
-- managed entirely from the app's Admin > Users page (no SQL needed).
create or replace function handle_new_user() returns trigger as $$
declare
  is_first_user boolean;
begin
  select not exists (select 1 from public.profiles) into is_first_user;

  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    (case when is_first_user then 'admin' else 'technician' end)::public.user_role
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============ STORAGE: breakdown photo attachments ============
-- Run this once. Creates a public bucket for breakdown photos, with
-- upload restricted to signed-in users. If it errors that the bucket
-- already exists, that's fine — it means this was already run.
insert into storage.buckets (id, name, public)
values ('breakdown-photos', 'breakdown-photos', true)
on conflict (id) do nothing;

create policy "breakdown_photos_insert" on storage.objects
  for insert with check (bucket_id = 'breakdown-photos' and auth.uid() is not null);

create policy "breakdown_photos_select" on storage.objects
  for select using (bucket_id = 'breakdown-photos');

create policy "breakdown_photos_delete" on storage.objects
  for delete using (bucket_id = 'breakdown-photos' and auth.uid() is not null);
-- ============ 1. SAP number on profiles ============
alter table profiles add column if not exists sap_number text;

-- ============ 2. Assignment note on breakdowns ============
alter table breakdowns add column if not exists assignment_note text;

-- ============ 3. Admin/Engineer-only "supervisor feedback" comments ============
-- Re-uses the existing comments table with entity_type = 'breakdown_review'.
-- Anyone can still post normal shift-update comments (entity_type = 'breakdown');
-- only admin/engineer can post review/feedback comments.
drop policy if exists "comments_insert" on comments;
create policy "comments_insert" on comments for insert with check (
  auth.uid() is not null and (entity_type <> 'breakdown_review' or is_admin_or_engineer())
);

-- ============ 4. Announcements / staff discussion board ============
create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);
alter table announcements enable row level security;
create policy "announcements_select" on announcements for select using (auth.uid() is not null);
create policy "announcements_insert" on announcements for insert with check (auth.uid() is not null);
create policy "announcements_delete" on announcements for delete using (
  user_id = auth.uid() or is_admin()
);

-- ============ 5. Shift roster uploads ============
create table if not exists shift_rosters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  storage_path text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table shift_rosters enable row level security;
create policy "shift_rosters_select" on shift_rosters for select using (auth.uid() is not null);
create policy "shift_rosters_insert" on shift_rosters for insert with check (is_admin());
create policy "shift_rosters_delete" on shift_rosters for delete using (is_admin());

insert into storage.buckets (id, name, public)
values ('shift-rosters', 'shift-rosters', true)
on conflict (id) do nothing;

create policy "shift_rosters_storage_insert" on storage.objects
  for insert with check (bucket_id = 'shift-rosters' and is_admin());

create policy "shift_rosters_storage_select" on storage.objects
  for select using (bucket_id = 'shift-rosters');

create policy "shift_rosters_storage_delete" on storage.objects
  for delete using (bucket_id = 'shift-rosters' and is_admin());
