-- Migration 15 : enrichissement des profils (avatar, adresse)

alter table public.profiles
  add column if not exists avatar_url text check (avatar_url is null or avatar_url ~ '^https?://'),
  add column if not exists address text check (address is null or length(address) <= 500);

comment on column public.profiles.avatar_url is 'URL publique de l''avatar (photo de profil).';
comment on column public.profiles.address is 'Adresse postale de contact.';

create or replace function public.admin_update_profile(
  p_user_id uuid,
  p_full_name text default null,
  p_phone text default null,
  p_address text default null,
  p_avatar_url text default null,
  p_role public.app_role default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_row public.profiles%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Seul un administrateur peut modifier un profil';
  end if;
  update public.profiles set
    full_name = coalesce(p_full_name, full_name),
    phone = coalesce(p_phone, phone),
    address = coalesce(p_address, address),
    avatar_url = coalesce(p_avatar_url, avatar_url),
    role = coalesce(p_role, role)
  where id = p_user_id
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Profil introuvable';
  end if;
  return v_row;
end;
$body$;

grant execute on function public.admin_update_profile(uuid,text,text,text,text,public.app_role) to authenticated;

create or replace function public.update_own_profile(
  p_full_name text default null,
  p_phone text default null,
  p_address text default null,
  p_avatar_url text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_row public.profiles%rowtype;
begin
  update public.profiles set
    full_name = coalesce(p_full_name, full_name),
    phone = coalesce(p_phone, phone),
    address = coalesce(p_address, address),
    avatar_url = coalesce(p_avatar_url, avatar_url)
  where id = auth.uid()
  returning * into v_row;
  if v_row.id is null then
    raise exception 'Profil introuvable';
  end if;
  return v_row;
end;
$body$;

grant execute on function public.update_own_profile(text,text,text,text) to authenticated;


