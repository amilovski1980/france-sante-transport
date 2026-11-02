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
      ('11111111-1111-4111-8111-111111111106', 'client2@fst.local',  'EHPAD Les Tilleuls','06 11 11 11 06'),
      ('11111111-1111-4111-8111-111111111107', 'fournisseur@fst.local','Lucas Fournier', '06 11 11 11 07')
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
update public.profiles set role = 'supplier'   where email = 'fournisseur@fst.local';
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

-- ============================================================
-- Phase 4/5 — Démo chaîne logistique (fournisseur, stock, livraisons)
-- ============================================================

-- Organisation + fiche fournisseur + rattachement du compte démo
insert into public.organizations (id, name, kind, siret, address, created_by)
values
  ('61111111-1111-4111-8111-111111111101', 'MediSupply France', 'supplier',
   '12345678901234', '45 avenue de la République, 75011 Paris',
   '11111111-1111-4111-8111-111111111101')
on conflict (id) do nothing;

insert into public.suppliers
  (id, organization_id, code, contact_email, contact_phone, active)
values
  ('62111111-1111-4111-8111-111111111101', '61111111-1111-4111-8111-111111111101',
   'MEDISUP', 'contact@medisupply.local', '01 44 55 66 77', true)
on conflict (id) do nothing;

insert into public.organization_members (organization_id, user_id, org_role)
values
  ('61111111-1111-4111-8111-111111111101', '11111111-1111-4111-8111-111111111107', 'owner')
on conflict (organization_id, user_id) do nothing;

-- Entrepôt
insert into public.warehouses (id, name, code, address, capacity_m3, active)
values
  ('63111111-1111-4111-8111-111111111101', 'Entrepôt médical FST', 'FST-PARIS',
   '3 rue de la Santé, 75014 Paris', 250.00, true)
on conflict (id) do nothing;

-- Catalogue produits / références / lots / stock
insert into public.products
  (id, supplier_id, name, description, category, unit, requires_cold_chain, temp_min, temp_max, active)
values
  ('64111111-1111-4111-8111-111111111101', '62111111-1111-4111-8111-111111111101',
   'Gants nitrile taille M', 'Gants d''examen non stériles', 'consommable', 'boîte', false, null, null, true),
  ('64111111-1111-4111-8111-111111111102', '62111111-1111-4111-8111-111111111101',
   'Sérum physiologique 500 ml', 'Solution saline stérile', 'consommable', 'flacon', false, null, null, true),
  ('64111111-1111-4111-8111-111111111103', '62111111-1111-4111-8111-111111111101',
   'Vaccin antigrippal', 'Vaccin saisonnier', 'médicament', 'dose', true, 2.00, 8.00, true)
on conflict (id) do nothing;

insert into public.product_references
  (id, product_id, reference_code, gtin, packaging, unit)
values
  ('65111111-1111-4111-8111-111111111101', '64111111-1111-4111-8111-111111111101',
   'GAN-M-100', '12345678901234', 'Boîte de 100 gants', 'boîte'),
  ('65111111-1111-4111-8111-111111111102', '64111111-1111-4111-8111-111111111102',
   'SER-500', '22345678901234', 'Flacon 500 ml', 'flacon'),
  ('65111111-1111-4111-8111-111111111103', '64111111-1111-4111-8111-111111111103',
   'VAC-GRIP-10', '32345678901234', 'Boîte de 10 doses', 'dose')
on conflict (id) do nothing;

insert into public.lots
  (id, product_reference_id, supplier_id, warehouse_id, lot_number, expiry_date, received_at)
values
  ('66111111-1111-4111-8111-111111111101', '65111111-1111-4111-8111-111111111101',
   '62111111-1111-4111-8111-111111111101', '63111111-1111-4111-8111-111111111101',
   'LOT-GAN-2601', current_date + interval '2 years', now() - interval '5 days'),
  ('66111111-1111-4111-8111-111111111102', '65111111-1111-4111-8111-111111111102',
   '62111111-1111-4111-8111-111111111101', '63111111-1111-4111-8111-111111111101',
   'LOT-SER-2602', current_date + interval '18 months', now() - interval '4 days'),
  ('66111111-1111-4111-8111-111111111103', '65111111-1111-4111-8111-111111111103',
   '62111111-1111-4111-8111-111111111101', '63111111-1111-4111-8111-111111111101',
   'LOT-VAC-2603', current_date + interval '10 months', now() - interval '3 days')
