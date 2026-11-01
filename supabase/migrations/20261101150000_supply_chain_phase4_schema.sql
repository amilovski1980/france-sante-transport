-- ============================================================
-- France Santé Transport — Phase 4 : programmation de livraison,
-- préparation, livraisons, signatures et rappels.
--
-- Migration strictement additive :
--   * nouvelles tables de programmation / préparation / livraison ;
--   * extension de `shipments` et `delivery_proofs` par des colonnes
--     nullables, sans supprimer ni réécrire les données existantes ;
--   * RLS et helpers d'isolation fournisseur / chauffeur ;
--   * écritures réservées aux RPC (aucun grant INSERT/UPDATE direct
--     sur les nouvelles tables, sauf `delivery_proofs` historique).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Nouveaux types
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'delivery_schedule_status' and n.nspname = 'public'
  ) then
    execute $sql$
      create type public.delivery_schedule_status as enum (
        'draft', 'validated', 'transmitted', 'planned',
        'in_progress', 'completed', 'cancelled'
      )
    $sql$;
  end if;

  if not exists (
    select 1 from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'preparation_order_status' and n.nspname = 'public'
  ) then
    execute $sql$
      create type public.preparation_order_status as enum (
        'pending', 'preparing', 'ready', 'cancelled'
      )
    $sql$;
  end if;

  if not exists (
    select 1 from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'delivery_status' and n.nspname = 'public'
  ) then
    execute $sql$
      create type public.delivery_status as enum (
        'pending', 'scheduled', 'in_progress', 'delivered', 'failed', 'cancelled'
      )
    $sql$;
  end if;

  if not exists (
    select 1 from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'mission_kind' and n.nspname = 'public'
  ) then
    execute $sql$
      create type public.mission_kind as enum (
        'patient_transport', 'goods_delivery'
      )
    $sql$;
  end if;
end $$;

comment on type public.mission_kind is
  'Nature d''une mission : transport de patient ou livraison de marchandises.';

-- ------------------------------------------------------------
-- 2) Programmation de livraison (fournisseur → destinataires)
-- ------------------------------------------------------------
create table if not exists public.delivery_schedules (
  id             uuid primary key default gen_random_uuid(),
  supplier_id    uuid not null references public.suppliers (id) on delete restrict,
  warehouse_id   uuid not null references public.warehouses (id) on delete restrict,
  label          text check (label is null or length(trim(label)) between 1 and 200),
  requested_date date not null,
  status         public.delivery_schedule_status not null default 'draft',
  validated_at   timestamptz,
  validated_by   uuid references public.profiles (id) on delete set null,
  transmitted_at timestamptz,
  notes          text check (notes is null or length(notes) <= 2000),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint delivery_schedules_transmit_consistency check (
    transmitted_at is null or validated_at is not null
  )
);

create index if not exists delivery_schedules_supplier_idx
  on public.delivery_schedules (supplier_id, requested_date desc);
create index if not exists delivery_schedules_status_idx
  on public.delivery_schedules (status, requested_date);
create index if not exists delivery_schedules_warehouse_idx
  on public.delivery_schedules (warehouse_id);

comment on table public.delivery_schedules is
  'Planning de livraison d''un fournisseur vers un ou plusieurs destinataires.';

