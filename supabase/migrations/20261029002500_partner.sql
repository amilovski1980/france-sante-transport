-- ============================================================
-- France Santé Transport — Migration 25 : espace partenaire
-- Attribution des apports d'affaires au partenaire qui les
-- transmet (+ RLS de lecture de ses propres apports).
-- ============================================================

alter table public.contact_messages
  add column if not exists partner_id uuid references public.profiles (id) on delete set null;

create index if not exists contact_messages_partner_idx
  on public.contact_messages (partner_id, created_at desc);

-- Le partenaire consulte ses propres apports
drop policy if exists contact_select_partner on public.contact_messages;
create policy contact_select_partner
  on public.contact_messages for select to authenticated
  using (partner_id = auth.uid());
