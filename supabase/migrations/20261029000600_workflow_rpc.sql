-- ============================================================
-- France Santé Transport — Migration 6 : RPC du parcours
-- opérationnel. Chaque transition vérifie les autorisations de
-- l'appelant et l'état du dossier, puis horodate l'événement.
-- ============================================================

-- ------------------------------------------------------------
-- Garde-fous d'état
-- ------------------------------------------------------------
create or replace function public.assert_staff()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if not public.is_staff() then
    raise exception 'Accès réservé aux utilisateurs autorisés' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.assert_admin()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if not public.is_admin() then
    raise exception 'Accès réservé aux administrateurs' using errcode = '42501';
  end if;
end;
$$;

revoke execute on function public.assert_staff() from public, anon, authenticated, service_role;
revoke execute on function public.assert_admin() from public, anon, authenticated, service_role;
grant execute on function public.assert_staff() to postgres;
grant execute on function public.assert_admin() to postgres;

-- ------------------------------------------------------------
-- 1. create_quote : un utilisateur autorisé prépare un devis
--    versionné. Le montant est fourni par l'équipe (jamais
--    généré automatiquement).
-- ------------------------------------------------------------
create or replace function public.create_quote(
  p_transport_request_id uuid,
  p_amount numeric,
  p_valid_until timestamptz default null,
  p_notes text default null
)
returns public.quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.transport_requests%rowtype;
  v_next integer;
  v_quote public.quotes%rowtype;
begin
  perform public.assert_staff();
  if p_amount is null or p_amount < 0 then
    raise exception 'Un montant validé par l''équipe est requis' using errcode = '22023';
  end if;
  if p_valid_until is not null and p_valid_until <= now() then
    raise exception 'La date de validité du devis doit être future' using errcode = '22023';
  end if;

  select * into v_request
    from public.transport_requests
    where id = p_transport_request_id
    for update;
  if not found then
    raise exception 'Demande de transport introuvable' using errcode = 'P0002';
  end if;
  if v_request.status not in ('submitted', 'under_review', 'quoted') then
    raise exception 'Impossible de créer un devis pour une demande au statut « % »', v_request.status
      using errcode = 'P0001';
  end if;

  select coalesce(max(version), 0) + 1 into v_next
    from public.quotes
    where transport_request_id = p_transport_request_id;

  insert into public.quotes (transport_request_id, version, amount, valid_until, notes, created_by)
  values (p_transport_request_id, v_next, p_amount, p_valid_until, p_notes, auth.uid())
  returning * into v_quote;

  perform internal.log_event(
    p_type => 'quote_created',
    p_transport_request_id => p_transport_request_id,
    p_payload => jsonb_build_object('quote_id', v_quote.id, 'version', v_quote.version)
  );
  return v_quote;
end;
$$;

-- ------------------------------------------------------------
-- 2. send_quote : envoi de la version au client. La version
--    précédente devient « superseded ».
-- ------------------------------------------------------------
create or replace function public.send_quote(p_quote_id uuid)
returns public.quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_request public.transport_requests%rowtype;
begin
  perform public.assert_staff();

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Devis introuvable' using errcode = 'P0002';
  end if;
  if v_quote.status <> 'draft' then
    raise exception 'Seul un devis en brouillon peut être envoyé (statut actuel : %)', v_quote.status
      using errcode = 'P0001';
  end if;

  select * into v_request
    from public.transport_requests
    where id = v_quote.transport_request_id
    for update;
  if v_request.status not in ('submitted', 'under_review', 'quoted') then
    raise exception 'Impossible d''envoyer un devis pour une demande au statut « % »', v_request.status
      using errcode = 'P0001';
  end if;

  update public.quotes
     set status = 'superseded'
   where transport_request_id = v_quote.transport_request_id
     and status = 'sent'
     and id <> p_quote_id;

  update public.quotes
     set status = 'sent',
         sent_at = now()
   where id = p_quote_id
   returning * into v_quote;

  update public.transport_requests
     set status = 'quoted'
   where id = v_quote.transport_request_id;

  perform internal.log_event(
    p_type => 'quote_sent',
    p_transport_request_id => v_quote.transport_request_id,
    p_payload => jsonb_build_object('quote_id', v_quote.id, 'version', v_quote.version)
  );
  return v_quote;
end;
$$;