on conflict (id) do nothing;

insert into public.stock_levels
  (id, lot_id, warehouse_id, qty_on_hand, qty_reserved, qty_shipped)
values
  ('67111111-1111-4111-8111-111111111101', '66111111-1111-4111-8111-111111111101',
   '63111111-1111-4111-8111-111111111101', 120.000, 20.000, 0.000),
  ('67111111-1111-4111-8111-111111111102', '66111111-1111-4111-8111-111111111102',
   '63111111-1111-4111-8111-111111111101', 80.000, 10.000, 0.000),
  ('67111111-1111-4111-8111-111111111103', '66111111-1111-4111-8111-111111111103',
   '63111111-1111-4111-8111-111111111101', 40.000, 0.000, 0.000)
on conflict (id) do nothing;

insert into public.stock_movements
  (id, lot_id, warehouse_id, movement_type, quantity, reference_type, note, created_by, created_at)
values
  ('68111111-1111-4111-8111-111111111101', '66111111-1111-4111-8111-111111111101',
   '63111111-1111-4111-8111-111111111101', 'receipt', 120.000, 'demo', 'Réception initiale (démo)',
   '11111111-1111-4111-8111-111111111101', now() - interval '5 days'),
  ('68111111-1111-4111-8111-111111111102', '66111111-1111-4111-8111-111111111102',
   '63111111-1111-4111-8111-111111111101', 'receipt', 80.000, 'demo', 'Réception initiale (démo)',
   '11111111-1111-4111-8111-111111111101', now() - interval '4 days'),
  ('68111111-1111-4111-8111-111111111103', '66111111-1111-4111-8111-111111111103',
   '63111111-1111-4111-8111-111111111101', 'receipt', 40.000, 'demo', 'Réception initiale (démo)',
   '11111111-1111-4111-8111-111111111101', now() - interval '3 days')
on conflict (id) do nothing;

-- Destinataires : carnet global FST + carnet fournisseur
insert into public.recipients
  (id, supplier_id, name, type, contact_name, email, phone, address, city, postal_code, active, created_by)
values
  ('6a111111-1111-4111-8111-111111111101', null, 'Hôpital Saint-Louis', 'hospital',
   'Service logistique', 'logistique@hopital-saint-louis.local', '01 42 49 49 49',
   '1 avenue Claude Vellefaux', 'Paris', '75010', true, '11111111-1111-4111-8111-111111111101'),
  ('6a111111-1111-4111-8111-111111111102', null, 'Laboratoire Cerba', 'laboratory',
   'Réception', 'reception@cerba.local', '01 30 30 30 30',
   '6 rue de l''Égalité', 'Cergy', '95000', true, '11111111-1111-4111-8111-111111111101'),
  ('6a111111-1111-4111-8111-111111111103', '62111111-1111-4111-8111-111111111101',
   'Pharmacie du Centre', 'pharmacy', 'Dr. Lemaire', 'pharmacie.centre@example.local', '01 45 45 45 45',
   '18 rue du Faubourg Saint-Antoine', 'Paris', '75011', true, '11111111-1111-4111-8111-111111111107')
on conflict (id) do nothing;

-- Planning de livraison transmis + ordre de préparation en cours
insert into public.delivery_schedules
  (id, supplier_id, warehouse_id, label, requested_date, status, validated_at, validated_by,
   transmitted_at, notes, created_by)
values
  ('6b111111-1111-4111-8111-111111111101', '62111111-1111-4111-8111-111111111101',
   '63111111-1111-4111-8111-111111111101', 'Tournée Paris Centre', current_date + 2, 'transmitted',
   now() - interval '1 day', '11111111-1111-4111-8111-111111111101',
   now() - interval '1 day', 'Planning de démonstration (test).',
   '11111111-1111-4111-8111-111111111107')
