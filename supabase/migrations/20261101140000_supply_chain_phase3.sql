-- ============================================================
-- France Santé Transport — Phase 3 : factures d'achat et
-- destinataires finaux (sans compte).
--
-- Migration additive. Les factures d'achat et le carnet de
-- destinataires sont isolés par fournisseur via RLS. Les
-- destinataires globaux (supplier_id null) sont gérés par
-- l'administration et visibles par les fournisseurs.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Nouveaux types énumérés
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'purchase_invoice_extraction_status'
       and n.nspname = 'public'
  ) then
    execute $sql$
      create type public.purchase_invoice_extraction_status as enum (
        'pending',
        'parsed',
        'failed',
        'manual'
      )
    $sql$;
  end if;

  if not exists (
    select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'recipient_type'
       and n.nspname = 'public'
  ) then
    execute $sql$
      create type public.recipient_type as enum (
        'laboratory',
        'hospital',
        'pharmacy',
        'clinic',
        'other'
      )
    $sql$;
  end if;
end $$;

comment on type public.purchase_invoice_extraction_status is
  'État de l''extraction automatique d''une facture d''achat (PDF/Excel).';
comment on type public.recipient_type is
  'Catégorie du destinataire final (laboratoire, hôpital, pharmacie, clinique, autre).';

-- ------------------------------------------------------------
-- 2) Tables
-- ------------------------------------------------------------

-- Factures d'achat importées par le fournisseur.
create table if not exists public.purchase_invoices (
  id                uuid primary key default gen_random_uuid(),
  supplier_id       uuid not null references public.suppliers (id) on delete restrict,
  invoice_number    text not null check (length(trim(invoice_number)) between 1 and 80),
  invoice_date      date,
  total_amount      numeric(14, 2) check (total_amount is null or total_amount >= 0),
  currency          text not null default 'EUR' check (currency = 'EUR'),
  file_path         text,
  file_name         text,
  mime_type         text,
  extraction_status public.purchase_invoice_extraction_status not null default 'pending',
  extracted_data    jsonb not null default '{}'::jsonb,
  uploaded_by       uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (supplier_id, invoice_number)
);

create index if not exists purchase_invoices_supplier_idx
  on public.purchase_invoices (supplier_id, invoice_date desc);
create index if not exists purchase_invoices_status_idx
  on public.purchase_invoices (extraction_status);

comment on table public.purchase_invoices is
  'Facture d''achat fournisseur importée (PDF/Excel). Le fichier est stocké dans le bucket privé « purchase-invoices » sous {supplier_id}/{invoice_id}/.';

-- Lignes extraites ou saisies manuellement.
create table if not exists public.purchase_invoice_lines (
  id                   uuid primary key default gen_random_uuid(),
  purchase_invoice_id  uuid not null references public.purchase_invoices (id) on delete cascade,
  product_reference_id uuid references public.product_references (id) on delete set null,
  description          text not null check (length(trim(description)) between 1 and 500),
  quantity             numeric(14, 3) not null check (quantity > 0),
  unit_price           numeric(14, 4) check (unit_price is null or unit_price >= 0),
  lot_number           text,
  expiry_date          date,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists purchase_invoice_lines_invoice_idx
  on public.purchase_invoice_lines (purchase_invoice_id);
create index if not exists purchase_invoice_lines_reference_idx
  on public.purchase_invoice_lines (product_reference_id);

comment on table public.purchase_invoice_lines is
  'Ligne de facture d''achat : produit, quantité, prix, lot et péremption. Alimente la réception de stock.';

-- Destinataires finaux (aucun compte utilisateur).
create table if not exists public.recipients (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers (id) on delete cascade,
  name        text not null check (length(trim(name)) between 2 and 200),
  type        public.recipient_type not null default 'other',
  contact_name text,
  email       text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text check (phone is null or length(phone) between 6 and 30),
  address     text,
  city        text,
  postal_code text,
  latitude    numeric(9, 6),
  longitude   numeric(9, 6),
  notes       text,
  active      boolean not null default true,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists recipients_supplier_idx
  on public.recipients (supplier_id, name);
create index if not exists recipients_active_idx
  on public.recipients (active) where active = true;

comment on table public.recipients is
  'Destinataire final (laboratoire, hôpital, pharmacie…). Aucun compte requis. supplier_id null = carnet global administré par FST.';

-- ------------------------------------------------------------
-- 3) Fonctions utilitaires RLS / stockage
-- ------------------------------------------------------------

create or replace function public.owns_purchase_invoice(p_invoice_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.purchase_invoices i
     where i.id = p_invoice_id
       and public.owns_supplier(i.supplier_id)
  );
$$;

-- Extrait l'identifiant fournisseur du chemin de stockage
-- ({supplier_id}/{invoice_id}/{fichier}). Renvoie null si le
-- chemin n'est pas préfixé par un UUID valide.
create or replace function public.storage_path_supplier_id(p_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  v text := split_part(coalesce(p_name, ''), '/', 1);
begin
  if v ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then
    return v::uuid;
  end if;
  return null;
end;
$$;

-- ------------------------------------------------------------
-- 4) Privilèges
-- ------------------------------------------------------------
revoke all on table public.purchase_invoices from anon, authenticated;
grant select, insert, update, delete on table public.purchase_invoices to authenticated;

revoke all on table public.purchase_invoice_lines from anon, authenticated;
grant select, insert, update, delete on table public.purchase_invoice_lines to authenticated;

revoke all on table public.recipients from anon, authenticated;
grant select, insert, update, delete on table public.recipients to authenticated;

-- ------------------------------------------------------------
-- 5) Row Level Security
-- ------------------------------------------------------------
alter table public.purchase_invoices enable row level security;
alter table public.purchase_invoice_lines enable row level security;
alter table public.recipients enable row level security;

