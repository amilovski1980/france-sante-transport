-- Migration 16 : logistique medicale

create type public.content_type as enum ('organ', 'blood', 'equipment', 'other');
create type public.criticality as enum ('critical', 'urgent', 'standard');

alter table public.transport_requests
  add column if not exists content_type public.content_type not null default 'other',
  add column if not exists criticality public.criticality not null default 'standard',
  add column if not exists sla_deadline timestamptz,
  add column if not exists ischemia_deadline timestamptz,
  add column if not exists temp_min numeric(5,2),
  add column if not exists temp_max numeric(5,2);

create table if not exists public.shipment_temperature (
  id bigint generated always as identity primary key,
  shipment_id uuid not null references public.shipments (id) on delete cascade,
  temperature numeric(5,2) not null,
  recorded_at timestamptz not null default now()
);

create index if not exists shipment_temperature_idx on public.shipment_temperature (shipment_id, recorded_at desc);

alter table public.shipment_temperature enable row level security;

drop policy if exists shipment_temperature_select on public.shipment_temperature;
create policy shipment_temperature_select on public.shipment_temperature for select to authenticated
  using (exists (select 1 from public.shipments s join public.transport_requests r on r.id = s.transport_request_id where s.id = shipment_id and (r.client_id = auth.uid() or public.is_staff())));

grant select on public.shipment_temperature to authenticated;


