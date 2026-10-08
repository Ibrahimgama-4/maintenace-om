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

-- ============ Machine documents library (troubleshooting manuals, by line) ============
create table if not exists machine_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  location text not null,
  storage_path text not null,
  uploaded_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
alter table machine_documents enable row level security;
create policy "machine_documents_select" on machine_documents for select using (auth.uid() is not null);
create policy "machine_documents_insert" on machine_documents for insert with check (is_admin_or_engineer());
create policy "machine_documents_delete" on machine_documents for delete using (is_admin_or_engineer());

insert into storage.buckets (id, name, public)
values ('machine-documents', 'machine-documents', true)
on conflict (id) do nothing;

create policy "machine_documents_storage_insert" on storage.objects
  for insert with check (bucket_id = 'machine-documents' and is_admin_or_engineer());

create policy "machine_documents_storage_select" on storage.objects
  for select using (bucket_id = 'machine-documents');

create policy "machine_documents_storage_delete" on storage.objects
  for delete using (bucket_id = 'machine-documents' and is_admin_or_engineer());

-- ============ Allow staff to edit their own profile (name/SAP), safely ============
-- The earlier "profiles_admin_write" policy only let admins update any row,
-- which accidentally blocked people from editing their OWN profile too.
-- This adds a self-service policy, plus a trigger that silently prevents
-- anyone (except an admin) from changing the `role` column on their own row,
-- even if someone tried to submit a role change through a raw API call.
create policy "profiles_self_update" on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function prevent_self_role_escalation() returns trigger as $$
begin
  if new.role is distinct from old.role and not is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists profiles_block_role_escalation on profiles;
create trigger profiles_block_role_escalation
  before update on profiles
  for each row execute function prevent_self_role_escalation();

-- ============ Notification "last seen" tracking (per user, per category) ============
create table if not exists notification_seen (
  user_id uuid not null references profiles(id) on delete cascade,
  category text not null,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, category)
);
alter table notification_seen enable row level security;
create policy "notification_seen_select" on notification_seen for select using (auth.uid() = user_id);
create policy "notification_seen_upsert" on notification_seen for insert with check (auth.uid() = user_id);
create policy "notification_seen_update" on notification_seen for update using (auth.uid() = user_id);

-- ============ v23 (see supabase/migrations/v23_parts_calendar_workload.sql) ============
alter table breakdown_spare_parts
  add column if not exists used_by uuid references profiles(id),
  add column if not exists used_at timestamptz not null default now();

create index if not exists breakdowns_start_time_idx on breakdowns (start_time);
create index if not exists breakdowns_assigned_status_idx on breakdowns (assigned_to, status);
create index if not exists bsp_used_at_idx on breakdown_spare_parts (used_at);

-- Parts usage must go through the functions below so stock is ALWAYS adjusted.
drop policy if exists "bsp_insert" on breakdown_spare_parts;

create or replace function can_edit_breakdown(p_breakdown_id uuid) returns boolean as $$
  select exists (
    select 1 from breakdowns b
    where b.id = p_breakdown_id
      and (b.assigned_to = auth.uid() or b.reported_by = auth.uid() or is_admin_or_engineer())
  );
$$ language sql stable security definer set search_path = public;

-- Record parts used on a breakdown and deduct them from stock (atomic, row-locked).
create or replace function use_spare_part(p_breakdown_id uuid, p_part_id uuid, p_qty integer)
returns integer as $$
declare
  v_stock integer;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_qty is null or p_qty < 1 then raise exception 'Quantity must be at least 1'; end if;
  if not can_edit_breakdown(p_breakdown_id) then
    raise exception 'You are not allowed to record parts on this breakdown';
  end if;

  select stock_qty into v_stock from spare_parts where id = p_part_id for update;
  if not found then raise exception 'Part not found'; end if;
  if v_stock < p_qty then raise exception 'Only % in stock', v_stock; end if;

  update spare_parts set stock_qty = stock_qty - p_qty where id = p_part_id;
  insert into breakdown_spare_parts (breakdown_id, part_id, qty_used, used_by)
  values (p_breakdown_id, p_part_id, p_qty, auth.uid());

  return v_stock - p_qty;  -- new stock level
end;
$$ language plpgsql security definer set search_path = public;

