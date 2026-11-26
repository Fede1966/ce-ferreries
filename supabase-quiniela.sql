-- La Quiniela del Ferre.
--
-- Dos tablas nuevas, cerradas a todo el mundo: nadie las lee ni las escribe directamente.
-- Todo pasa por las funciones de abajo, que deciden qué ve cada uno:
--   · Público (sin sesión): la jornada, la clasificación por alias y el ganador. Nunca los emails.
--     Puede enviar una quiniela y, con su localizador, verla o cambiarla hasta el cierre.
--     Los pronósticos de los demás solo se ven cuando la jornada ya está cerrada.
--   · Administrador y coordinador de la app: crean jornadas, ponen el patrocinador, meten
--     resultados, hacen el sorteo y ven los emails (para avisar al ganador).
-- Reglas: solo gana quien acierte todos los partidos de la jornada (los suspendidos no cuentan).
-- Si hay varios plenos, gana quien acierte también el resultado exacto del primer partido.
-- Si sigue el empate, sorteo entre ellos. Sin pleno, la jornada queda desierta.
-- Se puede ejecutar más de una vez: no borra datos.

-- 1. Tablas -----------------------------------------------------------------------------------
create table if not exists public.quiniela_jornadas (
  id text primary key,
  nombre text not null,
  cierre timestamptz not null,
  partidos jsonb not null default '[]'::jsonb,       -- [{id, equipo, local, visitante, fecha, hora}]; el primero es el del desempate
  resultados jsonb not null default '{}'::jsonb,     -- {idPartido: "1" | "X" | "2" | "S"}  (S = suspendido, no cuenta)
  exacto jsonb,                                      -- {"local": 2, "visitante": 1} del primer partido
  patrocinador jsonb not null default '{}'::jsonb,   -- {nombre, premio, enlace, logo}
  sorteo jsonb,                                      -- {entre: [localizadores], ganador, fecha}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quiniela_boletos (
  localizador text primary key,
  jornada_id text not null references public.quiniela_jornadas(id) on delete cascade,
  alias text not null,
  email text not null,
  picks jsonb not null,                              -- {idPartido: "1" | "X" | "2"}
  exacto jsonb not null,                             -- {"local": 2, "visitante": 1}
  acepta_bases timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists quiniela_boletos_alias_unico on public.quiniela_boletos (jornada_id, lower(alias));
create unique index if not exists quiniela_boletos_email_unico on public.quiniela_boletos (jornada_id, lower(email));

alter table public.quiniela_jornadas enable row level security;
alter table public.quiniela_boletos enable row level security;
revoke all on public.quiniela_jornadas, public.quiniela_boletos from anon, authenticated;

-- 2. Cálculo ----------------------------------------------------------------------------------
create or replace function public.quiniela_es_gestor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.ferreries_mi_rol(), '') in ('admin', 'coordinador')
$$;

create or replace function public.quiniela_exige_gestor() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.quiniela_es_gestor() then
    raise exception 'Solo el administrador o el coordinador pueden gestionar la quiniela' using errcode = '42501';
  end if;
end
$$;

-- Aciertos de cada quiniela de una jornada
create or replace function public.quiniela_puntuar(p_jornada text)
returns table (localizador text, alias text, email text, picks jsonb, exacto jsonb, aciertos int, validos int, pleno boolean, exacto_ok boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  with j as (select * from public.quiniela_jornadas where id = p_jornada),
  v as (
    select p ->> 'id' as pid, j.resultados ->> (p ->> 'id') as r
    from j, jsonb_array_elements(j.partidos) p
    where j.resultados ->> (p ->> 'id') in ('1', 'X', '2')
  )
  select b.localizador, b.alias, b.email, b.picks, b.exacto,
         (select count(*) from v where b.picks ->> v.pid = v.r)::int,
         (select count(*) from v)::int,
         (select count(*) from v) > 0 and (select count(*) from v where b.picks ->> v.pid = v.r) = (select count(*) from v),
         j.exacto is not null
           and (b.exacto ->> 'local')::int = (j.exacto ->> 'local')::int
           and (b.exacto ->> 'visitante')::int = (j.exacto ->> 'visitante')::int,
         b.created_at
  from public.quiniela_boletos b, j
  where b.jornada_id = p_jornada
$$;

-- Estado de la jornada y ganador (con localizadores; la versión pública los cambia por alias)
create or replace function public.quiniela_veredicto(p_jornada text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  j public.quiniela_jornadas;
  completa boolean;
  primero text;
  plenos text[];
  ex text[];
  pool text[];
begin
  select * into j from public.quiniela_jornadas where id = p_jornada;
  if j.id is null then return null; end if;
  if now() < j.cierre then return jsonb_build_object('estado', 'abierta'); end if;
  primero := j.partidos -> 0 ->> 'id';
  completa := jsonb_array_length(j.partidos) > 0
    and not exists (select 1 from jsonb_array_elements(j.partidos) p
                    where coalesce(j.resultados ->> (p ->> 'id'), '') not in ('1', 'X', '2', 'S'))
    and (j.exacto is not null or j.resultados ->> primero = 'S');
  if not completa then return jsonb_build_object('estado', 'pendiente'); end if;
  select coalesce(array_agg(q.localizador order by q.localizador), '{}') into plenos from public.quiniela_puntuar(p_jornada) q where q.pleno;
  if cardinality(plenos) = 0 then return jsonb_build_object('estado', 'desierta', 'plenos', '[]'::jsonb); end if;
  if cardinality(plenos) = 1 then
    return jsonb_build_object('estado', 'ganador', 'motivo', 'pleno', 'ganador', plenos[1], 'plenos', to_jsonb(plenos));
  end if;
  select coalesce(array_agg(q.localizador order by q.localizador), '{}') into ex from public.quiniela_puntuar(p_jornada) q where q.pleno and q.exacto_ok;
  if cardinality(ex) = 1 then
    return jsonb_build_object('estado', 'ganador', 'motivo', 'exacto', 'ganador', ex[1], 'plenos', to_jsonb(plenos));
  end if;
  pool := case when cardinality(ex) > 1 then ex else plenos end;
  if j.sorteo is not null and j.sorteo -> 'entre' = to_jsonb(pool) then
    return jsonb_build_object('estado', 'ganador', 'motivo', 'sorteo', 'ganador', j.sorteo ->> 'ganador', 'plenos', to_jsonb(plenos),
                              'pool', to_jsonb(pool), 'fecha_sorteo', j.sorteo -> 'fecha');
  end if;
  return jsonb_build_object('estado', 'sorteo_pendiente', 'plenos', to_jsonb(plenos), 'pool', to_jsonb(pool));
end
$$;

-- 3. Público ----------------------------------------------------------------------------------
create or replace function public.quiniela_publica(p_jornada text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  j public.quiniela_jornadas;
  cerrada boolean;
  v jsonb;
  alias_de jsonb;
begin
  if p_jornada is not null then
    select * into j from public.quiniela_jornadas where id = p_jornada;
  end if;
  if j.id is null then  -- la abierta que cierra antes; si no hay, la última cerrada
    select * into j from public.quiniela_jornadas where cierre > now() order by cierre asc limit 1;
  end if;
  if j.id is null then
    select * into j from public.quiniela_jornadas order by cierre desc limit 1;
  end if;
  if j.id is null then
    return jsonb_build_object('ahora', now(), 'gestor', public.quiniela_es_gestor(), 'jornadas', '[]'::jsonb, 'jornada', null);
  end if;
  cerrada := now() >= j.cierre;
  v := public.quiniela_veredicto(j.id);
  select coalesce(jsonb_object_agg(localizador, alias), '{}'::jsonb) into alias_de from public.quiniela_boletos where jornada_id = j.id;

  return jsonb_build_object(
    'ahora', now(),
    'gestor', public.quiniela_es_gestor(),
    'jornadas', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'cierre', cierre) order by cierre desc), '[]'::jsonb)
                 from public.quiniela_jornadas),
    'jornada', jsonb_build_object(
      'id', j.id, 'nombre', j.nombre, 'cierre', j.cierre, 'cerrada', cerrada,
      'partidos', j.partidos, 'resultados', j.resultados, 'exacto', j.exacto, 'patrocinador', j.patrocinador,
      'participantes', (select count(*) from public.quiniela_boletos where jornada_id = j.id)),
    'veredicto', jsonb_build_object(
      'estado', v ->> 'estado',
      'motivo', v ->> 'motivo',
      'ganador', alias_de ->> (v ->> 'ganador'),
      'plenos', (select count(*) from jsonb_array_elements_text(coalesce(v -> 'plenos', '[]'::jsonb))),
      'empatados', (select coalesce(jsonb_agg(alias_de ->> x order by alias_de ->> x), '[]'::jsonb) from jsonb_array_elements_text(coalesce(v -> 'pool', '[]'::jsonb)) x),
      'fecha_sorteo', v -> 'fecha_sorteo'),
    'clasificacion', case when cerrada then
        (select coalesce(jsonb_agg(jsonb_build_object('alias', q.alias, 'aciertos', q.aciertos, 'validos', q.validos, 'pleno', q.pleno,
                                                      'exacto', q.exacto, 'exacto_ok', q.exacto_ok, 'picks', q.picks)
                                   order by q.aciertos desc, q.exacto_ok desc, lower(q.alias)), '[]'::jsonb)
         from public.quiniela_puntuar(j.id) q)
      else
        (select coalesce(jsonb_agg(jsonb_build_object('alias', b.alias) order by b.created_at), '[]'::jsonb)
         from public.quiniela_boletos b where b.jornada_id = j.id)
      end,
    'acumulada', (
      select coalesce(jsonb_agg(jsonb_build_object('alias', t.alias, 'jornadas', t.jornadas, 'aciertos', t.aciertos, 'plenos', t.plenos)
                                order by t.aciertos desc, t.plenos desc, lower(t.alias)), '[]'::jsonb)
      from (
        select (array_agg(q.alias order by jj.cierre desc))[1] as alias, count(*)::int as jornadas,
               sum(q.aciertos)::int as aciertos, count(*) filter (where q.pleno)::int as plenos
        from public.quiniela_jornadas jj
        cross join lateral public.quiniela_puntuar(jj.id) q
        where jj.cierre <= now()
        group by lower(q.email)
        order by 3 desc
        limit 50
      ) t)
  );
