-- ============================================================
-- v24: PM "mark as done", calibration records, and a full audit
--      trail for spare-part usage (who, which machine, where).
-- Safe to run on an existing database (idempotent).
-- Run in: Supabase Dashboard -> SQL Editor (after v23).
-- ============================================================

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