-- ------------------------------------------------------------
-- 3. accept_quote : le client accepte la version qui lui a été
--    envoyée. Le serveur vérifie l'appartenance et l'état du
--    dossier, crée la mission en attente de confirmation
--    (jamais confirmée automatiquement).
-- ------------------------------------------------------------
create or replace function public.accept_quote(p_quote_id uuid)
returns public.shipments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_request public.transport_requests%rowtype;
  v_shipment public.shipments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Devis introuvable' using errcode = 'P0002';
  end if;
  if v_quote.status <> 'sent' then
    raise exception 'Seule la version envoyée peut être acceptée (statut actuel : %)', v_quote.status
      using errcode = 'P0001';
  end if;

  select * into v_request
    from public.transport_requests
    where id = v_quote.transport_request_id
    for update;
  if not found then
    raise exception 'Demande de transport introuvable' using errcode = 'P0002';
  end if;
  if v_request.client_id <> auth.uid() then
    raise exception 'Accès refusé : ce devis n''appartient pas à votre compte' using errcode = '42501';
  end if;
  if v_request.status <> 'quoted' then
    raise exception 'Acceptation impossible : la demande est au statut « % »', v_request.status
      using errcode = 'P0001';
  end if;

  update public.quotes
     set status = 'accepted',
         accepted_at = now(),
         accepted_by = auth.uid()
   where id = p_quote_id
   returning * into v_quote;

  update public.transport_requests
     set status = 'accepted'
   where id = v_request.id;

  insert into public.shipments (transport_request_id, quote_id, organization_id, scheduled_at)
  values (v_request.id, v_quote.id, v_request.organization_id, v_request.pickup_datetime)
  returning * into v_shipment;

  perform internal.log_event(
    p_type => 'quote_accepted',
    p_transport_request_id => v_request.id,
    p_payload => jsonb_build_object('quote_id', v_quote.id, 'version', v_quote.version),
    p_created_by => auth.uid()
  );
  perform internal.log_event(
    p_type => 'mission_created',
    p_shipment_id => v_shipment.id,
    p_payload => jsonb_build_object('quote_id', v_quote.id, 'status', 'pending_confirmation')
  );
  return v_shipment;
end;
$$;

-- ------------------------------------------------------------
-- 4. decline_quote : le client refuse la version envoyée
-- ------------------------------------------------------------
create or replace function public.decline_quote(p_quote_id uuid)
returns public.quotes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_request public.transport_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Devis introuvable' using errcode = 'P0002';
  end if;
  if v_quote.status <> 'sent' then
    raise exception 'Seule la version envoyée peut être refusée (statut actuel : %)', v_quote.status
      using errcode = 'P0001';
  end if;

  select * into v_request
    from public.transport_requests
    where id = v_quote.transport_request_id
    for update;
  if v_request.client_id <> auth.uid() then
    raise exception 'Accès refusé : ce devis n''appartient pas à votre compte' using errcode = '42501';
  end if;
  if v_request.status <> 'quoted' then
    raise exception 'Refus impossible : la demande est au statut « % »', v_request.status
      using errcode = 'P0001';
  end if;

  update public.quotes
     set status = 'declined',
         declined_at = now()
   where id = p_quote_id
   returning * into v_quote;

  update public.transport_requests
     set status = 'under_review'
   where id = v_request.id;

  perform internal.log_event(
    p_type => 'quote_declined',
    p_transport_request_id => v_request.id,
    p_payload => jsonb_build_object('quote_id', v_quote.id, 'version', v_quote.version),
    p_created_by => auth.uid()
  );
  return v_quote;
end;
$$;

-- ------------------------------------------------------------
-- 5. mark_request_under_review : un utilisateur autorisé ouvre
--    la demande en cours d'instruction
-- ------------------------------------------------------------
create or replace function public.mark_request_under_review(p_request_id uuid)
returns public.transport_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.transport_requests%rowtype;
begin
  perform public.assert_staff();
  select * into v_request from public.transport_requests where id = p_request_id for update;
  if not found then
    raise exception 'Demande de transport introuvable' using errcode = 'P0002';
  end if;
  if v_request.status <> 'submitted' then
    raise exception 'Transition invalide : la demande doit être au statut « submitted » (actuel : %)',
      v_request.status using errcode = 'P0001';
  end if;
  update public.transport_requests set status = 'under_review' where id = p_request_id
    returning * into v_request;
  perform internal.log_event(
    p_type => 'request_under_review',
    p_transport_request_id => p_request_id
  );
  return v_request;
