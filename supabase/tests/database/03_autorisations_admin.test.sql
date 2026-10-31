-- ============================================================
-- Tests : autorisations par rôle (admin, dispatcheur, client,
-- chauffeur, visiteur) et isolation des données.
-- Données 100 % fictives.
-- ============================================================
begin;

create extension if not exists pgtap with schema extensions;
select plan(23);

create function public.test_login(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function public.test_logout() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
end;
$$;

-- Tente une modification et renvoie le nombre de lignes touchées
-- (le rôle impersonné s'applique, RLS incluse).
create function public.test_update_shipment_notes(p_shipment uuid) returns bigint
language plpgsql as $$
declare v_count bigint;
begin
  with u as (
    update public.shipments set notes = 'tentative'
     where id = p_shipment
    returning 1
  )
  select count(*) into v_count from u;
  return v_count;
end;
$$;

create table public.test_ctx (k text primary key, v uuid);
grant all on table public.test_ctx to anon, authenticated, service_role;

-- ------------------------------------------------------------
-- Fixtures fictives
-- ------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
 ('30000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'client.a.f3@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Client A (test)"}'),
 ('30000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'client.b.f3@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Client B (test)"}'),
 ('30000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'admin.f3@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Admin (test)"}'),
 ('30000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'dispatch.f3@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Dispatcheur (test)"}'),
 ('30000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'chauffeur.f3@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Chauffeur (test)"}');

update public.profiles set role = 'admin'   where email = 'admin.f3@test.local';
update public.profiles set role = 'dispatcher' where email = 'dispatch.f3@test.local';
update public.profiles set role = 'driver'  where email = 'chauffeur.f3@test.local';

select public.test_login('30000000-0000-4000-8000-000000000001'::uuid);
insert into public.transport_requests
  (client_id, service_type, pickup_address, dropoff_address, pickup_datetime)
values
  ('30000000-0000-4000-8000-000000000001', 'medical_transport',
   'F3 : 10 rue des Fleurs, Marseille', 'F3 : Clinique du Vieux-Port, Marseille',
   now() + interval '5 days');
insert into public.test_ctx
  select 'rq1', id from public.transport_requests
   where client_id = '30000000-0000-4000-8000-000000000001';
select public.test_logout();

-- ============================================================
-- Le dispatcheur est un utilisateur autorisé
-- ============================================================
select public.test_login('30000000-0000-4000-8000-000000000004'::uuid);

-- 1
select is(
  (select status from public.mark_request_under_review(
     (select v from public.test_ctx where k = 'rq1'))),
  'under_review'::public.request_status,
  'un dispatcheur peut ouvrir l''instruction'
);

-- 2
select is(
  (select status from public.create_quote(
     (select v from public.test_ctx where k = 'rq1'), 200.00, null, 'Test équipe')),
  'draft'::public.quote_status,
  'un dispatcheur peut créer un devis'
);

insert into public.test_ctx
  select 'q1', id from public.quotes
   where transport_request_id = (select v from public.test_ctx where k = 'rq1');

-- 3
select is(
  (select status from public.send_quote((select v from public.test_ctx where k = 'q1'))),
  'sent'::public.quote_status,
  'un dispatcheur peut envoyer un devis'
);

select public.test_logout();

-- 4 : le client accepte
select public.test_login('30000000-0000-4000-8000-000000000001'::uuid);
select is(
  (select status from public.accept_quote((select v from public.test_ctx where k = 'q1'))),
  'pending_confirmation'::public.shipment_status,
  'le client accepte la version envoyée'
);

insert into public.test_ctx
  select 's1', id from public.shipments
   where quote_id = (select v from public.test_ctx where k = 'q1');

-- 9 : le client voit ses propres devis
select ok(
  (select count(*) from public.quotes) >= 1,
  'le client voit les devis de sa demande'
);

-- 11 : le client voit sa mission
select is(
  (select count(*) from public.shipments),
  1::bigint,
  'le client voit la mission issue de son devis'
);

select public.test_logout();

-- 5 : le dispatcheur peut confirmer la mission
select public.test_login('30000000-0000-4000-8000-000000000004'::uuid);
select is(
  (select status from public.confirm_shipment((select v from public.test_ctx where k = 's1'))),
  'confirmed'::public.shipment_status,
  'un dispatcheur peut confirmer une mission'
);

-- 6 : mais pas gérer les rôles (réservé admin)
select throws_ok(
  $q$select public.set_user_role('30000000-0000-4000-8000-000000000002', 'admin')$q$,
  '42501', null,
  'un dispatcheur ne peut pas modifier les rôles'
);
select public.test_logout();

-- ============================================================
-- Un client n'a aucun droit d'équipe
-- ============================================================
select public.test_login('30000000-0000-4000-8000-000000000001'::uuid);

-- 7
select throws_ok(
  $q$select public.reject_request((select v from public.test_ctx where k='rq1'))$q$,
  '42501', null,
  'un client ne peut pas refuser une demande'
);

-- 13 : pas d'auto-élévation de rôle
select throws_ok(
  $q$update public.profiles set role = 'admin'
     where id = '30000000-0000-4000-8000-000000000001'$q$,
  '42501', null,
  'un client ne peut pas élever son propre rôle'
);
select public.test_logout();

-- ============================================================
-- Isolation entre clients
-- ============================================================
select public.test_login('30000000-0000-4000-8000-000000000002'::uuid);

-- 8
select is(
  (select count(*) from public.quotes),
  0::bigint,
  'un autre client ne voit aucun devis'
);

-- 10
select is(
  (select count(*) from public.shipments),
  0::bigint,
  'un autre client ne voit aucune mission'
);

-- 14 : tentative de modification silencieuse d'une mission (0 ligne)
select is(
  public.test_update_shipment_notes((select v from public.test_ctx where k = 's1')),
  0::bigint,
  'un autre client ne peut modifier aucune mission'
);

-- 15 : aucun événement des autres dossiers
select is(
  (select count(*) from public.shipment_events
    where transport_request_id = (select v from public.test_ctx where k = 'rq1')),
  0::bigint,
  'un autre client ne voit pas le journal des autres dossiers'
);

select public.test_logout();

-- ============================================================
-- Chauffeur
-- ============================================================
select public.test_login('30000000-0000-4000-8000-000000000005'::uuid);

-- 12
select throws_ok(
  $q$select public.create_quote((select v from public.test_ctx where k='rq1'), 10)$q$,
  '42501', null,
  'un chauffeur ne peut pas créer de devis'
);

-- 16 : pas de demandes tant qu'il n'est pas affecté
select is(
  (select count(*) from public.transport_requests),
  0::bigint,
  'un chauffeur non affecté ne voit aucune demande'
);

-- 20 : après affectation, il voit sa mission assignation (ci-dessous)
select public.test_logout();

-- ============================================================
-- Admin : flotte, affectation, rôles
-- ============================================================
select public.test_login('30000000-0000-4000-8000-000000000003'::uuid);

-- 17 : création de véhicule réservée à l'administrateur
insert into public.vehicles (registration_plate, vehicle_type, capacity, has_wheelchair_lift)
values ('FT-001-AA', 'van', 4, true);
select is(
  (select registration_plate from public.vehicles
    where registration_plate = 'FT-001-AA'),
  'FT-001-AA',
  'un administrateur peut créer un véhicule'
);

-- 18 : affectation chauffeur / véhicule
select is(
  (select status from public.assign_driver(
     (select v from public.test_ctx where k = 's1'),
     '30000000-0000-4000-8000-000000000005',
     (select id from public.vehicles where registration_plate = 'FT-001-AA'))),
  'proposed'::public.assignment_status,
  'un administrateur peut affecter un chauffeur'
);

select public.test_logout();

-- 19 : un client ne peut pas créer de véhicule
select public.test_login('30000000-0000-4000-8000-000000000001'::uuid);
select throws_ok(
  $q$insert into public.vehicles (registration_plate, vehicle_type)
     values ('FT-999-ZZ', 'sedan')$q$,
  '42501', null,
  'un client ne peut pas créer de véhicule'
);
select public.test_logout();

-- 20 à 22 : après affectation, le chauffeur voit la mission assignée
select public.test_login('30000000-0000-4000-8000-000000000005'::uuid);
select is(
  (select count(*) from public.driver_assignments),
  1::bigint,
  'le chauffeur affecté voit son affectation'
);
select is(
  (select count(*) from public.transport_requests),
  1::bigint,
  'le chauffeur affecté voit la demande associée'
);
select is(
  (select count(*) from public.shipments),
  1::bigint,
  'le chauffeur affecté voit la mission associée'
);

select public.test_logout();

-- 22 : le bootstrap admin est bloqué dès qu'un admin existe
select public.test_login('30000000-0000-4000-8000-000000000001'::uuid);
select throws_ok(
  $q$select public.bootstrap_first_admin('client.a.f3@test.local')$q$,
  '42501', null,
  'le bootstrap administrateur est bloqué dès qu''un admin existe'
);

select public.test_logout();
select finish();
rollback;
