-- Permisos de la temporada 2026-2027 (aplicado el 26/11/2026).
--
-- Toda la temporada vive en una fila de public.lineups (match_id = '__app_state_2026_2027__').
-- Nadie la lee ni la escribe directamente: se hace con estas funciones, que entregan a cada
-- persona solo lo que le toca.
--   · Visitante sin sesión: lo público (sin fecha de nacimiento, valoraciones, texto de informes, plan de partido,
--     notas ni vídeos internos).
--   · Entrenador: lo público + todo lo de su equipo. Solo puede guardar su equipo.
--   · Coordinador y administrador: todo.
-- La temporada 2025-2026 (tablas players, matches, lineups, game_plans) solo la ve el administrador.

-- 1. Quién es quién ---------------------------------------------------------------------------
create table if not exists public.ferreries_acceso (
  email text primary key,
  rol text not null check (rol in ('admin', 'coordinador', 'entrenador')),
  equipo text
);
alter table public.ferreries_acceso enable row level security;
revoke all on public.ferreries_acceso from anon, authenticated;

insert into public.ferreries_acceso (email, rol, equipo) values
  ('calagaldana@gmail.com', 'admin', null),
  ('calagaldana+coordinador@gmail.com', 'coordinador', null),
  ('carlosfebrer22@gmail.com', 'coordinador', null),
  ('calagaldana+regional@gmail.com', 'entrenador', 'ce-ferreries-regional-preferente'),
  ('calagaldana+juvenil-nacional@gmail.com', 'entrenador', 'ce-ferreries-juvenil-nacional'),
  ('calagaldana+juvenil-b@gmail.com', 'entrenador', 'ce-ferreries-juvenil-preferente-b'),
  ('calagaldana+cadete@gmail.com', 'entrenador', 'ce-ferreries-cadete-preferente'),
  ('calagaldana+infantil@gmail.com', 'entrenador', 'ce-ferreries-infantil-preferente'),
  ('calagaldana+infantil-b@gmail.com', 'entrenador', 'ce-ferreries-infantil-b'),
  ('calagaldana+alevin-a@gmail.com', 'entrenador', 'ce-ferreries-alevin-a'),
  ('calagaldana+alevin-b@gmail.com', 'entrenador', 'ce-ferreries-alevin-b'),
  ('calagaldana+benjamin-a@gmail.com', 'entrenador', 'ce-ferreries-benjamin-a'),
  ('calagaldana+benjamin-b@gmail.com', 'entrenador', 'ce-ferreries-benjamin-b'),
  ('calagaldana+prebenjamin@gmail.com', 'entrenador', 'ce-ferreries-prebenjamin'),
  ('calagaldana+prebenjamin-b@gmail.com', 'entrenador', 'ce-ferreries-prebenjamin-b')
on conflict (email) do update set rol = excluded.rol, equipo = excluded.equipo;

create or replace function public.ferreries_mi_rol() returns text
language sql stable security definer set search_path = public as $$
  select rol from public.ferreries_acceso where email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

create or replace function public.ferreries_mi_equipo() returns text
language sql stable security definer set search_path = public as $$
  select equipo from public.ferreries_acceso where email = lower(coalesce(auth.jwt() ->> 'email', ''))
$$;

-- 2. Versión pública de la temporada (el equipo indicado se entrega completo) -------------------
create or replace function public.ferreries_filtrar(s jsonb, p_equipo text) returns jsonb
language sql immutable set search_path = public as $$
  select s || jsonb_build_object(
    'players', coalesce((
      -- De los informes de otros equipos solo quedan los números (minutos, goles, tarjetas...),
      -- que alimentan las estadísticas públicas. El texto, la nota y el vídeo del entrenador no.
      select jsonb_agg(case when p ->> 'teamId' = p_equipo then p
                            else (p - 'birthdate' - 'ratings' - 'description' - 'career') || jsonb_build_object('reports', coalesce((
                              select jsonb_object_agg(k, case when jsonb_typeof(v) = 'object' then v - 'text' - 'rating' - 'youtube' else '{}'::jsonb end)
                              from jsonb_each(case when jsonb_typeof(p -> 'reports') = 'object' then p -> 'reports' else '{}'::jsonb end) as e(k, v)), '{}'::jsonb))
                       end order by o)
      from jsonb_array_elements(coalesce(s -> 'players', '[]'::jsonb)) with ordinality as t(p, o)), '[]'::jsonb),
    'matches', coalesce((
      select jsonb_agg(case when m ->> 'teamId' = p_equipo then m
                            else m - 'plan' - 'notes' - 'videoUrl' end order by o)
      from jsonb_array_elements(coalesce(s -> 'matches', '[]'::jsonb)) with ordinality as t(m, o)), '[]'::jsonb),
    'matchVideos', coalesce((
      select jsonb_agg(v order by o)
      from jsonb_array_elements(coalesce(s -> 'matchVideos', '[]'::jsonb)) with ordinality as t(v, o)
      where v ->> 'teamId' = p_equipo), '[]'::jsonb)
  )
$$;

-- 3. Lectura -----------------------------------------------------------------------------------
create or replace function public.ferreries_estado() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r text := public.ferreries_mi_rol();
  l jsonb;
begin
  select lineup into l from public.lineups where match_id = '__app_state_2026_2027__';
  if l is null then return null; end if;
  if r in ('admin', 'coordinador') then return l; end if;
  return jsonb_build_object(
    '__seasonState', public.ferreries_filtrar(l -> '__seasonState', case when r = 'entrenador' then public.ferreries_mi_equipo() end),
    '__results', l -> '__results',
    '__public', l -> '__public');