end;
$$;

-- ------------------------------------------------------------
-- 6. reject_request : refus explicite par un utilisateur autorisé
-- ------------------------------------------------------------
create or replace function public.reject_request(p_request_id uuid, p_reason text default null)
returns public.transport_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.transport_requests%rowtype;
begin
  perform public.assert_staff();
  select * into v_request from public.transport_requests where id = p_request_id for update;
  if not found then
    raise exception 'Demande de transport introuvable' using errcode = 'P0002';
  end if;
  if v_request.status not in ('submitted', 'under_review', 'quoted') then
    raise exception 'Refus impossible : la demande est au statut « % »', v_request.status
      using errcode = 'P0001';
  end if;
  update public.transport_requests set status = 'rejected' where id = p_request_id
    returning * into v_request;
  perform internal.log_event(
    p_type => 'request_rejected',
    p_transport_request_id => p_request_id,
    p_payload => case when p_reason is null then '{}'::jsonb else jsonb_build_object('reason', p_reason) end
  );
  return v_request;
end;
$$;

-- ------------------------------------------------------------
-- 7. cancel_transport_request : le client (ou le staff) annule
--    une demande non terminée ; une mission active est annulée
--    en cascade.
-- ------------------------------------------------------------
create or replace function public.cancel_transport_request(p_request_id uuid, p_reason text default null)
returns public.transport_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.transport_requests%rowtype;
  v_shipment public.shipments%rowtype;
  v_is_staff boolean := public.is_staff();
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  select * into v_request from public.transport_requests where id = p_request_id for update;
  if not found then
    raise exception 'Demande de transport introuvable' using errcode = 'P0002';
  end if;
  if not v_is_staff and v_request.client_id <> auth.uid() then
    raise exception 'Accès refusé : cette demande n''appartient pas à votre compte' using errcode = '42501';
  end if;
  if v_request.status in ('cancelled', 'completed') then
    raise exception 'Annulation impossible : la demande est au statut « % »', v_request.status
      using errcode = 'P0001';
  end if;

  select * into v_shipment from public.shipments
   where transport_request_id = p_request_id
     and status in ('pending_confirmation', 'confirmed', 'in_progress');
  if found then
    update public.shipments
       set status = 'cancelled',
           cancelled_at = now()
     where id = v_shipment.id;
    perform internal.log_event(
      p_type => 'mission_cancelled',
      p_shipment_id => v_shipment.id,
      p_payload => case when p_reason is null then '{}'::jsonb else jsonb_build_object('reason', p_reason) end
    );
  end if;

  update public.transport_requests set status = 'cancelled' where id = p_request_id
    returning * into v_request;
  perform internal.log_event(
    p_type => 'request_cancelled',
    p_transport_request_id => p_request_id,
    p_payload => case when p_reason is null then '{}'::jsonb else jsonb_build_object('reason', p_reason) end
  );
  return v_request;
end;
$$;

-- ------------------------------------------------------------
-- 8. confirm_shipment : confirmation manuelle d'une mission.
--    Aucune mission n'est confirmée automatiquement.
-- ------------------------------------------------------------
create or replace function public.confirm_shipment(p_shipment_id uuid)
returns public.shipments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shipment public.shipments%rowtype;
begin
  perform public.assert_staff();
  select * into v_shipment from public.shipments where id = p_shipment_id for update;
  if not found then
    raise exception 'Mission introuvable' using errcode = 'P0002';
  end if;
  if v_shipment.status <> 'pending_confirmation' then
    raise exception 'Confirmation impossible : la mission est au statut « % »', v_shipment.status
      using errcode = 'P0001';
  end if;
  update public.shipments
     set status = 'confirmed',
         confirmed_at = now(),
         confirmed_by = auth.uid()
   where id = p_shipment_id
   returning * into v_shipment;
  perform internal.log_event(
    p_type => 'mission_confirmed',
    p_shipment_id => p_shipment_id
  );
  return v_shipment;
end;
$$;

