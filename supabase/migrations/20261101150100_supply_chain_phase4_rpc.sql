-- ============================================================
-- France Santé Transport — Phase 4 : RPC de programmation,
-- réception de stock, affectation de mission et preuve de
-- livraison. Toutes les fonctions sont SECURITY DEFINER et
-- vérifient explicitement les droits (staff / fournisseur /
-- chauffeur affecté).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Créer un planning (brouillon)
-- ------------------------------------------------------------
create or replace function public.create_delivery_schedule(
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_requested_date date,
  p_label text default null,
  p_notes text default null
)
returns public.delivery_schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.delivery_schedules%rowtype;
begin
  if not (public.is_staff() or public.owns_supplier(p_supplier_id)) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;

  if not exists (select 1 from public.suppliers where id = p_supplier_id and active) then
    raise exception 'Fournisseur introuvable ou inactif' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.warehouses where id = p_warehouse_id and active) then
    raise exception 'Entrepôt introuvable ou inactif' using errcode = 'P0002';
  end if;
  if p_requested_date is null or p_requested_date < current_date then
    raise exception 'Date de livraison invalide' using errcode = '22023';
  end if;

  insert into public.delivery_schedules
    (supplier_id, warehouse_id, requested_date, label, notes, created_by)
  values
    (p_supplier_id, p_warehouse_id, p_requested_date,
     nullif(trim(coalesce(p_label, '')), ''),
     nullif(trim(coalesce(p_notes, '')), ''),
     auth.uid())
  returning * into v_row;

  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- 2) Ajouter une ligne au planning
-- ------------------------------------------------------------
create or replace function public.add_delivery_schedule_line(
  p_schedule_id uuid,
  p_recipient_id uuid,
  p_lot_id uuid,
  p_quantity numeric,
  p_unit text default null,
  p_notes text default null
)
returns public.delivery_schedule_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.delivery_schedules%rowtype;
  v_lot public.lots%rowtype;
  v_recipient public.recipients%rowtype;
  v_row public.delivery_schedule_lines%rowtype;
begin
  select * into v_schedule from public.delivery_schedules
   where id = p_schedule_id for update;
  if not found then
    raise exception 'Planning introuvable' using errcode = 'P0002';
  end if;
  if not (public.is_staff() or public.owns_delivery_schedule(p_schedule_id)) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_schedule.status <> 'draft' then
    raise exception 'Ce planning n''est plus modifiable' using errcode = 'P0001';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantité invalide' using errcode = '22023';
  end if;

  select * into v_lot from public.lots where id = p_lot_id for update;
  if not found then
    raise exception 'Lot introuvable' using errcode = 'P0002';
  end if;
  if v_lot.supplier_id <> v_schedule.supplier_id then
    raise exception 'Ce lot appartient à un autre fournisseur' using errcode = '42501';
  end if;
  if v_lot.warehouse_id <> v_schedule.warehouse_id then
    raise exception 'Ce lot n''est pas stocké dans l''entrepôt du planning' using errcode = '22023';
  end if;

  select * into v_recipient
    from public.recipients
   where id = p_recipient_id and active;
  if not found then
    raise exception 'Destinataire introuvable ou inactif' using errcode = 'P0002';
  end if;
  if v_recipient.supplier_id is not null
     and v_recipient.supplier_id <> v_schedule.supplier_id then
    raise exception 'Ce destinataire appartient à un autre fournisseur' using errcode = '42501';
  end if;

  insert into public.delivery_schedule_lines
    (delivery_schedule_id, recipient_id, product_reference_id, lot_id,
     quantity, unit, notes)
  values
    (p_schedule_id, p_recipient_id, v_lot.product_reference_id, p_lot_id,
     p_quantity,
     nullif(trim(coalesce(p_unit, '')), ''),
     nullif(trim(coalesce(p_notes, '')), ''))
  returning * into v_row;

  return v_row;
end;
$$;

