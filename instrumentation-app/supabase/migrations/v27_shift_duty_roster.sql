-- ============================================================
-- v27: Shift rotation (A, B, C: 3 mornings, 3 nights, 3 off) and the
--      monthly duty roster that admins arrange (D, N, O, G).
-- Safe to run on an existing database (idempotent). Run after v26.
-- ============================================================

-- The rotation anchor: where each shift is in its 9-day cycle on one reference date.
-- Cycle position 0-2 = Morning day 1-3, 3-5 = Night day 1-3, 6-8 = Off day 1-3.
create table if not exists shift_settings (
  id integer primary key default 1 check (id = 1),
  anchor_date date not null,
  a_offset integer not null check (a_offset between 0 and 8),
  b_offset integer not null check (b_offset between 0 and 8),
  c_offset integer not null check (c_offset between 0 and 8),
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id)
);
-- Initial values: on 2026-10-09 Shift B is on night day 3, Shift C on morning day 3, Shift A on off day 3.
-- An admin can correct this under Duty Roster -> Shift pattern.
insert into shift_settings (id, anchor_date, a_offset, b_offset, c_offset)
values (1, date '2026-10-09', 8, 5, 2)
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
  code text not null check (code in ('D', 'N', 'O', 'G', 'AL', 'SL', 'CA')),
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