end
$$;

-- Enviar o cambiar una quiniela. Devuelve el localizador.
create or replace function public.quiniela_enviar(p_jornada text, p_alias text, p_email text, p_picks jsonb, p_exacto jsonb, p_localizador text default null)
returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  j public.quiniela_jornadas;
  a text := btrim(coalesce(p_alias, ''));
  e text := lower(btrim(coalesce(p_email, '')));
  loc text := upper(btrim(coalesce(p_localizador, '')));
  ids text[];
  v_picks jsonb;
  v_ex jsonb;
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  intentos int := 0;
  existente public.quiniela_boletos;
begin
  select * into j from public.quiniela_jornadas where id = p_jornada for share;
  if j.id is null then raise exception 'Esa jornada no existe' using errcode = '22023'; end if;
  if now() >= j.cierre then raise exception 'La jornada está cerrada: ya no se pueden enviar ni cambiar quinielas' using errcode = '22023'; end if;
  if loc <> '' then
    select * into existente from public.quiniela_boletos where localizador = loc and jornada_id = p_jornada;
    if existente.localizador is null then
      raise exception 'No hay ninguna quiniela de esta jornada con ese localizador' using errcode = '22023';
    end if;
    if e = '' then e := existente.email; end if;  -- al cambiarla no hace falta volver a escribir el email
  end if;
  if char_length(a) < 2 or char_length(a) > 20 or a ~ '[<>]' then
    raise exception 'El alias tiene que tener entre 2 y 20 letras' using errcode = '22023';
  end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(e) > 120 then
    raise exception 'El email no es válido' using errcode = '22023';
  end if;

  select array_agg(p ->> 'id') into ids from jsonb_array_elements(j.partidos) p;
  if jsonb_typeof(p_picks) <> 'object' then raise exception 'Faltan partidos por marcar' using errcode = '22023'; end if;
  select jsonb_object_agg(x, p_picks ->> x) into v_picks from unnest(ids) x;
  if exists (select 1 from unnest(ids) x where coalesce(p_picks ->> x, '') not in ('1', 'X', '2')) then
    raise exception 'Faltan partidos por marcar' using errcode = '22023';
  end if;
  begin
    v_ex := jsonb_build_object('local', (p_exacto ->> 'local')::int, 'visitante', (p_exacto ->> 'visitante')::int);
  exception when others then
    raise exception 'Pon el resultado exacto del primer partido' using errcode = '22023';
  end;
  if (v_ex ->> 'local') is null or (v_ex ->> 'visitante') is null
     or (v_ex ->> 'local')::int not between 0 and 30 or (v_ex ->> 'visitante')::int not between 0 and 30 then
    raise exception 'Pon el resultado exacto del primer partido' using errcode = '22023';
  end if;

  begin
    if loc <> '' then
      update public.quiniela_boletos set alias = a, email = e, picks = v_picks, exacto = v_ex, updated_at = now()
        where localizador = loc;
      return jsonb_build_object('localizador', loc, 'nueva', false);
    end if;
    loop
      loc := 'FER-' || (select string_agg(substr(alfabeto, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 5));
      exit when not exists (select 1 from public.quiniela_boletos where localizador = loc);
      intentos := intentos + 1;
      if intentos > 20 then raise exception 'No se ha podido crear el localizador, prueba otra vez'; end if;
    end loop;
    insert into public.quiniela_boletos (localizador, jornada_id, alias, email, picks, exacto)
      values (loc, p_jornada, a, e, v_picks, v_ex);
  exception when unique_violation then
    if exists (select 1 from public.quiniela_boletos where jornada_id = p_jornada and lower(email) = e and localizador <> loc) then
      raise exception 'Ya hay una quiniela con ese email en esta jornada. Para cambiarla, ábrela con tu localizador.' using errcode = '23505';
    end if;
    raise exception 'Ese alias ya está cogido en esta jornada. Prueba con otro.' using errcode = '23505';
  end;
  return jsonb_build_object('localizador', loc, 'nueva', true);
end
$$;

-- Ver la propia quiniela con el localizador (el email sale tapado)
create or replace function public.quiniela_ver(p_localizador text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'localizador', q.localizador, 'jornada', b.jornada_id, 'alias', q.alias, 'picks', q.picks, 'exacto', q.exacto,
    'email', regexp_replace(q.email, '^(.)[^@]*', '\1•••'),
    'aciertos', q.aciertos, 'validos', q.validos, 'pleno', q.pleno, 'exacto_ok', q.exacto_ok)
  from public.quiniela_boletos b
  cross join lateral public.quiniela_puntuar(b.jornada_id) q
  where b.localizador = upper(btrim(p_localizador)) and q.localizador = b.localizador
$$;

-- 4. Gestión (administrador y coordinador) ----------------------------------------------------
create or replace function public.quiniela_admin_guardar(p jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  cur public.quiniela_jornadas;
  logo text := coalesce(p -> 'patrocinador' ->> 'logo', '');
  enlace text := coalesce(p -> 'patrocinador' ->> 'enlace', '');
begin
  perform public.quiniela_exige_gestor();
  if coalesce(p ->> 'id', '') !~ '^[a-z0-9-]{3,40}$' then raise exception 'Identificador de jornada no válido' using errcode = '22023'; end if;
  if char_length(btrim(coalesce(p ->> 'nombre', ''))) < 2 then raise exception 'Ponle nombre a la jornada' using errcode = '22023'; end if;
  if jsonb_typeof(p -> 'partidos') <> 'array' or jsonb_array_length(p -> 'partidos') not between 1 and 20 then
    raise exception 'La jornada tiene que tener entre 1 y 20 partidos' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p -> 'partidos') x
             where coalesce(x ->> 'id', '') = '' or coalesce(x ->> 'local', '') = '' or coalesce(x ->> 'visitante', '') = '') then
    raise exception 'A algún partido le falta el equipo local o el visitante' using errcode = '22023';
  end if;
  if (select count(distinct x ->> 'id') from jsonb_array_elements(p -> 'partidos') x) <> jsonb_array_length(p -> 'partidos') then
    raise exception 'Hay partidos repetidos' using errcode = '22023';
  end if;
  if char_length(logo) > 400000 or (logo <> '' and logo !~ '^data:image/(png|jpeg|webp);base64,') then
    raise exception 'El logo no es válido o es demasiado grande' using errcode = '22023';
  end if;
  if enlace <> '' and enlace !~ '^https://' then raise exception 'El enlace del patrocinador tiene que empezar por https://' using errcode = '22023'; end if;

  select * into cur from public.quiniela_jornadas where id = p ->> 'id' for update;
  if cur.id is not null
     and exists (select 1 from public.quiniela_boletos where jornada_id = cur.id)
     and (select jsonb_agg(x ->> 'id' order by x ->> 'id') from jsonb_array_elements(cur.partidos) x)
         is distinct from (select jsonb_agg(x ->> 'id' order by x ->> 'id') from jsonb_array_elements(p -> 'partidos') x) then
    raise exception 'Ya hay quinielas enviadas en esta jornada: no se pueden quitar ni añadir partidos' using errcode = '22023';
  end if;

  insert into public.quiniela_jornadas (id, nombre, cierre, partidos, patrocinador)
    values (p ->> 'id', btrim(p ->> 'nombre'), (p ->> 'cierre')::timestamptz, p -> 'partidos', coalesce(p -> 'patrocinador', '{}'::jsonb))
  on conflict (id) do update set nombre = excluded.nombre, cierre = excluded.cierre, partidos = excluded.partidos,
    patrocinador = excluded.patrocinador, updated_at = now();
  return jsonb_build_object('ok', true, 'id', p ->> 'id');
