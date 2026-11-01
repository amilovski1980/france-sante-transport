-- ============================================================
-- Phase 5 — Lectures chauffeur pour les missions de livraison
-- Un chauffeur affecté à une livraison doit pouvoir lire les
-- informations nécessaires à l'écran mission : destinataire,
-- entrepôt de départ, produit, référence et lot.
-- Les politiques existantes restent inchangées (permissives).
-- ============================================================

-- Destinataire d'une livraison affectée au chauffeur.
drop policy if exists recipients_select_driver on public.recipients;
create policy recipients_select_driver
  on public.recipients for select to authenticated
  using (
    exists (
      select 1
        from public.deliveries d
       where d.recipient_id = recipients.id
         and public.driver_on_delivery(d.id)
    )
  );

-- Entrepôt de départ d'un planning affecté au chauffeur.
drop policy if exists warehouses_select_driver on public.warehouses;
create policy warehouses_select_driver
  on public.warehouses for select to authenticated
  using (
    exists (
      select 1
        from public.delivery_schedules s
       where s.warehouse_id = warehouses.id
         and public.driver_on_schedule(s.id)
    )
  );

-- Lots transportés dans une livraison affectée au chauffeur.
drop policy if exists lots_select_driver on public.lots;
create policy lots_select_driver
  on public.lots for select to authenticated
  using (
    exists (
      select 1
        from public.delivery_items di
        join public.deliveries d on d.id = di.delivery_id
       where di.lot_id = lots.id
         and public.driver_on_delivery(d.id)
    )
  );

-- Références produit des lots transportés.
drop policy if exists product_references_select_driver on public.product_references;
create policy product_references_select_driver
  on public.product_references for select to authenticated
  using (
    exists (
      select 1
        from public.delivery_items di
        join public.deliveries d on d.id = di.delivery_id
        join public.lots l on l.id = di.lot_id
       where l.product_reference_id = product_references.id
         and public.driver_on_delivery(d.id)
    )
  );

-- Produits des références transportées.
drop policy if exists products_select_driver on public.products;
create policy products_select_driver
  on public.products for select to authenticated
  using (
    exists (
      select 1
        from public.delivery_items di
        join public.deliveries d on d.id = di.delivery_id
        join public.lots l on l.id = di.lot_id
        join public.product_references pr on pr.id = l.product_reference_id
       where pr.product_id = products.id
         and public.driver_on_delivery(d.id)
    )
  );
