create or replace function public.assign_driver(
  p_shipment_id uuid,
  p_driver_id uuid,
  p_vehicle_id uuid
)
returns public.driver_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shipment public.shipments%rowtype;
  v_driver public.profiles%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_assignment public.driver_assignments%rowtype;
  v_existing public.driver_assignments%rowtype;
begin
  perform public.assert_staff();

  select * into v_shipment from public.shipments where id = p_shipment_id for update;
  if not found then
    raise exception 'Mission introuvable' using errcode = 'P0002';
  end if;
  if v_shipment.status not in ('pending_confirmation', 'confirmed', 'in_progress') then
    raise exception 'Affectation impossible : la mission est au statut « % »', v_shipment.status
      using errcode = 'P0001';
  end if;

  select * into v_driver from public.profiles where id = p_driver_id;
  if not found then
    raise exception 'Chauffeur introuvable' using errcode = 'P0002';
  end if;
  if v_driver.role <> 'driver' then
    raise exception 'Le profil sélectionné n''est pas un chauffeur' using errcode = '22023';
  end if;

  select * into v_vehicle from public.vehicles where id = p_vehicle_id for update;
  if not found then
    raise exception 'Véhicule introuvable' using errcode = 'P0002';
  end if;
  if not v_vehicle.active then
    raise exception 'Ce véhicule n''est pas disponible' using errcode = '22023';
  end if;

  select * into v_existing
    from public.driver_assignments
   where shipment_id = p_shipment_id
     and status in ('proposed', 'accepted')
   for update;

  if found and v_existing.driver_id = p_driver_id and v_existing.vehicle_id = p_vehicle_id then
    return v_existing;
  end if;

  if found then
    update public.driver_assignments
       set status = 'cancelled',
           responded_at = coalesce(responded_at, now())
     where id = v_existing.id;
    perform internal.log_event(
      p_type => 'driver_response',
      p_shipment_id => p_shipment_id,
      p_payload => jsonb_build_object('cancelled', true, 'reason', 'reassignment')
    );
  end if;

  insert into public.driver_assignments (shipment_id, driver_id, vehicle_id, assigned_by)
  values (p_shipment_id, p_driver_id, p_vehicle_id, auth.uid())
  returning * into v_assignment;

  perform internal.log_event(
    p_type => 'driver_assigned',
    p_shipment_id => p_shipment_id,
    p_payload => jsonb_build_object('driver_id', p_driver_id, 'vehicle_id', p_vehicle_id)
  );

  return v_assignment;
end;
$$;

create or replace function public.cancel_driver_assignment(p_assignment_id uuid)
returns public.driver_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.driver_assignments%rowtype;
begin
  perform public.assert_staff();

  select * into v_assignment
    from public.driver_assignments
   where id = p_assignment_id
   for update;
  if not found then
    raise exception 'Affectation introuvable' using errcode = 'P0002';
  end if;
  if v_assignment.status not in ('proposed', 'accepted') then
    raise exception 'Cette affectation n''est plus active' using errcode = 'P0001';
  end if;

  update public.driver_assignments
     set status = 'cancelled',
         responded_at = coalesce(responded_at, now())
   where id = p_assignment_id
   returning * into v_assignment;

  perform internal.log_event(
    p_type => 'driver_response',
    p_shipment_id => v_assignment.shipment_id,
    p_payload => jsonb_build_object('cancelled', true)
  );

  return v_assignment;
end;
$$;

revoke execute on function public.assign_driver(uuid, uuid, uuid) from public, anon, authenticated, service_role;
grant execute on function public.assign_driver(uuid, uuid, uuid) to authenticated, postgres, service_role;

revoke execute on function public.cancel_driver_assignment(uuid) from public, anon, authenticated, service_role;
grant execute on function public.cancel_driver_assignment(uuid) to authenticated, postgres, service_role;

create or replace function public.create_invoice_from_quote(p_quote_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote record;
  v_client uuid;
  v_amount numeric;
  v_year text := to_char(current_date, 'YYYY');
  v_next int;
  v_number text;
  v_invoice public.invoices;
begin
  select q.*, r.client_id as req_client_id
    into v_quote
    from public.quotes q
    join public.transport_requests r on r.id = q.transport_request_id
   where q.id = p_quote_id;
  if not found then
    raise exception 'Devis introuvable' using errcode = 'P0002';
  end if;

  if not (public.is_staff() or v_quote.req_client_id = auth.uid()) then
    raise exception 'Accès réservé au client du devis' using errcode = '42501';
  end if;
  if v_quote.status <> 'accepted' then
    raise exception 'Seul un devis accepté peut être facturé' using errcode = 'P0001';
  end if;

  select * into v_invoice from public.invoices where quote_id = p_quote_id;
  if found then
    return v_invoice;
  end if;

  v_client := v_quote.req_client_id;

  v_amount := coalesce(
    (select sum(l.quantity * l.unit_price) from public.quote_lines l where l.quote_id = p_quote_id),
    v_quote.amount
  );

  v_next := 1 + coalesce((
    select max(substring(i.invoice_number from '[0-9]+$')::int)
      from public.invoices i
     where i.invoice_number like 'FST-' || v_year || '-%'
  ), 0);
  v_number := 'FST-' || v_year || '-' || lpad(v_next::text, 4, '0');

  insert into public.invoices (quote_id, invoice_number, client_id, amount, currency,
                               vat_rate, status, issued_at, due_at)
  values (p_quote_id, v_number, v_client, v_amount, v_quote.currency,
          0, 'issued', current_date, current_date + interval '30 days')
  returning * into v_invoice;

  return v_invoice;
end;
$$;

revoke all on function public.create_invoice_from_quote(uuid) from public, anon;
grant execute on function public.create_invoice_from_quote(uuid) to authenticated, postgres, service_role;
