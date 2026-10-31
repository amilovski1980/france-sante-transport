-- ============================================================
-- France Santé Transport — Migration 24 : modules manquants
-- 1) Pièces jointes des demandes (bucket + table + RLS)
-- 2) Relances de factures : last_reminder_at
-- 3) TVA paramétrable : app_settings.vat_rate + RPC mise à jour
-- ============================================================

-- ------------------------------------------------------------
-- 1) Pièces jointes
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

drop policy if exists attachments_read on storage.objects;
create policy attachments_read
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments');

drop policy if exists attachments_write on storage.objects;
create policy attachments_write
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');

drop policy if exists attachments_remove on storage.objects;
create policy attachments_remove
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments');

create table if not exists public.request_attachments (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null references public.transport_requests (id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  mime_type    text not null default 'application/octet-stream',
  size_bytes   bigint,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now()
);

create index request_attachments_request_idx
  on public.request_attachments (request_id, created_at desc);

revoke all on table public.request_attachments from anon, authenticated;
grant select, insert, delete on table public.request_attachments to authenticated;

alter table public.request_attachments enable row level security;

drop policy if exists request_attachments_read on public.request_attachments;
create policy request_attachments_read
  on public.request_attachments for select to authenticated
  using (
    public.is_staff()
    or public.owns_request(request_id)
    or public.assigned_driver_on_request(request_id)
  );

drop policy if exists request_attachments_insert on public.request_attachments;
create policy request_attachments_insert
  on public.request_attachments for insert to authenticated
  with check (
    (public.is_staff() or public.owns_request(request_id))
    and uploaded_by = auth.uid()
  );

drop policy if exists request_attachments_delete on public.request_attachments;
create policy request_attachments_delete
  on public.request_attachments for delete to authenticated
  using (public.is_staff() or uploaded_by = auth.uid());

comment on table public.request_attachments is
  'Documents attachés à une demande (numérisés, justificatifs). Fichiers dans le bucket privé « attachments ».';

-- ------------------------------------------------------------
-- 2) Relances de factures
-- ------------------------------------------------------------
alter table public.invoices
  add column if not exists last_reminder_at timestamptz;

-- ------------------------------------------------------------
-- 3) TVA paramétrable depuis Services & API
-- ------------------------------------------------------------
alter table public.app_settings
  add column if not exists vat_rate numeric(4, 2) not null default 0;

create or replace function public.create_invoice_from_quote(p_quote_id uuid)
returns public.invoices
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote record;
  v_client uuid;
  v_amount numeric;
  v_year text := to_char(current_date, 'YYYY');
  v_next int;
  v_number text;
  v_vat numeric(4, 2);
  v_invoice public.invoices;
begin
  if not public.is_staff() then
    raise exception 'Accès réservé au staff';
  end if;

  select q.*, r.client_id as req_client_id
    into v_quote
    from public.quotes q
    join public.transport_requests r on r.id = q.transport_request_id
   where q.id = p_quote_id;
  if not found then
    raise exception 'Devis introuvable';
  end if;
  if v_quote.status <> 'accepted' then
    raise exception 'Seul un devis accepté peut être facturé';
  end if;

  -- Déjà facturé ?
  select * into v_invoice from public.invoices where quote_id = p_quote_id;
  if found then
    return v_invoice;  -- idempotent : renvoie la facture existante
  end if;

  v_client := v_quote.req_client_id;

  v_amount := coalesce(
    (select sum(l.quantity * l.unit_price) from public.quote_lines l where l.quote_id = p_quote_id),
    v_quote.amount
  );

  -- Taux de TVA configuré (Services & API), sinon 0
  v_vat := coalesce((select s.vat_rate from public.app_settings s where s.id = 1), 0);

  v_next := 1 + coalesce((
    select max(substring(i.invoice_number from '[0-9]+$')::int)
      from public.invoices i
     where i.invoice_number like 'FST-' || v_year || '-%'
  ), 0);
  v_number := 'FST-' || v_year || '-' || lpad(v_next::text, 4, '0');

  insert into public.invoices (quote_id, invoice_number, client_id, amount, currency,
                               vat_rate, status, issued_at, due_at)
  values (p_quote_id, v_number, v_client, v_amount, v_quote.currency,
          v_vat, 'issued', current_date, current_date + interval '30 days')
  returning * into v_invoice;

  return v_invoice;
end;
$$;
