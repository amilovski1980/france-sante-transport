-- ============================================================
-- France Santé Transport — Migration 4 : flotte et affectations
-- ============================================================

create type public.vehicle_type as enum (
  'sedan',
  'van',
  'minibus',
  'stretcher_van',
  'ambulance'
);

create type public.assignment_status as enum (
  'proposed',
  'accepted',
  'declined',
  'completed',
  'cancelled'
);

-- ------------------------------------------------------------
-- vehicles : flotte
-- ------------------------------------------------------------
create table public.vehicles (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid references public.organizations (id) on delete set null,
  registration_plate text not null unique check (registration_plate ~ '^[A-Z0-9-]{6,12}$'),
  vehicle_type       public.vehicle_type not null,
  label              text,
  capacity           integer not null default 1 check (capacity between 1 and 20),
  has_wheelchair_lift boolean not null default false,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index vehicles_active_idx on public.vehicles (active) where active = true;

-- ------------------------------------------------------------
-- driver_assignments : affectation chauffeur + véhicule à une mission
-- ------------------------------------------------------------
create table public.driver_assignments (
  id           uuid primary key default gen_random_uuid(),
  shipment_id  uuid not null references public.shipments (id) on delete cascade,
  driver_id    uuid not null references public.profiles (id) on delete restrict,
  vehicle_id   uuid not null references public.vehicles (id) on delete restrict,
  status       public.assignment_status not null default 'proposed',
  assigned_by  uuid references public.profiles (id) on delete set null,
  assigned_at  timestamptz not null default now(),
  responded_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint assignment_response_consistency check (
    (status = 'proposed' and responded_at is null)
    or (status <> 'proposed' and responded_at is not null)
  )
);

-- Une seule affectation active par mission
create unique index driver_assignments_one_active_per_shipment
  on public.driver_assignments (shipment_id)
  where status in ('proposed', 'accepted');

create index driver_assignments_driver_idx on public.driver_assignments (driver_id, status);
create index driver_assignments_vehicle_idx on public.driver_assignments (vehicle_id);

comment on table public.driver_assignments is 'Affectations chauffeur/véhicule. Une seule affectation active par mission.';

create trigger vehicles_updated_at
  before update on public.vehicles
  for each row execute function moddatetime (updated_at);

create trigger driver_assignments_updated_at
  before update on public.driver_assignments
  for each row execute function moddatetime (updated_at);
