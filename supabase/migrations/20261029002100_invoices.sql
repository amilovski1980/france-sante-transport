-- ============================================================
-- France Santé Transport — Migration 21 : facturation
-- Une facture est émise depuis un devis accepté (une seule fois)
-- avec numérotation séquentielle annuelle (FST-2026-0001).
-- Statuts : issued → sent → paid (ou cancelled).
-- ============================================================

create table public.invoices (
  id             uuid primary key default gen_random_uuid(),
  quote_id       uuid not null unique references public.quotes (id) on delete cascade,
  invoice_number text unique,
  client_id      uuid not null references public.profiles (id) on delete cascade,
  amount         numeric(10, 2) not null check (amount >= 0 and amount <= 1000000),
  currency       text not null default 'EUR' check (currency in ('EUR')),
  vat_rate       numeric(4, 2) not null default 0 check (vat_rate >= 0 and vat_rate <= 30),
  status         text not null default 'issued'
                 check (status in ('issued', 'sent', 'paid', 'cancelled')),
  issued_at      date not null default current_date,
  due_at         date,
  paid_at        timestamptz,
  notes          text,
  created_at     timestamptz not null default now()
);

create index invoices_client_idx on public.invoices (client_id, created_at desc);
create index invoices_status_idx on public.invoices (status, created_at desc);

revoke all on table public.invoices from anon, authenticated;
grant select, insert, update on table public.invoices to authenticated;

alter table public.invoices enable row level security;

drop policy if exists invoices_select_visible on public.invoices;
create policy invoices_select_visible
  on public.invoices for select to authenticated
  using (public.is_staff() or client_id = auth.uid());

drop policy if exists invoices_staff_write on public.invoices;
create policy invoices_staff_write
  on public.invoices for insert to authenticated
  with check (public.is_staff());

drop policy if exists invoices_staff_update on public.invoices;
create policy invoices_staff_update
  on public.invoices for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ------------------------------------------------------------
-- RPC : émettre la facture d'un devis accepté
-- ------------------------------------------------------------
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

  v_next := 1 + coalesce((
    select max(substring(i.invoice_number from '[0-9]+$')::int)
      from public.invoices i
     where i.invoice_number like 'FST-' || v_year || '-%'
  ), 0);
  v_number := 'FST-' || v_year || '-' || lpad(v_next::text, 4, '0');

  insert into public.invoices (quote_id, invoice_number, client_id, amount, currency,
                               vat_rate, status, issued_at, due_at)
  values (p_quote_id, v_number, v_client, v_amount, v_quote.currency,
          0, 'issued', current_date, current_date + interval '30 days')
  returning * into v_invoice;

  return v_invoice;
end;
$$;

revoke all on function public.create_invoice_from_quote(uuid) from anon;
grant execute on function public.create_invoice_from_quote(uuid) to authenticated;

-- Realtime : suivi des statuts de facture dans l'espace client.
do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'invoices'
  ) then
    alter publication supabase_realtime add table public.invoices;
  end if;
end $$;
