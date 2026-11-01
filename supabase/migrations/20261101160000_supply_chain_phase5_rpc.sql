-- ============================================================
-- France Santé Transport — Phase 5 : RPC complémentaires
--   * onboarding fournisseur (organisation + fournisseur + membre) ;
--   * suivi des ordres de préparation.
-- Migration strictement additive.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Onboarding fournisseur (admin)
-- ------------------------------------------------------------
create or replace function public.admin_create_supplier(
  p_organization_name text,
  p_code text,
  p_contact_email text default null,
  p_contact_phone text default null,
  p_siret text default null,
  p_address text default null
)
returns public.suppliers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
  v_supplier public.suppliers%rowtype;
begin
  perform public.assert_admin();

  if p_organization_name is null or length(trim(p_organization_name)) < 2 then
    raise exception 'Nom d''organisation invalide' using errcode = '22023';
  end if;
  if p_code is null or length(trim(p_code)) < 2 then
    raise exception 'Code fournisseur invalide' using errcode = '22023';
  end if;

  insert into public.organizations (name, kind, siret, address, created_by)
  values (
    trim(p_organization_name),
    'supplier',
    nullif(trim(coalesce(p_siret, '')), ''),
    nullif(trim(coalesce(p_address, '')), ''),
    auth.uid()
  )
  returning * into v_org;

  insert into public.suppliers (organization_id, code, contact_email, contact_phone)
  values (
    v_org.id,
    upper(trim(p_code)),
    nullif(trim(coalesce(p_contact_email, '')), ''),
    nullif(trim(coalesce(p_contact_phone, '')), '')
  )
  returning * into v_supplier;

  return v_supplier;
end;
$$;

create or replace function public.admin_attach_supplier_member(
  p_supplier_id uuid,
  p_user_id uuid,
  p_org_role public.org_role default 'member'
)
returns public.organization_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_member public.organization_members%rowtype;
begin
  perform public.assert_admin();

  select organization_id
    into v_organization_id
    from public.suppliers
   where id = p_supplier_id;

  if v_organization_id is null then
    raise exception 'Fournisseur introuvable' using errcode = 'P0002';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Profil introuvable' using errcode = 'P0002';
  end if;

  insert into public.organization_members (organization_id, user_id, org_role)
  values (v_organization_id, p_user_id, p_org_role)
  on conflict (organization_id, user_id)
  do update set org_role = excluded.org_role
  returning * into v_member;

  return v_member;
end;
$$;

-- ------------------------------------------------------------
-- 2) Suivi des ordres de préparation (staff)
-- ------------------------------------------------------------
create or replace function public.set_preparation_order_status(
  p_order_id uuid,
  p_status public.preparation_order_status,
  p_note text default null
)
returns public.preparation_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.preparation_orders%rowtype;
begin
  perform public.assert_staff();

  select * into v_order
    from public.preparation_orders
   where id = p_order_id
   for update;

  if not found then
    raise exception 'Ordre de préparation introuvable' using errcode = 'P0002';
  end if;

  if v_order.status = 'cancelled' and p_status <> 'cancelled' then
    raise exception 'Un ordre annulé ne peut plus être modifié' using errcode = 'P0001';
  end if;

  update public.preparation_orders
     set status = p_status,
         prepared_by = case when p_status = 'ready' then auth.uid() else prepared_by end,
         prepared_at = case when p_status = 'ready' then now() else prepared_at end,
         notes = coalesce(p_note, notes)
   where id = p_order_id
   returning * into v_order;

  return v_order;
end;
$$;

create or replace function public.record_preparation_progress(
  p_line_id uuid,
  p_quantity_prepared numeric
)
returns public.preparation_order_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line public.preparation_order_lines%rowtype;
  v_order public.preparation_orders%rowtype;
  v_remaining integer;
begin
  perform public.assert_staff();

  if p_quantity_prepared is null or p_quantity_prepared < 0 then
    raise exception 'Quantité préparée invalide' using errcode = '22023';
  end if;

  select * into v_line
    from public.preparation_order_lines
   where id = p_line_id
   for update;

  if not found then
    raise exception 'Ligne de préparation introuvable' using errcode = 'P0002';
  end if;

  if p_quantity_prepared > v_line.quantity_to_prepare then
    raise exception 'La quantité préparée dépasse la quantité attendue' using errcode = '22023';
  end if;

  update public.preparation_order_lines
     set quantity_prepared = p_quantity_prepared,
         status = case
           when p_quantity_prepared <= 0 then 'pending'
           when p_quantity_prepared >= quantity_to_prepare then 'prepared'
           else 'partial'
         end
   where id = p_line_id
   returning * into v_line;

  select * into v_order
    from public.preparation_orders
   where id = v_line.preparation_order_id
   for update;

  if v_order.status = 'pending' and p_quantity_prepared > 0 then
    update public.preparation_orders
       set status = 'preparing'
     where id = v_order.id
     returning * into v_order;
  end if;

  select count(*) into v_remaining
    from public.preparation_order_lines
   where preparation_order_id = v_line.preparation_order_id
     and status <> 'prepared';

  if v_remaining = 0 then
    update public.preparation_orders
       set status = 'ready',
           prepared_by = auth.uid(),
           prepared_at = now()
     where id = v_order.id
       and status <> 'cancelled';
  end if;

  return v_line;
end;
$$;

-- ------------------------------------------------------------
-- 3) Privilèges
-- ------------------------------------------------------------
revoke execute on function public.admin_create_supplier(text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_create_supplier(text, text, text, text, text, text) to authenticated, service_role;

revoke execute on function public.admin_attach_supplier_member(uuid, uuid, public.org_role) from public, anon;
grant execute on function public.admin_attach_supplier_member(uuid, uuid, public.org_role) to authenticated, service_role;

revoke execute on function public.set_preparation_order_status(uuid, public.preparation_order_status, text) from public, anon;
grant execute on function public.set_preparation_order_status(uuid, public.preparation_order_status, text) to authenticated, service_role;

revoke execute on function public.record_preparation_progress(uuid, numeric) from public, anon;
grant execute on function public.record_preparation_progress(uuid, numeric) to authenticated, service_role;