-- ------------------------------------------------------------
-- 9. start_shipment / complete_shipment
-- ------------------------------------------------------------
create or replace function public.start_shipment(p_shipment_id uuid)
returns public.shipments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shipment public.shipments%rowtype;
begin
  perform public.assert_staff();
  select * into v_shipment from public.shipments where id = p_shipment_id for update;
  if not found then
    raise exception 'Mission introuvable' using errcode = 'P0002';
  end if;
  if v_shipment.status <> 'confirmed' then
    raise exception 'Démarrage impossible : la mission est au statut « % »', v_shipment.status
      using errcode = 'P0001';
  end if;
  update public.shipments set status = 'in_progress' where id = p_shipment_id
    returning * into v_shipment;
  perform internal.log_event(p_type => 'mission_in_progress', p_shipment_id => p_shipment_id);
  return v_shipment;
end;
$$;

create or replace function public.complete_shipment(p_shipment_id uuid)
returns public.shipments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shipment public.shipments%rowtype;
begin
  perform public.assert_staff();
  select * into v_shipment from public.shipments where id = p_shipment_id for update;
  if not found then
    raise exception 'Mission introuvable' using errcode = 'P0002';
  end if;
  if v_shipment.status not in ('confirmed', 'in_progress') then
    raise exception 'Clôture impossible : la mission est au statut « % »', v_shipment.status
      using errcode = 'P0001';
  end if;
  update public.shipments
     set status = 'completed',
         completed_at = now()
   where id = p_shipment_id
   returning * into v_shipment;
  update public.transport_requests
     set status = 'completed'
   where id = v_shipment.transport_request_id;
  perform internal.log_event(p_type => 'mission_completed', p_shipment_id => p_shipment_id);
  return v_shipment;
end;
$$;

-- ------------------------------------------------------------
-- 10. cancel_shipment : annulation manuelle d'une mission
-- ------------------------------------------------------------
create or replace function public.cancel_shipment(p_shipment_id uuid, p_reason text default null)
returns public.shipments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shipment public.shipments%rowtype;
begin
  perform public.assert_staff();
  select * into v_shipment from public.shipments where id = p_shipment_id for update;
  if not found then
    raise exception 'Mission introuvable' using errcode = 'P0002';
  end if;
  if v_shipment.status in ('completed', 'cancelled') then
    raise exception 'Annulation impossible : la mission est au statut « % »', v_shipment.status
      using errcode = 'P0001';
  end if;
  update public.shipments
     set status = 'cancelled',
         cancelled_at = now()
   where id = p_shipment_id
   returning * into v_shipment;
  update public.transport_requests
     set status = 'under_review'
   where id = v_shipment.transport_request_id
     and status = 'accepted';
  perform internal.log_event(
    p_type => 'mission_cancelled',
    p_shipment_id => p_shipment_id,
    p_payload => case when p_reason is null then '{}'::jsonb else jsonb_build_object('reason', p_reason) end
  );
  return v_shipment;
end;
$$;

-- ------------------------------------------------------------
-- 11. assign_driver / respond_driver_assignment
-- ------------------------------------------------------------
create or replace function public.assign_driver(
  p_shipment_id uuid,
  p_driver_id uuid,
  p_vehicle_id uuid
)
returns public.driver_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shipment public.shipments%rowtype;
  v_driver public.profiles%rowtype;
  v_vehicle public.vehicles%rowtype;
  v_assignment public.driver_assignments%rowtype;
begin
  perform public.assert_staff();
  select * into v_shipment from public.shipments where id = p_shipment_id for update;
  if not found then
    raise exception 'Mission introuvable' using errcode = 'P0002';
  end if;
  if v_shipment.status not in ('pending_confirmation', 'confirmed') then
    raise exception 'Affectation impossible : la mission est au statut « % »', v_shipment.status
      using errcode = 'P0001';
  end if;
  select * into v_driver from public.profiles where id = p_driver_id;
  if not found then
    raise exception 'Chauffeur introuvable' using errcode = 'P0002';
  end if;
  if v_driver.role <> 'driver' then
    raise exception 'Le profil sélectionné n''est pas un chauffeur' using errcode = '22023';
  end if;
  select * into v_vehicle from public.vehicles where id = p_vehicle_id for update;
  if not found then
    raise exception 'Véhicule introuvable' using errcode = 'P0002';
  end if;
  if not v_vehicle.active then
    raise exception 'Ce véhicule n''est pas disponible' using errcode = '22023';
  end if;

  begin
    insert into public.driver_assignments (shipment_id, driver_id, vehicle_id, assigned_by)
    values (p_shipment_id, p_driver_id, p_vehicle_id, auth.uid())
    returning * into v_assignment;
  exception when unique_violation then
    raise exception 'Une affectation active existe déjà pour cette mission' using errcode = '23505';
  end;

  perform internal.log_event(
    p_type => 'driver_assigned',
    p_shipment_id => p_shipment_id,
    p_payload => jsonb_build_object('driver_id', p_driver_id, 'vehicle_id', p_vehicle_id)
  );
  return v_assignment;
