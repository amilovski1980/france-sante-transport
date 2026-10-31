-- ============================================================
-- France Santé Transport — Migration 22 : services & APIs
-- Paramétrage central (SMTP/Resend/Twilio/Stripe) administré,
-- codes de vérification e-mail + SMS, statuts de vérification
-- sur les profils et référence de paiement Stripe sur les factures.
-- ============================================================

-- ------------------------------------------------------------
-- Réglages plateforme (singleton id = 1) — lecture admin only
-- ------------------------------------------------------------
create table if not exists public.app_settings (
  id                 integer primary key default 1 check (id = 1),

  -- E-mail
  smtp_host          text,
  smtp_port          integer,
  smtp_user          text,
  smtp_pass          text,
  smtp_from          text,
  resend_api_key     text,

  -- SMS Twilio
  twilio_account_sid text,
  twilio_auth_token  text,
  twilio_from        text,

  -- Paiement Stripe
  stripe_secret_key  text,

  updated_by         uuid references public.profiles (id) on delete set null,
  updated_at         timestamptz not null default now()
);

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

revoke all on table public.app_settings from anon, authenticated;
grant select, update on table public.app_settings to authenticated;

alter table public.app_settings enable row level security;

drop policy if exists app_settings_admin_all on public.app_settings;
create policy app_settings_admin_all
  on public.app_settings for all to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

comment on table public.app_settings is
  'Paramètres des services techniques (SMTP, Resend, Twilio, Stripe). Secrets stockés côté base, jamais rendus au client.';

-- ------------------------------------------------------------
-- Codes de vérification (e-mail / SMS)
-- ------------------------------------------------------------
create table public.verification_codes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  channel     text not null check (channel in ('email', 'sms')),
  code_hash   text not null,
  expires_at  timestamptz not null,
  attempts    integer not null default 0,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create index verification_codes_user_idx
  on public.verification_codes (user_id, channel, created_at desc);

revoke all on table public.verification_codes from anon, authenticated;
grant select, insert, update, delete on table public.verification_codes to authenticated;

alter table public.verification_codes enable row level security;

drop policy if exists verification_codes_owner on public.verification_codes;
create policy verification_codes_owner
  on public.verification_codes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.verification_codes is
  'Codes OTP à usage unique (hachés), 10 minutes de validité.';

-- ------------------------------------------------------------
-- Vérification des coordonnées sur les profils
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists email_verified_at timestamptz,
  add column if not exists phone_verified_at timestamptz;

-- ------------------------------------------------------------
-- Paiement Stripe sur les factures
-- ------------------------------------------------------------
alter table public.invoices
  add column if not exists stripe_session_id text;
