-- ============================================================
-- France Santé Transport — Migration 5 : fonctions utilitaires,
-- politiques RLS et privilèges
-- ============================================================

-- ------------------------------------------------------------
-- Schéma interne non exposé à l'API PostgREST
-- ------------------------------------------------------------
create schema if not exists internal;
revoke usage on schema internal from public, anon, authenticated, service_role;

-- ------------------------------------------------------------
-- Fonctions utilitaires (security definer : lisent les tables
-- sans déclencher de récursion des politiques RLS)
-- ------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'dispatcher')
  );
$$;

create or replace function public.is_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'driver'
  );
$$;

create or replace function public.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = p_organization_id and user_id = auth.uid()
  );
$$;

create or replace function public.owns_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.transport_requests
    where id = p_request_id and client_id = auth.uid()
  );
$$;

create or replace function public.owns_shipment(p_shipment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.shipments s
    join public.transport_requests r on r.id = s.transport_request_id
    where s.id = p_shipment_id and r.client_id = auth.uid()
  );
$$;

create or replace function public.assigned_driver_on_shipment(p_shipment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.driver_assignments
    where shipment_id = p_shipment_id and driver_id = auth.uid()
  );
$$;

create or replace function public.assigned_driver_on_request(p_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from public.shipments s
      join public.driver_assignments da on da.shipment_id = s.id
     where s.transport_request_id = p_request_id
       and da.driver_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- Journal interne horodaté (appelé uniquement par les fonctions
-- du serveur et les triggers ; schéma non exposé)
-- ------------------------------------------------------------
create or replace function internal.log_event(
  p_type public.shipment_event_type,
  p_shipment_id uuid default null,
  p_transport_request_id uuid default null,
  p_payload jsonb default '{}'::jsonb,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_shipment_id is null and p_transport_request_id is null then
    raise exception 'Un événement doit être rattaché à une mission ou à une demande';
  end if;
  insert into public.shipment_events (shipment_id, transport_request_id, event_type, payload, created_by)
  values (p_shipment_id, p_transport_request_id, p_type, p_payload, coalesce(p_created_by, auth.uid()))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function internal.log_event(public.shipment_event_type, uuid, uuid, jsonb, uuid)
  from public, anon, authenticated, service_role;
grant execute on function internal.log_event(public.shipment_event_type, uuid, uuid, jsonb, uuid)
  to postgres;

-- ============================================================
-- Privilèges : on retire tout ce qui n'est pas nécessaire
-- Les transitions de statut passent exclusivement par les
-- fonctions du serveur (colonne status non accordée en UPDATE).
-- ============================================================

-- profiles : lecture propre/staff, mise à jour limitée (rôle via RPC)
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, phone, updated_at) on table public.profiles to authenticated;

-- organizations
revoke all on table public.organizations from anon, authenticated;
grant select on table public.organizations to authenticated;
grant insert (name, kind, siret, address, updated_at) on table public.organizations to authenticated;
grant update (name, kind, siret, address, updated_at) on table public.organizations to authenticated;
grant delete on table public.organizations to authenticated;

-- organization_members
revoke all on table public.organization_members from anon, authenticated;
grant select, insert, update, delete on table public.organization_members to authenticated;

-- transport_requests : pas de delete, pas de status en update
revoke all on table public.transport_requests from anon, authenticated;
grant select on table public.transport_requests to authenticated;
grant insert (client_id, organization_id, service_type, pickup_address, dropoff_address,
              pickup_datetime, patient_name, mobility_notes, contact_phone, notes)
  on table public.transport_requests to authenticated;
grant update (organization_id, service_type, pickup_address, dropoff_address,
              pickup_datetime, patient_name, mobility_notes, contact_phone, notes, updated_at)
  on table public.transport_requests to authenticated;

-- quotes : le montant n'est pas modifiable après publication (trigger),
-- le statut et la version ne sont modifiables que par les RPC
revoke all on table public.quotes from anon, authenticated;
grant select on table public.quotes to authenticated;
grant insert (transport_request_id, amount, currency, valid_until, notes, created_by)
  on table public.quotes to authenticated;
grant update (amount, currency, valid_until, notes, updated_at) on table public.quotes to authenticated;

-- shipments : insertion uniquement par RPC (accept_quote)
revoke all on table public.shipments from anon, authenticated;
grant select on table public.shipments to authenticated;
grant update (notes, scheduled_at, updated_at) on table public.shipments to authenticated;

-- shipment_events : journal en écriture limitée
revoke all on table public.shipment_events from anon, authenticated;
grant select on table public.shipment_events to authenticated;
grant insert (shipment_id, transport_request_id, event_type, payload, created_by)
  on table public.shipment_events to authenticated;

-- vehicles
revoke all on table public.vehicles from anon, authenticated;
grant select, insert, update, delete on table public.vehicles to authenticated;

-- driver_assignments : réponses uniquement par RPC
revoke all on table public.driver_assignments from anon, authenticated;
grant select on table public.driver_assignments to authenticated;
grant insert (shipment_id, driver_id, vehicle_id, assigned_by)
  on table public.driver_assignments to authenticated;

-- ============================================================
-- Politiques RLS
-- ============================================================
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.transport_requests enable row level security;
alter table public.quotes enable row level security;
alter table public.shipments enable row level security;
alter table public.shipment_events enable row level security;
alter table public.vehicles enable row level security;
alter table public.driver_assignments enable row level security;

-- profiles
drop policy if exists profiles_select_own_or_staff on public.profiles;
create policy profiles_select_own_or_staff
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
  on public.profiles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- organizations
drop policy if exists orgs_select_member_or_staff on public.organizations;
create policy orgs_select_member_or_staff
  on public.organizations for select to authenticated
  using (public.is_staff() or public.is_org_member(id));

drop policy if exists orgs_insert_staff on public.organizations;
create policy orgs_insert_staff
  on public.organizations for insert to authenticated
  with check (public.is_staff());

drop policy if exists orgs_update_staff on public.organizations;
create policy orgs_update_staff
  on public.organizations for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists orgs_delete_admin on public.organizations;
create policy orgs_delete_admin
  on public.organizations for delete to authenticated
  using (public.is_admin());

-- organization_members
drop policy if exists org_members_select on public.organization_members;
create policy org_members_select
  on public.organization_members for select to authenticated
  using (public.is_staff() or public.is_org_member(organization_id));

drop policy if exists org_members_insert_admin on public.organization_members;
create policy org_members_insert_admin
  on public.organization_members for insert to authenticated
  with check (public.is_admin());

drop policy if exists org_members_update_admin on public.organization_members;
create policy org_members_update_admin
  on public.organization_members for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists org_members_delete_admin on public.organization_members;
create policy org_members_delete_admin
  on public.organization_members for delete to authenticated
  using (public.is_admin());

-- transport_requests
drop policy if exists requests_select_own_or_staff on public.transport_requests;
create policy requests_select_own_or_staff
  on public.transport_requests for select to authenticated
  using (client_id = auth.uid() or public.is_staff() or public.assigned_driver_on_request(id));

drop policy if exists requests_insert_own on public.transport_requests;
create policy requests_insert_own
  on public.transport_requests for insert to authenticated
  with check (client_id = auth.uid() and status = 'submitted');

drop policy if exists requests_update_own on public.transport_requests;
create policy requests_update_own
  on public.transport_requests for update to authenticated
  using (client_id = auth.uid())
  with check (client_id = auth.uid());

drop policy if exists requests_update_staff on public.transport_requests;
create policy requests_update_staff
  on public.transport_requests for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- quotes
drop policy if exists quotes_select_staff_or_client on public.quotes;
create policy quotes_select_staff_or_client
  on public.quotes for select to authenticated
  using (public.is_staff() or public.owns_request(transport_request_id));

drop policy if exists quotes_insert_staff on public.quotes;
create policy quotes_insert_staff
  on public.quotes for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid());

