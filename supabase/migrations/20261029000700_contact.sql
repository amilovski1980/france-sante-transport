-- ============================================================
-- France Santé Transport — Migration 7 : messages de contact
-- et apport d'affaires (formulaires publics fonctionnels)
-- ============================================================

create type public.contact_topic as enum (
  'contact',
  'referral',
  'quote_request',
  'other'
);

create table public.contact_messages (
  id          uuid primary key default gen_random_uuid(),
  topic       public.contact_topic not null default 'contact',
  full_name   text not null check (length(trim(full_name)) between 2 and 200),
  email       text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone       text check (phone is null or length(phone) between 6 and 30),
  subject     text not null check (length(trim(subject)) between 2 and 300),
  message     text not null check (length(trim(message)) between 10 and 5000),
  handled     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index contact_messages_topic_idx on public.contact_messages (topic, created_at desc);
create index contact_messages_handled_idx on public.contact_messages (handled) where handled = false;

revoke all on table public.contact_messages from anon, authenticated;
grant insert (topic, full_name, email, phone, subject, message)
  on table public.contact_messages to anon, authenticated;
grant select, update on table public.contact_messages to authenticated;

alter table public.contact_messages enable row level security;

drop policy if exists contact_insert_public on public.contact_messages;
create policy contact_insert_public
  on public.contact_messages for insert to anon, authenticated
  with check (true);

drop policy if exists contact_select_staff on public.contact_messages;
create policy contact_select_staff
  on public.contact_messages for select to authenticated
  using (public.is_staff());

drop policy if exists contact_update_staff on public.contact_messages;
create policy contact_update_staff
  on public.contact_messages for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());
