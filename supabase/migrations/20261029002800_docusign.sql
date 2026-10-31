-- ============================================================
-- France Santé Transport — Migration 28 : signature électronique
-- DocuSign : réglages + documents à signer (enveloppes) + bucket
-- pour les PDF signés.
-- ============================================================

alter table public.app_settings
  add column if not exists docusign_account_id text,
  add column if not exists docusign_integration_key text,
  add column if not exists docusign_user_id text,
  add column if not exists docusign_private_key text,
  add column if not exists docusign_environment text not null default 'demo'
    check (docusign_environment in ('demo', 'production'));

-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('esign', 'esign', false)
on conflict (id) do nothing;

drop policy if exists esign_storage_read on storage.objects;
create policy esign_storage_read
  on storage.objects for select to authenticated
  using (bucket_id = 'esign' and public.is_staff());

drop policy if exists esign_storage_write on storage.objects;
create policy esign_storage_write
  on storage.objects for insert to authenticated
  with check (bucket_id = 'esign' and public.is_staff());

create table if not exists public.esign_documents (
  id             uuid primary key default gen_random_uuid(),
  scope          text not null check (scope in ('quote', 'invoice', 'transport_order')),
  reference_id   uuid not null,
  envelope_id    text,
  status         text not null default 'created'
                 check (status in ('created', 'sent', 'completed', 'declined', 'voided')),
  signer_email   text not null check (signer_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  signer_name    text not null check (length(trim(signer_name)) between 2 and 200),
  signed_pdf_path text,
  signed_at      timestamptz,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);

create index if not exists esign_reference_idx
  on public.esign_documents (scope, reference_id, created_at desc);

revoke all on table public.esign_documents from anon, authenticated;
grant select, insert, update on table public.esign_documents to authenticated;

alter table public.esign_documents enable row level security;

-- Staff : tout. Client : les signatures de ses devis (lecture seule).
drop policy if exists esign_read on public.esign_documents;
create policy esign_read
  on public.esign_documents for select to authenticated
  using (
    public.is_staff()
    or (
      scope = 'quote'
      and exists (
        select 1
          from public.quotes q
          join public.transport_requests r on r.id = q.transport_request_id
         where q.id = reference_id
           and r.client_id = auth.uid()
      )
    )
  );

drop policy if exists esign_insert on public.esign_documents;
create policy esign_insert
  on public.esign_documents for insert to authenticated
  with check (public.is_staff() and created_by = auth.uid());

drop policy if exists esign_update on public.esign_documents;
create policy esign_update
  on public.esign_documents for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

comment on table public.esign_documents is
  'Enveloppes DocuSign : devis, factures ou ordres de transport à signer électroniquement.';
