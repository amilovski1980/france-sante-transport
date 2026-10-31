-- ============================================================
-- France Santé Transport — Migration 19 : messagerie interne
-- Échange direct entre chauffeurs, dispatchers et admins.
-- RLS : chaque utilisateur ne voit que ses propres fils ;
-- les admins accèdent à l'ensemble (supervision).
-- L'expéditeur écrit ; le destinataire marque seulement « lu ».
-- ============================================================

create table if not exists public.internal_messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references public.profiles (id) on delete cascade,
  recipient_id  uuid not null references public.profiles (id) on delete cascade,
  body          text not null check (length(trim(body)) between 1 and 2000),
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists internal_messages_pair_idx
  on public.internal_messages (least(sender_id, recipient_id), greatest(sender_id, recipient_id), created_at);
create index if not exists internal_messages_recipient_unread_idx
  on public.internal_messages (recipient_id, created_at desc) where read_at is null;
create index if not exists internal_messages_sender_idx
  on public.internal_messages (sender_id, created_at desc);

revoke all on table public.internal_messages from anon, authenticated;
grant select, insert, update on table public.internal_messages to authenticated;

alter table public.internal_messages enable row level security;

drop policy if exists internal_messages_select_participant on public.internal_messages;
create policy internal_messages_select_participant
  on public.internal_messages for select to authenticated
  using (
    sender_id = auth.uid()
    or recipient_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists internal_messages_insert_sender on public.internal_messages;
create policy internal_messages_insert_sender
  on public.internal_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and recipient_id <> sender_id
    and exists (
      select 1 from public.profiles r
      where r.id = recipient_id
        and r.role in ('admin', 'dispatcher', 'driver')
    )
  );

drop policy if exists internal_messages_update_recipient on public.internal_messages;
create policy internal_messages_update_recipient
  on public.internal_messages for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

comment on table public.internal_messages is
  'Messagerie interne : fils directs chauffeur ↔ dispatcher ↔ admin.';

-- Realtime : la messagerie s'actualise à l'arrivée de nouveaux messages.
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'internal_messages'
  ) then
    alter publication supabase_realtime add table public.internal_messages;
  end if;
end $$;
