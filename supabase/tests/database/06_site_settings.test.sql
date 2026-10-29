-- ============================================================
-- Tests : réglages de personnalisation du site (site_settings)
-- Ligne unique, lecture publique, écriture admin uniquement.
-- Données 100 % fictives.
-- ============================================================
begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

create function public.test_login(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end;
$$;

create function public.test_logout() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'reset role';
end;
$$;

create table public.test_ctx (k text primary key, v uuid);
grant all on table public.test_ctx to anon, authenticated, service_role;

-- Tente une mise à jour et renvoie le nombre de lignes touchées.
create function public.test_update_site_settings(p_slogan text) returns bigint
language plpgsql as $$
declare v_count bigint;
begin
  with u as (
    update public.site_settings set slogan = p_slogan
     where id = 1
    returning 1
  )
  select count(*) into v_count from u;
  return v_count;
end;
$$;

-- ------------------------------------------------------------
-- Fixtures fictives
-- ------------------------------------------------------------
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
values
 ('70000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'client.a.f6@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Client A (test)"}'),
 ('70000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'admin.f6@test.local', 'x', now(),
  '{"provider":"email"}', '{"full_name":"Admin (test)"}');
update public.profiles set role = 'admin' where email = 'admin.f6@test.local';

-- 1 : la ligne par défaut existe
select is(
  (select count(*) from public.site_settings where id = 1),
  1::bigint,
  'la ligne unique de réglages existe'
);

-- 2 : lecture anonyme autorisée
set local role anon;
select is(
  (select slogan from public.site_settings where id = 1),
  'Le transport qui fait avancer la santé',
  'un visiteur lit le slogan'
);
reset role;

-- 3 : un client ne peut pas modifier les réglages (RLS : 0 ligne)
select public.test_login('70000000-0000-4000-8000-000000000001'::uuid);
select is(
  public.test_update_site_settings('Piratage (test)'),
  0::bigint,
  'un client ne modifie aucune ligne'
);
select public.test_logout();

-- 4 : le slogan d'origine est intact après la tentative
select is(
  (select slogan from public.site_settings where id = 1),
  'Le transport qui fait avancer la santé',
  'le slogan public est intact après la tentative client'
);

-- 5 : un client ne peut pas insérer une seconde ligne
select public.test_login('70000000-0000-4000-8000-000000000001'::uuid);
select throws_ok(
  $q$insert into public.site_settings (id, slogan) values (2, 'Hack')$q$,
  '42501', null,
  'un client ne peut pas insérer une ligne de réglages'
);

-- 6 : ni supprimer la ligne existante
select throws_ok(
  $q$delete from public.site_settings where id = 1$q$,
  '42501', null,
  'un client ne peut pas supprimer les réglages'
);
select public.test_logout();

-- 7 : l'administrateur met à jour le slogan
select public.test_login('70000000-0000-4000-8000-000000000003'::uuid);
select is(
  (select slogan from public.site_settings where id = 1),
  'Le transport qui fait avancer la santé',
  'sélection admin des réglages'
);

update public.site_settings set slogan = 'Slogan de test (fictif)' where id = 1;
select is(
  (select slogan from public.site_settings where id = 1),
  'Slogan de test (fictif)',
  'un administrateur met à jour le slogan'
);

-- 8 : le déclencheur enregistre l'auteur
select is(
  (select updated_by from public.site_settings where id = 1),
  '70000000-0000-4000-8000-000000000003'::uuid,
  'le déclencheur enregistre l''administrateur auteur'
);

-- 9 : logo avec schéma interdit refusé
select throws_ok(
  $q$update public.site_settings set logo_url = 'javascript:alert(1)' where id = 1$q$,
  '23514', null,
  'une URL de logo hors http(s)/chemin relatif est refusée'
);

-- 10 : URL http(s) acceptée
update public.site_settings set logo_url = 'https://example.org/logo.png' where id = 1;
select is(
  (select logo_url from public.site_settings where id = 1),
  'https://example.org/logo.png',
  'une URL de logo https est acceptée'
);

-- 11 : CSS trop long refusé
select throws_ok(
  $q$update public.site_settings set custom_css = repeat('a', 10001) where id = 1$q$,
  '23514', null,
  'un CSS de plus de 10000 caractères est refusé'
);

-- 12 : CSS raisonnable accepté
update public.site_settings set custom_css = ':root { --x: 1; }' where id = 1;
select is(
  (select custom_css from public.site_settings where id = 1),
  ':root { --x: 1; }',
  'un CSS de taille raisonnable est accepté'
);

select public.test_logout();
select finish();
rollback;
