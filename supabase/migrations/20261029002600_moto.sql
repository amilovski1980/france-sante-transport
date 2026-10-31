-- ============================================================
-- France Santé Transport — Migration 26 : flotte — motos
-- Ajout du type « moto » (moto-taxi / VMDTR) aux véhicules.
-- ============================================================

alter type public.vehicle_type add value if not exists 'moto' after 'ambulance';

comment on type public.vehicle_type is
  'Types de véhicules de la flotte : sedan, van, minibus, stretcher_van, ambulance, moto (moto-taxi / VMDTR).';
