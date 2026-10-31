-- Migration 13 : historique de trajet (Tracki)

create table public.driver_position_history (
  id          bigint generated always as identity primary key,
  driver_id   uuid not null references public.profiles (id) on delete cascade,
  lat         double precision not null check (lat between -90 and 90),
  lng         double precision not null check (lng between -180 and 180),
  accuracy    double precision,
  recorded_at timestamptz not null default now()
);

create index driver_position_history_driver_time_idx
  on public.driver_position_history (driver_id, recorded_at desc);

create or replace function public.archive_driver_position()
returns trigger
language plpgsql
security definer
set search_path = public
as $body$
begin
  if new.shared then
    insert into public.driver_position_history (driver_id, lat, lng, accuracy, recorded_at)
    values (new.driver_id, new.lat, new.lng, new.accuracy, now());
  end if;
  return new;
end;
$body$;

create trigger driver_positions_archive
  after insert or update on public.driver_positions
  for each row execute function public.archive_driver_position();

revoke all on table public.driver_position_history from anon, authenticated, service_role;
grant select on table public.driver_position_history to authenticated;

alter table public.driver_position_history enable row level security;

drop policy if exists position_history_select on public.driver_position_history;
create policy position_history_select
  on public.driver_position_history for select to authenticated
  using (driver_id = auth.uid() or public.is_staff());