end
$$;

create or replace function public.quiniela_admin_resultados(p_jornada text, p_resultados jsonb, p_exacto jsonb) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  ex jsonb := null;
begin
  perform public.quiniela_exige_gestor();
  if jsonb_typeof(p_resultados) <> 'object'
     or exists (select 1 from jsonb_each_text(p_resultados) r where r.value not in ('1', 'X', '2', 'S')) then
    raise exception 'Resultados no válidos' using errcode = '22023';
  end if;
  if p_exacto is not null and jsonb_typeof(p_exacto) = 'object' and (p_exacto ->> 'local') is not null and (p_exacto ->> 'visitante') is not null then
    ex := jsonb_build_object('local', (p_exacto ->> 'local')::int, 'visitante', (p_exacto ->> 'visitante')::int);
  end if;
  update public.quiniela_jornadas set resultados = p_resultados, exacto = ex, updated_at = now() where id = p_jornada;
  if not found then raise exception 'Esa jornada no existe' using errcode = '22023'; end if;
  return jsonb_build_object('ok', true);
end
$$;

create or replace function public.quiniela_admin_sorteo(p_jornada text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  v jsonb;
  pool text[];
  ganador text;
begin
  perform public.quiniela_exige_gestor();
  perform 1 from public.quiniela_jornadas where id = p_jornada for update;
  v := public.quiniela_veredicto(p_jornada);
  if v ->> 'estado' <> 'sorteo_pendiente' then
    raise exception 'Esta jornada no necesita sorteo' using errcode = '22023';
  end if;
  select array_agg(x order by x) into pool from jsonb_array_elements_text(v -> 'pool') x;
  ganador := pool[1 + floor(random() * cardinality(pool))::int];
  update public.quiniela_jornadas
    set sorteo = jsonb_build_object('entre', to_jsonb(pool), 'ganador', ganador, 'fecha', now()), updated_at = now()
    where id = p_jornada;
  return jsonb_build_object('ok', true, 'ganador', (select alias from public.quiniela_boletos where localizador = ganador));
end
$$;

create or replace function public.quiniela_admin_boletos(p_jornada text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.quiniela_exige_gestor();
  return (
    select coalesce(jsonb_agg(jsonb_build_object('localizador', q.localizador, 'alias', q.alias, 'email', q.email,
                                                 'aciertos', q.aciertos, 'validos', q.validos, 'pleno', q.pleno, 'exacto_ok', q.exacto_ok,
                                                 'enviada', q.created_at)
                              order by q.aciertos desc, lower(q.alias)), '[]'::jsonb)
    from public.quiniela_puntuar(p_jornada) q);
end
$$;

create or replace function public.quiniela_admin_jornada(p_jornada text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.quiniela_exige_gestor();
  return (select to_jsonb(j) || jsonb_build_object('veredicto', public.quiniela_veredicto(j.id),
                                                    'participantes', (select count(*) from public.quiniela_boletos where jornada_id = j.id))
          from public.quiniela_jornadas j where id = p_jornada);
end
$$;

create or replace function public.quiniela_admin_borrar_boleto(p_localizador text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.quiniela_exige_gestor();
  delete from public.quiniela_boletos where localizador = upper(btrim(p_localizador));
  return jsonb_build_object('ok', found);
end
$$;

create or replace function public.quiniela_admin_borrar_jornada(p_jornada text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
begin
  perform public.quiniela_exige_gestor();
  delete from public.quiniela_jornadas where id = p_jornada;
  return jsonb_build_object('ok', found);
end
$$;

-- 5. Quién puede llamar a cada función ----------------------------------------------------------
revoke all on function public.quiniela_puntuar(text), public.quiniela_veredicto(text), public.quiniela_exige_gestor() from public, anon, authenticated;
revoke all on function public.quiniela_publica(text), public.quiniela_enviar(text, text, text, jsonb, jsonb, text), public.quiniela_ver(text),
  public.quiniela_es_gestor(), public.quiniela_admin_guardar(jsonb), public.quiniela_admin_resultados(text, jsonb, jsonb),
  public.quiniela_admin_sorteo(text), public.quiniela_admin_boletos(text), public.quiniela_admin_jornada(text),
  public.quiniela_admin_borrar_boleto(text), public.quiniela_admin_borrar_jornada(text) from public;
grant execute on function public.quiniela_publica(text), public.quiniela_enviar(text, text, text, jsonb, jsonb, text),
  public.quiniela_ver(text), public.quiniela_es_gestor() to anon, authenticated;
grant execute on function public.quiniela_admin_guardar(jsonb), public.quiniela_admin_resultados(text, jsonb, jsonb),
  public.quiniela_admin_sorteo(text), public.quiniela_admin_boletos(text), public.quiniela_admin_jornada(text),
  public.quiniela_admin_borrar_boleto(text), public.quiniela_admin_borrar_jornada(text) to authenticated;

notify pgrst, 'reload schema';