create table if not exists public.delivery_schedule_lines (
  id                   uuid primary key default gen_random_uuid(),
  delivery_schedule_id uuid not null references public.delivery_schedules (id) on delete cascade,
  recipient_id         uuid not null references public.recipients (id) on delete restrict,
  product_reference_id uuid not null references public.product_references (id) on delete restrict,
  lot_id               uuid not null references public.lots (id) on delete restrict,
  quantity             numeric(14, 3) not null check (quantity > 0),
  unit                 text check (unit is null or length(trim(unit)) between 1 and 40),
  notes                text check (notes is null or length(notes) <= 1000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists delivery_schedule_lines_schedule_idx
  on public.delivery_schedule_lines (delivery_schedule_id);
create index if not exists delivery_schedule_lines_lot_idx
  on public.delivery_schedule_lines (lot_id);
create index if not exists delivery_schedule_lines_recipient_idx
  on public.delivery_schedule_lines (recipient_id);

comment on table public.delivery_schedule_lines is
  'Ligne de planning : un lot destiné à un destinataire. Un même lot peut être éclaté entre plusieurs destinataires.';

-- ------------------------------------------------------------
-- 3) Ordres de préparation (FST)
-- ------------------------------------------------------------
create table if not exists public.preparation_orders (
  id                   uuid primary key default gen_random_uuid(),
  delivery_schedule_id uuid not null unique references public.delivery_schedules (id) on delete cascade,
  warehouse_id         uuid not null references public.warehouses (id) on delete restrict,
  status               public.preparation_order_status not null default 'pending',
  prepared_by          uuid references public.profiles (id) on delete set null,
  prepared_at          timestamptz,
  notes                text check (notes is null or length(notes) <= 2000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists preparation_orders_status_idx
  on public.preparation_orders (status, created_at desc);

comment on table public.preparation_orders is
  'Ordre de préparation généré à la transmission d''un planning de livraison.';

create table if not exists public.preparation_order_lines (
  id                   uuid primary key default gen_random_uuid(),
  preparation_order_id uuid not null references public.preparation_orders (id) on delete cascade,
  schedule_line_id     uuid not null references public.delivery_schedule_lines (id) on delete cascade,
  quantity_to_prepare  numeric(14, 3) not null check (quantity_to_prepare > 0),
  quantity_prepared    numeric(14, 3) not null default 0 check (quantity_prepared >= 0),
  status               text not null default 'pending'
    check (status in ('pending', 'partial', 'prepared')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (preparation_order_id, schedule_line_id)
);

create index if not exists preparation_order_lines_order_idx
  on public.preparation_order_lines (preparation_order_id);

comment on table public.preparation_order_lines is
  'Détail des marchandises à préparer pour un planning.';

-- ------------------------------------------------------------
-- 4) Livraisons et articles livrés
-- ------------------------------------------------------------
create table if not exists public.deliveries (
  id                   uuid primary key default gen_random_uuid(),
  delivery_schedule_id uuid not null references public.delivery_schedules (id) on delete cascade,
  recipient_id         uuid not null references public.recipients (id) on delete restrict,
  shipment_id          uuid references public.shipments (id) on delete set null,
  status               public.delivery_status not null default 'pending',
  scheduled_at         timestamptz,
  delivered_at         timestamptz,
  notes                text check (notes is null or length(notes) <= 1000),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (delivery_schedule_id, recipient_id),
  constraint deliveries_delivered_consistency check (
    (status = 'delivered' and delivered_at is not null)
    or (status <> 'delivered' and delivered_at is null)
  )
);

create index if not exists deliveries_schedule_idx
  on public.deliveries (delivery_schedule_id);
create index if not exists deliveries_shipment_idx
  on public.deliveries (shipment_id) where shipment_id is not null;
create index if not exists deliveries_status_idx
  on public.deliveries (status, scheduled_at);

comment on table public.deliveries is
  'Livraison d''un planning vers un destinataire, rattachée à une mission (shipments).';

create table if not exists public.delivery_items (
  id               uuid primary key default gen_random_uuid(),
  delivery_id      uuid not null references public.deliveries (id) on delete cascade,
  schedule_line_id uuid unique references public.delivery_schedule_lines (id) on delete set null,
  lot_id           uuid not null references public.lots (id) on delete restrict,
  quantity         numeric(14, 3) not null check (quantity > 0),
  unit             text check (unit is null or length(trim(unit)) between 1 and 40),
  created_at       timestamptz not null default now()
);

create index if not exists delivery_items_delivery_idx
  on public.delivery_items (delivery_id);
create index if not exists delivery_items_lot_idx
  on public.delivery_items (lot_id);

comment on table public.delivery_items is
  'Marchandises réellement rattachées à une livraison.';

-- ------------------------------------------------------------
-- 5) Extension de shipments (mission de livraison)
-- ------------------------------------------------------------
alter table public.shipments
  add column if not exists mission_kind public.mission_kind not null default 'patient_transport',
  add column if not exists delivery_schedule_id uuid
    references public.delivery_schedules (id) on delete set null,
  add column if not exists warehouse_id uuid
    references public.warehouses (id) on delete set null,
  add column if not exists supplier_id uuid
    references public.suppliers (id) on delete set null;

alter table public.shipments
  alter column transport_request_id drop not null,
  alter column quote_id drop not null;

alter table public.shipments drop constraint if exists shipments_mission_target;
alter table public.shipments add constraint shipments_mission_target check (
  (mission_kind = 'patient_transport'
    and transport_request_id is not null
    and quote_id is not null)
  or (mission_kind = 'goods_delivery' and delivery_schedule_id is not null)
);

create index if not exists shipments_delivery_schedule_idx
  on public.shipments (delivery_schedule_id) where delivery_schedule_id is not null;
create index if not exists shipments_supplier_idx
  on public.shipments (supplier_id) where supplier_id is not null;

comment on column public.shipments.mission_kind is
  'Transport de patient (historique) ou livraison de marchandises.';

-- ------------------------------------------------------------
-- 6) Extension de delivery_proofs (preuve par livraison)
-- ------------------------------------------------------------
alter table public.delivery_proofs
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists delivery_id uuid
    references public.deliveries (id) on delete cascade,
  add column if not exists signature_hash text,
  add column if not exists ip_address text,
  add column if not exists user_agent text;

alter table public.delivery_proofs alter column shipment_id drop not null;

-- Supprime l'ancienne contrainte UNIQUE (shipment_id) si elle existe,
-- quel que soit son nom, pour la remplacer par un index partiel.
do $$
declare
  v_constraint text;
begin
  select c.conname
    into v_constraint
    from pg_constraint c
   where c.conrelid = 'public.delivery_proofs'::regclass
     and c.contype = 'u'
     and c.conkey = array[
       (select a.attnum
          from pg_attribute a
         where a.attrelid = 'public.delivery_proofs'::regclass
           and a.attname = 'shipment_id')
     ];

  if v_constraint is not null then
    execute format('alter table public.delivery_proofs drop constraint %I', v_constraint);
  end if;
end $$;

create unique index if not exists delivery_proofs_legacy_shipment_uidx
  on public.delivery_proofs (shipment_id)
  where delivery_id is null;

create unique index if not exists delivery_proofs_delivery_uidx
  on public.delivery_proofs (delivery_id)
  where delivery_id is not null;

alter table public.delivery_proofs drop constraint if exists delivery_proofs_target;
alter table public.delivery_proofs add constraint delivery_proofs_target
  check (shipment_id is not null or delivery_id is not null);

-- ------------------------------------------------------------
-- 7) Signatures (traçabilité de la preuve)
-- ------------------------------------------------------------
create table if not exists public.signatures (
  id             uuid primary key default gen_random_uuid(),
  delivery_id    uuid references public.deliveries (id) on delete cascade,
  shipment_id    uuid references public.shipments (id) on delete cascade,
  proof_id       uuid references public.delivery_proofs (id) on delete cascade,
  signer_name    text not null check (length(trim(signer_name)) between 2 and 120),
  signature_data text not null,
  signature_hash text not null,
  signed_at      timestamptz not null default now(),
  ip_address     text,
  user_agent     text,
  created_at     timestamptz not null default now(),
  constraint signatures_target check (delivery_id is not null or shipment_id is not null)
);

