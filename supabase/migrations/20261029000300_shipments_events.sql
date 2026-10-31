-- ============================================================
-- France Santé Transport — Migration 3 : missions et événements
-- ============================================================

create type public.shipment_status as enum (
  'pending_confirmation',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled'
);

create type public.shipment_event_type as enum (
  'request_submitted',
  'request_under_review',
  'request_rejected',
  'request_cancelled',
  'quote_created',
  'quote_sent',
  'quote_accepted',
  'quote_declined',
  'quote_cancelled',
  'mission_created',
  'mission_confirmed',
  'mission_in_progress',
  'mission_completed',
  'mission_cancelled',
  'driver_assigned',
  'driver_response',
  'note'
);

-- ------------------------------------------------------------
-- shipments : missions créées après acceptation d''un devis.
-- Jamais confirmées automatiquement : confirmation = RPC dédiée.
-- ------------------------------------------------------------
create table public.shipments (
  id                   uuid primary key default gen_random_uuid(),
  transport_request_id uuid not null references public.transport_requests (id) on delete restrict,
  quote_id             uuid not null references public.quotes (id) on delete restrict,
  organization_id      uuid references public.organizations (id) on delete set null,
  status               public.shipment_status not null default 'pending_confirmation',
  scheduled_at         timestamptz not null,
  confirmed_at         timestamptz,
  confirmed_by         uuid references public.profiles (id) on delete set null,
  completed_at         timestamptz,
  cancelled_at         timestamptz,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint shipment_confirmed_consistency check (
    status = 'cancelled'
    or (status = 'pending_confirmation' and confirmed_at is null)
    or (status in ('confirmed', 'in_progress', 'completed') and confirmed_at is not null)
  ),
  constraint shipment_completed_consistency check (
    (status = 'completed') = (completed_at is not null)
  ),
  constraint shipment_cancelled_consistency check (
    (status = 'cancelled') = (cancelled_at is not null)
  )
);

create unique index shipments_one_active_per_request
  on public.shipments (transport_request_id)
  where status in ('pending_confirmation', 'confirmed', 'in_progress');

create index shipments_status_idx on public.shipments (status);
create index shipments_scheduled_idx on public.shipments (scheduled_at);
create index shipments_quote_idx on public.shipments (quote_id);

comment on table public.shipments is 'Missions. Créées uniquement par la RPC accept_quote puis confirmées manuellement par un administrateur.';

-- ------------------------------------------------------------
-- shipment_events : journal horodaté, en lecture seule.
-- Lié soit à une mission, soit à une demande (avant création de mission).
-- ------------------------------------------------------------
create table public.shipment_events (
  id                   uuid primary key default gen_random_uuid(),
  shipment_id          uuid references public.shipments (id) on delete cascade,
  transport_request_id uuid references public.transport_requests (id) on delete cascade,
  event_type           public.shipment_event_type not null,
  payload              jsonb not null default '{}'::jsonb,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  constraint shipment_events_exactly_one_target check (
    (case when shipment_id is not null then 1 else 0 end
     + case when transport_request_id is not null then 1 else 0 end) = 1
  )
);

create index shipment_events_shipment_idx on public.shipment_events (shipment_id, created_at);
create index shipment_events_request_idx on public.shipment_events (transport_request_id, created_at);

comment on table public.shipment_events is 'Journal horodaté des événements importants. Écrit en lecture seule pour les clients.';

create trigger shipments_updated_at
  before update on public.shipments
  for each row execute function moddatetime (updated_at);