-- shipments
drop policy if exists shipments_select_staff_or_client on public.shipments;
create policy shipments_select_staff_or_client
  on public.shipments for select to authenticated
  using (
    public.is_staff()
    or public.owns_request(transport_request_id)
    or public.assigned_driver_on_shipment(id)
  );

drop policy if exists shipments_update_staff on public.shipments;
create policy shipments_update_staff
  on public.shipments for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- shipment_events
drop policy if exists events_select_staff_or_client on public.shipment_events;
create policy events_select_staff_or_client
  on public.shipment_events for select to authenticated
  using (
    public.is_staff()
    or (shipment_id is not null and public.owns_shipment(shipment_id))
    or (transport_request_id is not null and public.owns_request(transport_request_id))
  );

drop policy if exists events_insert_staff_note on public.shipment_events;
create policy events_insert_staff_note
  on public.shipment_events for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid() and event_type = 'note');

-- vehicles
drop policy if exists vehicles_select_staff on public.vehicles;
create policy vehicles_select_staff
  on public.vehicles for select to authenticated
  using (public.is_staff() or public.is_driver());

drop policy if exists vehicles_write_admin on public.vehicles;
create policy vehicles_write_admin
  on public.vehicles for insert to authenticated
  with check (public.is_admin());

drop policy if exists vehicles_update_admin on public.vehicles;
create policy vehicles_update_admin
  on public.vehicles for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists vehicles_delete_admin on public.vehicles;
create policy vehicles_delete_admin
  on public.vehicles for delete to authenticated
  using (public.is_admin());

-- driver_assignments
drop policy if exists assignments_select on public.driver_assignments;
create policy assignments_select
  on public.driver_assignments for select to authenticated
  using (public.is_staff() or driver_id = auth.uid() or public.owns_shipment(shipment_id));

drop policy if exists assignments_insert_staff on public.driver_assignments;
create policy assignments_insert_staff
  on public.driver_assignments for insert to authenticated
  with check (public.is_staff() and assigned_by = auth.uid());
