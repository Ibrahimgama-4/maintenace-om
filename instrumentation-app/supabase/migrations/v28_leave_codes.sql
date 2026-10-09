-- ============================================================
-- v28: Leave on the duty roster: AL (annual), SL (sick), CA (casual).
-- Leave days are stored as duty changes, so yearly counts per person are always
-- worked out from the roster itself.
-- Safe to run on an existing database (idempotent). Run after v27.
-- ============================================================
alter table duty_overrides drop constraint if exists duty_overrides_code_check;
alter table duty_overrides add constraint duty_overrides_code_check
  check (code in ('D', 'N', 'O', 'G', 'AL', 'SL', 'CA'));

create index if not exists duty_overrides_staff_date_idx on duty_overrides (staff_id, duty_date);
