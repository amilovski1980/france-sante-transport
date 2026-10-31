-- ============================================================
-- France Santé Transport — Migration 27 : étiquettes & preuve
-- de livraison (POD — Proof of Delivery).
-- 1) Nouvel événement « delivery_proved »
-- 2) Table delivery_proofs : destinataire + signature + note + GPS
-- 3) RPC confirm_delivery : chauffeur affecté (accepté) ou staff
--    clôture la mission avec preuve de livraison.
-- ============================================================

alter type public.shipment_event_type add value if not exists 'delivery_proved' after 'note';

create table if not exists public.delivery_proofs (
  id             uuid primary key default gen_random_uuid(),
  shipment_id    uuid not null unique references public.shipments (id) on delete cascade,
  recipient_name text not null check (length(trim(recipient_name)) between 2 and 120),
  signature_data text not null,
  note           text check (note is null or length(note) <= 1000),
  latitude       numeric(9, 6),
  longitude      numeric(9, 6),
  recorded_by    uuid not null references public.profiles (id) on delete restrict,
  created_at     timestamptz not null default now()
);

drop trigger if exists delivery_proofs_updated_at on public.delivery_proofs;
create trigger delivery_proofs_updated_at
  before update on public.delivery_proofs
  for each row execute function moddatetime (updated_at);

revoke all on table public.delivery_proofs from anon, authenticated;
grant select, insert on table public.delivery_proofs to authenticated;

alter table public.delivery_proofs enable row level security;

drop policy if exists delivery_proofs_read on public.delivery_proofs;
create policy delivery_proofs_read
  on public.delivery_proofs for select to authenticated
  using (
    public.is_staff()
    or public.owns_shipment(shipment_id)
    or exists (
      select 1 from public.driver_assignments a
       where a.shipment_id = delivery_proofs.shipment_id
         and a.driver_id = auth.uid()
    )
  );

drop policy if exists delivery_proofs_insert on public.delivery_proofs;
create policy delivery_proofs_insert
  on public.delivery_proofs for insert to authenticated
  with check (
    recorded_by = auth.uid()
    and (
      public.is_staff()
      or exists (
        select 1 from public.driver_assignments a
         where a.shipment_id = delivery_proofs.shipment_id
           and a.driver_id = auth.uid()
           and a.status = 'accepted'
      )
    )
  );

comment on table public.delivery_proofs is
  'Preuve de livraison : destinataire, signature PNG (data URI), note et position.';

-- ------------------------------------------------------------
-- RPC : valider la livraison avec preuve
-- ------------------------------------------------------------
create or replace function public.confirm_delivery(
  p_shipment_id     uuid,
  p_recipient_name  text,
  p_signature_data  text,
  p_note            text     default null,
  p_latitude        numeric  default null,
  p_longitude       numeric  default null
)
returns public.shipments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.shipments%rowtype;
begin
  -- Chauffeur affecté (accepté) ou staff
  if not (
    public.is_staff()
    or exists (
      select 1 from public.driver_assignments a
       where a.shipment_id = p_shipment_id
         and a.driver_id = auth.uid()
         and a.status = 'accepted'
    )
  ) then
    raise exception 'Accès refusé';
  end if;

  if p_recipient_name is null or length(trim(p_recipient_name)) < 2 then
    raise exception 'Nom du destinataire requis' using errcode = '22023';
  end if;
  if p_signature_data is null
     or position('data:image/png;base64,' in p_signature_data) <> 1
     or length(p_signature_data) > 400000 then
    raise exception 'Signature manuscrite attendue (PNG)' using errcode = '22023';
  end if;

  select * into v_row from public.shipments where id = p_shipment_id for update;
  if not found then
    raise exception 'Mission introuvable' using errcode = 'P0002';
  end if;
  if v_row.status not in ('confirmed', 'in_progress') then
    raise exception 'Livraison impossible : mission au statut « % »', v_row.status using errcode = 'P0001';
  end if;
  if v_row.phase = 'delivered' then
    raise exception 'Livraison déjà validée' using errcode = 'P0001';
  end if;

  update public.shipments
     set phase        = 'delivered',
         picked_up_at = coalesce(picked_up_at, now()),
         delivered_at = now(),
         status       = 'completed',
         completed_at = now()
   where id = p_shipment_id
   returning * into v_row;

  insert into public.delivery_proofs
    (shipment_id, recipient_name, signature_data, note, latitude, longitude, recorded_by)
  values
    (p_shipment_id, trim(p_recipient_name), p_signature_data, nullif(trim(coalesce(p_note, '')), ''),
     p_latitude, p_longitude, auth.uid());

  update public.driver_assignments
     set status = 'completed'
   where shipment_id = p_shipment_id
     and status = 'accepted';

  perform internal.log_event(
    p_type => 'delivery_proved',
    p_shipment_id => p_shipment_id,
    p_payload => jsonb_build_object(
      'recipient_name', trim(p_recipient_name),
      'note', nullif(trim(coalesce(p_note, '')), '')
    )
  );

  return v_row;
end;
$$;

revoke execute on function public.confirm_delivery(uuid, text, text, text, numeric, numeric)
  from public, anon;
grant execute on function public.confirm_delivery(uuid, text, text, text, numeric, numeric)
  to authenticated;