-- Undo a usage record (e.g. entered by mistake) and return the parts to stock.
create or replace function return_spare_part(p_usage_id uuid) returns void as $$
declare
  r breakdown_spare_parts%rowtype;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into r from breakdown_spare_parts where id = p_usage_id for update;
  if not found then raise exception 'Usage record not found'; end if;
  if not can_edit_breakdown(r.breakdown_id) then
    raise exception 'You are not allowed to change parts on this breakdown';
  end if;

  update spare_parts set stock_qty = stock_qty + r.qty_used where id = r.part_id;
  delete from breakdown_spare_parts where id = p_usage_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function use_spare_part(uuid, uuid, integer) from public, anon;
revoke execute on function return_spare_part(uuid) from public, anon;
grant execute on function use_spare_part(uuid, uuid, integer) to authenticated;
grant execute on function return_spare_part(uuid) to authenticated;

-- ============ v24 (see supabase/migrations/v24_pm_done_calibration_parts_audit.sql) ============
-- ---------- 1. Spare-part usage audit trail ----------
alter table breakdown_spare_parts
  add column if not exists equipment_id uuid references equipment(id) on delete set null,
  add column if not exists machine text,
  add column if not exists location text,
  add column if not exists notes text,
  add column if not exists used_by_name text,
  add column if not exists used_by_sap text;

-- Back-fill rows recorded before v24 from the breakdown, equipment and profile.
update breakdown_spare_parts u set
  used_by_name = coalesce(u.used_by_name, (select full_name from profiles where id = u.used_by)),
  used_by_sap  = coalesce(u.used_by_sap,  (select sap_number from profiles where id = u.used_by)),
  equipment_id = coalesce(u.equipment_id, (select equipment_id from breakdowns where id = u.breakdown_id)),
  machine      = coalesce(u.machine, (select e.tag_number || ' — ' || e.name
                    from breakdowns b join equipment e on e.id = b.equipment_id where b.id = u.breakdown_id)),
  location     = coalesce(u.location, (select location from breakdowns where id = u.breakdown_id));

create index if not exists bsp_part_idx on breakdown_spare_parts (part_id);
create index if not exists bsp_used_by_idx on breakdown_spare_parts (used_by);
create index if not exists bsp_location_idx on breakdown_spare_parts (location);

-- Replace the v23 function: now also records the machine, location, notes and the user's identity.
drop function if exists use_spare_part(uuid, uuid, integer);
create or replace function use_spare_part(
  p_breakdown_id uuid,
  p_part_id uuid,
  p_qty integer,
  p_equipment_id uuid default null,
  p_machine text default null,
  p_location text default null,
  p_notes text default null
) returns integer as $$
declare
  v_stock integer;
  b breakdowns%rowtype;
  v_equip uuid;
  v_machine text;
  v_loc text;
  prof record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_qty is null or p_qty < 1 then raise exception 'Quantity must be at least 1'; end if;
  if not can_edit_breakdown(p_breakdown_id) then
    raise exception 'You are not allowed to record parts on this breakdown';
  end if;

  select * into b from breakdowns where id = p_breakdown_id;
  if not found then raise exception 'Breakdown not found'; end if;

  -- Machine: registry item chosen > free text typed > the breakdown's own equipment.
  if p_equipment_id is not null then
    v_equip := p_equipment_id;
  elsif nullif(trim(coalesce(p_machine, '')), '') is not null then
    v_equip := null;
    v_machine := trim(p_machine);
  else
    v_equip := b.equipment_id;
  end if;
  if v_equip is not null then
    select tag_number || ' — ' || name into v_machine from equipment where id = v_equip;
  end if;
  if v_machine is null then raise exception 'Machine / equipment is required'; end if;

  v_loc := coalesce(nullif(trim(coalesce(p_location, '')), ''), b.location);
  if v_loc is null then raise exception 'Location is required'; end if;

  select full_name, sap_number into prof from profiles where id = auth.uid();

  select stock_qty into v_stock from spare_parts where id = p_part_id for update;
  if not found then raise exception 'Part not found'; end if;
  if v_stock < p_qty then raise exception 'Only % in stock', v_stock; end if;

  update spare_parts set stock_qty = stock_qty - p_qty where id = p_part_id;
  insert into breakdown_spare_parts
    (breakdown_id, part_id, qty_used, used_by, used_by_name, used_by_sap, equipment_id, machine, location, notes)
  values
    (p_breakdown_id, p_part_id, p_qty, auth.uid(), prof.full_name, prof.sap_number, v_equip, v_machine, v_loc,
     nullif(trim(coalesce(p_notes, '')), ''));

  return v_stock - p_qty;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function use_spare_part(uuid, uuid, integer, uuid, text, text, text) from public, anon;
