-- ============================================================
-- France Santé Transport — Migration 8 : personnalisation du
-- site (logo, slogan, CSS sur mesure).
-- Ligne unique, lecture publique, écriture réservée admin.
-- ============================================================

create table public.site_settings (
  id         smallint primary key default 1 check (id = 1),
  logo_url   text check (
    logo_url is null or (
      length(logo_url) <= 2048
      and (logo_url ~ '^https?://[^\s]+$' or logo_url ~ '^/[^\s]*$')
    )
  ),
  logo_alt   text check (logo_alt is null or length(trim(logo_alt)) between 1 and 120),
  slogan     text check (slogan is null or length(trim(slogan)) between 2 and 160),
  custom_css text check (custom_css is null or length(custom_css) <= 10000),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.site_settings is
  'Réglages d''identité visuelle du site (ligne unique). Lecture publique, écriture admin.';

-- Ligne par défaut : identité provisoire actuelle
insert into public.site_settings (id, logo_alt, slogan)
values (1, 'France Santé Transport', 'Le transport qui fait avancer la santé');

-- ------------------------------------------------------------
-- Déclencheur : horodatage + auteur de la dernière modification
-- ------------------------------------------------------------
create or replace function public.touch_site_settings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), old.updated_by);
  return new;
end;
$$;

create trigger site_settings_touch
  before update on public.site_settings
  for each row execute function public.touch_site_settings();

-- ------------------------------------------------------------
-- Privileges : lecture publique, ecriture colonnes admin via RLS
-- (pas d'insert / delete pour les clients : ligne unique seedee)
-- ------------------------------------------------------------
revoke all on table public.site_settings from anon, authenticated, service_role;
grant select on table public.site_settings to anon, authenticated;
grant update (logo_url, logo_alt, slogan, custom_css, updated_at, updated_by)
  on table public.site_settings to authenticated;

alter table public.site_settings enable row level security;

drop policy if exists site_settings_public_select on public.site_settings;
create policy site_settings_public_select
  on public.site_settings for select
  using (true);

drop policy if exists site_settings_admin_update on public.site_settings;
create policy site_settings_admin_update
  on public.site_settings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());
