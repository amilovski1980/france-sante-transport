-- ============================================================
-- Tests : validations de données — contraintes SQL, refus des
-- saisies invalides, identifiants inconnus.
-- Données 100 % fictives.
-- ============================================================
begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

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

-- ------------------------------------------------------------
-- Fixtures fictives
-- ------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
 ('50000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'client.a.f5@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Client A (test)"}'),
 ('50000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'admin.f5@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Admin (test)"}');

update public.profiles set role = 'admin' where email = 'admin.f5@test.local';

-- Une demande valide, utilisée comme cible des tests de devis
select public.test_login('50000000-0000-4000-8000-000000000001'::uuid);
insert into public.transport_requests
  (client_id, service_type, pickup_address, dropoff_address, pickup_datetime)
values
  ('50000000-0000-4000-8000-000000000001', 'medical_transport',
   'F5 : 1 rue Victor Hugo, Nantes', 'F5 : Clinique Sainte-Marie, Nantes',
   now() + interval '3 days');
create temporary table test_rq as
  select id from public.transport_requests
   where client_id = '50000000-0000-4000-8000-000000000001';
select public.test_logout();

-- ============================================================
-- Contraintes de saisie
-- ============================================================
select public.test_login('50000000-0000-4000-8000-000000000001'::uuid);

-- 1 : départ identique à l'arrivée
select throws_ok(
  $q$insert into public.transport_requests
       (client_id, service_type, pickup_address, dropoff_address, pickup_datetime)
     values ('50000000-0000-4000-8000-000000000001', 'medical_transport',
             '10 rue A, Bordeaux', '10 rue A, Bordeaux', now())$q$,
  '23514', null,
  'une demande avec départ identique à l''arrivée est refusée'
);

-- 2 : type de service inconnu
select throws_ok(
  $q$insert into public.transport_requests
       (client_id, service_type, pickup_address, dropoff_address, pickup_datetime)
     values ('50000000-0000-4000-8000-000000000001', 'teleportation',
             '1 rue A, Bordeaux', '2 rue B, Bordeaux', now())$q$,
  '22P02', null,
  'un type de service hors énumération est refusé'
);

-- 3 : adresse trop courte
select throws_ok(
  $q$insert into public.transport_requests
       (client_id, service_type, pickup_address, dropoff_address, pickup_datetime)
     values ('50000000-0000-4000-8000-000000000001', 'medical_transport',
             'a', '2 rue B, Bordeaux', now())$q$,
  '23514', null,
  'une adresse trop courte est refusée'
);
select public.test_logout();

select public.test_login('50000000-0000-4000-8000-000000000003'::uuid);

-- 4 : montant négatif
select throws_ok(
  $q$insert into public.quotes (transport_request_id, amount, created_by)
     values ((select id from test_rq), -5.00,
             '50000000-0000-4000-8000-000000000003')$q$,
  '23514', null,
  'un montant négatif est refusé'
);

-- 5 : montant manquant
select throws_ok(
  $q$insert into public.quotes (transport_request_id, created_by)
     values ((select id from test_rq), '50000000-0000-4000-8000-000000000003')$q$,
  '23502', null,
  'un montant manquant est refusé'
);

-- 6 : devise hors zone euro
select throws_ok(
  $q$insert into public.quotes (transport_request_id, amount, currency, created_by)
     values ((select id from test_rq), 100.00, 'USD',
             '50000000-0000-4000-8000-000000000003')$q$,
  '23514', null,
  'une devise autre que l''euro est refusée'
);

-- 7 : plaque invalide
select throws_ok(
  $q$insert into public.vehicles (registration_plate, vehicle_type)
     values ('!!', 'van')$q$,
  '23514', null,
  'une plaque d''immatriculation invalide est refusée'
);

-- 8 : plaque dupliquée
insert into public.vehicles (registration_plate, vehicle_type)
values ('FT-501-AA', 'van');
select throws_ok(
  $q$insert into public.vehicles (registration_plate, vehicle_type)
     values ('FT-501-AA', 'sedan')$q$,
  '23505', null,
  'une plaque dupliquée est refusée'
);

-- 9 : montant manquant passé à la RPC
select throws_ok(
  $q$select public.create_quote((select id from test_rq), null, null, null)$q$,
  '22023', null,
  'la RPC refuse un montant manquant'
);

-- 10 : date de validité passée
select throws_ok(
  $q$select public.create_quote((select id from test_rq), 100.00,
      now() - interval '1 day', null)$q$,
  '22023', null,
  'la RPC refuse une validité déjà expirée'
);

-- 11 : envoi d'un devis inexistant
select throws_ok(
  $q$select public.send_quote('00000000-0000-4000-8000-00000000ffff')$q$,
  'P0002', null,
  'la RPC signale un devis introuvable'
);

-- 12 : demande inconnue pour un devis
select throws_ok(
  $q$select public.create_quote('00000000-0000-4000-8000-00000000ffff', 100.00, null, null)$q$,
  'P0002', null,
  'la RPC signale une demande introuvable'
);

-- 13 : mission inconnue pour une confirmation
select throws_ok(
  $q$select public.confirm_shipment('00000000-0000-4000-8000-00000000ffff')$q$,
  'P0002', null,
  'la RPC signale une mission introuvable'
);

-- 14 : affectation sur mission inconnue
select throws_ok(
  $q$select public.assign_driver('00000000-0000-4000-8000-00000000ffff',
     '50000000-0000-4000-8000-000000000001',
     (select id from public.vehicles limit 1))$q$,
  'P0002', null,
  'la RPC signale une mission introuvable'
);
select public.test_logout();

-- 15 : e-mail de profil invalide refusé par la base (en accès direct)
select throws_ok(
  $q$insert into public.profiles (id, email)
     values ('50000000-0000-4000-8000-000000000099', 'pas-un-email')$q$,
  '23514', null,
  'un e-mail de profil invalide est refusé par la base'
);

select finish();
rollback;
