-- ============================================================
-- France Santé Transport — Données de démonstration.
-- Appliqué automatiquement par `supabase db reset` / npm run db:reset.
-- Toutes les données sont fictives. Mot de passe commun : demo2026
-- ============================================================

set search_path = extensions, public;

-- ------------------------------------------------------------
-- Comptes de démonstration (identité)
-- ------------------------------------------------------------
do $$
declare
  v_hash text := extensions.crypt('demo2026', extensions.gen_salt('bf', 10));
  v_user record;
begin
  for v_user in
    select * from (values
      ('11111111-1111-4111-8111-111111111101', 'admin@fst.local',    'Camille Bernard',   '06 11 11 11 01'),
      ('11111111-1111-4111-8111-111111111102', 'dispatch@fst.local', 'Nadia Petit',      '06 11 11 11 02'),
      ('11111111-1111-4111-8111-111111111103', 'chauffeur1@fst.local','Karim Leroy',      '06 11 11 11 03'),
      ('11111111-1111-4111-8111-111111111104', 'chauffeur2@fst.local','Sophie Martin',    '06 11 11 11 04'),
      ('11111111-1111-4111-8111-111111111105', 'client@fst.local',   'Jeanne Moreau',    '06 11 11 11 05'),
      ('11111111-1111-4111-8111-111111111106', 'client2@fst.local',  'EHPAD Les Tilleuls','06 11 11 11 06')
    ) as t(uid, email, fullname, phone)
  loop
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, confirmation_sent_at,
      raw_app_meta_data, raw_user_meta_data,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) values (
      v_user.uid::uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      v_user.email, v_hash,
      now(), now(), now(), now(),
      '{"provider":"email","providers":["email"]}',
      json_build_object('full_name', v_user.fullname)::jsonb,
      '', '', '', '', '', v_user.phone, '', '', ''
    )
    on conflict (id) do nothing;

    insert into auth.identities (id, user_id, provider_id, identity_data, provider,
                                 last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_user.uid::uuid, v_user.uid::uuid,
            json_build_object('sub', v_user.uid, 'email', v_user.email,
                              'email_verified', true, 'phone_verified', false),
            'email', now(), now(), now())
    on conflict do nothing;
  end loop;
end $$;

-- Rôles applicatifs (les profils sont créés par le déclencheur handle_new_user)
update public.profiles set role = 'admin'      where email = 'admin@fst.local';
update public.profiles set role = 'dispatcher' where email = 'dispatch@fst.local';
update public.profiles set role = 'driver'     where email in ('chauffeur1@fst.local', 'chauffeur2@fst.local');
update public.profiles set full_name = 'EHPAD Les Tilleuls' where email = 'client2@fst.local';

-- ------------------------------------------------------------
-- Flotte (fictive)
-- ------------------------------------------------------------
insert into public.vehicles (registration_plate, vehicle_type, label, capacity, has_wheelchair_lift, active)
values
  ('FT-101-AB', 'van',          'Van médical 1',  4, true,  true),
  ('FT-202-CD', 'sedan',        'Berline 1',      3, false, true),
  ('FT-303-EF', 'minibus',      'Minibus PMR',    8, true,  true),
  ('FT-404-GH', 'stretcher_van','Ambulance 1',    2, false, false)
on conflict (registration_plate) do nothing;

-- ------------------------------------------------------------
-- Demandes de transport (client : Jeanne Moreau sauf mention)
-- D1 soumise · D2 en instruction · D3 devis envoyé · D4 devis accepté
-- D5 mission confirmée · D6 mission terminée · D7 annulée · D8 refusée
-- ------------------------------------------------------------
insert into public.transport_requests
  (id, client_id, service_type, pickup_address, dropoff_address, pickup_datetime,
   patient_name, mobility_notes, contact_phone, status, created_at)
