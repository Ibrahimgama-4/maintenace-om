-- ============================================================
-- v23: automatic spare-part stock deduction + indexes for the
--      new Calendar and Team Workload pages.
-- Safe to run on an existing database (idempotent).
-- Run in: Supabase Dashboard -> SQL Editor.
-- ============================================================

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
