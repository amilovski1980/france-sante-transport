-- Migration 14 : RPC shipment_track (polyline de trajet)

create or replace function public.shipment_track(
  p_shipment_id uuid,
  p_hours_before integer default 6
)
returns table (lat double precision, lng double precision, recorded_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $body$
declare
  v_request_id uuid;
  v_org_id uuid;
  v_scheduled timestamptz;
  v_can_view boolean;
  v_driver_id uuid;
begin
  select s.transport_request_id, s.organization_id, s.scheduled_at
    into v_request_id, v_org_id, v_scheduled
    from public.shipments s
   where s.id = p_shipment_id;

  if v_request_id is null then
    raise exception 'Mission introuvable';
  end if;

  select
    public.owns_request(v_request_id)
    or (v_org_id is not null and public.is_org_member(v_org_id))
    or public.is_staff()
    or exists (
      select 1 from public.driver_assignments a
       where a.shipment_id = p_shipment_id and a.driver_id = auth.uid()
    )
    into v_can_view;

  if not coalesce(v_can_view, false) then
    raise exception 'Acces refuse a cette mission';
  end if;

  select a.driver_id
    into v_driver_id
    from public.driver_assignments a
   where a.shipment_id = p_shipment_id
     and a.status in ('accepted', 'proposed', 'completed')
   order by (a.status = 'accepted') desc, a.assigned_at desc
   limit 1;

  if v_driver_id is null then
    return;
  end if;

  return query
    select h.lat, h.lng, h.recorded_at
      from public.driver_position_history h
     where h.driver_id = v_driver_id
       and h.recorded_at >= v_scheduled - make_interval(hours => greatest(coalesce(p_hours_before, 6), 1))
       and h.recorded_at <= v_scheduled + interval '12 hours'
     order by h.recorded_at asc;
end;
$body$;

revoke execute on function public.shipment_track(uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.shipment_track(uuid, integer)
  to authenticated, postgres, service_role;