create index if not exists signatures_delivery_idx
  on public.signatures (delivery_id) where delivery_id is not null;
create index if not exists signatures_shipment_idx
  on public.signatures (shipment_id) where shipment_id is not null;

comment on table public.signatures is
  'Signature manuscrite et empreinte associées à une preuve de livraison.';

-- ------------------------------------------------------------
-- 8) Rappels 48 h
-- ------------------------------------------------------------
create table if not exists public.delivery_reminders (
  id            uuid primary key default gen_random_uuid(),
  delivery_id   uuid not null references public.deliveries (id) on delete cascade,
  channel       text not null check (channel in ('email', 'sms')),
  target        text not null check (target in ('recipient', 'supplier', 'admin')),
  scheduled_for timestamptz not null,
  status        text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  sent_at       timestamptz,
  payload       jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (delivery_id, channel, target),
  constraint delivery_reminders_sent_consistency check (
    (status = 'sent' and sent_at is not null)
    or (status <> 'sent' and sent_at is null)
  )
);

create index if not exists delivery_reminders_due_idx
  on public.delivery_reminders (status, scheduled_for);

comment on table public.delivery_reminders is
  'Rappels programmés 48 h avant une livraison (email / SMS).';

-- ------------------------------------------------------------
-- 9) Helpers RLS
-- ------------------------------------------------------------
create or replace function public.owns_delivery_schedule(p_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.delivery_schedules s
     where s.id = p_schedule_id
       and public.owns_supplier(s.supplier_id)
  );
