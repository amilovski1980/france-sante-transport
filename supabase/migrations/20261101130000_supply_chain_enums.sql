-- ============================================================
-- France Santé Transport — Phase 1 : énumérations additives
-- Aucune valeur existante n'est supprimée ou renommée.
-- Ce fichier est volontairement séparé des tables qui utilisent
-- ces valeurs : PostgreSQL interdit d'utiliser une nouvelle
-- valeur d'enum dans la transaction qui l'a créée.
-- ============================================================

-- Nouveau rôle applicatif : espace fournisseur (remplace à terme
-- l'espace client, sans casser les comptes « client » existants).
alter type public.app_role add value if not exists 'supplier';

-- Nouveau type d'organisation : fournisseur.
alter type public.org_kind add value if not exists 'supplier';

-- Types de mouvements de stock (journal append-only).
do $$
begin
  if not exists (
    select 1
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
     where t.typname = 'stock_movement_type'
       and n.nspname = 'public'
  ) then
    execute $sql$
      create type public.stock_movement_type as enum (
        'receipt',
        'reservation',
        'release',
        'shipment',
        'adjustment',
        'return'
      )
    $sql$;
  end if;
end $$;

comment on type public.stock_movement_type is
  'Nature d''un mouvement de stock : réception, réservation, libération, expédition, ajustement, retour.';
