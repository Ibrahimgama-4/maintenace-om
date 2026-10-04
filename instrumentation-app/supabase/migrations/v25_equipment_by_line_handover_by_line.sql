-- ============================================================
-- v25: equipment is registered per production line, and shift
--      handovers are written per line (each line has its own
--      shift personnel).
-- Safe to run on an existing database (idempotent).
-- Run in: Supabase Dashboard -> SQL Editor (after v24).
-- ============================================================

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
