-- ============================================================
-- France Santé Transport — Migration 12 : suivi client
-- Position du chauffeur d'une mission, exposée au client
-- propriétaire de la demande (et aux membres de son organisation)
-- sans élargir la politique RLS de driver_positions.
-- ============================================================

-- ------------------------------------------------------------
-- shipment_driver_position : renvoie la position partagée du
-- chauffeur affecté à une mission, uniquement si l'appelant peut
-- voir cette mission (propriétaire de la demande, membre de
-- l'organisation, staff ou chauffeur affecté). Si aucune position
-- n'est partagée, renvoie un enregistrement avec shared = false
-- et lat/lng à null (le client sait alors que le partage est off).
-- ------------------------------------------------------------
create or replace function public.shipment_driver_position(p_shipment_id uuid)
returns table (
  lat double precision,
  lng double precision,
  accuracy double precision,
  shared boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_org_id uuid;
  v_can_view boolean;
  v_driver_id uuid;
begin
  select s.transport_request_id, s.organization_id
    into v_request_id, v_org_id
    from public.shipments s
   where s.id = p_shipment_id;

  if v_request_id is null then
    raise exception 'Mission introuvable' using errcode = 'P0002';
  end if;

  -- Peut voir : propriétaire de la demande, membre de l'organisation,
  -- staff, ou chauffeur affecté à cette mission.
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
    raise exception 'Accès refusé à cette mission' using errcode = '42501';
  end if;

  -- Chauffeur actif sur la mission : affectation acceptée/proposée en priorité,
  -- sinon n'importe quelle affectation non annulée/refusée.
  select a.driver_id
    into v_driver_id
    from public.driver_assignments a
   where a.shipment_id = p_shipment_id
     and a.status in ('accepted', 'proposed', 'completed')
   order by (a.status = 'accepted') desc, a.assigned_at desc
   limit 1;

  if v_driver_id is null then
    return query select null::double precision, null::double precision,
                        null::double precision, false, null::timestamptz;
    return;
  end if;

  return query
    select dp.lat, dp.lng, dp.accuracy, dp.shared, dp.updated_at
      from public.driver_positions dp
     where dp.driver_id = v_driver_id;

  if not found then
    return query select null::double precision, null::double precision,
                        null::double precision, false, null::timestamptz;
  end if;
end;
$$;

comment on function public.shipment_driver_position(uuid) is
  'Position partagée du chauffeur affecté à une mission, pour le client propriétaire (contrôle d''accès interne).';

revoke execute on function public.shipment_driver_position(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.shipment_driver_position(uuid)
  to authenticated, postgres, service_role;
