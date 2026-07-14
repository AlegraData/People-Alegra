-- ============================================================================
-- LOCKDOWN DE SEGURIDAD — cerrar el acceso anónimo/autenticado a la API REST
-- ============================================================================
-- Contexto:
--   El proyecto Supabase (tuxthsukoeytvzqhspnb) es COMPARTIDO por varias apps
--   (People Hub, Portal de Novedades y ALMA). Todas acceden a los datos con la
--   service_role key (que tiene BYPASSRLS) y/o vía Prisma con una conexión
--   directa como rol `postgres` (que también tiene BYPASSRLS). La anon key solo
--   se usa para autenticación (schema `auth`), NUNCA para leer tablas de `public`.
--
--   Por eso habilitar RLS y revocar el acceso de anon/authenticated NO afecta el
--   funcionamiento de las apps: solo cierra el hueco de la API REST pública, que
--   hoy expone tablas como `employees` (1297 filas) y `employee_personal_info`
--   (1279 filas) a cualquiera en internet con solo la anon key.
--
-- Ejecutar en: Supabase Dashboard -> SQL Editor (con el proyecto compartido).
-- Idempotente: se puede correr varias veces sin efectos adversos.
-- Reversible por tabla:  alter table public.<tabla> disable row level security;
-- ============================================================================

-- ----------------------------------------------------------------------------
-- SECCIÓN A — Habilitar RLS en TODAS las tablas base de `public`
-- Sin políticas => deny-by-default: anon y authenticated obtienen 0 filas y no
-- pueden escribir. service_role y postgres siguen operando con normalidad.
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table public.%I enable row level security;', r.tablename);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- SECCIÓN B — Cerrar las VISTAS de `public`
-- RLS no aplica a vistas (se ejecutan con privilegios del owner). Se cierran
-- revocando el privilegio de lectura a anon/authenticated. Cubre, por ejemplo,
-- `v_empleados_activos_completa`.
-- ----------------------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select table_name from information_schema.views where table_schema = 'public'
  loop
    execute format('revoke all on public.%I from anon, authenticated;', r.table_name);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- SECCIÓN C — Defensa en profundidad
-- Revoca privilegios directos de anon/authenticated sobre tablas, secuencias y
-- funciones de `public`, y ajusta los privilegios por defecto para objetos
-- futuros. Con esto, aunque a alguien se le olvide activar RLS en una tabla
-- nueva, la API pública no la expondrá.
-- ----------------------------------------------------------------------------
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

-- Privilegios por defecto para objetos creados a futuro por el rol postgres.
alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- ----------------------------------------------------------------------------
-- VERIFICACIÓN (opcional — ejecutar por separado para revisar el resultado)
-- ----------------------------------------------------------------------------
-- Tablas que AÚN tengan RLS deshabilitado (debería devolver 0 filas):
--   select tablename from pg_tables
--   where schemaname = 'public' and rowsecurity = false;
--
-- Confirmar desde fuera (reemplazar <ANON_KEY>):
--   curl -s -o /dev/null -w "%{http_code}\n" \
--     "https://tuxthsukoeytvzqhspnb.supabase.co/rest/v1/employees?select=id&limit=1" \
--     -H "apikey: <ANON_KEY>" -H "Authorization: Bearer <ANON_KEY>"
--   Debe responder 401 (o 200 con []), NUNCA 200 con filas.
-- ============================================================================
