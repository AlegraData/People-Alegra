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

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ pending: [] }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({
      where: { email: user.email! },
    });

    if (!employee) {
      return NextResponse.json({ pending: [] });
    }

    // Encuestas de clima pendientes: misma lógica que el viewer en /api/clima/surveys
    // Incluye encuestas "abiertas a todos" (sin asignaciones) + las asignadas al empleado
    const [{ data: myAssignments }, { data: allAssignments }] = await Promise.all([
      supabaseAdmin.from("climate_survey_assignments").select("survey_id").eq("employee_id", employee.id),
      supabaseAdmin.from("climate_survey_assignments").select("survey_id"),
    ]);

    const myClimaSurveyIds      = new Set((myAssignments  ?? []).map((a) => a.survey_id as string));
    const idsWithAnyAssignment  = new Set((allAssignments ?? []).map((a) => a.survey_id as string));

    const allActiveClima = await prisma.climateSurvey.findMany({
      where: { isActive: true },
      select: { id: true, title: true },
    });

    const visibleClima = allActiveClima.filter(
      (s) => !idsWithAnyAssignment.has(s.id) || myClimaSurveyIds.has(s.id)
    );

    const respondedClima = await prisma.climateSurveyResponse.findMany({
      where: { employeeId: employee.id, surveyId: { in: visibleClima.map((s) => s.id) } },
      select: { surveyId: true },
    });
    const respondedClimaIds = new Set(respondedClima.map((r) => r.surveyId));

    const pendingClima: PendingItem[] = visibleClima
      .filter((s) => !respondedClimaIds.has(s.id))
      .map((s) => ({ id: s.id, title: s.title, type: "clima", href: `/clima/encuesta/${s.id}` }));

    // Encuestas eNPS pendientes (asignadas, sin completar, activas)
    const enpsRaw = await prisma.enpsSurveyAssignment.findMany({
      where: {
        employeeId: employee.id,
        completedAt: null,
        survey: { isActive: true },
      },
      include: { survey: { select: { id: true, title: true } } },
    });

    const pendingEnps: PendingItem[] = enpsRaw.map((a) => ({
      id: a.surveyId,
      title: a.survey.title,
      type: "enps",
      href: "/enps",
    }));

    return NextResponse.json({ pending: [...pendingClima, ...pendingEnps] });
  } catch (error) {
    console.error("[GET /api/home/pending]", error);
    return NextResponse.json({ pending: [] });
  }
}
