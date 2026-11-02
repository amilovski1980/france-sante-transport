-- ============================================================
-- France Santé Transport — Phase 2 : référentiel fournisseur,
-- entrepôts, catalogue produits, lots, stocks et mouvements.
--
-- Migration strictement additive : aucune table existante n'est
-- modifiée. Les nouvelles tables sont protégées par RLS et
-- isolent les données par fournisseur (supplier_id).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tables du référentiel
-- ------------------------------------------------------------

-- Fournisseurs : prolonge une organisation existante.
create table if not exists public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete restrict,
  code            text not null unique check (length(trim(code)) between 2 and 40),
  contact_email   text check (contact_email is null or contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone   text check (contact_phone is null or length(contact_phone) between 6 and 30),
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists suppliers_active_idx
  on public.suppliers (active) where active = true;

comment on table public.suppliers is
  'Fournisseur (entité commerciale) rattaché à une organisation. Les comptes fournisseurs sont membres de cette organisation.';

-- Entrepôts exploités par France Santé Transport.
create table if not exists public.warehouses (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 2 and 200),
  code        text not null unique check (length(trim(code)) between 2 and 40),
  address     text,
  capacity_m3 numeric(12, 2) check (capacity_m3 is null or capacity_m3 >= 0),
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.warehouses is
  'Entrepôt physique de stockage. Les emplacements détaillés pourront être ajoutés ultérieurement.';

-- Catalogue produits d'un fournisseur.
create table if not exists public.products (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         uuid not null references public.suppliers (id) on delete restrict,
  name                text not null check (length(trim(name)) between 2 and 200),
  description         text,
  category            text,
  unit                text not null default 'unité' check (length(trim(unit)) between 1 and 40),
  requires_cold_chain boolean not null default false,
  temp_min            numeric(5, 2),
  temp_max            numeric(5, 2),
  active              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint products_temp_range check (
    temp_min is null or temp_max is null or temp_min <= temp_max
  )
);

create index if not exists products_supplier_idx
  on public.products (supplier_id, name);

comment on table public.products is
  'Produit du catalogue d''un fournisseur. Un produit peut avoir plusieurs références (conditionnements).';

-- Références / conditionnements d'un produit.
create table if not exists public.product_references (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id) on delete cascade,
  reference_code text not null check (length(trim(reference_code)) between 1 and 80),
  gtin           text check (gtin is null or gtin ~ '^[0-9]{8,14}$'),
  packaging      text,
  unit           text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (product_id, reference_code)
);

create index if not exists product_references_product_idx
  on public.product_references (product_id);

comment on table public.product_references is
  'Référence commerciale (SKU/GTIN) d''un produit, avec son conditionnement.';

-- Lots reçus, avec numéro et date de péremption.
create table if not exists public.lots (
  id                   uuid primary key default gen_random_uuid(),
  product_reference_id uuid not null references public.product_references (id) on delete restrict,
  supplier_id          uuid not null references public.suppliers (id) on delete restrict,
  warehouse_id         uuid not null references public.warehouses (id) on delete restrict,
  lot_number           text not null check (length(trim(lot_number)) between 1 and 80),
  expiry_date          date,
  received_at          timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (product_reference_id, lot_number, warehouse_id)
);

create index if not exists lots_supplier_idx
  on public.lots (supplier_id, expiry_date);
create index if not exists lots_warehouse_idx
  on public.lots (warehouse_id);

comment on table public.lots is
  'Lot de marchandise identifié par un numéro et une date de péremption, stocké dans un entrepôt.';

-- Niveaux de stock par lot et entrepôt.
create table if not exists public.stock_levels (
  id           uuid primary key default gen_random_uuid(),
  lot_id       uuid not null references public.lots (id) on delete restrict,
  warehouse_id uuid not null references public.warehouses (id) on delete restrict,
  qty_on_hand  numeric(14, 3) not null default 0 check (qty_on_hand >= 0),
  qty_reserved numeric(14, 3) not null default 0 check (qty_reserved >= 0),
  qty_shipped  numeric(14, 3) not null default 0 check (qty_shipped >= 0),
  updated_at   timestamptz not null default now(),
  unique (lot_id, warehouse_id),
  constraint stock_levels_consistency check (qty_reserved + qty_shipped <= qty_on_hand)
);

create index if not exists stock_levels_lot_idx on public.stock_levels (lot_id);
create index if not exists stock_levels_warehouse_idx on public.stock_levels (warehouse_id);

