-- ============================================================
-- France Santé Transport — Migration 1 : identité et organisations
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "moddatetime";

-- ------------------------------------------------------------
-- Types énumérés
-- ------------------------------------------------------------
create type public.app_role as enum ('client', 'admin', 'dispatcher', 'driver', 'partner');

create type public.org_kind as enum ('client_company', 'facility', 'partner');

create type public.org_role as enum ('owner', 'member', 'contact');

-- ------------------------------------------------------------
-- profiles : liée 1:1 à auth.users
-- ------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name   text check (full_name is null or length(trim(full_name)) between 1 and 200),
  phone       text check (phone is null or length(phone) between 6 and 30),
  role        public.app_role not null default 'client',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'Profil applicatif lié à un compte authentifié. Le rôle est attribué par un administrateur.';

-- ------------------------------------------------------------
-- organizations : établissements, entreprises clientes, partenaires
-- ------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 2 and 200),
  kind        public.org_kind not null default 'client_company',
  siret       text check (siret is null or siret ~ '^[0-9]{14}$'),
  address     text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index organizations_name_idx on public.organizations (lower(name));

-- ------------------------------------------------------------
-- organization_members : appartenances avec rôle dans l'organisation
-- ------------------------------------------------------------
create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  org_role        public.org_role not null default 'member',
  created_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_idx on public.organization_members (user_id);

-- ------------------------------------------------------------
-- Création automatique du profil à l'inscription
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    coalesce(new.email, new.raw_user_meta_data ->> 'email', new.id || '@placeholder.local'),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- Interdiction d'auto-élévation de rôle (trigger applicatif)
-- ------------------------------------------------------------
create or replace function public.prevent_self_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- Contexte PostgREST (claims JWT présents) : seul un admin peut changer un rôle.
    -- Hors contexte JWT (migrations, scripts serveur) : autorisé.
    -- Exception : promotion du tout premier admin (bootstrap_first_admin).
    if nullif(current_setting('request.jwt.claims', true), '') is not null
       and not public.is_admin()
       and exists (select 1 from public.profiles where role = 'admin') then
      raise exception 'Seul un administrateur peut modifier un rôle';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_no_self_role_change
  before update of role on public.profiles
  for each row execute function public.prevent_self_role_change();

-- ------------------------------------------------------------
-- updated_at
-- ------------------------------------------------------------
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function moddatetime (updated_at);

create trigger organizations_updated_at
  before update on public.organizations
  for each row execute function moddatetime (updated_at);