$$;

create or replace function public.owns_delivery(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.deliveries d
      join public.delivery_schedules s on s.id = d.delivery_schedule_id
     where d.id = p_delivery_id
       and public.owns_supplier(s.supplier_id)
  );
$$;

create or replace function public.owns_preparation_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.preparation_orders po
      join public.delivery_schedules s on s.id = po.delivery_schedule_id
     where po.id = p_order_id
       and public.owns_supplier(s.supplier_id)
  );
$$;

create or replace function public.driver_on_delivery(p_delivery_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.deliveries d
      join public.driver_assignments a on a.shipment_id = d.shipment_id
     where d.id = p_delivery_id
       and a.driver_id = auth.uid()
  );
$$;

create or replace function public.driver_on_schedule(p_schedule_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.deliveries d
      join public.driver_assignments a on a.shipment_id = d.shipment_id
     where d.delivery_schedule_id = p_schedule_id
       and a.driver_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- 10) Grants (lecture seule, écritures via RPC)
-- ------------------------------------------------------------
revoke all on table public.delivery_schedules from anon, authenticated, service_role;
grant select on table public.delivery_schedules to authenticated, service_role;

revoke all on table public.delivery_schedule_lines from anon, authenticated, service_role;
grant select on table public.delivery_schedule_lines to authenticated, service_role;

revoke all on table public.preparation_orders from anon, authenticated, service_role;
grant select on table public.preparation_orders to authenticated, service_role;

revoke all on table public.preparation_order_lines from anon, authenticated, service_role;
grant select on table public.preparation_order_lines to authenticated, service_role;

revoke all on table public.deliveries from anon, authenticated, service_role;
grant select on table public.deliveries to authenticated, service_role;

revoke all on table public.delivery_items from anon, authenticated, service_role;
grant select on table public.delivery_items to authenticated, service_role;

revoke all on table public.signatures from anon, authenticated, service_role;
grant select on table public.signatures to authenticated;
grant select on table public.signatures to service_role;

revoke all on table public.delivery_reminders from anon, authenticated, service_role;
grant select on table public.delivery_reminders to authenticated;
grant all on table public.delivery_reminders to service_role;

-- ------------------------------------------------------------
-- 11) RLS
-- ------------------------------------------------------------
alter table public.delivery_schedules enable row level security;

drop policy if exists delivery_schedules_select on public.delivery_schedules;
create policy delivery_schedules_select
  on public.delivery_schedules for select to authenticated
  using (
    public.is_staff()
    or public.owns_delivery_schedule(id)
    or public.driver_on_schedule(id)
  );

alter table public.delivery_schedule_lines enable row level security;

drop policy if exists delivery_schedule_lines_select on public.delivery_schedule_lines;
create policy delivery_schedule_lines_select
  on public.delivery_schedule_lines for select to authenticated
  using (
    public.is_staff()
    or public.owns_delivery_schedule(delivery_schedule_id)
    or public.driver_on_schedule(delivery_schedule_id)
  );

alter table public.preparation_orders enable row level security;

drop policy if exists preparation_orders_select on public.preparation_orders;
create policy preparation_orders_select
  on public.preparation_orders for select to authenticated
  using (
    public.is_staff()
    or public.owns_delivery_schedule(delivery_schedule_id)
  );

alter table public.preparation_order_lines enable row level security;

drop policy if exists preparation_order_lines_select on public.preparation_order_lines;
create policy preparation_order_lines_select
  on public.preparation_order_lines for select to authenticated
  using (
    public.is_staff()
    or public.owns_preparation_order(preparation_order_id)
  );