-- purchase_invoices : isolation par fournisseur.
drop policy if exists purchase_invoices_select on public.purchase_invoices;
create policy purchase_invoices_select
  on public.purchase_invoices for select to authenticated
  using (public.is_staff() or public.owns_supplier(supplier_id));

drop policy if exists purchase_invoices_insert on public.purchase_invoices;
create policy purchase_invoices_insert
  on public.purchase_invoices for insert to authenticated
  with check (public.is_admin() or public.owns_supplier(supplier_id));

drop policy if exists purchase_invoices_update on public.purchase_invoices;
create policy purchase_invoices_update
  on public.purchase_invoices for update to authenticated
  using (public.is_admin() or public.owns_supplier(supplier_id))
  with check (public.is_admin() or public.owns_supplier(supplier_id));

drop policy if exists purchase_invoices_delete on public.purchase_invoices;
create policy purchase_invoices_delete
  on public.purchase_invoices for delete to authenticated
  using (public.is_admin() or public.owns_supplier(supplier_id));

-- purchase_invoice_lines : isolation via la facture parente.
drop policy if exists purchase_invoice_lines_select on public.purchase_invoice_lines;
create policy purchase_invoice_lines_select
  on public.purchase_invoice_lines for select to authenticated
  using (public.is_staff() or public.owns_purchase_invoice(purchase_invoice_id));

drop policy if exists purchase_invoice_lines_insert on public.purchase_invoice_lines;
create policy purchase_invoice_lines_insert
  on public.purchase_invoice_lines for insert to authenticated
  with check (public.is_admin() or public.owns_purchase_invoice(purchase_invoice_id));

drop policy if exists purchase_invoice_lines_update on public.purchase_invoice_lines;
create policy purchase_invoice_lines_update
  on public.purchase_invoice_lines for update to authenticated
  using (public.is_admin() or public.owns_purchase_invoice(purchase_invoice_id))
  with check (public.is_admin() or public.owns_purchase_invoice(purchase_invoice_id));

drop policy if exists purchase_invoice_lines_delete on public.purchase_invoice_lines;
create policy purchase_invoice_lines_delete
  on public.purchase_invoice_lines for delete to authenticated
  using (public.is_admin() or public.owns_purchase_invoice(purchase_invoice_id));

-- recipients : staff, ou fournisseur pour son carnet + les destinataires globaux.
drop policy if exists recipients_select on public.recipients;
create policy recipients_select
  on public.recipients for select to authenticated
  using (
    public.is_staff()
    or (
      public.is_supplier()
      and (supplier_id is null or public.owns_supplier(supplier_id))
    )
  );

drop policy if exists recipients_insert on public.recipients;
create policy recipients_insert
  on public.recipients for insert to authenticated
  with check (
    public.is_admin()
    or (
      public.is_supplier()
      and supplier_id is not null
      and public.owns_supplier(supplier_id)
    )
  );

drop policy if exists recipients_update on public.recipients;
create policy recipients_update
  on public.recipients for update to authenticated
  using (
    public.is_admin()
    or (
      public.is_supplier()
      and supplier_id is not null
      and public.owns_supplier(supplier_id)
    )
  )
  with check (
    public.is_admin()
    or (
      public.is_supplier()
      and supplier_id is not null
      and public.owns_supplier(supplier_id)
    )
  );

drop policy if exists recipients_delete on public.recipients;
create policy recipients_delete
  on public.recipients for delete to authenticated
  using (
    public.is_admin()
    or (
      public.is_supplier()
      and supplier_id is not null
      and public.owns_supplier(supplier_id)
    )
  );

-- ------------------------------------------------------------
-- 6) Stockage privé des factures d'achat
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('purchase-invoices', 'purchase-invoices', false)
on conflict (id) do nothing;

drop policy if exists purchase_invoices_files_read on storage.objects;
create policy purchase_invoices_files_read
  on storage.objects for select to authenticated
  using (
    bucket_id = 'purchase-invoices'
    and (
      public.is_staff()
      or public.owns_supplier(public.storage_path_supplier_id(name))
    )
  );

drop policy if exists purchase_invoices_files_write on storage.objects;
create policy purchase_invoices_files_write
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'purchase-invoices'
    and (
      public.is_staff()
      or public.owns_supplier(public.storage_path_supplier_id(name))
    )
  );

drop policy if exists purchase_invoices_files_delete on storage.objects;
create policy purchase_invoices_files_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'purchase-invoices'
    and (
      public.is_staff()
      or public.owns_supplier(public.storage_path_supplier_id(name))
    )
  );

-- ------------------------------------------------------------
-- 7) Triggers updated_at
-- ------------------------------------------------------------
drop trigger if exists purchase_invoices_updated_at on public.purchase_invoices;
create trigger purchase_invoices_updated_at
  before update on public.purchase_invoices
  for each row execute function moddatetime (updated_at);

drop trigger if exists purchase_invoice_lines_updated_at on public.purchase_invoice_lines;
create trigger purchase_invoice_lines_updated_at
  before update on public.purchase_invoice_lines
  for each row execute function moddatetime (updated_at);

drop trigger if exists recipients_updated_at on public.recipients;
create trigger recipients_updated_at
  before update on public.recipients
  for each row execute function moddatetime (updated_at);
