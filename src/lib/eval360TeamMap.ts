/**
 * Resuelve el equipo (Technical Team) de cada persona involucrada en una
 * encuesta 360°: match contra el directorio activo, con fallback al campo
 * `team` guardado en la propia asignación (para personas que ya no están en
 * el directorio). Mismo patrón usado en results/route.ts, participation/route.ts,
 * reports/[email]/route.ts y reports/analysis/route.ts.
 */
import { supabaseAdmin } from "@/utils/supabase/admin";

export async function buildTeamByEmail(
  submitted: { evaluatorEmail: string; evaluateeEmail: string; team?: string | null }[]
): Promise<Map<string, string | null>> {
  const allEmails = [...new Set(submitted.flatMap((a) => [a.evaluatorEmail, a.evaluateeEmail]))];
  const { data: teamRows } = await supabaseAdmin
    .from("v_empleados_activos_completa").select("correo, equipo").in("correo", allEmails);
  const teamMap = new Map(
    (teamRows ?? []).map((r: { correo: string; equipo: string | null }) => [r.correo, r.equipo ?? null])
  );
  const storedTeamMap = new Map<string, string>();
  submitted.forEach((a) => { if (a.team && !storedTeamMap.has(a.evaluateeEmail)) storedTeamMap.set(a.evaluateeEmail, a.team); });
  const teamByEmail = new Map<string, string | null>();
  allEmails.forEach((e) => teamByEmail.set(e, teamMap.get(e) ?? storedTeamMap.get(e) ?? null));
  return teamByEmail;
}
