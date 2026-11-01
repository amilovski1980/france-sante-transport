-- ============================================================
-- France Santé Transport — Migration 32 : notifications par
-- utilisateur (style Deliveroo : chaque acteur reçoit SA
-- notification à chaque étape du dossier).
-- ============================================================

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  url        text,
  tag        text,
  data       jsonb not null default '{}'::jsonb,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

-- Un même événement (tag unique) ne crée qu'une notification par utilisateur.
create unique index if not exists notifications_user_tag_uidx
  on public.notifications (user_id, tag)
  where tag is not null;

revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select to authenticated
  using (user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Les insertions sont faites côté serveur avec la clé service_role
-- (route /api/notify) : aucune policy d'insertion n'est nécessaire.

do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

comment on table public.notifications is
  'Notifications personnelles (in-app + push) : une ligne par destinataire et par événement.';