-- ------------------------------------------------------------
-- 3) Modifier un planning (brouillon)
-- ------------------------------------------------------------
create or replace function public.update_delivery_schedule(
  p_schedule_id uuid,
  p_label text default null,
  p_notes text default null,
  p_requested_date date default null,
  p_warehouse_id uuid default null
)
returns public.delivery_schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.delivery_schedules%rowtype;
begin
  select * into v_schedule from public.delivery_schedules
   where id = p_schedule_id for update;
  if not found then
    raise exception 'Planning introuvable' using errcode = 'P0002';
  end if;
  if not (public.is_staff() or public.owns_delivery_schedule(p_schedule_id)) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_schedule.status <> 'draft' then
    raise exception 'Ce planning n''est plus modifiable' using errcode = 'P0001';
  end if;

  if p_requested_date is not null and p_requested_date < current_date then
    raise exception 'Date de livraison invalide' using errcode = '22023';
  end if;

  if p_warehouse_id is not null and p_warehouse_id <> v_schedule.warehouse_id then
    if exists (
      select 1 from public.delivery_schedule_lines
       where delivery_schedule_id = p_schedule_id
    ) then
      raise exception 'Impossible de changer d''entrepôt avec des lignes existantes'
        using errcode = 'P0001';
    end if;
    if not exists (select 1 from public.warehouses where id = p_warehouse_id and active) then
      raise exception 'Entrepôt introuvable ou inactif' using errcode = 'P0002';
    end if;
  end if;

  update public.delivery_schedules
     set label = coalesce(nullif(trim(coalesce(p_label, '')), ''), label),
         notes = coalesce(nullif(trim(coalesce(p_notes, '')), ''), notes),
         requested_date = coalesce(p_requested_date, requested_date),
         warehouse_id = coalesce(p_warehouse_id, warehouse_id)
   where id = p_schedule_id
   returning * into v_schedule;

  return v_schedule;
end;
$$;

-- ------------------------------------------------------------
-- 4) Supprimer un planning (brouillon)
-- ------------------------------------------------------------
create or replace function public.delete_delivery_schedule(p_schedule_id uuid)
returns public.delivery_schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.delivery_schedules%rowtype;
begin
  select * into v_schedule from public.delivery_schedules
   where id = p_schedule_id for update;
  if not found then
    raise exception 'Planning introuvable' using errcode = 'P0002';
  end if;
  if not (public.is_staff() or public.owns_delivery_schedule(p_schedule_id)) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_schedule.status <> 'draft' then
    raise exception 'Seul un brouillon peut être supprimé' using errcode = 'P0001';
  end if;

  delete from public.delivery_schedules
   where id = p_schedule_id
   returning * into v_schedule;

  return v_schedule;
end;
$$;

-- ------------------------------------------------------------
-- 5) Supprimer une ligne de planning (brouillon)
-- ------------------------------------------------------------
create or replace function public.remove_delivery_schedule_line(p_line_id uuid)
returns public.delivery_schedule_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line public.delivery_schedule_lines%rowtype;
  v_schedule public.delivery_schedules%rowtype;
begin
  select * into v_line from public.delivery_schedule_lines
   where id = p_line_id for update;
  if not found then
    raise exception 'Ligne introuvable' using errcode = 'P0002';
  end if;

  select * into v_schedule from public.delivery_schedules
   where id = v_line.delivery_schedule_id for update;
  if not (public.is_staff() or public.owns_delivery_schedule(v_schedule.id)) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_schedule.status <> 'draft' then
    raise exception 'Ce planning n''est plus modifiable' using errcode = 'P0001';
  end if;

  delete from public.delivery_schedule_lines
   where id = p_line_id
   returning * into v_line;

  return v_line;
end;
$$;

-- ------------------------------------------------------------
-- 6) Valider un planning : réserve atomiquement le stock
-- ------------------------------------------------------------
create or replace function public.validate_delivery_schedule(p_schedule_id uuid)
returns public.delivery_schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.delivery_schedules%rowtype;
  v_line record;
  v_level public.stock_levels%rowtype;
  v_available numeric;
