export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

type Ctx = { params: Promise<{ id: string }> };

async function getRole(userId: string) {
  const { data: r } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).single();
  const { data: m } = await supabaseAdmin.from("user_module_roles").select("role").eq("user_id", userId).eq("module", "360").single();
  return m?.role ?? r?.role ?? "viewer";
}

async function buildNameMap(emails: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (emails.length === 0) return map;

  // Primary: employee directory (has proper full names)
  const { data: empRows } = await supabaseAdmin
    .from("v_empleados_activos_completa")
    .select("correo, nombre_completo")
    .in("correo", emails);
  (empRows ?? []).forEach((r: { correo: string; nombre_completo: string | null }) => {
    if (r.nombre_completo) map.set(r.correo, r.nombre_completo);
  });

  // Fallback: user_roles (display name from Google login)
  const missing = emails.filter((e) => !map.has(e));
  if (missing.length > 0) {
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("email, full_name")
      .in("email", missing);
    (roleRows ?? []).forEach((r: { email: string; full_name: string | null }) => {
      if (r.full_name) map.set(r.email, r.full_name);
    });
  }

  return map;
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const role = await getRole(user.id);
    if (!["admin", "manager"].includes(role))
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const assignments = await prisma.evaluation360Assignment.findMany({
      where: { evaluationId: id },
      select: {
        evaluatorEmail: true,
        evaluatorName:  true,
        evaluateeEmail: true,
        evaluateeName:  true,
        team:           true,
        evaluationType: true,
        status:         true,
        submittedAt:    true,
      },
    });

    // Enrich missing names from the directory (retroactive for old imports)
    const missingNameEmails = [
      ...new Set(
        assignments.flatMap((a) => [
          ...(a.evaluatorName ? [] : [a.evaluatorEmail]),
          ...(a.evaluateeName ? [] : [a.evaluateeEmail]),
        ])
      ),
    ];
    const nameMap = await buildNameMap(missingNameEmails);
    const resolveName = (email: string, stored: string | null) =>
      stored || nameMap.get(email) || null;

    // Equipo de cada persona (evaluada o evaluadora): match contra el directorio
    // de empleados, más fresco que el `team` guardado por asignación (que además
    // solo se guarda del lado del evaluado). Cae al team guardado como respaldo.
    const allEmails = [...new Set(assignments.flatMap((a) => [a.evaluatorEmail, a.evaluateeEmail]))];
    const { data: teamRows } = allEmails.length > 0
      ? await supabaseAdmin.from("v_empleados_activos_completa").select("correo, equipo").in("correo", allEmails)
      : { data: [] };
    const teamMap = new Map(
      (teamRows ?? []).map((r: { correo: string; equipo: string | null }) => [r.correo, r.equipo ?? null])
    );
    const storedTeamMap = new Map<string, string>();
    assignments.forEach((a) => {
      if (a.team && !storedTeamMap.has(a.evaluateeEmail)) storedTeamMap.set(a.evaluateeEmail, a.team);
    });
    const resolveTeam = (email: string): string | null =>
      teamMap.get(email) ?? storedTeamMap.get(email) ?? null;

    const total          = assignments.length;
    const submittedList  = assignments.filter((a) => a.status === "submitted");
    const submittedCount = submittedList.length;
    const pendingCount   = total - submittedCount;
    const completionRate = total > 0 ? Math.round((submittedCount / total) * 100) : 0;

    // Timeline grouped by submittedAt day
    const byDay = new Map<string, number>();
    submittedList.forEach((a) => {
      if (a.submittedAt) {
        const day = new Date(a.submittedAt).toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
      }
    });
    let cum = 0;
    const timeline = [...byDay.keys()].sort().map((date) => {
      cum += byDay.get(date)!;
      return { date, daily: byDay.get(date)!, cumulative: cum };
    });

    // By team (del evaluado)
    const teamAggMap = new Map<string, { total: number; submitted: number }>();
    assignments.forEach((a) => {
      const t = resolveTeam(a.evaluateeEmail) || "Sin equipo";
      if (!teamAggMap.has(t)) teamAggMap.set(t, { total: 0, submitted: 0 });
      const e = teamAggMap.get(t)!;
      e.total++;
      if (a.status === "submitted") e.submitted++;
    });
    const byTeam = [...teamAggMap.entries()]
      .map(([team, { total: t, submitted: s }]) => ({
        team, total: t, submitted: s, pending: t - s,
        rate: t > 0 ? Math.round((s / t) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate);

    // By team (del evaluador) — qué tan al día está cada equipo HACIENDO sus evaluaciones,
    // en vez de recibiéndolas.
    const teamAggMapEvaluator = new Map<string, { total: number; submitted: number }>();
    assignments.forEach((a) => {
      const t = resolveTeam(a.evaluatorEmail) || "Sin equipo";
      if (!teamAggMapEvaluator.has(t)) teamAggMapEvaluator.set(t, { total: 0, submitted: 0 });
      const e = teamAggMapEvaluator.get(t)!;
      e.total++;
      if (a.status === "submitted") e.submitted++;
    });
    const byTeamEvaluator = [...teamAggMapEvaluator.entries()]
      .map(([team, { total: t, submitted: s }]) => ({
        team, total: t, submitted: s, pending: t - s,
        rate: t > 0 ? Math.round((s / t) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate);

    // By evaluatee
    const evalMap = new Map<string, { name: string | null; team: string | null; total: number; received: number }>();
    assignments.forEach((a) => {
      if (!evalMap.has(a.evaluateeEmail))
        evalMap.set(a.evaluateeEmail, {
          name: resolveName(a.evaluateeEmail, a.evaluateeName),
          team: resolveTeam(a.evaluateeEmail),
          total: 0, received: 0,
        });
      const e = evalMap.get(a.evaluateeEmail)!;
      e.total++;
      if (a.status === "submitted") e.received++;
    });
    const evaluatees = [...evalMap.entries()]
      .map(([email, { name, team, total: t, received }]) => ({
        email, name, team, total: t, received, pending: t - received,
      }))
      .sort((a, b) => b.pending - a.pending || a.email.localeCompare(b.email));

    // By evaluator
    const evtorMap = new Map<string, { name: string | null; team: string | null; total: number; submitted: number }>();
    assignments.forEach((a) => {
      if (!evtorMap.has(a.evaluatorEmail))
        evtorMap.set(a.evaluatorEmail, {
          name: resolveName(a.evaluatorEmail, a.evaluatorName),
          team: resolveTeam(a.evaluatorEmail),
          total: 0, submitted: 0,
        });
      const e = evtorMap.get(a.evaluatorEmail)!;
      e.total++;
      if (a.status === "submitted") e.submitted++;
    });
    const evaluators = [...evtorMap.entries()]
      .map(([email, { name, team, total: t, submitted: s }]) => ({
        email, name, team, total: t, submitted: s, pending: t - s,
      }))
      .sort((a, b) => b.pending - a.pending || a.email.localeCompare(b.email));

    return NextResponse.json({
      totalAssignments: total,
      submittedCount,
      pendingCount,
      completionRate,
      timeline,
      byTeam,
      byTeamEvaluator,
      evaluatees,
      evaluators,
    });
  } catch (error) {
    console.error("[GET participation]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
