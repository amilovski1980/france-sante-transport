-- ============================================================
-- France Santé Transport — Migration 10 : lignes de devis
-- Remplace le « montant global unique » par des lignes de
-- prestation détaillées (désignation, quantité, prix unitaire).
-- Le montant de quotes est recalculé automatiquement (somme des
-- lignes) tant que le devis est en brouillon.
-- ============================================================

create table public.quote_lines (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.quotes (id) on delete cascade,
  position    integer not null default 1 check (position >= 1),
  description text not null check (length(btrim(description)) between 1 and 500),
  quantity    numeric(10,2) not null default 1 check (quantity > 0 and quantity <= 10000),
  unit_price  numeric(10,2) not null check (unit_price >= 0 and unit_price <= 1000000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (quote_id, position)
);

create index quote_lines_quote_idx on public.quote_lines (quote_id, position);

comment on table public.quote_lines is
  'Lignes de prestation d''un devis. Modifiables uniquement en brouillon (RPC).';

create trigger quote_lines_updated_at
  before update on public.quote_lines
  for each row execute function moddatetime (updated_at);

-- ------------------------------------------------------------
-- Lecture : même périmètre que le devis parent
-- ------------------------------------------------------------
revoke all on table public.quote_lines from anon, authenticated, service_role;
grant select on table public.quote_lines to authenticated;

alter table public.quote_lines enable row level security;

drop policy if exists quote_lines_select on public.quote_lines;
create policy quote_lines_select
  on public.quote_lines for select to authenticated
  using (
    exists (
      select 1 from public.quotes q
       where q.id = quote_id
         and (public.is_staff() or public.owns_request(q.transport_request_id))
    )
  );

-- Écriture interdite en table : uniquement via les RPC ci-dessous.

-- ------------------------------------------------------------
-- Recalcul du montant du devis depuis ses lignes
-- ------------------------------------------------------------
create or replace function internal.recalc_quote_amount(p_quote_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sum numeric;
begin
  select coalesce(sum(quantity * unit_price), 0)
    into v_sum
    from public.quote_lines
   where quote_id = p_quote_id;

  -- Un devis sans lignes conserve son montant saisi manuellement.
  if v_sum > 0 then
    update public.quotes set amount = v_sum where id = p_quote_id;
  end if;
end;
$$;

revoke execute on function internal.recalc_quote_amount(uuid)
  from public, anon, authenticated, service_role;
grant execute on function internal.recalc_quote_amount(uuid) to postgres;

-- ------------------------------------------------------------
-- add_quote_line : ajoute une ligne à un devis en brouillon
-- ------------------------------------------------------------
create or replace function public.add_quote_line(
  p_quote_id uuid,
  p_description text,
  p_quantity numeric default 1,
  p_unit_price numeric default 0
)
returns public.quote_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote public.quotes%rowtype;
  v_line public.quote_lines%rowtype;
begin
  perform public.assert_staff();

  select * into v_quote from public.quotes where id = p_quote_id for update;
  if not found then
    raise exception 'Devis introuvable' using errcode = 'P0002';
  end if;
  if v_quote.status <> 'draft' then
    raise exception 'Seul un devis en brouillon peut être modifié'
      using errcode = 'P0001';
  end if;
  if p_description is null or length(btrim(p_description)) = 0 then
    raise exception 'La désignation de la ligne est requise' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 10000 then
    raise exception 'Quantité invalide' using errcode = '22023';
  end if;
  if p_unit_price is null or p_unit_price < 0 or p_unit_price > 1000000 then
    raise exception 'Prix unitaire invalide' using errcode = '22023';
  end if;

  insert into public.quote_lines (quote_id, position, description, quantity, unit_price)
  values (
    p_quote_id,
    coalesce((select max(position) from public.quote_lines where quote_id = p_quote_id), 0) + 1,
    btrim(p_description),
    p_quantity,
    p_unit_price
  )
  returning * into v_line;

  perform internal.recalc_quote_amount(p_quote_id);

  perform internal.log_event(
    p_type => 'note',
    p_transport_request_id => v_quote.transport_request_id,
    p_payload => jsonb_build_object(
      'quote_id', p_quote_id, 'action', 'quote_line_added', 'line_id', v_line.id
    ),
    p_created_by => auth.uid()
  );
  return v_line;
end;
$$;

-- ------------------------------------------------------------
-- update_quote_line : modifier quantité / prix / désignation
-- ------------------------------------------------------------
create or replace function public.update_quote_line(
  p_line_id uuid,
  p_description text,
  p_quantity numeric,
  p_unit_price numeric
)
returns public.quote_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line public.quote_lines%rowtype;
  v_quote public.quotes%rowtype;
begin
  perform public.assert_staff();

  select * into v_line from public.quote_lines where id = p_line_id for update;
  if not found then
    raise exception 'Ligne de devis introuvable' using errcode = 'P0002';
  end if;
  select * into v_quote from public.quotes where id = v_line.quote_id for update;
  if v_quote.status <> 'draft' then
    raise exception 'Seul un devis en brouillon peut être modifié'
      using errcode = 'P0001';
  end if;
  if p_description is null or length(btrim(p_description)) = 0 then
    raise exception 'La désignation de la ligne est requise' using errcode = '22023';
  end if;
  if p_quantity is null or p_quantity <= 0 or p_quantity > 10000 then
    raise exception 'Quantité invalide' using errcode = '22023';
  end if;
  if p_unit_price is null or p_unit_price < 0 or p_unit_price > 1000000 then
    raise exception 'Prix unitaire invalide' using errcode = '22023';
  end if;

  update public.quote_lines
     set description = btrim(p_description),
         quantity = p_quantity,
         unit_price = p_unit_price
   where id = p_line_id
  returning * into v_line;

  perform internal.recalc_quote_amount(v_line.quote_id);

  perform internal.log_event(
    p_type => 'note',
    p_transport_request_id => v_quote.transport_request_id,
    p_payload => jsonb_build_object(
      'quote_id', v_line.quote_id, 'action', 'quote_line_updated', 'line_id', v_line.id
    ),
    p_created_by => auth.uid()
  );
  return v_line;
end;
$$;

-- ------------------------------------------------------------
-- delete_quote_line : supprime une ligne et renumérote
-- ------------------------------------------------------------
create or replace function public.delete_quote_line(p_line_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line public.quote_lines%rowtype;
  v_quote public.quotes%rowtype;
begin
  perform public.assert_staff();

  select * into v_line from public.quote_lines where id = p_line_id for update;
  if not found then
    raise exception 'Ligne de devis introuvable' using errcode = 'P0002';
  end if;
  select * into v_quote from public.quotes where id = v_line.quote_id for update;
  if v_quote.status <> 'draft' then
    raise exception 'Seul un devis en brouillon peut être modifié'
      using errcode = 'P0001';
  end if;

  delete from public.quote_lines where id = p_line_id;

  -- Renumerotation pour garder des positions denses
  with ranked as (
    select id, row_number() over (order by position) as rn
      from public.quote_lines
     where quote_id = v_line.quote_id
  )
  update public.quote_lines l
     set position = r.rn
    from ranked r
   where l.id = r.id and l.position <> r.rn;

  perform internal.recalc_quote_amount(v_line.quote_id);

  perform internal.log_event(
    p_type => 'note',
    p_transport_request_id => v_quote.transport_request_id,
    p_payload => jsonb_build_object(
      'quote_id', v_line.quote_id, 'action', 'quote_line_deleted', 'line_id', p_line_id
    ),
    p_created_by => auth.uid()
  );
end;
$$;

-- ------------------------------------------------------------
-- Exécution : réservée aux mêmes destinaires que les RPC métier
-- ------------------------------------------------------------
do $$
declare
  fn text;
begin
  foreach fn in array array[
    'public.add_quote_line(uuid,text,numeric,numeric)',
    'public.update_quote_line(uuid,text,numeric,numeric)',
    'public.delete_quote_line(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated, service_role', fn);
    execute format('grant execute on function %s to authenticated, postgres, service_role', fn);
  end loop;
end;
$$;
