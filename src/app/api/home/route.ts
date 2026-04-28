export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import prisma from "@/lib/prisma";
import type { PendingItem } from "./pending/route";

const ROLE_RANK: Record<string, number> = { viewer: 0, manager: 1, admin: 2 };

// ── Fetchers de pendientes por módulo ──────────────────────────────────────
// Para agregar un nuevo módulo al home: crear la función y añadirla a PENDING_FETCHERS.

async function fetchClimaPending(employeeId: string, _userEmail: string): Promise<PendingItem[]> {
  const [{ data: mine }, { data: all }] = await Promise.all([
    supabaseAdmin.from("climate_survey_assignments").select("survey_id").eq("employee_id", employeeId),
    supabaseAdmin.from("climate_survey_assignments").select("survey_id"),
  ]);

  const myIds  = new Set((mine ?? []).map((a: any) => a.survey_id as string));
  const anyIds = new Set((all  ?? []).map((a: any) => a.survey_id as string));

  const active = await prisma.climateSurvey.findMany({
    where: { isActive: true },
    select: { id: true, title: true },
  });
  const visible = active.filter((s) => !anyIds.has(s.id) || myIds.has(s.id));

  const responded = await prisma.climateSurveyResponse.findMany({
    where: { employeeId, surveyId: { in: visible.map((s) => s.id) } },
    select: { surveyId: true },
  });
  const done = new Set(responded.map((r) => r.surveyId));

  return visible
    .filter((s) => !done.has(s.id))
    .map((s) => ({ id: s.id, title: s.title, type: "clima" as const, href: `/clima/encuesta/${s.id}` }));
}

async function fetchEnpsPending(employeeId: string, _userEmail: string): Promise<PendingItem[]> {
  const rows = await prisma.enpsSurveyAssignment.findMany({
    where: { employeeId, completedAt: null, survey: { isActive: true } },
    include: { survey: { select: { id: true, title: true } } },
  });
  return rows.map((a) => ({
    id: a.surveyId,
    title: a.survey.title,
    type: "enps" as const,
    href: "/enps",
  }));
}

async function fetch360Pending(_employeeId: string, userEmail: string): Promise<PendingItem[]> {
  // Una entrada por evaluación aunque el usuario tenga múltiples asignaciones dentro de ella
  const assignments = await prisma.evaluation360Assignment.findMany({
    where: {
      evaluatorEmail: userEmail,
      status: { not: "submitted" },
      evaluation: { status: "active" },
    },
    select: {
      evaluationId: true,
      evaluation: { select: { id: true, title: true } },
    },
    distinct: ["evaluationId"],
  });
  return assignments.map((a) => ({
    id: a.evaluation.id,
    title: a.evaluation.title,
    type: "360" as const,
    href: "/evaluaciones360",
  }));
}

type PendingFetcher = (employeeId: string, userEmail: string) => Promise<PendingItem[]>;

// Registro central: cada módulo que quiera aparecer en el home registra su fetcher aquí.
const PENDING_FETCHERS: Partial<Record<string, PendingFetcher>> = {
  clima: fetchClimaPending,
  enps:  fetchEnpsPending,
  "360": fetch360Pending,
};

// ── Handler ────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ modules: [], pending: [] }, { status: 401 });

    // Una sola consulta a module_config — compartida por tarjetas y pendientes
    const [{ data: roleData }, { data: modulesData, error: modulesError }] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single(),
      supabaseAdmin
        .from("module_config")
        .select("id, label, description, is_active, sort_order, min_role")
        .eq("is_active", true)
        .order("sort_order"),
    ]);

    if (modulesError) return NextResponse.json({ modules: [], pending: [] }, { status: 500 });

    const userRank = ROLE_RANK[roleData?.role ?? "viewer"] ?? 0;
    const modules = (modulesData ?? []).filter(
      (m: any) => userRank >= (ROLE_RANK[m.min_role ?? "viewer"] ?? 0)
    );

    // Si no hay registro de empleado devolvemos los módulos igualmente (para mostrar las tarjetas)
    const employee = await prisma.employee.findUnique({ where: { email: user.email! } });
    if (!employee) return NextResponse.json({ modules, pending: [] });

    // Pendientes de cada módulo activo que tenga fetcher registrado — fallos individuales no bloquean el resto
    const tasks = modules
      .filter((m: any) => m.id in PENDING_FETCHERS)
      .map((m: any) =>
        PENDING_FETCHERS[m.id]!(employee.id, employee.email).catch(() => [] as PendingItem[])
      );

    const results = await Promise.all(tasks);
    return NextResponse.json({ modules, pending: results.flat() });
  } catch (error) {
    console.error("[GET /api/home]", error);
    return NextResponse.json({ modules: [], pending: [] });
  }
}