begin
  select * into v_schedule from public.delivery_schedules
   where id = p_schedule_id for update;
  if not found then
    raise exception 'Planning introuvable' using errcode = 'P0002';
  end if;
  if not (public.is_staff() or public.owns_delivery_schedule(p_schedule_id)) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_schedule.status <> 'draft' then
    raise exception 'Seul un brouillon peut être validé' using errcode = 'P0001';
  end if;
  if v_schedule.requested_date < current_date then
    raise exception 'La date de livraison est passée' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.delivery_schedule_lines
     where delivery_schedule_id = p_schedule_id
  ) then
    raise exception 'Le planning ne contient aucune ligne' using errcode = 'P0001';
  end if;

  -- Agrégation par lot pour contrôler le stock global du planning.
  for v_line in
    select lot_id, sum(quantity) as qty
      from public.delivery_schedule_lines
     where delivery_schedule_id = p_schedule_id
     group by lot_id
     order by lot_id
  loop
    select * into v_level
      from public.stock_levels
     where lot_id = v_line.lot_id
       and warehouse_id = v_schedule.warehouse_id
     for update;
    if not found then
      raise exception 'Stock introuvable pour le lot %', v_line.lot_id
        using errcode = 'P0001';
    end if;

    v_available := v_level.qty_on_hand - v_level.qty_reserved - v_level.qty_shipped;
    if v_available < v_line.qty then
      raise exception 'Stock insuffisant pour le lot % : disponible %, demandé %',
        v_line.lot_id, v_available, v_line.qty
        using errcode = 'P0001';
    end if;

    update public.stock_levels
       set qty_reserved = qty_reserved + v_line.qty,
           updated_at = now()
     where id = v_level.id;

    insert into public.stock_movements
      (lot_id, warehouse_id, movement_type, quantity,
       reference_type, reference_id, note, created_by)
    values
      (v_line.lot_id, v_schedule.warehouse_id, 'reservation', v_line.qty,
       'delivery_schedule', p_schedule_id,
       'Réservation à la validation du planning', auth.uid());
  end loop;

  update public.delivery_schedules
     set status = 'validated',
         validated_at = now(),
         validated_by = auth.uid()
   where id = p_schedule_id
   returning * into v_schedule;

  return v_schedule;
end;
$$;

-- ------------------------------------------------------------
-- 7) Transmettre un planning validé : génère préparation + livraisons
-- ------------------------------------------------------------
create or replace function public.transmit_delivery_schedule(p_schedule_id uuid)
returns public.delivery_schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.delivery_schedules%rowtype;
  v_order public.preparation_orders%rowtype;
begin
  select * into v_schedule from public.delivery_schedules
   where id = p_schedule_id for update;
  if not found then
    raise exception 'Planning introuvable' using errcode = 'P0002';
  end if;
  if not (public.is_staff() or public.owns_delivery_schedule(p_schedule_id)) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_schedule.status <> 'validated' then
    raise exception 'Seul un planning validé peut être transmis' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.delivery_schedule_lines
     where delivery_schedule_id = p_schedule_id
  ) then
    raise exception 'Le planning ne contient aucune ligne' using errcode = 'P0001';
  end if;

  insert into public.preparation_orders (delivery_schedule_id, warehouse_id)
  values (p_schedule_id, v_schedule.warehouse_id)
  on conflict (delivery_schedule_id) do nothing;

  select * into v_order
    from public.preparation_orders
   where delivery_schedule_id = p_schedule_id;

  insert into public.preparation_order_lines
    (preparation_order_id, schedule_line_id, quantity_to_prepare)
  select v_order.id, l.id, l.quantity
    from public.delivery_schedule_lines l
   where l.delivery_schedule_id = p_schedule_id
  on conflict (preparation_order_id, schedule_line_id) do nothing;

  insert into public.deliveries (delivery_schedule_id, recipient_id, status)
  select p_schedule_id, l.recipient_id, 'pending'
    from public.delivery_schedule_lines l
   where l.delivery_schedule_id = p_schedule_id
   group by l.recipient_id
  on conflict (delivery_schedule_id, recipient_id) do nothing;

  insert into public.delivery_items
    (delivery_id, schedule_line_id, lot_id, quantity, unit)
  select d.id, l.id, l.lot_id, l.quantity, l.unit
    from public.delivery_schedule_lines l
    join public.deliveries d
      on d.delivery_schedule_id = l.delivery_schedule_id
     and d.recipient_id = l.recipient_id
   where l.delivery_schedule_id = p_schedule_id
  on conflict (schedule_line_id) do nothing;

  update public.delivery_schedules
     set status = 'transmitted',
         transmitted_at = now()
   where id = p_schedule_id
   returning * into v_schedule;

  return v_schedule;
end;
$$;

