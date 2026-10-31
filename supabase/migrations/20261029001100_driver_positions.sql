-- ============================================================
-- France Santé Transport — Migration 11 : positions GPS chauffeurs
-- Une ligne par chauffeur, mise à jour par le navigateur pendant
-- le partage actif. Visible par le dispatch (staff) uniquement
-- lorsque le chauffeur a activé le partage.
-- ============================================================

create table public.driver_positions (
  driver_id  uuid primary key references public.profiles (id) on delete cascade,
  lat        double precision not null check (lat between -90 and 90),
  lng        double precision not null check (lng between -180 and 180),
  accuracy   double precision check (accuracy is null or (accuracy >= 0 and accuracy <= 100000)),
  shared     boolean not null default false,
  updated_at timestamptz not null default now()
);

comment on table public.driver_positions is
  'Dernière position GPS partagée par chaque chauffeur (mutualisée : une ligne par chauffeur).';

create trigger driver_positions_updated_at
  before update on public.driver_positions
  for each row execute function moddatetime (updated_at);

-- ------------------------------------------------------------
-- Droits : lecture staff/chauffeur concerné, écriture via RPC
-- ------------------------------------------------------------
revoke all on table public.driver_positions from anon, authenticated, service_role;
grant select on table public.driver_positions to authenticated;

alter table public.driver_positions enable row level security;

-- Le dispatch voit les positions partagées ; le chauffeur voit la sienne
-- (partagée ou non).
drop policy if exists positions_select on public.driver_positions;
create policy positions_select
  on public.driver_positions for select to authenticated
  using (driver_id = auth.uid() or (public.is_staff() and shared));

-- Aucune politique INSERT/UPDATE/DELETE directe : uniquement via RPC.

-- ------------------------------------------------------------
-- share_driver_position : mise à jour (upsert) de sa propre
-- position. p_shared = false masque la position du dispatch
-- sans la supprimer (le chauffeur peut la partager à nouveau).
-- ------------------------------------------------------------
create or replace function public.share_driver_position(
  p_lat double precision,
  p_lng double precision,
  p_accuracy double precision default null,
  p_shared boolean default true
)
returns public.driver_positions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.driver_positions%rowtype;
begin
  if not public.is_driver() then
    raise exception 'Seuls les chauffeurs peuvent partager leur position'
      using errcode = '42501';
  end if;
  if p_lat is null or p_lat not between -90 and 90
     or p_lng is null or p_lng not between -180 and 180 then
    raise exception 'Position GPS invalide' using errcode = '22023';
  end if;

  insert into public.driver_positions (driver_id, lat, lng, accuracy, shared, updated_at)
  values (auth.uid(), p_lat, p_lng, p_accuracy, coalesce(p_shared, true), now())
  on conflict (driver_id) do update
    set lat = excluded.lat,
        lng = excluded.lng,
        accuracy = excluded.accuracy,
        shared = excluded.shared,
        updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke execute on function public.share_driver_position(double precision,double precision,double precision,boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.share_driver_position(double precision,double precision,double precision,boolean)
  to authenticated, postgres, service_role;

-- ------------------------------------------------------------
-- Publication Realtime : la position diffuse en direct
-- (les politiques RLS restent appliquées à l'abonné)
-- ------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'driver_positions'
  ) then
    alter publication supabase_realtime add table public.driver_positions;
  end if;
end $$;