end;
$$;

create or replace function public.respond_driver_assignment(p_assignment_id uuid, p_accept boolean)
returns public.driver_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment public.driver_assignments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '42501';
  end if;
  if p_accept is null then
    raise exception 'Réponse attendue' using errcode = '22023';
  end if;
  select * into v_assignment from public.driver_assignments where id = p_assignment_id for update;
  if not found then
    raise exception 'Affectation introuvable' using errcode = 'P0002';
  end if;
  if v_assignment.driver_id <> auth.uid() then
    raise exception 'Accès refusé : cette affectation ne vous est pas destinée' using errcode = '42501';
  end if;
  if v_assignment.status <> 'proposed' then
    raise exception 'Réponse impossible : l''affectation est au statut « % »', v_assignment.status
      using errcode = 'P0001';
  end if;

  update public.driver_assignments
     set status = case when p_accept then 'accepted'::public.assignment_status
                       else 'declined'::public.assignment_status end,
         responded_at = now()
   where id = p_assignment_id
   returning * into v_assignment;

  perform internal.log_event(
    p_type => 'driver_response',
    p_shipment_id => v_assignment.shipment_id,
    p_payload => jsonb_build_object('accepted', p_accept)
  );
  return v_assignment;
end;
$$;

-- ------------------------------------------------------------
-- 12. set_user_role : réservé aux administrateurs
-- ------------------------------------------------------------
create or replace function public.set_user_role(p_user_id uuid, p_role public.app_role)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  perform public.assert_admin();
  if p_user_id is null or p_role is null then
    raise exception 'Paramètres manquants' using errcode = '22023';
  end if;
  update public.profiles set role = p_role where id = p_user_id
    returning * into v_profile;
  if not found then
    raise exception 'Profil introuvable' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

-- ------------------------------------------------------------
-- 13. bootstrap_first_admin : permet de promouvoir le tout
--    premier administrateur uniquement tant qu'il n'en existe
--    aucun (installation / environnement de test).
-- ------------------------------------------------------------
create or replace function public.bootstrap_first_admin(p_email text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_profile public.profiles%rowtype;
begin
  select count(*) into v_count from public.profiles where role = 'admin';
  if v_count > 0 then
    raise exception 'Un administrateur existe déjà : utilisez set_user_role' using errcode = '42501';
  end if;
  select * into v_profile from public.profiles where lower(email) = lower(p_email);
  if not found then
    raise exception 'Aucun compte avec cet e-mail' using errcode = 'P0002';
  end if;
  update public.profiles set role = 'admin' where id = v_profile.id
    returning * into v_profile;
  return v_profile;
end;
$$;

-- ------------------------------------------------------------
-- Exécution : réservée à authenticated (les politiques RLS
-- vérifient ensuite les rôles pour chaque action)
-- ------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.create_quote(uuid,numeric,timestamptz,text)',
    'public.send_quote(uuid)',
    'public.accept_quote(uuid)',
    'public.decline_quote(uuid)',
    'public.mark_request_under_review(uuid)',
    'public.reject_request(uuid,text)',
    'public.cancel_transport_request(uuid,text)',
    'public.confirm_shipment(uuid)',
    'public.start_shipment(uuid)',
    'public.complete_shipment(uuid)',
    'public.cancel_shipment(uuid,text)',
    'public.assign_driver(uuid,uuid,uuid)',
    'public.respond_driver_assignment(uuid,boolean)',
    'public.set_user_role(uuid,public.app_role)',
    'public.bootstrap_first_admin(text)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated, service_role', fn);
    execute format('grant execute on function %s to authenticated, postgres, service_role', fn);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Événement « demande soumise » horodaté à la création
-- ------------------------------------------------------------
create or replace function public.on_request_submitted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform internal.log_event(
    p_type => 'request_submitted',
    p_transport_request_id => new.id
  );
  return new;
end;
$$;

drop trigger if exists transport_requests_submitted_event on public.transport_requests;
create trigger transport_requests_submitted_event
  after insert on public.transport_requests
  for each row execute function public.on_request_submitted();
