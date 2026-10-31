-- ============================================================
-- Tests : machine à états — transitions invalides refusées,
-- cascade d'annulation, affectations chauffeur, montant
-- verrouillé après publication.
-- Données 100 % fictives.
-- ============================================================
begin;

create extension if not exists pgtap with schema extensions;
select plan(28);

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

create table public.test_ctx (k text primary key, v uuid);
grant all on table public.test_ctx to anon, authenticated, service_role;

-- Tente de modifier le montant d'un devis et renvoie le nombre
-- de lignes réellement modifiées (RLS incluse).
create function public.test_update_quote_amount(p_quote uuid, p_amount numeric)
returns bigint
language plpgsql as $$
declare v_count bigint;
begin
  with u as (
    update public.quotes set amount = p_amount
     where id = p_quote
    returning 1
  )
  select count(*) into v_count from u;
  return v_count;
end;
$$;

-- ------------------------------------------------------------
-- Fixtures fictives
-- ------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
 ('40000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'client.a.f4@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Client A (test)"}'),
 ('40000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'admin.f4@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Admin (test)"}'),
 ('40000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'chauffeur1.f4@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Chauffeur 1 (test)"}'),
 ('40000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'chauffeur2.f4@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Chauffeur 2 (test)"}');

update public.profiles set role = 'admin'   where email = 'admin.f4@test.local';
update public.profiles set role = 'driver'  where email = 'chauffeur1.f4@test.local';
update public.profiles set role = 'driver'  where email = 'chauffeur2.f4@test.local';

insert into public.vehicles (registration_plate, vehicle_type, capacity, has_wheelchair_lift)
values ('FT-404-AA', 'van', 4, true);
insert into public.vehicles (registration_plate, vehicle_type, capacity, active)
values ('FT-405-BB', 'sedan', 3, false);

insert into public.test_ctx values
  ('v_active',   (select id from public.vehicles where registration_plate = 'FT-404-AA')),
  ('v_inactive', (select id from public.vehicles where registration_plate = 'FT-405-BB'));

-- RQ1 : acceptée, mission s1 (sera confirmée puis annulée par l'équipe)
-- RQ2 : acceptée, mission s2 (annulée en cascade par le client)
-- RQ3 : devis en brouillon (jamais envoyé)
select public.test_login('40000000-0000-4000-8000-000000000001'::uuid);
insert into public.transport_requests
  (client_id, service_type, pickup_address, dropoff_address, pickup_datetime)
values
  ('40000000-0000-4000-8000-000000000001', 'medical_transport',
   'F4-RQ1 : 1 rue des Lilas, Lille', 'F4-RQ1 : CHU de Lille', now() + interval '4 days'),
  ('40000000-0000-4000-8000-000000000001', 'appointment_transfer',
   'F4-RQ2 : 5 boulevard Gambetta, Lille', 'F4-RQ2 : Clinique des Bois, Lille',
   now() + interval '6 days'),
  ('40000000-0000-4000-8000-000000000001', 'medical_transport',
   'F4-RQ3 : 8 rue Pasteur, Roubaix', 'F4-RQ3 : EHPAD Roubaix', now() + interval '8 days');

insert into public.test_ctx
  select case
    when pickup_address like 'F4-RQ1%' then 'rq1'
    when pickup_address like 'F4-RQ2%' then 'rq2'
    else 'rq3' end, id
    from public.transport_requests
   where client_id = '40000000-0000-4000-8000-000000000001';
select public.test_logout();

select public.test_login('40000000-0000-4000-8000-000000000003'::uuid);
select public.create_quote(
  (select v from public.test_ctx where k = 'rq1'), 150.00, now() + interval '7 days', 'Test');
select public.create_quote(
  (select v from public.test_ctx where k = 'rq2'), 95.00, now() + interval '7 days', 'Test');
select public.create_quote(
  (select v from public.test_ctx where k = 'rq3'), 75.00, null, 'Brouillon (test)');

insert into public.test_ctx
  select case
    when transport_request_id = (select v from public.test_ctx where k = 'rq1') then 'q1'
    when transport_request_id = (select v from public.test_ctx where k = 'rq2') then 'q2'
    else 'q3draft' end, id
    from public.quotes
   where transport_request_id in ((select v from public.test_ctx where k = 'rq1'),
                                  (select v from public.test_ctx where k = 'rq2'),
                                  (select v from public.test_ctx where k = 'rq3'));

select public.send_quote((select v from public.test_ctx where k = 'q1'));
select public.send_quote((select v from public.test_ctx where k = 'q2'));
select public.test_logout();

select public.test_login('40000000-0000-4000-8000-000000000001'::uuid);
select public.accept_quote((select v from public.test_ctx where k = 'q1'));
select public.accept_quote((select v from public.test_ctx where k = 'q2'));
insert into public.test_ctx
  select 's1', id from public.shipments
   where quote_id = (select v from public.test_ctx where k = 'q1');
insert into public.test_ctx
  select 's2', id from public.shipments
   where quote_id = (select v from public.test_ctx where k = 'q2');
select public.test_logout();

-- ============================================================
-- Transitions invalides
-- ============================================================
select public.test_login('40000000-0000-4000-8000-000000000001'::uuid);

-- 1 : acceptation d'un devis jamais envoyé
select throws_ok(
  $q$select public.accept_quote((select v from public.test_ctx where k='q3draft'))$q$,
  'P0001', null,
  'un devis en brouillon ne peut pas être accepté'
);
select public.test_logout();

select public.test_login('40000000-0000-4000-8000-000000000003'::uuid);

-- 2 : démarrage d'une mission non confirmée
select throws_ok(
  $q$select public.start_shipment((select v from public.test_ctx where k='s1'))$q$,
  'P0001', null,
  'une mission non confirmée ne peut pas démarrer'
);

-- 3 : affectation d'un non-chauffeur
select throws_ok(
  $q$select public.assign_driver((select v from public.test_ctx where k='s1'),
     '40000000-0000-4000-8000-000000000001',
     (select v from public.test_ctx where k='v_active'))$q$,
  '22023', null,
  'affecter un non-chauffeur est refusé'
);

-- 4 : affectation d'un véhicule inactif
select throws_ok(
  $q$select public.assign_driver((select v from public.test_ctx where k='s1'),
     '40000000-0000-4000-8000-000000000005',
     (select v from public.test_ctx where k='v_inactive'))$q$,
  '22023', null,
  'affecter un véhicule inactif est refusé'
);

-- 5 : affectation valide
select is(
  (select status from public.assign_driver(
     (select v from public.test_ctx where k = 's1'),
     '40000000-0000-4000-8000-000000000005',
     (select v from public.test_ctx where k = 'v_active'))),
  'proposed'::public.assignment_status,
  'une affectation valide est proposée au chauffeur'
);

insert into public.test_ctx
  select 'a1', id from public.driver_assignments
   where shipment_id = (select v from public.test_ctx where k = 's1');

-- 6 : une seule affectation active par mission
select throws_ok(
  $q$select public.assign_driver((select v from public.test_ctx where k='s1'),
     '40000000-0000-4000-8000-000000000006',
     (select v from public.test_ctx where k='v_active'))$q$,
  '23505', null,
  'une seconde affectation active pour la même mission est refusée'
);
select public.test_logout();

-- 7 : le chauffeur affecté accepte
select public.test_login('40000000-0000-4000-8000-000000000005'::uuid);
select is(
  (select status from public.respond_driver_assignment(
     (select v from public.test_ctx where k = 'a1'), true)),
  'accepted'::public.assignment_status,
  'le chauffeur accepte sa proposition'
);

-- 8 : le chauffeur ne peut pas répondre deux fois
select throws_ok(
  $q$select public.respond_driver_assignment(
     (select v from public.test_ctx where k = 'a1'), false)$q$,
  'P0001', null,
  'le chauffeur ne peut pas répondre deux fois'
);

-- 9 : réponse sans valeur
select throws_ok(
  $q$select public.respond_driver_assignment(
     (select v from public.test_ctx where k = 'a1'), null)$q$,
  '22023', null,
  'une réponse null est refusée avant toute recherche'
);
select public.test_logout();

-- 10 : un autre chauffeur ne peut pas répondre à l'affectation d'autrui
select public.test_login('40000000-0000-4000-8000-000000000006'::uuid);
select throws_ok(
  $q$select public.respond_driver_assignment(
     (select v from public.test_ctx where k = 'a1'), true)$q$,
  '42501', null,
  'un autre chauffeur ne peut pas répondre à cette affectation'
);
select public.test_logout();

-- ============================================================
-- Cycle de vie confirmé → démarré → annulé (équipe)
-- ============================================================
select public.test_login('40000000-0000-4000-8000-000000000003'::uuid);

-- 11
select is(
  (select status from public.confirm_shipment((select v from public.test_ctx where k = 's1'))),
  'confirmed'::public.shipment_status,
  'la mission est confirmée manuellement'
);

-- 12 : la double confirmation est refusée
select throws_ok(
  $q$select public.confirm_shipment((select v from public.test_ctx where k='s1'))$q$,
  'P0001', null,
  'la double confirmation est refusée'
);

-- 13
select is(
  (select status from public.start_shipment((select v from public.test_ctx where k = 's1'))),
  'in_progress'::public.shipment_status,
  'la mission confirmée démarre'
);

-- 14 : un second démarrage est refusé
select throws_ok(
  $q$select public.start_shipment((select v from public.test_ctx where k='s1'))$q$,
  'P0001', null,
  'un second démarrage est refusé'
);

-- 15 : annulation autorisée depuis in_progress
select is(
  (select status from public.cancel_shipment(
     (select v from public.test_ctx where k = 's1'), 'Annulée (test)')),
  'cancelled'::public.shipment_status,
  'une mission en cours peut être annulée'
);

-- 16 : annuler deux fois est refusé
select throws_ok(
  $q$select public.cancel_shipment((select v from public.test_ctx where k='s1'), null)$q$,
  'P0001', null,
  'annuler deux fois est refusé'
);

-- 17 : démarrer une mission annulée est refusé
select throws_ok(
  $q$select public.start_shipment((select v from public.test_ctx where k='s1'))$q$,
  'P0001', null,
  'démarrer une mission annulée est refusé'
);

-- 18 : clôturer une mission annulée est refusé
select throws_ok(
  $q$select public.complete_shipment((select v from public.test_ctx where k='s1'))$q$,
  'P0001', null,
  'clôturer une mission annulée est refusé'
);

-- 19 : affecter un chauffeur sur une mission annulée est refusé
select throws_ok(
  $q$select public.assign_driver((select v from public.test_ctx where k='s1'),
     '40000000-0000-4000-8000-000000000005',
     (select v from public.test_ctx where k='v_active'))$q$,
  'P0001', null,
  'affecter un chauffeur sur une mission annulée est refusé'
);
select public.test_logout();

-- 20 : le montant verrouillé ne peut plus bouger (déclencheur), en accès direct
select throws_ok(
  $q$update public.quotes set amount = 1.00
     where id = (select v from public.test_ctx where k = 'q2')$q$,
  'P0001', null,
  'le montant d''un devis publié ne peut plus être modifié'
);

-- 21 : la table n'autorise aucune modification directe (équipe incluse)
select public.test_login('40000000-0000-4000-8000-000000000003'::uuid);
select is(
  public.test_update_quote_amount(
    (select v from public.test_ctx where k = 'q2'), 1.00),
  0::bigint,
  'la table ne permet aucune modification directe du montant publié (équipe incluse)'
);
select public.test_logout();

-- 22 : ni le client
select public.test_login('40000000-0000-4000-8000-000000000001'::uuid);
select is(
  public.test_update_quote_amount(
    (select v from public.test_ctx where k = 'q1'), 1.00),
  0::bigint,
  'la table ne permet aucune modification directe du montant publié (client inclus)'
);

-- 23 : le journal retrace le cycle de vie complet de la mission 1
select ok(
  (select count(*) from public.shipment_events
    where shipment_id = (select v from public.test_ctx where k = 's1')) >= 6,
  'le journal retrace au moins 6 événements de la mission 1'
);

-- ============================================================
-- Annulation d'une demande : sans puis avec mission active
-- ============================================================
-- 24 : le client annule sa demande (mission déjà annulée par l'équipe)
select is(
  (select status from public.cancel_transport_request(
     (select v from public.test_ctx where k = 'rq1'), 'Annulée par le client (test)')),
  'cancelled'::public.request_status,
  'le client peut annuler sa demande sans mission active'
);

-- 25
select is(
  (select status from public.transport_requests
    where id = (select v from public.test_ctx where k = 'rq1')),
  'cancelled'::public.request_status,
  'la demande annulée passe au statut cancelled'
);

-- 26 : annuler deux fois la même demande est refusé
select throws_ok(
  $q$select public.cancel_transport_request(
     (select v from public.test_ctx where k='rq1'), null)$q$,
  'P0001', null,
  'annuler deux fois la même demande est refusé'
);

-- 27 : annulation en cascade de la mission active de la demande 2
select is(
  (select status from public.cancel_transport_request(
     (select v from public.test_ctx where k = 'rq2'), 'Annulée aussi (test)')),
  'cancelled'::public.request_status,
  'le client peut annuler sa demande acceptée'
);

-- 28 : la mission associée est annulée en cascade
select is(
  (select status from public.shipments
    where id = (select v from public.test_ctx where k = 's2')),
  'cancelled'::public.shipment_status,
  'annuler la demande annule aussi la mission active associée'
);

select public.test_logout();
select finish();
rollback;
