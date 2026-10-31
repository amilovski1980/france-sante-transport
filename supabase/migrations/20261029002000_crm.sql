-- ============================================================
-- France Santé Transport — Migration 20 : CRM clients + e-mailing
-- Journal des envois e-mail (module Mailing) et notes CRM
-- rattachées aux clients (module CRM).
-- RLS : réservé au staff (admin + dispatcher).
-- ============================================================

create table if not exists public.crm_notes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.profiles (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  kind       text not null default 'note'
             check (kind in ('note', 'call', 'email')),
  body       text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists crm_notes_client_idx
  on public.crm_notes (client_id, created_at desc);

create table if not exists public.email_log (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  to_email     text not null,
  subject      text not null,
  body_preview text not null default '',
  status       text not null default 'queued'
               check (status in ('queued', 'sent', 'failed')),
  provider     text,
  error        text,
  sent_by      uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists email_log_recipient_idx
  on public.email_log (recipient_id, created_at desc);
create index if not exists email_log_status_idx
  on public.email_log (status, created_at desc);

revoke all on table public.crm_notes from anon, authenticated;
revoke all on table public.email_log from anon, authenticated;
grant select, insert, delete on table public.crm_notes to authenticated;
grant select, insert on table public.email_log to authenticated;

alter table public.crm_notes enable row level security;
alter table public.email_log enable row level security;

drop policy if exists crm_notes_staff_all on public.crm_notes;
create policy crm_notes_staff_all
  on public.crm_notes
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists email_log_staff_all on public.email_log;
create policy email_log_staff_all
  on public.email_log
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

comment on table public.crm_notes is
  'CRM : notes et historique de contact rattachés à un client.';
comment on table public.email_log is
  'CRM : journal des e-mails envoyés depuis le module mailing.';
