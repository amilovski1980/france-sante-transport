-- ============================================================
-- France Santé Transport — Migration 2 : demandes et devis
-- ============================================================

create type public.request_status as enum (
  'draft',
  'submitted',
  'under_review',
  'quoted',
  'accepted',
  'rejected',
  'cancelled',
  'completed'
);

create type public.service_type as enum (
  'medical_transport',
  'wheelchair_transport',
  'stretcher_transport',
  'appointment_transfer',
  'medical_supply',
  'other'
);

create type public.quote_status as enum (
  'draft',
  'sent',
  'accepted',
  'declined',
  'expired',
  'superseded'
);

-- ------------------------------------------------------------
-- transport_requests : demande de transport soumise par un client
-- ------------------------------------------------------------
create table public.transport_requests (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.profiles (id) on delete restrict,
  organization_id uuid references public.organizations (id) on delete set null,
  status          public.request_status not null default 'submitted',
  service_type    public.service_type not null,
  pickup_address  text not null check (length(trim(pickup_address)) between 3 and 500),
  dropoff_address text not null check (length(trim(dropoff_address)) between 3 and 500),
  pickup_datetime timestamptz not null,
  patient_name    text check (patient_name is null or length(trim(patient_name)) between 1 and 200),
  mobility_notes  text,
  contact_phone   text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint request_not_self_dropoff check (pickup_address is distinct from dropoff_address)
);

create index transport_requests_client_idx on public.transport_requests (client_id, created_at desc);
create index transport_requests_status_idx on public.transport_requests (status);
create index transport_requests_pickup_idx on public.transport_requests (pickup_datetime);
create index transport_requests_org_idx on public.transport_requests (organization_id);

comment on table public.transport_requests is 'Demandes de transport soumises par les clients. Aucun tarif n''est stocké ici.';

-- ------------------------------------------------------------
-- quotes : devis versionnés. Le montant est fixé par l''équipe.
-- ------------------------------------------------------------
create table public.quotes (
  id                   uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null references public.transport_requests (id) on delete cascade,
  version              integer not null default 1 check (version >= 1),
  status               public.quote_status not null default 'draft',
  amount               numeric(10, 2) not null check (amount >= 0),
  currency             text not null default 'EUR' check (currency = 'EUR'),
  valid_until          timestamptz,
  notes                text,
  created_by           uuid not null references public.profiles (id) on delete restrict,
  sent_at              timestamptz,
  accepted_at          timestamptz,
  accepted_by          uuid references public.profiles (id) on delete set null,
  declined_at          timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (transport_request_id, version),
  constraint quote_sent_timestamps check (
    (status = 'draft') = (sent_at is null)
  ),
  constraint quote_accepted_consistency check (
    (status = 'accepted') = (accepted_at is not null and accepted_by is not null)
  ),
  constraint quote_declined_consistency check (
    (declined_at is null) or (status = 'declined')
  )
);

create index quotes_request_idx on public.quotes (transport_request_id, version desc);
create index quotes_status_idx on public.quotes (status);

comment on table public.quotes is 'Devis versionnés. Un envoi crée/transmet une version ; le client accepte la version envoyée.';
comment on column public.quotes.amount is 'Montant défini et validé par l''équipe. Aucune valeur par défaut : jamais généré automatiquement.';

-- ------------------------------------------------------------
-- Interdiction de modifier le montant d'un devis déjà publié
-- ------------------------------------------------------------
create or replace function public.protect_quote_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.amount is distinct from old.amount
     and old.status in ('sent', 'accepted', 'declined', 'expired', 'superseded') then
    raise exception 'Le montant d''un devis publié (version %) ne peut plus être modifié', old.version;
  end if;
  if new.transport_request_id is distinct from old.transport_request_id then
    raise exception 'Un devis ne peut pas changer de demande de transport';
  end if;
  if new.version is distinct from old.version then
    raise exception 'La version d''un devis ne peut pas être modifiée';
  end if;
  return new;
end;
$$;

create trigger quotes_protect_published_amount
  before update on public.quotes
  for each row execute function public.protect_quote_amount();

-- ------------------------------------------------------------
-- updated_at
-- ------------------------------------------------------------
create trigger transport_requests_updated_at
  before update on public.transport_requests
  for each row execute function moddatetime (updated_at);

create trigger quotes_updated_at
  before update on public.quotes
  for each row execute function moddatetime (updated_at);
