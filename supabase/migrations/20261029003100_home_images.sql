-- ============================================================
-- France Santé Transport — Migration 31 : personnalisation des
-- images de la page d'accueil (fond du bandeau + visuel carte).
-- Ligne unique, lecture publique, écriture réservée admin
-- (RLS héritée de la migration 8).
-- ============================================================

alter table public.site_settings
  add column if not exists home_hero_image   text,
  add column if not exists home_visual_image text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
      where conname = 'site_settings_home_hero_image_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_home_hero_image_check
        check (home_hero_image is null or (
          length(home_hero_image) <= 2048
          and (home_hero_image ~ '^https?://[^\s]+$' or home_hero_image ~ '^/[^\s]*$')
        ));
  end if;
  if not exists (
    select 1 from pg_constraint
      where conname = 'site_settings_home_visual_image_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_home_visual_image_check
        check (home_visual_image is null or (
          length(home_visual_image) <= 2048
          and (home_visual_image ~ '^https?://[^\s]+$' or home_visual_image ~ '^/[^\s]*$')
        ));
  end if;
end $$;

-- Écriture par les administrateurs (RLS contrôle le rôle).
grant update (
  home_hero_image, home_visual_image, updated_at, updated_by
) on table public.site_settings to authenticated;

comment on column public.site_settings.home_hero_image is
  'Image de fond du bandeau supérieur de la page d''accueil (URL absolue ou chemin local).';
comment on column public.site_settings.home_visual_image is
  'Visuel affiché dans la carte « Un parcours sous contrôle » de la page d''accueil.';
