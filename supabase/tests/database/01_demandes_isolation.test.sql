-- ============================================================
-- Tests : création / consultation d'une demande, isolation
-- entre deux clients, politiques d'accès de base.
-- Données 100 % fictives.
-- ============================================================
begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

-- Helpers d'impersonation (roulés back à la fin)
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

-- ------------------------------------------------------------
-- Fixtures fictives
-- ------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
 ('10000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'client.a.f1@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Client A (test)"}'),
 ('10000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'client.b.f1@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Client B (test)"}'),
 ('10000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'admin.f1@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Admin (test)"}');

-- 1 : les profils sont créés automatiquement à l'inscription
select is(
  (select count(*) from public.profiles where email like '%f1@test.local'),
  3::bigint,
  'les profils sont créés automatiquement à l''inscription'
);

-- 2 : rôle par défaut
select is(
  (select role from public.profiles where email = 'client.a.f1@test.local'),
  'client'::public.app_role,
  'le rôle par défaut est client'
);

update public.profiles set role = 'admin' where email = 'admin.f1@test.local';

-- ------------------------------------------------------------
-- Le client A soumet une demande
-- ------------------------------------------------------------
select public.test_login('10000000-0000-4000-8000-000000000001'::uuid);

insert into public.transport_requests
  (client_id, service_type, pickup_address, dropoff_address, pickup_datetime, contact_phone)
values
  ('10000000-0000-4000-8000-000000000001', 'medical_transport',
   '12 rue des Lilas, 75011 Paris', 'Hôpital Saint-Louis, 75010 Paris',
   now() + interval '3 days', '0600000001');

-- 3 : la demande est enregistrée au statut « submitted »
select is(
  (select status from public.transport_requests
    where client_id = '10000000-0000-4000-8000-000000000001'),
  'submitted'::public.request_status,
  'la demande est enregistrée au statut submitted'
);

-- 4 : le client A voit sa propre demande
select is(
  (select count(*) from public.transport_requests),
  1::bigint,
  'le client A voit sa demande'
);

-- Mémorise l'identifiant de la demande du client A
insert into public.test_ctx
  select 'rq1', id from public.transport_requests
   where client_id = '10000000-0000-4000-8000-000000000001';

-- ------------------------------------------------------------
-- Isolation : le client B ne voit rien
-- ------------------------------------------------------------
select public.test_login('10000000-0000-4000-8000-000000000002'::uuid);

-- 5
select is(
  (select count(*) from public.transport_requests),
  0::bigint,
  'le client B ne voit aucune demande des autres'
);

-- 6 : lecture directe par identifiant connu
select is(
  (select count(*) from public.transport_requests
    where id = (select v from public.test_ctx where k = 'rq1')),
  0::bigint,
  'le client B ne peut pas lire la demande du client A par identifiant'
);

-- 9 : le client B ne peut pas créer une demande au nom du client A
select throws_ok(
  $q$insert into public.transport_requests
      (client_id, service_type, pickup_address, dropoff_address, pickup_datetime)
     values ('10000000-0000-4000-8000-000000000001', 'medical_transport',
             'Adresse X', 'Adresse Y', now() + interval '1 day')$q$,
  '42501', null,
  'un client ne peut pas soumettre une demande pour un autre compte'
);

-- ------------------------------------------------------------
-- L'administrateur voit tout
-- ------------------------------------------------------------
select public.test_login('10000000-0000-4000-8000-000000000003'::uuid);

-- 7
select is(
  (select count(*) from public.transport_requests
    where id = (select v from public.test_ctx where k = 'rq1')),
  1::bigint,
  'l''administrateur voit la demande du client'
);

select public.test_logout();

-- 8 : événement horodaté à la soumission
select ok(
  exists(select 1 from public.shipment_events
          where transport_request_id = (select v from public.test_ctx where k = 'rq1')
            and event_type = 'request_submitted'
            and created_at is not null),
  'la soumission de la demande est horodatée dans le journal'
);

-- ------------------------------------------------------------
-- Transitions et droits directement en table
-- ------------------------------------------------------------
select public.test_login('10000000-0000-4000-8000-000000000001'::uuid);

-- 10 : le client ne peut pas changer le statut en table
select throws_ok(
  $q$update public.transport_requests set status = 'accepted'$q$,
  '42501', null,
  'un client ne peut pas modifier le statut d''une demande en table'
);

-- 11 : aucune suppression de demandes
select throws_ok(
  $q$delete from public.transport_requests$q$,
  '42501', null,
  'aucun client ne peut supprimer une demande de transport'
);

select public.test_logout();

-- ------------------------------------------------------------
-- Accès anonyme
-- ------------------------------------------------------------
set local role anon;

-- 12
select throws_ok(
  $q$select * from public.transport_requests$q$,
  '42501', null,
  'un visiteur non connecté ne voit aucune demande'
);

-- 13 : le formulaire de contact public reste utilisable
select lives_ok(
  $q$insert into public.contact_messages (topic, full_name, email, subject, message)
     values ('contact', 'Visiteur Test', 'visiteur@test.local',
             'Question test', 'Ceci est un message de test suffisamment long.')$q$,
  'un visiteur peut envoyer un message de contact'
);

-- 14 : mais pas le relire
select throws_ok(
  $q$select * from public.contact_messages$q$,
  '42501', null,
  'les messages de contact ne sont lisibles que par les équipes'
);

reset role;
select finish();
rollback;