-- ------------------------------------------------------------
-- 7 bis) Annuler un planning et libérer le stock réservé
-- ------------------------------------------------------------
create or replace function public.cancel_delivery_schedule(p_schedule_id uuid)
returns public.delivery_schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_schedule public.delivery_schedules%rowtype;
  v_line record;
  v_level public.stock_levels%rowtype;
begin
  select * into v_schedule from public.delivery_schedules
   where id = p_schedule_id for update;
  if not found then
    raise exception 'Planning introuvable' using errcode = 'P0002';
  end if;
  if not (public.is_staff() or public.owns_delivery_schedule(p_schedule_id)) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_schedule.status = 'transmitted' then
    raise exception 'Un planning transmis ne peut plus être annulé' using errcode = 'P0001';
  end if;
  if v_schedule.status = 'cancelled' then
    return v_schedule;
  end if;

  if v_schedule.status = 'validated' then
    for v_line in
      select lot_id, sum(quantity) as qty
        from public.delivery_schedule_lines
       where delivery_schedule_id = p_schedule_id
       group by lot_id
       order by lot_id
    loop
      select * into v_level
        from public.stock_levels
       where lot_id = v_line.lot_id
         and warehouse_id = v_schedule.warehouse_id
       for update;

      if found then
        update public.stock_levels
           set qty_reserved = greatest(qty_reserved - v_line.qty, 0),
               updated_at = now()
         where id = v_level.id;

        insert into public.stock_movements
          (lot_id, warehouse_id, movement_type, quantity,
           reference_type, reference_id, note, created_by)
        values
          (v_line.lot_id, v_schedule.warehouse_id, 'release', v_line.qty,
           'delivery_schedule', p_schedule_id,
           'Libération après annulation du planning', auth.uid());
      end if;
    end loop;
  end if;

  update public.delivery_schedules
     set status = 'cancelled'
   where id = p_schedule_id
   returning * into v_schedule;

  return v_schedule;
end;
$$;

-- ------------------------------------------------------------
-- 8) Réception de stock (fournisseur ou staff)
-- ------------------------------------------------------------
create or replace function public.receive_stock(
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_product_reference_id uuid,
  p_lot_number text,
  p_quantity numeric,
  p_expiry_date date default null,
  p_reference_type text default 'manual',
  p_reference_id uuid default null,
  p_note text default null
)
returns public.stock_levels
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reference_id uuid;
  v_lot_id uuid;
  v_lot_supplier uuid;
  v_level public.stock_levels%rowtype;
begin
  if not (public.is_staff() or public.owns_supplier(p_supplier_id)) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantité invalide' using errcode = '22023';
  end if;
  if p_lot_number is null or length(trim(p_lot_number)) = 0 then
    raise exception 'Numéro de lot requis' using errcode = '22023';
  end if;

  select pr.id into v_reference_id
    from public.product_references pr
    join public.products p on p.id = pr.product_id
   where pr.id = p_product_reference_id
     and p.supplier_id = p_supplier_id;
  if v_reference_id is null then
    raise exception 'Référence produit hors fournisseur' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.warehouses where id = p_warehouse_id and active
  ) then
    raise exception 'Entrepôt introuvable ou inactif' using errcode = 'P0002';
  end if;

  insert into public.lots
    (product_reference_id, supplier_id, warehouse_id, lot_number, expiry_date)
  values
    (p_product_reference_id, p_supplier_id, p_warehouse_id, trim(p_lot_number), p_expiry_date)
  on conflict (product_reference_id, lot_number, warehouse_id)
  do update set
    expiry_date = coalesce(excluded.expiry_date, lots.expiry_date),
    updated_at = now()
  returning id into v_lot_id;

  select supplier_id into v_lot_supplier from public.lots where id = v_lot_id;
  if v_lot_supplier <> p_supplier_id then
    raise exception 'Ce lot appartient à un autre fournisseur' using errcode = '42501';
  end if;

  insert into public.stock_levels (lot_id, warehouse_id, qty_on_hand)
  values (v_lot_id, p_warehouse_id, p_quantity)
  on conflict (lot_id, warehouse_id)
  do update set
    qty_on_hand = stock_levels.qty_on_hand + excluded.qty_on_hand,
    updated_at = now()
  returning * into v_level;

  insert into public.stock_movements
    (lot_id, warehouse_id, movement_type, quantity,
     reference_type, reference_id, note, created_by)
  values
    (v_lot_id, p_warehouse_id, 'receipt', p_quantity,
     coalesce(nullif(trim(coalesce(p_reference_type, '')), ''), 'manual'),
     p_reference_id,
     nullif(trim(coalesce(p_note, '')), ''),
     auth.uid());

  return v_level;
