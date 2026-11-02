-- ============================================================
-- France Santé Transport — Commandes d'enlèvement fournisseur
--   * le fournisseur soumet une demande d'enlèvement (adresse,
--     date, destinataires, lots) ;
--   * l'admin / le dispatcher la consulte, la confirme et peut la
--     convertir en planning de livraison existant.
-- Migration strictement additive.
-- ============================================================

create type public.pickup_order_status as enum (
  'submitted',
  'confirmed',
  'planned',
  'completed',
  'cancelled'
);

-- ------------------------------------------------------------
-- 1) Commandes d'enlèvement
-- ------------------------------------------------------------
create table public.pickup_orders (
  id                    uuid primary key default gen_random_uuid(),
  supplier_id           uuid not null references public.suppliers (id) on delete restrict,
  warehouse_id          uuid not null references public.warehouses (id) on delete restrict,
  pickup_address        text not null check (length(trim(pickup_address)) between 3 and 500),
  pickup_contact_name   text check (pickup_contact_name is null or length(trim(pickup_contact_name)) between 1 and 200),
  pickup_contact_phone  text check (pickup_contact_phone is null or length(trim(pickup_contact_phone)) between 1 and 40),
  requested_pickup_date date not null,
  requested_window      text check (requested_window is null or length(trim(requested_window)) between 1 and 80),
  status                public.pickup_order_status not null default 'submitted',
  notes                 text check (notes is null or length(notes) <= 2000),
  admin_notes           text check (admin_notes is null or length(admin_notes) <= 2000),
  delivery_schedule_id  uuid references public.delivery_schedules (id) on delete set null,
  created_by            uuid not null references public.profiles (id) on delete restrict,
  confirmed_by          uuid references public.profiles (id) on delete set null,
  confirmed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index pickup_orders_supplier_idx
  on public.pickup_orders (supplier_id, requested_pickup_date desc);
create index pickup_orders_status_idx
  on public.pickup_orders (status, requested_pickup_date);
create index pickup_orders_schedule_idx
  on public.pickup_orders (delivery_schedule_id);

comment on table public.pickup_orders is
  'Commande d''enlèvement soumise par un fournisseur, traitée par le staff FST.';

create table public.pickup_order_lines (
  id                   uuid primary key default gen_random_uuid(),
  pickup_order_id      uuid not null references public.pickup_orders (id) on delete cascade,
  recipient_id         uuid not null references public.recipients (id) on delete restrict,
  product_reference_id uuid not null references public.product_references (id) on delete restrict,
  lot_id               uuid not null references public.lots (id) on delete restrict,
  quantity             numeric(14, 3) not null check (quantity > 0),
  unit                 text check (unit is null or length(trim(unit)) between 1 and 40),
  notes                text check (notes is null or length(notes) <= 1000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index pickup_order_lines_order_idx
  on public.pickup_order_lines (pickup_order_id);
create index pickup_order_lines_recipient_idx
  on public.pickup_order_lines (recipient_id);
create index pickup_order_lines_lot_idx
  on public.pickup_order_lines (lot_id);

comment on table public.pickup_order_lines is
  'Ligne d''une commande d''enlèvement : un lot destiné à un destinataire.';

-- ------------------------------------------------------------
-- 2) Création d'une commande (fournisseur ou staff)
-- ------------------------------------------------------------
create or replace function public.create_pickup_order(
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_pickup_address text,
  p_requested_pickup_date date,
  p_requested_window text default null,
  p_contact_name text default null,
  p_contact_phone text default null,
  p_notes text default null,
  p_lines jsonb default '[]'::jsonb
)
returns public.pickup_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.pickup_orders%rowtype;
  v_line record;
  v_reference public.product_references%rowtype;
  v_lot public.lots%rowtype;
  v_recipient public.recipients%rowtype;
  v_address text;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if not (public.is_staff() or public.owns_supplier(p_supplier_id)) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if p_warehouse_id is null or not exists (
    select 1 from public.warehouses where id = p_warehouse_id and active
  ) then
    raise exception 'Entrepôt invalide' using errcode = '22023';
  end if;
  if p_requested_pickup_date is null then
    raise exception 'Date d''enlèvement requise' using errcode = '22023';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Au moins une ligne est requise' using errcode = '22023';
  end if;

  v_address := nullif(trim(coalesce(p_pickup_address, '')), '');
  if v_address is null then
    select address into v_address from public.warehouses where id = p_warehouse_id;
  end if;
  if v_address is null or length(v_address) < 3 then
    raise exception 'Adresse d''enlèvement requise' using errcode = '22023';
  end if;

  insert into public.pickup_orders
    (supplier_id, warehouse_id, pickup_address, pickup_contact_name,
     pickup_contact_phone, requested_pickup_date, requested_window,
     notes, created_by)
  values
    (p_supplier_id, p_warehouse_id, v_address,
     nullif(trim(coalesce(p_contact_name, '')), ''),
     nullif(trim(coalesce(p_contact_phone, '')), ''),
     p_requested_pickup_date,
     nullif(trim(coalesce(p_requested_window, '')), ''),
     nullif(trim(coalesce(p_notes, '')), ''),
     auth.uid())
  returning * into v_order;

  for v_line in
    select *
      from jsonb_to_recordset(p_lines) as x(
        recipient_id uuid,
        product_reference_id uuid,
        lot_id uuid,
        quantity numeric,
        unit text,
        notes text
      )
  loop
    if v_line.quantity is null or v_line.quantity <= 0 then
      raise exception 'Quantité invalide' using errcode = '22023';
    end if;

    select * into v_lot from public.lots where id = v_line.lot_id;
    if not found then
      raise exception 'Lot introuvable' using errcode = 'P0002';
    end if;
    if v_lot.supplier_id is distinct from p_supplier_id then
      raise exception 'Ce lot n''appartient pas au fournisseur' using errcode = '42501';
    end if;
    if v_lot.warehouse_id is distinct from p_warehouse_id then
      raise exception 'Ce lot n''est pas stocké dans cet entrepôt' using errcode = '22023';
    end if;
    if v_line.product_reference_id is distinct from v_lot.product_reference_id then
      raise exception 'La référence ne correspond pas au lot' using errcode = '22023';
    end if;

    select * into v_recipient from public.recipients where id = v_line.recipient_id;
    if not found then
      raise exception 'Destinataire introuvable' using errcode = 'P0002';
    end if;
    if v_recipient.supplier_id is not null
       and v_recipient.supplier_id is distinct from p_supplier_id then
      raise exception 'Ce destinataire n''appartient pas au fournisseur' using errcode = '42501';
    end if;

    select * into v_reference
      from public.product_references
     where id = v_line.product_reference_id;

    insert into public.pickup_order_lines
      (pickup_order_id, recipient_id, product_reference_id, lot_id,
       quantity, unit, notes)
    values
      (v_order.id, v_line.recipient_id, v_line.product_reference_id, v_line.lot_id,
       v_line.quantity, coalesce(nullif(trim(coalesce(v_line.unit, '')), ''), v_reference.unit),
       nullif(trim(coalesce(v_line.notes, '')), ''));
  end loop;

  return v_order;
end;
$$;

-- ------------------------------------------------------------
-- 3) Traitement staff (confirmer / annuler / clôturer)
-- ------------------------------------------------------------
create or replace function public.set_pickup_order_status(
  p_order_id uuid,
  p_status public.pickup_order_status,
  p_admin_notes text default null
)
returns public.pickup_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.pickup_orders%rowtype;
begin
  perform public.assert_staff();

  select * into v_order
    from public.pickup_orders
   where id = p_order_id
   for update;
  if not found then
    raise exception 'Commande d''enlèvement introuvable' using errcode = 'P0002';
  end if;
  if v_order.status in ('completed', 'cancelled') and p_status <> v_order.status then
    raise exception 'Cette commande est clôturée' using errcode = 'P0001';
  end if;

  update public.pickup_orders
     set status = p_status,
         admin_notes = coalesce(nullif(trim(coalesce(p_admin_notes, '')), ''), admin_notes),
         confirmed_by = case when p_status = 'confirmed' then auth.uid() else confirmed_by end,
         confirmed_at = case when p_status = 'confirmed' then now() else confirmed_at end
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

-- ------------------------------------------------------------
-- 4) Conversion en planning de livraison
-- ------------------------------------------------------------
create or replace function public.convert_pickup_order_to_schedule(p_order_id uuid)
returns public.delivery_schedules
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.pickup_orders%rowtype;
  v_schedule public.delivery_schedules%rowtype;
