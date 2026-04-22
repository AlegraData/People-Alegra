export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

// GET /api/clima/surveys/[id]/take
// Valida que el usuario autenticado pueda responder esta encuesta y retorna sus datos.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id } = await params;

    const survey = await prisma.climateSurvey.findUnique({ where: { id } });
    if (!survey)
      return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });

    if (!survey.isActive)
      return NextResponse.json({ error: "Esta encuesta ya no está disponible.", code: "INACTIVE" }, { status: 403 });

    const employee = await prisma.employee.findUnique({ where: { email: user.email! } });
    if (!employee)
      return NextResponse.json({ error: "No tienes acceso a esta encuesta.", code: "NO_EMPLOYEE" }, { status: 403 });

    // Si la encuesta tiene participantes asignados, el usuario debe estar en la lista
    const { count: totalAssignments } = await supabaseAdmin
      .from("climate_survey_assignments")
      .select("*", { count: "exact", head: true })
      .eq("survey_id", id);

    if (totalAssignments && totalAssignments > 0) {
      const { data: assignment } = await supabaseAdmin
        .from("climate_survey_assignments")
        .select("completed_at")
        .eq("survey_id", id)
        .eq("employee_id", employee.id)
        .single();

      if (!assignment)
        return NextResponse.json({ error: "No tienes acceso a esta encuesta.", code: "NOT_ASSIGNED" }, { status: 403 });
    }

    // Verificar si ya respondió
    const existing = await prisma.climateSurveyResponse.findFirst({
      where: { surveyId: id, employeeId: employee.id },
      select: { id: true },
    });

    return NextResponse.json({
      id:           survey.id,
      title:        survey.title,
      description:  survey.description,
      questions:    survey.questions,
      isActive:     survey.isActive,
      introEnabled: survey.introEnabled,
      introMessage: survey.introMessage,
      termsEnabled: survey.termsEnabled,
      termsText:    survey.termsText,
      createdAt:    survey.createdAt,
      responsesCount:   0,
      assignmentsCount: 0,
      hasResponded: !!existing,
    });
  } catch (error) {
    console.error("[GET /api/clima/surveys/[id]/take]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