end;
$$;

-- ------------------------------------------------------------
-- 9) Programmer les rappels 48 h d'une livraison
-- ------------------------------------------------------------
create or replace function public.schedule_delivery_reminders(p_delivery_id uuid)
returns setof public.delivery_reminders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_schedule public.delivery_schedules%rowtype;
  v_recipient public.recipients%rowtype;
  v_supplier public.suppliers%rowtype;
  v_when timestamptz;
  v_payload jsonb;
begin
  select * into v_delivery from public.deliveries where id = p_delivery_id;
  if not found then
    raise exception 'Livraison introuvable' using errcode = 'P0002';
  end if;

  select * into v_schedule
    from public.delivery_schedules
   where id = v_delivery.delivery_schedule_id;

  if not (public.is_staff() or public.owns_supplier(v_schedule.supplier_id)) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_delivery.scheduled_at is null then
    raise exception 'Date de livraison non planifiée' using errcode = 'P0001';
  end if;

  select * into v_recipient from public.recipients where id = v_delivery.recipient_id;
  select * into v_supplier from public.suppliers where id = v_schedule.supplier_id;

  v_when := v_delivery.scheduled_at - interval '48 hours';
  v_payload := jsonb_build_object(
    'delivery_id', v_delivery.id,
    'recipient_id', v_recipient.id,
    'recipient_name', v_recipient.name,
    'recipient_email', v_recipient.email,
    'recipient_phone', v_recipient.phone,
    'supplier_id', v_supplier.id,
    'supplier_email', v_supplier.contact_email,
    'supplier_phone', v_supplier.contact_phone,
    'scheduled_at', v_delivery.scheduled_at
  );

  insert into public.delivery_reminders
    (delivery_id, channel, target, scheduled_for, payload)
  values
    (p_delivery_id, 'email', 'recipient', v_when, v_payload),
    (p_delivery_id, 'email', 'supplier', v_when, v_payload),
    (p_delivery_id, 'email', 'admin', v_when, v_payload)
  on conflict (delivery_id, channel, target) do nothing;

  if v_recipient.phone is not null then
    insert into public.delivery_reminders
      (delivery_id, channel, target, scheduled_for, payload)
    values (p_delivery_id, 'sms', 'recipient', v_when, v_payload)
    on conflict (delivery_id, channel, target) do nothing;
  end if;

  if v_supplier.contact_phone is not null then
    insert into public.delivery_reminders
      (delivery_id, channel, target, scheduled_for, payload)
    values (p_delivery_id, 'sms', 'supplier', v_when, v_payload)
    on conflict (delivery_id, channel, target) do nothing;
  end if;

  return query
    select * from public.delivery_reminders
     where delivery_id = p_delivery_id
     order by scheduled_for, channel, target;
end;
$$;

-- ------------------------------------------------------------
-- 10) Affecter une mission de livraison à un chauffeur
-- ------------------------------------------------------------
create or replace function public.assign_delivery_mission(
  p_delivery_id uuid,
  p_driver_id uuid,
  p_vehicle_id uuid
)
returns public.driver_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_schedule public.delivery_schedules%rowtype;
  v_shipment public.shipments%rowtype;
  v_assignment public.driver_assignments%rowtype;