values
  ('21111111-1111-4111-8111-111111111101',
   '11111111-1111-4111-8111-111111111105', 'medical_transport',
   '12 rue des Lilas, 75011 Paris', 'Hôpital Saint-Louis, 75010 Paris',
   now() + interval '4 days', 'Jeanne Moreau',
   'Patient marchant avec canne, accompagnant.', '06 11 11 11 05',
   'submitted', now() - interval '2 hours'),

  ('21111111-1111-4111-8111-111111111102',
   '11111111-1111-4111-8111-111111111105', 'appointment_transfer',
   '12 rue des Lilas, 75011 Paris', 'Cabinet radiologie, 20 avenue Parmentier, Paris',
   now() + interval '7 days', 'Jeanne Moreau', null, '06 11 11 11 05',
   'under_review', now() - interval '1 day'),

  ('21111111-1111-4111-8111-111111111103',
   '11111111-1111-4111-8111-111111111106', 'wheelchair_transport',
   'EHPAD Les Tilleuls, 8 rue des Écoles, 92100 Boulogne', 'Hôpital Ambroise Paré, 92100 Boulogne',
   now() + interval '3 days', 'M. Dubois',
   'Fauteuil roulant, accompagnant EHPAD.', '06 11 11 11 06',
   'quoted', now() - interval '2 days'),

  ('21111111-1111-4111-8111-111111111104',
   '11111111-1111-4111-8111-111111111105', 'medical_transport',
   '12 rue des Lilas, 75011 Paris', 'Clinique Hartmann, 92310 Neuilly',
   now() + interval '2 days', 'Jeanne Moreau', null, '06 11 11 11 05',
   'accepted', now() - interval '3 days'),

  ('21111111-1111-4111-8111-111111111105',
   '11111111-1111-4111-8111-111111111106', 'stretcher_transport',
   'EHPAD Les Tilleuls, 8 rue des Écoles, 92100 Boulogne', 'CHU Bicêtre, 94270 Le Kremlin-Bicêtre',
   now() + interval '1 day', 'Mme Leroux',
   'Brancard, oxygène à bord.', '06 11 11 11 06',
   'accepted', now() - interval '4 days'),

  ('21111111-1111-4111-8111-111111111106',
   '11111111-1111-4111-8111-111111111105', 'appointment_transfer',
   '12 rue des Lilas, 75011 Paris', 'CHU Mondor, 94000 Créteil',
   now() - interval '5 days', 'Jeanne Moreau', null, '06 11 11 11 05',
   'completed', now() - interval '12 days'),

  ('21111111-1111-4111-8111-111111111107',
   '11111111-1111-4111-8111-111111111105', 'medical_supply',
   'Entrepôt médical FST, 3 rue de la Santé, Paris', '12 rue des Lilas, 75011 Paris',
   now() - interval '2 days', null, 'Livraison de matériel.', '06 11 11 11 05',
   'cancelled', now() - interval '8 days'),

  ('21111111-1111-4111-8111-111111111108',
   '11111111-1111-4111-8111-111111111106', 'other',
   'EHPAD Les Tilleuls, 8 rue des Écoles, 92100 Boulogne', 'Maison de retraite Sainte-Anne, Versailles',
   now() - interval '10 days', null, null, '06 11 11 11 06',
   'rejected', now() - interval '15 days')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Devis (montants fictifs, saisis « par l'équipe »)
-- D3 : v1 envoyée puis remplacée par v2 (en attente de réponse)
-- D4 : devis accepté · D5 : devis accepté · D6 : devis accepté (dossier clos)
-- ------------------------------------------------------------
insert into public.quotes
  (id, transport_request_id, version, amount, currency, status,
   valid_until, notes, created_by, sent_at, accepted_at, accepted_by, created_at)
values
  -- D3 : deux versions, la v2 est la version en cours
  ('31111111-1111-4111-8111-111111111101', '21111111-1111-4111-8111-111111111103', 1,
   95.00, 'EUR', 'superseded', now() + interval '7 days',
   'Première estimation (test).',
   '11111111-1111-4111-8111-111111111102', now() - interval '1 day', null, null, now() - interval '1 day'),
  ('31111111-1111-4111-8111-111111111102', '21111111-1111-4111-8111-111111111103', 2,
   110.00, 'EUR', 'sent', now() + interval '7 days',
   'Révision : trajet aller-retour inclus (test).',
   '11111111-1111-4111-8111-111111111102', now() - interval '3 hours', null, null, now() - interval '3 hours'),
  -- D4 : accepté
  ('31111111-1111-4111-8111-111111111103', '21111111-1111-4111-8111-111111111104', 1,
   140.00, 'EUR', 'accepted', now() + interval '5 days',
   'Trajet Neuilly aller-retour (test).',
   '11111111-1111-4111-8111-111111111101', now() - interval '2 days', now() - interval '2 days',
   '11111111-1111-4111-8111-111111111105', now() - interval '2 days'),
  -- D5 : accepté
  ('31111111-1111-4111-8111-111111111104', '21111111-1111-4111-8111-111111111105', 1,
   210.00, 'EUR', 'accepted', now() + interval '4 days',
   'Brancard + oxygène (test).',
   '11111111-1111-4111-8111-111111111102', now() - interval '3 days', now() - interval '3 days',
   '11111111-1111-4111-8111-111111111106', now() - interval '3 days'),
  -- D6 : accepté, mission clôturée
  ('31111111-1111-4111-8111-111111111105', '21111111-1111-4111-8111-111111111106', 1,
   85.00, 'EUR', 'accepted', now() - interval '4 days',
   'Dossier clos (test).',
   '11111111-1111-4111-8111-111111111101', now() - interval '10 days', now() - interval '10 days',
   '11111111-1111-4111-8111-111111111105', now() - interval '10 days')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Missions : D4 en attente de confirmation · D5 confirmée avec
-- chauffeur affecté · D6 terminée
-- ------------------------------------------------------------
insert into public.shipments
  (id, transport_request_id, quote_id, status, scheduled_at,
   confirmed_at, confirmed_by, completed_at, notes, created_at)
values
  ('41111111-1111-4111-8111-111111111101', '21111111-1111-4111-8111-111111111104',
   '31111111-1111-4111-8111-111111111103', 'pending_confirmation', now() + interval '2 days',
   null, null, null, 'En attente de confirmation par l''équipe (test).', now() - interval '2 days'),
  ('41111111-1111-4111-8111-111111111102', '21111111-1111-4111-8111-111111111105',
   '31111111-1111-4111-8111-111111111104', 'confirmed', now() + interval '1 day',
   now() - interval '1 day', '11111111-1111-4111-8111-111111111102', null,
   'Confirmée, chauffeur affecté (test).', now() - interval '3 days'),
  ('41111111-1111-4111-8111-111111111103', '21111111-1111-4111-8111-111111111106',
   '31111111-1111-4111-8111-111111111105', 'completed', now() - interval '5 days',
   now() - interval '6 days', '11111111-1111-4111-8111-111111111101',
   now() - interval '5 days', 'Mission terminée (test).', now() - interval '10 days')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Affectations chauffeur
-- ------------------------------------------------------------
insert into public.driver_assignments
  (id, shipment_id, driver_id, vehicle_id, status, assigned_by,
   assigned_at, responded_at, created_at)
values
  ('51111111-1111-4111-8111-111111111101', '41111111-1111-4111-8111-111111111102',
   '11111111-1111-4111-8111-111111111103', (select id from public.vehicles where registration_plate = 'FT-101-AB'),
   'accepted', '11111111-1111-4111-8111-111111111102',
   now() - interval '1 day', now() - interval '1 day', now() - interval '1 day'),
  ('51111111-1111-4111-8111-111111111102', '41111111-1111-4111-8111-111111111103',
   '11111111-1111-4111-8111-111111111104', (select id from public.vehicles where registration_plate = 'FT-202-CD'),
   'completed', '11111111-1111-4111-8111-111111111101',
   now() - interval '6 days', now() - interval '6 days', now() - interval '6 days')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Journal d'événements (extraits du cycle de vie)
-- ------------------------------------------------------------
insert into public.shipment_events
  (transport_request_id, event_type, payload, created_by, created_at)
values
  ('21111111-1111-4111-8111-111111111103', 'request_submitted', '{}', null, now() - interval '2 days'),
  ('21111111-1111-4111-8111-111111111103', 'request_under_review', '{}',
   '11111111-1111-4111-8111-111111111102', now() - interval '1 day'),
  ('21111111-1111-4111-8111-111111111103', 'quote_sent', '{"version": 1}',
   '11111111-1111-4111-8111-111111111102', now() - interval '1 day'),
  ('21111111-1111-4111-8111-111111111103', 'quote_sent', '{"version": 2}',
   '11111111-1111-4111-8111-111111111102', now() - interval '3 hours'),
  ('21111111-1111-4111-8111-111111111104', 'quote_accepted', '{}',
   '11111111-1111-4111-8111-111111111105', now() - interval '2 days'),
  ('21111111-1111-4111-8111-111111111107', 'request_cancelled', '{"reason": "Plus besoin (test)"}',
   '11111111-1111-4111-8111-111111111105', now() - interval '2 days'),
  ('21111111-1111-4111-8111-111111111108', 'request_rejected', '{"reason": "Hors zone (test)"}',
   '11111111-1111-4111-8111-111111111102', now() - interval '14 days')
on conflict do nothing;

insert into public.shipment_events
  (shipment_id, event_type, payload, created_by, created_at)
values
  ('41111111-1111-4111-8111-111111111102', 'mission_created', '{}',
   '11111111-1111-4111-8111-111111111106', now() - interval '3 days'),
  ('41111111-1111-4111-8111-111111111102', 'mission_confirmed', '{}',
   '11111111-1111-4111-8111-111111111102', now() - interval '1 day'),
  ('41111111-1111-4111-8111-111111111102', 'driver_assigned',
   '{"driver_id": "11111111-1111-4111-8111-111111111103"}',
   '11111111-1111-4111-8111-111111111102', now() - interval '1 day'),
  ('41111111-1111-4111-8111-111111111102', 'driver_response', '{"accepted": true}',
   '11111111-1111-4111-8111-111111111103', now() - interval '1 day'),
  ('41111111-1111-4111-8111-111111111103', 'mission_completed', '{}',
   '11111111-1111-4111-8111-111111111104', now() - interval '5 days')
on conflict do nothing;

-- ------------------------------------------------------------
-- Messages de contact (démo)
-- ------------------------------------------------------------
insert into public.contact_messages (topic, full_name, email, phone, subject, message)
values
  ('contact', 'Marie Dupont', 'marie.dupont@example.fr', '06 22 22 22 22',
   'Demande d''information', 'Bonjour, proposez-vous des transports nuits ? Merci.'),
  ('referral', 'Dr. Bernard', 'dr.bernard@cabinet-example.fr', '06 33 33 33 33',
   'Apport d''affaires cabinet', 'Je souhaite vous adresser régulièrement mes patients (démo).')
on conflict do nothing;

-- ------------------------------------------------------------
-- Réglages de démo : slogan + CSS sur mesure d'exemple
-- ------------------------------------------------------------
update public.site_settings
   set slogan = 'Le transport qui fait avancer la santé',
       custom_css = e'/* Exemple de personnalisation (démo) */\n:root {\n  --demo-accent: #c8102e;\n}\n.font-display {\n  letter-spacing: 0.01em;\n}',
       updated_at = now()
 where id = 1;

-- ------------------------------------------------------------
-- Démo : lignes de devis (détail prestation) + position GPS
-- ------------------------------------------------------------
insert into public.quote_lines (quote_id, position, description, quantity, unit_price)
values
  -- Devis accepté D4 (total 140,00) : détail visible côté client
  ('31111111-1111-4111-8111-111111111103', 1, 'Transport aller-retour médicalisé (berline)', 1, 120.00),
  ('31111111-1111-4111-8111-111111111103', 2, 'Attente sur place (30 min)', 1, 20.00)
on conflict (quote_id, position) do nothing;

-- Brouillon éditable sur la demande D1 (démonstration de l'éditeur de lignes)
insert into public.quotes (id, transport_request_id, version, amount, currency, status,
                           valid_until, notes, created_by, created_at)
values ('31111111-1111-4111-8111-111111111106', '21111111-1111-4111-8111-111111111101', 1,
        135.00, 'EUR', 'draft', now() + interval '7 days',
        'Brouillon avec lignes détaillées (test).',
        '11111111-1111-4111-8111-111111111102', now() - interval '1 hour')
on conflict (id) do nothing;

insert into public.quote_lines (quote_id, position, description, quantity, unit_price)
values
  ('31111111-1111-4111-8111-111111111106', 1, 'Transport aller-retour médicalisé', 1, 110.00),
  ('31111111-1111-4111-8111-111111111106', 2, 'Attente sur place 30 min', 1, 25.00)
on conflict (quote_id, position) do nothing;

-- Position GPS partagée par le chauffeur 1 (Paris centre)
insert into public.driver_positions (driver_id, lat, lng, accuracy, shared)
values ('11111111-1111-4111-8111-111111111103', 48.8566, 2.3522, 15, true)
on conflict (driver_id) do nothing;
