import prisma from "@/lib/prisma";

/**
 * Acceso jerárquico descendente a reportes 360° — un empleado de esta lista
 * es subordinado (directo o de cualquier nivel) del líder consultado, según
 * la jerarquía REAL de hoy en `v_hc_activo_compartida` (512 empleados
 * activos, columna `lider_correo` apuntando al correo del líder directo).
 * Es una fuente distinta a la de `/api/organigrama` (esa usa la tabla
 * `employee_leadership` con UUIDs) — esta vista ya trae los emails
 * resueltos, sin necesitar un join extra.
 */
export interface DescendantEmployee {
  correo: string;
  nombre: string | null;
  cargo: string | null;
  technicalTeam: string | null;
  /** 1 = reporta directo al líder consultado, 2 = reporta a uno de esos, etc. */
  nivel: number;
}

interface DescendantRow {
  correo: string;
  nombre: string | null;
  cargo: string | null;
  technical_team: string | null;
  nivel: number;
}

/**
 * Devuelve TODO el árbol de subordinados de `leaderEmail` (todos los
 * niveles) — vacío si esa persona no lidera a nadie.
 *
 * Detalles de la CTE, cada uno corrigiendo un hueco real encontrado en
 * auditoría antes de escribir esto:
 * - Normaliza `LOWER(TRIM(...))` tanto en el caso base como en la condición
 *   del JOIN recursivo (no solo en el parámetro de entrada) — sin esto, una
 *   inconsistencia de mayúsculas/espacios en los datos de RRHH corta la
 *   recursión en silencio y un líder legítimo pierde acceso a una rama
 *   entera de su equipo, sin ningún error visible.
 * - `CYCLE correo SET is_cycle USING path` (nativo de Postgres 14+,
 *   confirmado 17.6 en producción): corta cualquier ciclo real en los datos
 *   (ej. A dice que su líder es B y B dice que su líder es A) sin depender
 *   solo de un tope de profundidad.
 * - Excluye explícitamente al propio `leaderEmail` del resultado — con un
 *   ciclo A↔B, sin esta línea, un líder podría aparecer como "subordinado
 *   de sí mismo" y verse a sí mismo listado como "reporte de su equipo".
 * - Selección de columnas explícita (nunca `SELECT *`): si mañana se agrega
 *   una columna nueva a la vista (ej. cualquier dato sensible de RRHH), no
 *   se propaga sin querer hasta la respuesta HTTP de ningún endpoint.
 */
export async function getDescendantEmployees(leaderEmail: string): Promise<DescendantEmployee[]> {
  const email = leaderEmail.trim().toLowerCase();
  if (!email) return [];

  const rows = await prisma.$queryRaw<DescendantRow[]>`
    WITH RECURSIVE subordinados AS (
      SELECT
        lower(trim(correo)) as correo,
        nombre,
        cargo,
        technical_team,
        lower(trim(lider_correo)) as lider_correo,
        1 as nivel
      FROM v_hc_activo_compartida
      WHERE lower(trim(lider_correo)) = ${email}

      UNION ALL

      SELECT
        lower(trim(v.correo)),
        v.nombre,
        v.cargo,
        v.technical_team,
        lower(trim(v.lider_correo)),
        s.nivel + 1
      FROM v_hc_activo_compartida v
      INNER JOIN subordinados s ON lower(trim(v.lider_correo)) = s.correo
    )
    CYCLE correo SET is_cycle USING path
    SELECT correo, nombre, cargo, technical_team, nivel
    FROM subordinados
    WHERE NOT is_cycle AND correo <> ${email}
  `;

  return rows.map((r) => ({
    correo: r.correo,
    nombre: r.nombre,
    cargo: r.cargo,
    technicalTeam: r.technical_team,
    nivel: r.nivel,
  }));
}

/** ¿`leaderEmail` es líder (de cualquier nivel) de `targetEmail`? */
export async function isDescendantOf(leaderEmail: string, targetEmail: string): Promise<boolean> {
  const target = targetEmail.trim().toLowerCase();
  if (!target) return false;
  const team = await getDescendantEmployees(leaderEmail);
  return team.some((m) => m.correo === target);
}
