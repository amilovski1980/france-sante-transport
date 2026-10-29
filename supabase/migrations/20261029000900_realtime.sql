-- ============================================================
-- France Santé Transport — Migration 9 : publication Realtime
-- Expose les tables métier au canal Supabase Realtime pour le
-- suivi temps réel dispatch (les politiques RLS restent appliquées
-- aux événements livrés selon le rôle de l'abonné).
-- ============================================================

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'transport_requests',
    'quotes',
    'shipments',
    'shipment_events',
    'driver_assignments'
  ]
  loop
    if not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end $$;

comment on publication supabase_realtime is
  'Changements applicatifs (demandes, devis, missions, affectations, journal) pour le suivi temps réel.';