comment on table public.stock_levels is
  'Stock d''un lot dans un entrepôt : quantité en stock, réservée et expédiée. Le disponible = qty_on_hand - qty_reserved - qty_shipped.';

-- Journal des mouvements de stock (append-only).
create table if not exists public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  lot_id         uuid not null references public.lots (id) on delete restrict,
  warehouse_id   uuid not null references public.warehouses (id) on delete restrict,
  movement_type  public.stock_movement_type not null,
  quantity       numeric(14, 3) not null check (quantity > 0),
  reference_type text,
  reference_id   uuid,
  note           text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists stock_movements_lot_idx
  on public.stock_movements (lot_id, created_at desc);
create index if not exists stock_movements_warehouse_idx
  on public.stock_movements (warehouse_id, created_at desc);

comment on table public.stock_movements is
  'Journal horodaté et immuable des mouvements de stock (réception, réservation, expédition…).';

-- ------------------------------------------------------------
-- 2) Fonctions utilitaires RLS
-- ------------------------------------------------------------

create or replace function public.is_supplier()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'supplier'
  );
$$;

create or replace function public.owns_supplier(p_supplier_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.suppliers s
      join public.organization_members m
        on m.organization_id = s.organization_id
     where s.id = p_supplier_id
       and m.user_id = auth.uid()
  );
$$;

create or replace function public.owns_product(p_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.products p
     where p.id = p_product_id
       and public.owns_supplier(p.supplier_id)
  );
$$;

create or replace function public.owns_lot(p_lot_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.lots l
     where l.id = p_lot_id
       and public.owns_supplier(l.supplier_id)
  );
$$;

-- ------------------------------------------------------------
-- 3) Privilèges
-- ------------------------------------------------------------

revoke all on table public.suppliers from anon, authenticated;
grant select, insert, update, delete on table public.suppliers to authenticated;

revoke all on table public.warehouses from anon, authenticated;
grant select, insert, update, delete on table public.warehouses to authenticated;

revoke all on table public.products from anon, authenticated;
grant select, insert, update, delete on table public.products to authenticated;

revoke all on table public.product_references from anon, authenticated;
grant select, insert, update, delete on table public.product_references to authenticated;

revoke all on table public.lots from anon, authenticated;
grant select, insert, update, delete on table public.lots to authenticated;

revoke all on table public.stock_levels from anon, authenticated;
grant select, insert, update, delete on table public.stock_levels to authenticated;

-- Journal append-only : pas de UPDATE ni DELETE.
revoke all on table public.stock_movements from anon, authenticated;
grant select, insert on table public.stock_movements to authenticated;

-- ------------------------------------------------------------
-- 4) Row Level Security
-- ------------------------------------------------------------

alter table public.suppliers enable row level security;
alter table public.warehouses enable row level security;
alter table public.products enable row level security;
alter table public.product_references enable row level security;
alter table public.lots enable row level security;
alter table public.stock_levels enable row level security;
alter table public.stock_movements enable row level security;

-- suppliers : lecture staff ou membre de l'organisation ; écriture admin.
drop policy if exists suppliers_select on public.suppliers;
create policy suppliers_select
  on public.suppliers for select to authenticated
  using (public.is_staff() or public.owns_supplier(id));

drop policy if exists suppliers_insert_admin on public.suppliers;
create policy suppliers_insert_admin
  on public.suppliers for insert to authenticated
  with check (public.is_admin());

drop policy if exists suppliers_update_admin on public.suppliers;
create policy suppliers_update_admin
  on public.suppliers for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists suppliers_delete_admin on public.suppliers;
create policy suppliers_delete_admin
  on public.suppliers for delete to authenticated
  using (public.is_admin());

-- warehouses : lecture staff/fournisseur ; écriture admin.
drop policy if exists warehouses_select on public.warehouses;
create policy warehouses_select
  on public.warehouses for select to authenticated
  using (public.is_staff() or public.is_supplier());

drop policy if exists warehouses_insert_admin on public.warehouses;
create policy warehouses_insert_admin
  on public.warehouses for insert to authenticated
  with check (public.is_admin());

drop policy if exists warehouses_update_admin on public.warehouses;
create policy warehouses_update_admin
  on public.warehouses for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists warehouses_delete_admin on public.warehouses;
create policy warehouses_delete_admin
  on public.warehouses for delete to authenticated
  using (public.is_admin());

-- products : isolation par fournisseur.
drop policy if exists products_select on public.products;
create policy products_select
  on public.products for select to authenticated
  using (public.is_staff() or public.owns_supplier(supplier_id));