on conflict (id) do nothing;

insert into public.delivery_schedule_lines
  (id, delivery_schedule_id, recipient_id, product_reference_id, lot_id, quantity, unit, notes)
values
  ('6c111111-1111-4111-8111-111111111101', '6b111111-1111-4111-8111-111111111101',
   '6a111111-1111-4111-8111-111111111101', '65111111-1111-4111-8111-111111111101',
   '66111111-1111-4111-8111-111111111101', 10.000, 'boîte', 'Livraison service logistique'),
  ('6c111111-1111-4111-8111-111111111102', '6b111111-1111-4111-8111-111111111101',
   '6a111111-1111-4111-8111-111111111103', '65111111-1111-4111-8111-111111111102',
   '66111111-1111-4111-8111-111111111102', 5.000, 'flacon', 'Réassort pharmacie'),
  ('6c111111-1111-4111-8111-111111111103', '6b111111-1111-4111-8111-111111111101',
   '6a111111-1111-4111-8111-111111111102', '65111111-1111-4111-8111-111111111103',
   '66111111-1111-4111-8111-111111111103', 4.000, 'dose', 'Chaîne du froid')
on conflict (id) do nothing;

insert into public.preparation_orders
  (id, delivery_schedule_id, warehouse_id, status, prepared_by, notes)
values
  ('6d111111-1111-4111-8111-111111111101', '6b111111-1111-4111-8111-111111111101',
   '63111111-1111-4111-8111-111111111101', 'preparing',
   '11111111-1111-4111-8111-111111111102', 'Préparation en cours (démo).')
on conflict (id) do nothing;

insert into public.preparation_order_lines
  (id, preparation_order_id, schedule_line_id, quantity_to_prepare, quantity_prepared, status)
values
  ('6e111111-1111-4111-8111-111111111101', '6d111111-1111-4111-8111-111111111101',
   '6c111111-1111-4111-8111-111111111101', 10.000, 4.000, 'partial'),
  ('6e111111-1111-4111-8111-111111111102', '6d111111-1111-4111-8111-111111111101',
   '6c111111-1111-4111-8111-111111111102', 5.000, 0.000, 'pending'),
  ('6e111111-1111-4111-8111-111111111103', '6d111111-1111-4111-8111-111111111101',
   '6c111111-1111-4111-8111-111111111103', 4.000, 0.000, 'pending')
on conflict (id) do nothing;

-- Mission de livraison de marchandises + livraisons + articles
insert into public.shipments
  (id, transport_request_id, quote_id, mission_kind, delivery_schedule_id, warehouse_id,
   supplier_id, status, scheduled_at, confirmed_at, confirmed_by, notes, created_at)
values
  ('41111111-1111-4111-8111-111111111104', null, null, 'goods_delivery',
   '6b111111-1111-4111-8111-111111111101', '63111111-1111-4111-8111-111111111101',
   '62111111-1111-4111-8111-111111111101', 'confirmed', now() + interval '2 days',
   now() - interval '1 day', '11111111-1111-4111-8111-111111111102',
   'Mission de livraison de marchandises (démo).', now() - interval '1 day')
on conflict (id) do nothing;

insert into public.deliveries
  (id, delivery_schedule_id, recipient_id, shipment_id, status, scheduled_at, delivered_at, notes)
values
  ('6f111111-1111-4111-8111-111111111101', '6b111111-1111-4111-8111-111111111101',
   '6a111111-1111-4111-8111-111111111101', '41111111-1111-4111-8111-111111111104',
   'scheduled', now() + interval '2 days', null, 'Livraison planifiée (démo).'),
  ('6f111111-1111-4111-8111-111111111102', '6b111111-1111-4111-8111-111111111101',
   '6a111111-1111-4111-8111-111111111103', null,
   'pending', now() + interval '2 days', null, 'En attente d''affectation (démo).'),
  ('6f111111-1111-4111-8111-111111111103', '6b111111-1111-4111-8111-111111111101',
   '6a111111-1111-4111-8111-111111111102', null,
   'pending', now() + interval '2 days', null, 'Chaîne du froid (démo).')
