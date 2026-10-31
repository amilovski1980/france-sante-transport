-- ============================================================
-- France Santé Transport — Migration 30 : réseaux sociaux,
-- newsletter. Colonnes de diffusion appliquées au pied de page
-- public (colonne « Rejoignez-nous »).
-- Ligne unique, lecture publique, écriture réservée admin
-- (RLS héritée de la migration 8).
-- ============================================================

alter table public.site_settings
  add column if not exists social_facebook  text,
  add column if not exists social_linkedin  text,
  add column if not exists social_x         text,
  add column if not exists social_instagram text,
  add column if not exists newsletter_url   text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
      where conname = 'site_settings_social_facebook_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_social_facebook_check
        check (social_facebook is null or (
          length(social_facebook) <= 2048
          and social_facebook ~ '^https?://[^\s]+$'
        ));
  end if;
  if not exists (
    select 1 from pg_constraint
      where conname = 'site_settings_social_linkedin_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_social_linkedin_check
        check (social_linkedin is null or (
          length(social_linkedin) <= 2048
          and social_linkedin ~ '^https?://[^\s]+$'
        ));
  end if;
  if not exists (
    select 1 from pg_constraint
      where conname = 'site_settings_social_x_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_social_x_check
        check (social_x is null or (
          length(social_x) <= 2048
          and social_x ~ '^https?://[^\s]+$'
        ));
  end if;
  if not exists (
    select 1 from pg_constraint
      where conname = 'site_settings_social_instagram_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_social_instagram_check
        check (social_instagram is null or (
          length(social_instagram) <= 2048
          and social_instagram ~ '^https?://[^\s]+$'
        ));
  end if;
  if not exists (
    select 1 from pg_constraint
      where conname = 'site_settings_newsletter_url_check'
  ) then
    alter table public.site_settings
      add constraint site_settings_newsletter_url_check
        check (newsletter_url is null or (
          length(newsletter_url) <= 2048
          and newsletter_url ~ '^https?://[^\s]+$'
        ));
  end if;
end $$;

-- Écriture par les administrateurs (RLS contrôle le rôle).
grant update (
  social_facebook, social_linkedin, social_x, social_instagram,
  newsletter_url, updated_at, updated_by
) on table public.site_settings to authenticated;

comment on column public.site_settings.social_facebook is
  'URL de la page Facebook (liens « Rejoignez-nous » du pied de page).';
comment on column public.site_settings.social_linkedin is
  'URL de la page LinkedIn.';
comment on column public.site_settings.social_x is
  'URL du profil X (ex-Twitter).';
comment on column public.site_settings.social_instagram is
  'URL du profil Instagram.';
comment on column public.site_settings.newsletter_url is
  'URL d''inscription à la newsletter (formulaire externe).';