grant execute on function use_spare_part(uuid, uuid, integer, uuid, text, text, text) to authenticated;

-- ---------- 2. PM: mark as done ----------
alter table pm_schedules add column if not exists last_done_by uuid references profiles(id);

create table if not exists pm_completions (
  id uuid primary key default gen_random_uuid(),
  pm_schedule_id uuid references pm_schedules(id) on delete set null,
  task_name text not null,
  equipment_label text,
  location text,
  done_date date not null,
  previous_due date,
  next_due date,
  done_by uuid references profiles(id),
  done_by_name text,
  done_by_sap text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists pmc_done_date_idx on pm_completions (done_date desc);
alter table pm_completions enable row level security;
drop policy if exists "pmc_select" on pm_completions;
drop policy if exists "pmc_delete" on pm_completions;
create policy "pmc_select" on pm_completions for select using (auth.uid() is not null);
create policy "pmc_delete" on pm_completions for delete using (is_admin());
-- No insert policy: completions are only written by complete_pm_schedule() below.

-- Any signed-in staff member can complete a PM task; the next due date rolls forward from the date done.
create or replace function complete_pm_schedule(
  p_pm_id uuid,
  p_done_date date default current_date,
  p_notes text default null
) returns date as $$
declare
  pm pm_schedules%rowtype;
  v_next date;
  v_label text;
  prof record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into pm from pm_schedules where id = p_pm_id for update;
  if not found then raise exception 'PM schedule not found'; end if;
  if p_done_date is null then p_done_date := current_date; end if;
  if p_done_date > current_date + 1 then raise exception 'Date done cannot be in the future'; end if;

  v_next := p_done_date + greatest(coalesce(pm.frequency_days, 1), 1);
  if pm.equipment_id is not null then
    select tag_number || ' — ' || name into v_label from equipment where id = pm.equipment_id;
  end if;
  v_label := coalesce(v_label, pm.equipment_description);
  select full_name, sap_number into prof from profiles where id = auth.uid();

  insert into pm_completions
    (pm_schedule_id, task_name, equipment_label, location, done_date, previous_due, next_due, done_by, done_by_name, done_by_sap, notes)
  values
    (pm.id, pm.task_name, v_label, pm.location, p_done_date, pm.next_due, v_next, auth.uid(), prof.full_name, prof.sap_number,
     nullif(trim(coalesce(p_notes, '')), ''));

  update pm_schedules set last_done = p_done_date, last_done_by = auth.uid(), next_due = v_next where id = pm.id;
  return v_next;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function complete_pm_schedule(uuid, date, text) from public, anon;
grant execute on function complete_pm_schedule(uuid, date, text) to authenticated;

-- ---------- 3. Calibration records ----------
alter table calibrations alter column equipment_id drop not null;
alter table calibrations
  add column if not exists equipment_label text,
  add column if not exists location text,
  add column if not exists as_found text,
  add column if not exists as_left text,
  add column if not exists standard_used text,
  add column if not exists certificate_no text,
  add column if not exists notes text,
  add column if not exists performed_by_name text,
  add column if not exists performed_by_sap text;
create index if not exists cal_date_idx on calibrations (calibration_date desc);
create index if not exists cal_next_due_idx on calibrations (next_due_date);

-- Any signed-in staff member can record a calibration they performed.
create or replace function record_calibration(
  p_equipment_id uuid,
  p_equipment_text text,
  p_location text,
  p_date date,
  p_result text,
  p_as_found text default null,
  p_as_left text default null,
  p_standard text default null,
  p_certificate text default null,
  p_next_due date default null,
  p_notes text default null
) returns uuid as $$
declare
  v_label text;
  v_id uuid;
  prof record;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if p_result not in ('pass', 'adjusted', 'fail') then raise exception 'Result must be pass, adjusted or fail'; end if;
  if p_date is null or p_date > current_date + 1 then raise exception 'Calibration date is missing or in the future'; end if;
  if p_equipment_id is not null then
    select tag_number || ' — ' || name into v_label from equipment where id = p_equipment_id;
  end if;
  v_label := coalesce(v_label, nullif(trim(coalesce(p_equipment_text, '')), ''));
  if v_label is null then raise exception 'Select the instrument or describe it'; end if;
  select full_name, sap_number into prof from profiles where id = auth.uid();

  insert into calibrations
    (equipment_id, equipment_label, location, calibration_date, result, next_due_date, performed_by,
     performed_by_name, performed_by_sap, as_found, as_left, standard_used, certificate_no, notes)
  values
    (p_equipment_id, v_label, nullif(trim(coalesce(p_location, '')), ''), p_date, p_result, p_next_due, auth.uid(),
     prof.full_name, prof.sap_number, nullif(trim(coalesce(p_as_found, '')), ''), nullif(trim(coalesce(p_as_left, '')), ''),
     nullif(trim(coalesce(p_standard, '')), ''), nullif(trim(coalesce(p_certificate, '')), ''),
     nullif(trim(coalesce(p_notes, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function record_calibration(uuid, text, text, date, text, text, text, text, text, date, text) from public, anon;
grant execute on function record_calibration(uuid, text, text, date, text, text, text, text, text, date, text) to authenticated;

-- ============ v25 (see supabase/migrations/v25_equipment_by_line_handover_by_line.sql) ============
-- ---------- 1. Equipment belongs to a production line ----------
-- equipment.location holds the line name. Tidy older free-text values that clearly name a line.
update equipment set location = 'Line 1 & 2 Packing Plant'
 where location is not null
   and location <> 'Line 1 & 2 Packing Plant'
   and location ~* '^[[:space:]]*line[[:space:]]*1[[:space:]]*(&|and|\+|,|/|-)[[:space:]]*(line[[:space:]]*)?2([^0-9]|$)';
update equipment set location = 'Line 3 Packing Plant'
 where location is not null and location <> 'Line 3 Packing Plant' and location ~* '^[[:space:]]*line[[:space:]]*3([^0-9]|$)';
update equipment set location = 'Line 4 Packing Plant'
 where location is not null and location <> 'Line 4 Packing Plant' and location ~* '^[[:space:]]*line[[:space:]]*4([^0-9]|$)';
update equipment set location = 'Line 5 Packing Plant'
 where location is not null and location <> 'Line 5 Packing Plant' and location ~* '^[[:space:]]*line[[:space:]]*5([^0-9]|$)';

create index if not exists equipment_location_idx on equipment (location);

-- New equipment must name a line. NOT VALID keeps existing rows untouched; they appear under
-- "No line" in the app until an engineer assigns one.
alter table equipment drop constraint if exists equipment_line_required;
alter table equipment add constraint equipment_line_required check (location is not null) not valid;

-- ---------- 2. Shift handovers belong to a production line ----------
alter table shift_handovers
  add column if not exists location text,
  add column if not exists shift_personnel text;

create index if not exists handover_location_idx on shift_handovers (location, created_at desc);

alter table shift_handovers drop constraint if exists handover_line_required;
alter table shift_handovers add constraint handover_line_required check (location is not null) not valid;

-- ============ v26 (see supabase/migrations/v26_packer_spout_calibration.sql) ============
create table if not exists packers (
  id uuid primary key default gen_random_uuid(),
  line text not null,                       -- e.g. 'Line 3 Packing Plant'
  name text not null,                       -- e.g. 'Packer 1'
  code text,                                -- machine number on the sheet, e.g. 'RP1'
  spout_count integer not null check (spout_count between 1 and 24),
  sort_order integer not null default 0,    -- calibration rotation order within the line
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (line, name)
);

create table if not exists spout_calibrations (
  id uuid primary key default gen_random_uuid(),
  packer_id uuid references packers(id) on delete set null,
  line text not null,
  packer_name text not null,                -- snapshots keep the record readable if a packer is removed
  packer_code text,
  spout_count integer not null,
  cal_date date not null,
  notes text,
  performed_by uuid references profiles(id),
  performed_by_name text,
  performed_by_sap text,
  created_at timestamptz not null default now(),
  -- Production department sign-off (may be added later)
  prod_name text,
  prod_staff_no text,
  prod_remarks text,
  prod_signed_at timestamptz,
  prod_signed_by uuid references profiles(id)
);
create unique index if not exists spout_cal_packer_date_uq on spout_calibrations (packer_id, cal_date);
create index if not exists spout_cal_line_date_idx on spout_calibrations (line, cal_date desc);
create index if not exists spout_cal_date_idx on spout_calibrations (cal_date desc);

create table if not exists spout_calibration_readings (
  id uuid primary key default gen_random_uuid(),
  sheet_id uuid not null references spout_calibrations(id) on delete cascade,
  seq integer not null,
  kind text not null default 'spout' check (kind in ('packer', 'spout', 'checkweigher')),
  label text not null,                      -- RP1, SP1..SPn, CW-1
  zero_before numeric(8,2),
  span_before numeric(8,2),
  zero_after numeric(8,2),
  span_after numeric(8,2),
  error_pct numeric(8,2)                    -- (span_before - span_after) * 2
);
create index if not exists spout_reading_sheet_idx on spout_calibration_readings (sheet_id, seq);

alter table packers enable row level security;
alter table spout_calibrations enable row level security;
alter table spout_calibration_readings enable row level security;

drop policy if exists "packers_select" on packers;
drop policy if exists "packers_insert" on packers;
drop policy if exists "packers_update" on packers;
drop policy if exists "packers_delete" on packers;
create policy "packers_select" on packers for select using (auth.uid() is not null);
create policy "packers_insert" on packers for insert with check (is_admin_or_engineer());
create policy "packers_update" on packers for update using (is_admin_or_engineer());
create policy "packers_delete" on packers for delete using (is_admin());

drop policy if exists "spoutcal_select" on spout_calibrations;
drop policy if exists "spoutcal_delete" on spout_calibrations;
create policy "spoutcal_select" on spout_calibrations for select using (auth.uid() is not null);
-- Sheets are written only by record_spout_calibration(). An admin can delete any sheet; the person who
-- recorded it can remove it within 24 hours to fix a mistake.
create policy "spoutcal_delete" on spout_calibrations for delete
  using (is_admin() or (performed_by = auth.uid() and created_at > now() - interval '24 hours'));

drop policy if exists "spoutread_select" on spout_calibration_readings;
create policy "spoutread_select" on spout_calibration_readings for select using (auth.uid() is not null);

-- Save a whole sheet (header + every reading) in one step. Any signed-in staff member can record one.
create or replace function record_spout_calibration(
  p_packer_id uuid,
  p_date date,
  p_readings jsonb,
  p_notes text default null,
  p_prod_name text default null,
  p_prod_staff_no text default null,
  p_prod_remarks text default null
) returns uuid as $$
declare
  pk packers%rowtype;
  prof record;
  v_id uuid;
  r jsonb;
  n integer := 0;
  v_sb numeric;
  v_sa numeric;
  v_prod text := nullif(trim(coalesce(p_prod_name, '')), '');
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select * into pk from packers where id = p_packer_id;
  if not found then raise exception 'Packer not found'; end if;
  if p_date is null or p_date > current_date + 1 then raise exception 'Calibration date is missing or in the future'; end if;
  if p_readings is null or jsonb_typeof(p_readings) <> 'array' or jsonb_array_length(p_readings) = 0 then
    raise exception 'Enter at least one reading';
  end if;
  if exists (select 1 from spout_calibrations where packer_id = p_packer_id and cal_date = p_date) then
    raise exception '% already has a calibration sheet for %', pk.name, p_date;
  end if;

  select full_name, sap_number into prof from profiles where id = auth.uid();

  insert into spout_calibrations
    (packer_id, line, packer_name, packer_code, spout_count, cal_date, notes, performed_by, performed_by_name, performed_by_sap,
     prod_name, prod_staff_no, prod_remarks, prod_signed_at, prod_signed_by)
  values
    (pk.id, pk.line, pk.name, pk.code, pk.spout_count, p_date, nullif(trim(coalesce(p_notes, '')), ''), auth.uid(), prof.full_name, prof.sap_number,
     v_prod, case when v_prod is not null then nullif(trim(coalesce(p_prod_staff_no, '')), '') end,
     case when v_prod is not null then nullif(trim(coalesce(p_prod_remarks, '')), '') end,
     case when v_prod is not null then now() end, case when v_prod is not null then auth.uid() end)
  returning id into v_id;

  for r in select value from jsonb_array_elements(p_readings) loop
    n := n + 1;
    v_sb := nullif(r->>'span_before', '')::numeric;
    v_sa := nullif(r->>'span_after', '')::numeric;
    insert into spout_calibration_readings (sheet_id, seq, kind, label, zero_before, span_before, zero_after, span_after, error_pct)
    values (
      v_id, n,
      case when r->>'kind' in ('packer', 'spout', 'checkweigher') then r->>'kind' else 'spout' end,
      coalesce(nullif(r->>'label', ''), 'Row ' || n),
      nullif(r->>'zero_before', '')::numeric, v_sb,
      nullif(r->>'zero_after', '')::numeric, v_sa,
      case when v_sb is not null and v_sa is not null then round((v_sb - v_sa) * 2, 2) end
    );
  end loop;

  return v_id;
end;
$$ language plpgsql security definer set search_path = public;

-- Production department signs a sheet off afterwards (once).
create or replace function sign_off_spout_calibration(
  p_sheet_id uuid,
  p_name text,
  p_staff_no text,
  p_remarks text default null
) returns void as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if nullif(trim(coalesce(p_name, '')), '') is null then raise exception 'Enter the production representative name'; end if;
  update spout_calibrations set
    prod_name = trim(p_name),
    prod_staff_no = nullif(trim(coalesce(p_staff_no, '')), ''),
    prod_remarks = nullif(trim(coalesce(p_remarks, '')), ''),
    prod_signed_at = now(),
    prod_signed_by = auth.uid()
  where id = p_sheet_id and prod_signed_at is null;
  if not found then raise exception 'Sheet not found, or Production has already signed it off'; end if;
end;
$$ language plpgsql security definer set search_path = public;

revoke execute on function record_spout_calibration(uuid, date, jsonb, text, text, text, text) from public, anon;
grant execute on function record_spout_calibration(uuid, date, jsonb, text, text, text, text) to authenticated;
revoke execute on function sign_off_spout_calibration(uuid, text, text, text) from public, anon;
grant execute on function sign_off_spout_calibration(uuid, text, text, text) to authenticated;

-- ============ v27 (see supabase/migrations/v27_shift_duty_roster.sql) ============
create table if not exists shift_settings (
  id integer primary key default 1 check (id = 1),
  anchor_date date not null,
  a_offset integer not null check (a_offset between 0 and 8),
  b_offset integer not null check (b_offset between 0 and 8),
  c_offset integer not null check (c_offset between 0 and 8),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);
-- Initial values: on the day this script is run, Shift B is on night day 2, Shift C on morning day 2,
-- Shift A on off day 2. An admin can correct this under Duty Roster -> Shift pattern.
insert into shift_settings (id, anchor_date, a_offset, b_offset, c_offset)
values (1, current_date, 7, 4, 1)
on conflict (id) do nothing;

-- People on the duty roster: picked from app users, or typed in (name + SAP) for staff without an account.
create table if not exists roster_staff (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete set null,
  full_name text not null,
  sap_number text,
  shift_group text not null check (shift_group in ('A', 'B', 'C', 'G')),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists roster_staff_profile_uq on roster_staff (profile_id) where profile_id is not null;

-- Days where the admin changed a person's duty away from the normal pattern.
create table if not exists duty_overrides (
  staff_id uuid not null references roster_staff(id) on delete cascade,
  duty_date date not null,
  code text not null check (code in ('D', 'N', 'O', 'G')),
  note text,
  set_by uuid references profiles(id),
  set_at timestamptz not null default now(),
  primary key (staff_id, duty_date)
);
create index if not exists duty_overrides_date_idx on duty_overrides (duty_date);

alter table shift_settings enable row level security;
alter table roster_staff enable row level security;
alter table duty_overrides enable row level security;

drop policy if exists "shiftset_select" on shift_settings;
drop policy if exists "shiftset_update" on shift_settings;
create policy "shiftset_select" on shift_settings for select using (auth.uid() is not null);
create policy "shiftset_update" on shift_settings for update using (is_admin());

drop policy if exists "rosterstaff_select" on roster_staff;
drop policy if exists "rosterstaff_insert" on roster_staff;
drop policy if exists "rosterstaff_update" on roster_staff;
drop policy if exists "rosterstaff_delete" on roster_staff;
create policy "rosterstaff_select" on roster_staff for select using (auth.uid() is not null);
create policy "rosterstaff_insert" on roster_staff for insert with check (is_admin());
create policy "rosterstaff_update" on roster_staff for update using (is_admin());
create policy "rosterstaff_delete" on roster_staff for delete using (is_admin());

drop policy if exists "dutyov_select" on duty_overrides;
drop policy if exists "dutyov_insert" on duty_overrides;
drop policy if exists "dutyov_update" on duty_overrides;
drop policy if exists "dutyov_delete" on duty_overrides;
create policy "dutyov_select" on duty_overrides for select using (auth.uid() is not null);
create policy "dutyov_insert" on duty_overrides for insert with check (is_admin());
create policy "dutyov_update" on duty_overrides for update using (is_admin());
create policy "dutyov_delete" on duty_overrides for delete using (is_admin());
