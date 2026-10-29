-- Migration 17 : phases critiques et classe de vehicule

create type public.vehicle_class as enum ('moto', 'iveco', 'other');
create type public.mission_phase as enum ('validated', 'en_route', 'picked_up', 'in_transit', 'delivered');

alter table public.vehicles
  add column if not exists vehicle_class public.vehicle_class not null default 'other';

alter table public.shipments
  add column if not exists phase public.mission_phase not null default 'validated',
  add column if not exists picked_up_at timestamptz,
  add column if not exists delivered_at timestamptz;

create or replace function public.advance_mission_phase(p_shipment_id uuid, p_phase public.mission_phase)
returns public.shipments
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_row public.shipments%rowtype;
begin
  if not (public.is_staff() or exists (select 1 from public.driver_assignments a where a.shipment_id = p_shipment_id and a.driver_id = auth.uid() and a.status = 'accepted')) then
    raise exception 'Acces refuse';
  end if;
  update public.shipments set
    phase = p_phase,
    picked_up_at = case when p_phase = 'picked_up' then now() else picked_up_at end,
    delivered_at = case when p_phase = 'delivered' then now() else delivered_at end,
    status = case when p_phase = 'delivered' then 'completed' else status end
  where id = p_shipment_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Mission introuvable';
  end if;
  return v_row;
end;
$body$;

grant execute on function public.advance_mission_phase(uuid, public.mission_phase) to authenticated;