begin
  perform public.assert_staff();

  select * into v_order
    from public.pickup_orders
   where id = p_order_id
   for update;
  if not found then
    raise exception 'Commande d''enlèvement introuvable' using errcode = 'P0002';
  end if;
  if v_order.status in ('cancelled', 'completed') then
    raise exception 'Cette commande est clôturée' using errcode = 'P0001';
  end if;
  if v_order.delivery_schedule_id is not null then
    select * into v_schedule
      from public.delivery_schedules
     where id = v_order.delivery_schedule_id;
    if found then
      return v_schedule;
    end if;
  end if;
  if not exists (select 1 from public.pickup_order_lines where pickup_order_id = p_order_id) then
    raise exception 'La commande ne contient aucune ligne' using errcode = 'P0001';
  end if;

  insert into public.delivery_schedules
    (supplier_id, warehouse_id, label, requested_date, status, notes, created_by)
  values
    (v_order.supplier_id, v_order.warehouse_id,
     'Enlèvement ' || to_char(v_order.requested_pickup_date, 'DD/MM/YYYY'),
     v_order.requested_pickup_date, 'draft',
     coalesce(v_order.notes, v_order.admin_notes), auth.uid())
  returning * into v_schedule;

  insert into public.delivery_schedule_lines
    (delivery_schedule_id, recipient_id, product_reference_id, lot_id,
     quantity, unit, notes)
  select v_schedule.id, l.recipient_id, l.product_reference_id, l.lot_id,
         l.quantity, l.unit, l.notes
    from public.pickup_order_lines l
   where l.pickup_order_id = p_order_id;

  update public.pickup_orders
     set status = 'planned',
         delivery_schedule_id = v_schedule.id
   where id = p_order_id;

  return v_schedule;
