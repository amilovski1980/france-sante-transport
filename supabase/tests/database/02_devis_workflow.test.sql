-- ============================================================
-- Tests : parcours devis — préparation, envoi, acceptation,
-- vérifications serveur, création de mission (jamais confirmée
-- automatiquement), journal horodaté.
-- Données 100 % fictives.
-- ============================================================
begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

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
 ('20000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'client.a.f2@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Client A (test)"}'),
 ('20000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'client.b.f2@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Client B (test)"}'),
 ('20000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'admin.f2@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Admin (test)"}');

update public.profiles set role = 'admin' where email = 'admin.f2@test.local';

-- Deux demandes du client A
select public.test_login('20000000-0000-4000-8000-000000000001'::uuid);

insert into public.transport_requests
  (client_id, service_type, pickup_address, dropoff_address, pickup_datetime)
values
  ('20000000-0000-4000-8000-000000000001', 'medical_transport',
   'F2-RQ1 : 1 rue de la Paix, Paris', 'F2-RQ1 : Clinique du Nord, Paris',
   now() + interval '4 days');

insert into public.transport_requests
  (client_id, service_type, pickup_address, dropoff_address, pickup_datetime)
values
  ('20000000-0000-4000-8000-000000000001', 'wheelchair_transport',
   'F2-RQ2 : 5 avenue Victor Hugo, Lyon', 'F2-RQ2 : EHPAD des Tilleuls, Lyon',
   now() + interval '6 days');

insert into public.test_ctx
  select case when pickup_address like 'F2-RQ1%' then 'rq1' else 'rq2' end, id
    from public.transport_requests
   where client_id = '20000000-0000-4000-8000-000000000001';

select public.test_logout();

-- ============================================================
-- Instruction et devis versionné (équipe)
-- ============================================================
select public.test_login('20000000-0000-4000-8000-000000000003'::uuid);

-- 1 : passage en instruction
select is(
  (select status from public.mark_request_under_review(
     (select v from public.test_ctx where k = 'rq1'))),
  'under_review'::public.request_status,
  'un membre autorisé peut ouvrir l''instruction d''une demande soumise'
);

-- 2 : création du devis (montant fourni par l'équipe)
select is(
  (select status from public.create_quote(
     (select v from public.test_ctx where k = 'rq1'), 120.50,
     now() + interval '7 days', 'Montant validé par l''équipe (test)')),
  'draft'::public.quote_status,
  'le devis est créé en brouillon avec le montant saisi par l''équipe'
);

insert into public.test_ctx
  select 'q1', id from public.quotes
   where transport_request_id = (select v from public.test_ctx where k = 'rq1')
     and version = 1;

select public.test_logout();

-- 3 : un client ne peut pas créer de devis
select public.test_login('20000000-0000-4000-8000-000000000001'::uuid);
select throws_ok(
  $q$select public.create_quote((select v from public.test_ctx where k='rq1'), 99.99)$q$,
  '42501', null,
  'un client ne peut pas créer un devis'
);

select public.test_logout();

-- ============================================================
-- Envoi et acceptation
-- ============================================================
select public.test_login('20000000-0000-4000-8000-000000000003'::uuid);

-- 4 : envoi au client
select is(
  (select status from public.send_quote((select v from public.test_ctx where k = 'q1'))),
  'sent'::public.quote_status,
  'le devis peut être envoyé au client'
);

-- 5 : la demande passe à « devis envoyé »
select is(
  (select status from public.transport_requests
    where id = (select v from public.test_ctx where k = 'rq1')),
  'quoted'::public.request_status,
  'la demande passe au statut quoted après envoi'
);

-- 6 : deuxième version
select is(
  (select version from public.create_quote(
     (select v from public.test_ctx where k = 'rq1'), 135.00, null, 'Révision (test)')),
  2::integer,
  'chaque nouvelle proposition crée une version suivante'
);

insert into public.test_ctx
  select 'q2', id from public.quotes
   where transport_request_id = (select v from public.test_ctx where k = 'rq1')
     and version = 2;

-- 7 : l'envoi de la version 2 remplace la version 1
select public.send_quote((select v from public.test_ctx where k = 'q2'));
select is(
  (select status from public.quotes where id = (select v from public.test_ctx where k = 'q1')),
  'superseded'::public.quote_status,
  'la version précédente devient superseded à l''envoi de la suivante'
);

-- 8 : la version 2 est bien envoyée
select is(
  (select status from public.quotes where id = (select v from public.test_ctx where k = 'q2')),
  'sent'::public.quote_status,
  'la version 2 est envoyée'
);

select public.test_logout();

-- 9 : un autre client ne peut pas accepter
select public.test_login('20000000-0000-4000-8000-000000000002'::uuid);
select throws_ok(
  $q$select public.accept_quote((select v from public.test_ctx where k='q2'))$q$,
  '42501', null,
  'un autre client ne peut pas accepter le devis'
);
select public.test_logout();

-- 10 : le client propriétaire accepte la version envoyée
select public.test_login('20000000-0000-4000-8000-000000000001'::uuid);
select is(
  (select status from public.accept_quote((select v from public.test_ctx where k = 'q2'))),
  'pending_confirmation'::public.shipment_status,
  'l''acceptation crée une mission en attente de confirmation'
);

insert into public.test_ctx
  select 's1', id from public.shipments
   where quote_id = (select v from public.test_ctx where k = 'q2');

-- 11 : le devis est accepté
select is(
  (select status from public.quotes where id = (select v from public.test_ctx where k = 'q2')),
  'accepted'::public.quote_status,
  'le devis accepté passe au statut accepted'
);

-- 12 : l'acceptation est attribuée au client
select is(
  (select accepted_by from public.quotes where id = (select v from public.test_ctx where k = 'q2')),
  '20000000-0000-4000-8000-000000000001'::uuid,
  'l''acceptation est rattachée au compte du client'
);

-- 13 : la demande passe à acceptée
select is(
  (select status from public.transport_requests
    where id = (select v from public.test_ctx where k = 'rq1')),
  'accepted'::public.request_status,
  'la demande passe au statut accepted'
);

-- 14 : aucune confirmation automatique de mission
select ok(
  (select confirmed_at is null from public.shipments
    where id = (select v from public.test_ctx where k = 's1')),
  'la mission n''est pas confirmée automatiquement'
);

-- 15 : impossible d'accepter deux fois
select throws_ok(
  $q$select public.accept_quote((select v from public.test_ctx where k='q2'))$q$,
  'P0001', null,
  'une seconde acceptation est refusée'
);

-- 16 : le client ne peut pas confirmer la mission
select throws_ok(
  $q$select public.confirm_shipment((select v from public.test_ctx where k='s1'))$q$,
  '42501', null,
  'un client ne peut pas confirmer une mission'
);

select public.test_logout();

-- ============================================================
-- Confirmation et clôture par l'équipe
-- ============================================================
select public.test_login('20000000-0000-4000-8000-000000000003'::uuid);

-- 17
select is(
  (select status from public.confirm_shipment((select v from public.test_ctx where k = 's1'))),
  'confirmed'::public.shipment_status,
  'un membre autorisé confirme la mission'
);

-- 18 : impossible de confirmer deux fois
select throws_ok(
  $q$select public.confirm_shipment((select v from public.test_ctx where k='s1'))$q$,
  'P0001', null,
  'la confirmation d''une mission déjà confirmée est refusée'
);

-- 19
select is(
  (select status from public.start_shipment((select v from public.test_ctx where k = 's1'))),
  'in_progress'::public.shipment_status,
  'la mission confirmée peut être démarrée'
);

-- 20
select is(
  (select status from public.complete_shipment((select v from public.test_ctx where k = 's1'))),
  'completed'::public.shipment_status,
  'la mission en cours peut être terminée'
);

-- 21 : la demande est clôturée avec la mission
select is(
  (select status from public.transport_requests
    where id = (select v from public.test_ctx where k = 'rq1')),
  'completed'::public.request_status,
  'la demande est clôturée à la fin de la mission'
);

-- 22 : pas de clôture deux fois
select throws_ok(
  $q$select public.complete_shipment((select v from public.test_ctx where k='s1'))$q$,
  'P0001', null,
  'la clôture d''une mission terminée est refusée'
);

-- 23 : tous les événements du dossier sont horodatés et présents
select ok(
  (select count(*) from public.shipment_events
     where transport_request_id = (select v from public.test_ctx where k = 'rq1')
        or shipment_id = (select v from public.test_ctx where k = 's1')) >= 8,
  'le journal contient au moins 8 événements horodatés pour le dossier'
);

-- 24 : aucun événement sans horodatage
select is(
  (select count(*) from public.shipment_events where created_at is null),
  0::bigint,
  'aucun événement du journal n''est sans horodatage'
);

select public.test_logout();

-- ============================================================
-- Refus d'une version envoyée (deuxième demande)
-- ============================================================
select public.test_login('20000000-0000-4000-8000-000000000003'::uuid);
select public.create_quote(
  (select v from public.test_ctx where k = 'rq2'), 89.00, null, 'Devis (test)');
insert into public.test_ctx
  select 'q3', id from public.quotes
   where transport_request_id = (select v from public.test_ctx where k = 'rq2')
     and version = 1;
select public.send_quote((select v from public.test_ctx where k = 'q3'));
select public.test_logout();

-- 25 : le client refuse la version envoyée
select public.test_login('20000000-0000-4000-8000-000000000001'::uuid);
select is(
  (select status from public.decline_quote((select v from public.test_ctx where k = 'q3'))),
  'declined'::public.quote_status,
  'le client peut refuser la version envoyée'
);

-- 26 : la demande repasse en instruction
select is(
  (select status from public.transport_requests
    where id = (select v from public.test_ctx where k = 'rq2')),
  'under_review'::public.request_status,
  'un refus renvoie la demande en instruction'
);

-- 27 : pas de double refus
select throws_ok(
  $q$select public.decline_quote((select v from public.test_ctx where k='q3'))$q$,
  'P0001', null,
  'un second refus est refusé'
);

select public.test_logout();
select finish();
rollback;