end
$$;

create or replace function public.ferreries_modificado() returns bigint
language sql stable security definer set search_path = public as $$
  select coalesce((lineup -> '__seasonState' ->> 'lastModifiedAt')::bigint, 0)
  from public.lineups where match_id = '__app_state_2026_2027__'
$$;

create or replace function public.ferreries_portada() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'fixtures', lineup -> '__seasonState' -> 'fixtures',
    'teams', lineup -> '__seasonState' -> 'teams',
    'results', lineup -> '__results',
    'public', lineup -> '__public')
  from public.lineups where match_id = '__app_state_2026_2027__'
$$;

-- 4. Guardado ----------------------------------------------------------------------------------
-- p_esperado: lastModifiedAt de la versión que cargó quien guarda. Si la base de datos tiene una
-- más reciente, no se guarda (para no borrar cambios de otro) y se devuelve conflicto.
create or replace function public.ferreries_guardar(p_lineup jsonb, p_esperado bigint) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  r text := public.ferreries_mi_rol();
  eq text := public.ferreries_mi_equipo();
  cur jsonb;
  s jsonb;
  n jsonb := p_lineup -> '__seasonState';
  actual bigint;
  nuevo jsonb;
begin
  if r is null then
    raise exception 'Esta cuenta no tiene permiso para guardar' using errcode = '42501';
  end if;
  if n is null or jsonb_typeof(n -> 'players') <> 'array' or jsonb_typeof(n -> 'matches') <> 'array' then
    raise exception 'Datos de temporada incompletos' using errcode = '22023';
  end if;
  select lineup into cur from public.lineups where match_id = '__app_state_2026_2027__' for update;
  actual := coalesce((cur -> '__seasonState' ->> 'lastModifiedAt')::bigint, 0);
  if p_esperado is not null and actual > p_esperado then
    return jsonb_build_object('ok', false, 'conflicto', true, 'remoto', actual);
  end if;

  if r in ('admin', 'coordinador') then
    nuevo := p_lineup;
  else
    if eq is null or cur is null then
      raise exception 'Esta cuenta no tiene equipo asignado' using errcode = '42501';
    end if;
    s := cur -> '__seasonState';
    s := s || jsonb_build_object(
      'players',
        coalesce((select jsonb_agg(p) from jsonb_array_elements(s -> 'players') p where coalesce(p ->> 'teamId', '') <> eq), '[]'::jsonb)
        || coalesce((select jsonb_agg(p) from jsonb_array_elements(n -> 'players') p where p ->> 'teamId' = eq), '[]'::jsonb),
      'matches',
        coalesce((select jsonb_agg(m) from jsonb_array_elements(s -> 'matches') m where coalesce(m ->> 'teamId', '') <> eq), '[]'::jsonb)
        || coalesce((select jsonb_agg(m) from jsonb_array_elements(n -> 'matches') m where m ->> 'teamId' = eq), '[]'::jsonb),
      'matchVideos',
        coalesce((select jsonb_agg(v) from jsonb_array_elements(coalesce(s -> 'matchVideos', '[]'::jsonb)) v where coalesce(v ->> 'teamId', '') <> eq), '[]'::jsonb)
        || coalesce((select jsonb_agg(v) from jsonb_array_elements(coalesce(n -> 'matchVideos', '[]'::jsonb)) v where v ->> 'teamId' = eq), '[]'::jsonb),
      'staff',
        coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(s -> 'staff', '[]'::jsonb)) x where coalesce(x ->> 'teamId', '') <> eq), '[]'::jsonb)
        || coalesce((select jsonb_agg(x) from jsonb_array_elements(coalesce(n -> 'staff', '[]'::jsonb)) x where x ->> 'teamId' = eq), '[]'::jsonb),
      'teams', coalesce((
        select jsonb_agg(case when t ->> 'id' = eq
                              then coalesce((select t2 from jsonb_array_elements(n -> 'teams') t2 where t2 ->> 'id' = eq limit 1), t)
                              else t end)
        from jsonb_array_elements(s -> 'teams') t), s -> 'teams'),
      'fixtures', case when n -> 'fixtures' -> eq is not null
                       then coalesce(s -> 'fixtures', '{}'::jsonb) || jsonb_build_object(eq, n -> 'fixtures' -> eq)
                       else s -> 'fixtures' end,
      'lastModifiedAt', n -> 'lastModifiedAt'
    );
    nuevo := jsonb_build_object('__seasonState', s, '__results', p_lineup -> '__results', '__public', p_lineup -> '__public');
  end if;

  update public.lineups set lineup = nuevo, updated_at = now() where match_id = '__app_state_2026_2027__';
  if not found then
    insert into public.matches (id, round, home, away, date, status, score, updated_at)
      values ('__app_state_2026_2027__', 0, 'Estado temporada 2026-2027', 'Estado temporada 2026-2027', null, 'Sistema', '', now())
      on conflict (id) do nothing;
    insert into public.lineups (match_id, lineup, updated_at) values ('__app_state_2026_2027__', nuevo, now());
  end if;
  return jsonb_build_object('ok', true, 'lastModifiedAt', coalesce((nuevo -> '__seasonState' ->> 'lastModifiedAt')::bigint, 0));
end
$$;

revoke all on function public.ferreries_guardar(jsonb, bigint) from public, anon;
grant execute on function public.ferreries_guardar(jsonb, bigint) to authenticated;
grant execute on function public.ferreries_estado(), public.ferreries_modificado(), public.ferreries_portada(),
  public.ferreries_mi_rol(), public.ferreries_mi_equipo() to anon, authenticated;