drop policy if exists products_insert on public.products;
create policy products_insert
  on public.products for insert to authenticated
  with check (public.is_admin() or public.owns_supplier(supplier_id));

drop policy if exists products_update on public.products;
create policy products_update
  on public.products for update to authenticated
  using (public.is_admin() or public.owns_supplier(supplier_id))
  with check (public.is_admin() or public.owns_supplier(supplier_id));

drop policy if exists products_delete on public.products;
create policy products_delete
  on public.products for delete to authenticated
  using (public.is_admin() or public.owns_supplier(supplier_id));

-- product_references : isolation via le produit parent.
drop policy if exists product_references_select on public.product_references;
create policy product_references_select
  on public.product_references for select to authenticated
  using (public.is_staff() or public.owns_product(product_id));

drop policy if exists product_references_insert on public.product_references;
create policy product_references_insert
  on public.product_references for insert to authenticated
  with check (public.is_admin() or public.owns_product(product_id));

drop policy if exists product_references_update on public.product_references;
create policy product_references_update
  on public.product_references for update to authenticated
  using (public.is_admin() or public.owns_product(product_id))
  with check (public.is_admin() or public.owns_product(product_id));

drop policy if exists product_references_delete on public.product_references;
create policy product_references_delete
  on public.product_references for delete to authenticated
  using (public.is_admin() or public.owns_product(product_id));

-- lots : isolation par fournisseur ; suppression admin.
drop policy if exists lots_select on public.lots;
create policy lots_select
  on public.lots for select to authenticated
  using (public.is_staff() or public.owns_supplier(supplier_id));

drop policy if exists lots_insert on public.lots;
create policy lots_insert
  on public.lots for insert to authenticated
  with check (public.is_admin() or public.owns_supplier(supplier_id));

drop policy if exists lots_update on public.lots;
create policy lots_update
  on public.lots for update to authenticated
  using (public.is_admin() or public.owns_supplier(supplier_id))
  with check (public.is_admin() or public.owns_supplier(supplier_id));

drop policy if exists lots_delete_admin on public.lots;
create policy lots_delete_admin
  on public.lots for delete to authenticated
  using (public.is_admin());

-- stock_levels : lecture via le lot ; écriture staff uniquement
-- (les RPC métier manipuleront le stock en security definer).
drop policy if exists stock_levels_select on public.stock_levels;
create policy stock_levels_select
  on public.stock_levels for select to authenticated
  using (public.is_staff() or public.owns_lot(lot_id));

drop policy if exists stock_levels_insert_staff on public.stock_levels;
create policy stock_levels_insert_staff
  on public.stock_levels for insert to authenticated
  with check (public.is_staff());

drop policy if exists stock_levels_update_staff on public.stock_levels;
create policy stock_levels_update_staff
  on public.stock_levels for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists stock_levels_delete_admin on public.stock_levels;
create policy stock_levels_delete_admin
  on public.stock_levels for delete to authenticated
  using (public.is_admin());

-- stock_movements : lecture via le lot ; insertion staff ; immuable.
drop policy if exists stock_movements_select on public.stock_movements;
create policy stock_movements_select
  on public.stock_movements for select to authenticated
  using (public.is_staff() or public.owns_lot(lot_id));

drop policy if exists stock_movements_insert_staff on public.stock_movements;
create policy stock_movements_insert_staff
  on public.stock_movements for insert to authenticated
  with check (public.is_staff());

-- ------------------------------------------------------------
-- 5) Triggers updated_at
-- ------------------------------------------------------------

drop trigger if exists suppliers_updated_at on public.suppliers;
create trigger suppliers_updated_at
  before update on public.suppliers
  for each row execute function moddatetime (updated_at);

drop trigger if exists warehouses_updated_at on public.warehouses;
create trigger warehouses_updated_at
  before update on public.warehouses
  for each row execute function moddatetime (updated_at);

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row execute function moddatetime (updated_at);

drop trigger if exists product_references_updated_at on public.product_references;
create trigger product_references_updated_at
  before update on public.product_references
  for each row execute function moddatetime (updated_at);

drop trigger if exists lots_updated_at on public.lots;
create trigger lots_updated_at
  before update on public.lots
  for each row execute function moddatetime (updated_at);

drop trigger if exists stock_levels_updated_at on public.stock_levels;
create trigger stock_levels_updated_at
  before update on public.stock_levels
  for each row execute function moddatetime (updated_at);