begin
  perform public.assert_staff();

  select * into v_delivery from public.deliveries
   where id = p_delivery_id for update;
  if not found then
    raise exception 'Livraison introuvable' using errcode = 'P0002';
  end if;
  if v_delivery.status in ('delivered', 'cancelled') then
    raise exception 'Cette livraison est déjà clôturée' using errcode = 'P0001';
  end if;

  select * into v_schedule from public.delivery_schedules
   where id = v_delivery.delivery_schedule_id;

  if v_delivery.shipment_id is null then
    insert into public.shipments
      (transport_request_id, quote_id, organization_id, status, scheduled_at,
       mission_kind, delivery_schedule_id, warehouse_id, supplier_id, notes)
    values
      (null, null, null, 'pending_confirmation',
       coalesce(v_delivery.scheduled_at, v_schedule.requested_date::timestamptz),
       'goods_delivery', v_schedule.id, v_schedule.warehouse_id, v_schedule.supplier_id,
       'Mission de livraison de marchandises')
    returning * into v_shipment;
  else
    select * into v_shipment from public.shipments where id = v_delivery.shipment_id;
    if not found then
      raise exception 'Mission introuvable' using errcode = 'P0002';
    end if;
  end if;

  update public.deliveries
     set shipment_id = v_shipment.id,
         status = 'scheduled',
         scheduled_at = coalesce(scheduled_at, v_shipment.scheduled_at)
   where id = p_delivery_id
   returning * into v_delivery;

  v_assignment := public.assign_driver(v_shipment.id, p_driver_id, p_vehicle_id);

  perform public.schedule_delivery_reminders(p_delivery_id);

  return v_assignment;
end;
$$;

-- ------------------------------------------------------------
-- 11) Confirmer une livraison avec preuve et signature
-- ------------------------------------------------------------
create or replace function public.confirm_delivery_with_proof(
  p_delivery_id uuid,
  p_recipient_name text,
  p_signature_data text,
  p_note text default null,
  p_latitude numeric default null,
  p_longitude numeric default null
)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_delivery public.deliveries%rowtype;
  v_schedule public.delivery_schedules%rowtype;
  v_shipment public.shipments%rowtype;
  v_item record;
  v_level public.stock_levels%rowtype;
  v_proof public.delivery_proofs%rowtype;
  v_is_driver boolean;
  v_headers jsonb;
  v_ip text;
  v_user_agent text;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  select * into v_delivery from public.deliveries
   where id = p_delivery_id for update;
  if not found then
    raise exception 'Livraison introuvable' using errcode = 'P0002';
  end if;

  select exists (
    select 1
      from public.deliveries d
      join public.driver_assignments a on a.shipment_id = d.shipment_id
     where d.id = p_delivery_id
       and a.driver_id = auth.uid()
       and a.status = 'accepted'
  ) into v_is_driver;

  if not (public.is_staff() or v_is_driver) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if v_delivery.status = 'delivered' then
    raise exception 'Livraison déjà validée' using errcode = 'P0001';
  end if;
  if v_delivery.status = 'cancelled' then
    raise exception 'Livraison annulée' using errcode = 'P0001';
  end if;

  if p_recipient_name is null or length(trim(p_recipient_name)) < 2 then
    raise exception 'Nom du destinataire requis' using errcode = '22023';
  end if;
  if p_signature_data is null
     or position('data:image/png;base64,' in p_signature_data) <> 1
     or length(p_signature_data) > 400000 then
    raise exception 'Signature manuscrite attendue (PNG)' using errcode = '22023';
  end if;

  select * into v_schedule from public.delivery_schedules
   where id = v_delivery.delivery_schedule_id;
  if not found then
    raise exception 'Planning introuvable' using errcode = 'P0002';
  end if;

  v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  v_ip := nullif(v_headers ->> 'x-forwarded-for', '');
  v_user_agent := nullif(v_headers ->> 'user-agent', '');

  insert into public.delivery_proofs
    (delivery_id, shipment_id, recipient_name, signature_data, signature_hash,
     note, latitude, longitude, ip_address, user_agent, recorded_by)
  values
    (p_delivery_id, v_delivery.shipment_id, trim(p_recipient_name), p_signature_data,
     md5(p_signature_data), nullif(trim(coalesce(p_note, '')), ''),
     p_latitude, p_longitude, v_ip, v_user_agent, auth.uid())
  returning * into v_proof;

  insert into public.signatures
    (delivery_id, shipment_id, proof_id, signer_name, signature_data,
     signature_hash, ip_address, user_agent)
  values
    (p_delivery_id, v_delivery.shipment_id, v_proof.id, trim(p_recipient_name),
     p_signature_data, md5(p_signature_data), v_ip, v_user_agent);

  if v_delivery.shipment_id is not null then
    update public.shipments
       set phase = 'delivered',
           picked_up_at = coalesce(picked_up_at, now()),
           delivered_at = now(),
           status = 'completed',
           completed_at = now(),
           confirmed_at = coalesce(confirmed_at, now())
     where id = v_delivery.shipment_id
     returning * into v_shipment;

    update public.driver_assignments
       set status = 'completed'
     where shipment_id = v_delivery.shipment_id
       and status = 'accepted';

    perform internal.log_event(
      p_type => 'delivery_proved',
      p_shipment_id => v_delivery.shipment_id,
      p_payload => jsonb_build_object(
        'delivery_id', p_delivery_id,
        'recipient_name', trim(p_recipient_name),
        'note', nullif(trim(coalesce(p_note, '')), '')
      )
    );
  end if;

  for v_item in
    select lot_id, quantity
      from public.delivery_items
     where delivery_id = p_delivery_id
  loop
    select * into v_level
      from public.stock_levels
     where lot_id = v_item.lot_id
       and warehouse_id = v_schedule.warehouse_id
     for update;
    if not found then
      raise exception 'Stock introuvable pour le lot %', v_item.lot_id
        using errcode = 'P0001';
    end if;
    if v_level.qty_reserved < v_item.quantity then
      raise exception 'Réservation insuffisante pour le lot %', v_item.lot_id
        using errcode = 'P0001';
    end if;

    update public.stock_levels
       set qty_reserved = qty_reserved - v_item.quantity,
           qty_shipped = qty_shipped + v_item.quantity,
           updated_at = now()
     where id = v_level.id;

    insert into public.stock_movements
      (lot_id, warehouse_id, movement_type, quantity,
       reference_type, reference_id, note, created_by)
    values
      (v_item.lot_id, v_schedule.warehouse_id, 'shipment', v_item.quantity,
       'delivery', p_delivery_id, null, auth.uid());
  end loop;

  update public.deliveries
     set status = 'delivered',
         delivered_at = now()
   where id = p_delivery_id
   returning * into v_delivery;

  return v_delivery;
