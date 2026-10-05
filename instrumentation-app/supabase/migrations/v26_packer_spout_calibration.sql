-- ============================================================
-- v26: Packer spout calibration sheets (per production line).
--  - packers: the packers on each line and how many spouts each has
--  - spout_calibrations: one sheet per packer per calibration day
--  - spout_calibration_readings: zero/span before and after + error %
-- Error % = (span before - span after) x 2   (50 kg reference span)
-- Safe to run on an existing database (idempotent). Run after v25.
-- ============================================================

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
