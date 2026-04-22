export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import prisma from "@/lib/prisma";

export interface PendingItem {
  id: string;
  title: string;
  type: "clima" | "enps";
  href: string;
}

const ROLE_RANK: Record<string, number> = { viewer: 0, manager: 1, admin: 2 };

async function getVisibleModuleIds(userId: string): Promise<Set<string>> {
  const [{ data: roleData }, { data: modules }] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).single(),
    supabaseAdmin.from("module_config").select("id, min_role").eq("is_active", true),
  ]);

  const userRank = ROLE_RANK[roleData?.role ?? "viewer"] ?? 0;

  return new Set(
    (modules ?? [])
      .filter((m) => userRank >= (ROLE_RANK[m.min_role ?? "viewer"] ?? 0))
      .map((m) => m.id as string)
  );
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ pending: [] }, { status: 401 });

    const [employee, visibleModules] = await Promise.all([
      prisma.employee.findUnique({ where: { email: user.email! } }),
      getVisibleModuleIds(user.id),
    ]);

    if (!employee) return NextResponse.json({ pending: [] });

    const tasks: Promise<PendingItem[]>[] = [];

    // ── Clima ────────────────────────────────────────────────────────────────
    if (visibleModules.has("clima")) {
      tasks.push(
        (async (): Promise<PendingItem[]> => {
          const [{ data: myAssignments }, { data: allAssignments }] = await Promise.all([
            supabaseAdmin.from("climate_survey_assignments").select("survey_id").eq("employee_id", employee.id),
            supabaseAdmin.from("climate_survey_assignments").select("survey_id"),
          ]);

          const myIds     = new Set((myAssignments  ?? []).map((a) => a.survey_id as string));
          const anyIds    = new Set((allAssignments ?? []).map((a) => a.survey_id as string));

          const allActive = await prisma.climateSurvey.findMany({
            where: { isActive: true },
            select: { id: true, title: true },
          });

          const visible = allActive.filter((s) => !anyIds.has(s.id) || myIds.has(s.id));

          const responded = await prisma.climateSurveyResponse.findMany({
            where: { employeeId: employee.id, surveyId: { in: visible.map((s) => s.id) } },
            select: { surveyId: true },
          });
          const respondedIds = new Set(responded.map((r) => r.surveyId));

          return visible
            .filter((s) => !respondedIds.has(s.id))
            .map((s) => ({ id: s.id, title: s.title, type: "clima", href: `/clima/encuesta/${s.id}` }));
        })()
      );
    }

    // ── eNPS ─────────────────────────────────────────────────────────────────
    if (visibleModules.has("enps")) {
      tasks.push(
        (async (): Promise<PendingItem[]> => {
          const rows = await prisma.enpsSurveyAssignment.findMany({
            where: { employeeId: employee.id, completedAt: null, survey: { isActive: true } },
            include: { survey: { select: { id: true, title: true } } },
          });
          return rows.map((a) => ({
            id: a.surveyId, title: a.survey.title, type: "enps", href: "/enps",
          }));
        })()
      );
    }

    const results = await Promise.all(tasks);
    return NextResponse.json({ pending: results.flat() });
  } catch (error) {
    console.error("[GET /api/home/pending]", error);
    return NextResponse.json({ pending: [] });
  }
}