end;
$$;

-- ------------------------------------------------------------
-- 5) Privilèges et RLS
-- ------------------------------------------------------------
revoke all on table public.pickup_orders from anon, authenticated, service_role;
grant select on table public.pickup_orders to authenticated;
grant all on table public.pickup_orders to service_role;

revoke all on table public.pickup_order_lines from anon, authenticated, service_role;
grant select on table public.pickup_order_lines to authenticated;
grant all on table public.pickup_order_lines to service_role;

alter table public.pickup_orders enable row level security;
alter table public.pickup_order_lines enable row level security;

drop policy if exists pickup_orders_select on public.pickup_orders;
create policy pickup_orders_select
  on public.pickup_orders for select to authenticated
  using (public.is_staff() or public.owns_supplier(supplier_id));

drop policy if exists pickup_order_lines_select on public.pickup_order_lines;
create policy pickup_order_lines_select
  on public.pickup_order_lines for select to authenticated
  using (
    exists (
      select 1
        from public.pickup_orders o
       where o.id = pickup_order_id
         and (public.is_staff() or public.owns_supplier(o.supplier_id))
    )
  );

-- ------------------------------------------------------------
-- 6) Triggers updated_at
-- ------------------------------------------------------------
drop trigger if exists pickup_orders_updated_at on public.pickup_orders;
create trigger pickup_orders_updated_at
  before update on public.pickup_orders
  for each row execute function moddatetime (updated_at);

drop trigger if exists pickup_order_lines_updated_at on public.pickup_order_lines;
create trigger pickup_order_lines_updated_at
  before update on public.pickup_order_lines
  for each row execute function moddatetime (updated_at);

-- ------------------------------------------------------------
-- 7) Exécution des RPC
-- ------------------------------------------------------------
revoke execute on function public.create_pickup_order(uuid, uuid, text, date, text, text, text, text, jsonb)
  from public, anon;
grant execute on function public.create_pickup_order(uuid, uuid, text, date, text, text, text, text, jsonb)
  to authenticated, service_role;

revoke execute on function public.set_pickup_order_status(uuid, public.pickup_order_status, text)
  from public, anon;
grant execute on function public.set_pickup_order_status(uuid, public.pickup_order_status, text)
  to authenticated, service_role;

revoke execute on function public.convert_pickup_order_to_schedule(uuid)
  from public, anon;
grant execute on function public.convert_pickup_order_to_schedule(uuid)
  to authenticated, service_role;