end;
$$;

-- ------------------------------------------------------------
-- 12) Permissions d'exécution
-- ------------------------------------------------------------
revoke execute on function public.create_delivery_schedule(uuid, uuid, date, text, text) from public, anon;
grant execute on function public.create_delivery_schedule(uuid, uuid, date, text, text) to authenticated, service_role;

revoke execute on function public.add_delivery_schedule_line(uuid, uuid, uuid, numeric, text, text) from public, anon;
grant execute on function public.add_delivery_schedule_line(uuid, uuid, uuid, numeric, text, text) to authenticated, service_role;

revoke execute on function public.update_delivery_schedule(uuid, text, text, date, uuid) from public, anon;
grant execute on function public.update_delivery_schedule(uuid, text, text, date, uuid) to authenticated, service_role;

revoke execute on function public.delete_delivery_schedule(uuid) from public, anon;
grant execute on function public.delete_delivery_schedule(uuid) to authenticated, service_role;

revoke execute on function public.remove_delivery_schedule_line(uuid) from public, anon;
grant execute on function public.remove_delivery_schedule_line(uuid) to authenticated, service_role;

revoke execute on function public.validate_delivery_schedule(uuid) from public, anon;
grant execute on function public.validate_delivery_schedule(uuid) to authenticated, service_role;

revoke execute on function public.transmit_delivery_schedule(uuid) from public, anon;
grant execute on function public.transmit_delivery_schedule(uuid) to authenticated, service_role;

revoke execute on function public.cancel_delivery_schedule(uuid) from public, anon;
grant execute on function public.cancel_delivery_schedule(uuid) to authenticated, service_role;

revoke execute on function public.receive_stock(uuid, uuid, uuid, text, numeric, date, text, uuid, text) from public, anon;
grant execute on function public.receive_stock(uuid, uuid, uuid, text, numeric, date, text, uuid, text) to authenticated, service_role;

revoke execute on function public.schedule_delivery_reminders(uuid) from public, anon;
grant execute on function public.schedule_delivery_reminders(uuid) to authenticated, service_role;

revoke execute on function public.assign_delivery_mission(uuid, uuid, uuid) from public, anon;
grant execute on function public.assign_delivery_mission(uuid, uuid, uuid) to authenticated, service_role;

revoke execute on function public.confirm_delivery_with_proof(uuid, text, text, text, numeric, numeric) from public, anon;
grant execute on function public.confirm_delivery_with_proof(uuid, text, text, text, numeric, numeric) to authenticated, service_role;