alter table public.deliveries enable row level security;

drop policy if exists deliveries_select on public.deliveries;
create policy deliveries_select
  on public.deliveries for select to authenticated
  using (
    public.is_staff()
    or public.owns_delivery_schedule(delivery_schedule_id)
    or public.driver_on_delivery(id)
  );

alter table public.delivery_items enable row level security;

drop policy if exists delivery_items_select on public.delivery_items;
create policy delivery_items_select
  on public.delivery_items for select to authenticated
  using (
    public.is_staff()
    or public.owns_delivery(delivery_id)
    or public.driver_on_delivery(delivery_id)
  );

alter table public.signatures enable row level security;

drop policy if exists signatures_select on public.signatures;
create policy signatures_select
  on public.signatures for select to authenticated
  using (
    public.is_staff()
    or (delivery_id is not null and public.owns_delivery(delivery_id))
    or (delivery_id is not null and public.driver_on_delivery(delivery_id))
    or (shipment_id is not null and public.owns_shipment(shipment_id))
  );

drop policy if exists signatures_insert on public.signatures;
create policy signatures_insert
  on public.signatures for insert to authenticated
  with check (
    (delivery_id is not null and public.driver_on_delivery(delivery_id))
    or (shipment_id is not null and public.owns_shipment(shipment_id))
    or public.is_staff()
  );

alter table public.delivery_reminders enable row level security;

drop policy if exists delivery_reminders_select on public.delivery_reminders;
create policy delivery_reminders_select
  on public.delivery_reminders for select to authenticated
  using (public.is_staff());

-- ------------------------------------------------------------
-- 12) Mise à jour des politiques delivery_proofs
-- ------------------------------------------------------------
drop policy if exists delivery_proofs_read on public.delivery_proofs;
create policy delivery_proofs_read
  on public.delivery_proofs for select to authenticated
  using (
    public.is_staff()
    or (shipment_id is not null and public.owns_shipment(shipment_id))
    or (delivery_id is not null and public.owns_delivery(delivery_id))
    or (shipment_id is not null and exists (
      select 1 from public.driver_assignments a
       where a.shipment_id = delivery_proofs.shipment_id
         and a.driver_id = auth.uid()
    ))
    or (delivery_id is not null and public.driver_on_delivery(delivery_id))
  );

drop policy if exists delivery_proofs_insert on public.delivery_proofs;
create policy delivery_proofs_insert
  on public.delivery_proofs for insert to authenticated
  with check (
    recorded_by = auth.uid()
    and (
      public.is_staff()
      or (shipment_id is not null and exists (
        select 1 from public.driver_assignments a
         where a.shipment_id = delivery_proofs.shipment_id
           and a.driver_id = auth.uid()
           and a.status = 'accepted'
      ))
      or (delivery_id is not null and exists (
        select 1
          from public.deliveries d
          join public.driver_assignments a on a.shipment_id = d.shipment_id
         where d.id = delivery_proofs.delivery_id
           and a.driver_id = auth.uid()
           and a.status = 'accepted'
      ))
    )
  );

-- ------------------------------------------------------------
-- 13) Triggers updated_at
-- ------------------------------------------------------------
drop trigger if exists delivery_schedules_updated_at on public.delivery_schedules;
create trigger delivery_schedules_updated_at
  before update on public.delivery_schedules
  for each row execute function moddatetime (updated_at);

drop trigger if exists delivery_schedule_lines_updated_at on public.delivery_schedule_lines;
create trigger delivery_schedule_lines_updated_at
  before update on public.delivery_schedule_lines
  for each row execute function moddatetime (updated_at);

drop trigger if exists preparation_orders_updated_at on public.preparation_orders;
create trigger preparation_orders_updated_at
  before update on public.preparation_orders
  for each row execute function moddatetime (updated_at);

drop trigger if exists preparation_order_lines_updated_at on public.preparation_order_lines;
create trigger preparation_order_lines_updated_at
  before update on public.preparation_order_lines
  for each row execute function moddatetime (updated_at);

drop trigger if exists deliveries_updated_at on public.deliveries;
create trigger deliveries_updated_at
  before update on public.deliveries
  for each row execute function moddatetime (updated_at);
