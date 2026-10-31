-- ============================================================
-- France Santé Transport — Migration 23 : push navigateur (Web Push)
-- Abonnements des appareils (endpoint par appareil), notification
-- transactionnelle poussée en plus de l'e-mail et du temps réel.
-- ============================================================

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

revoke all on table public.push_subscriptions from anon, authenticated;
grant select, insert, update, delete on table public.push_subscriptions to authenticated;

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_owner on public.push_subscriptions;
create policy push_subscriptions_owner
  on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.push_subscriptions is
  'Abonnements Web Push par appareil (endpoint, clés de chiffrement). Le serveur pousse via VAPID ; lecture par service_role uniquement.';
