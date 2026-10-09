-- ============================================================
-- v29: remember each person's chosen shift on the Calendar, so it follows
-- them to any phone. Safe to run on an existing database (idempotent).
-- Run after v28.
-- ============================================================
alter table profiles add column if not exists calendar_shift text;
alter table profiles drop constraint if exists profiles_calendar_shift_check;
alter table profiles add constraint profiles_calendar_shift_check check (calendar_shift in ('A', 'B', 'C', 'G', 'none'));
-- Everyone can already update their own profile row, so no new policy is needed.