on conflict (id) do nothing;

insert into public.delivery_items
  (id, delivery_id, schedule_line_id, lot_id, quantity, unit)
values
  ('71111111-1111-4111-8111-111111111101', '6f111111-1111-4111-8111-111111111101',
   '6c111111-1111-4111-8111-111111111101', '66111111-1111-4111-8111-111111111101', 10.000, 'boîte'),
  ('71111111-1111-4111-8111-111111111102', '6f111111-1111-4111-8111-111111111102',
   '6c111111-1111-4111-8111-111111111102', '66111111-1111-4111-8111-111111111102', 5.000, 'flacon'),
  ('71111111-1111-4111-8111-111111111103', '6f111111-1111-4111-8111-111111111103',
   '6c111111-1111-4111-8111-111111111103', '66111111-1111-4111-8111-111111111103', 4.000, 'dose')
on conflict (id) do nothing;

insert into public.driver_assignments
  (id, shipment_id, driver_id, vehicle_id, status, assigned_by, assigned_at, responded_at, created_at)
values
  ('51111111-1111-4111-8111-111111111103', '41111111-1111-4111-8111-111111111104',
   '11111111-1111-4111-8111-111111111103',
   (select id from public.vehicles where registration_plate = 'FT-101-AB'),
   'accepted', '11111111-1111-4111-8111-111111111102',
   now() - interval '1 hour', now() - interval '1 hour', now() - interval '1 hour')
on conflict (id) do nothing;

insert into public.delivery_reminders
  (id, delivery_id, channel, target, scheduled_for, status, sent_at, payload)
values
  ('72111111-1111-4111-8111-111111111101', '6f111111-1111-4111-8111-111111111101',
   'email', 'recipient', now() + interval '1 day', 'pending', null, '{"demo": true}'::jsonb),
  ('72111111-1111-4111-8111-111111111102', '6f111111-1111-4111-8111-111111111101',
   'email', 'admin', now() + interval '1 day', 'pending', null, '{"demo": true}'::jsonb)
on conflict (id) do nothing;

-- Facture d'achat de démonstration + lignes saisies manuellement
insert into public.purchase_invoices
  (id, supplier_id, invoice_number, invoice_date, total_amount, currency, extraction_status,
   extracted_data, uploaded_by)
values
  ('73111111-1111-4111-8111-111111111101', '62111111-1111-4111-8111-111111111101',
   'FA-2026-001', current_date - 5, 450.00, 'EUR', 'manual', '{"demo": true}'::jsonb,
   '11111111-1111-4111-8111-111111111107')
on conflict (id) do nothing;

insert into public.purchase_invoice_lines
  (id, purchase_invoice_id, product_reference_id, description, quantity, unit_price, lot_number, expiry_date)
values
  ('74111111-1111-4111-8111-111111111101', '73111111-1111-4111-8111-111111111101',
   '65111111-1111-4111-8111-111111111101', 'Gants nitrile taille M (boîte de 100)',
   20.000, 12.5000, 'LOT-GAN-2601', current_date + interval '2 years'),
  ('74111111-1111-4111-8111-111111111102', '73111111-1111-4111-8111-111111111101',
   '65111111-1111-4111-8111-111111111102', 'Sérum physiologique 500 ml',
   20.000, 10.0000, 'LOT-SER-2602', current_date + interval '18 months')
on conflict (id) do nothing;

insert into public.shipment_events
  (shipment_id, event_type, payload, created_by, created_at)
values
  ('41111111-1111-4111-8111-111111111104', 'mission_created', '{"mission_kind": "goods_delivery"}',
   '11111111-1111-4111-8111-111111111102', now() - interval '1 day'),
  ('41111111-1111-4111-8111-111111111104', 'mission_confirmed', '{}',
   '11111111-1111-4111-8111-111111111102', now() - interval '1 day'),
  ('41111111-1111-4111-8111-111111111104', 'driver_assigned',
   '{"driver_id": "11111111-1111-4111-8111-111111111103"}',
   '11111111-1111-4111-8111-111111111102', now() - interval '1 hour')
on conflict do nothing;
