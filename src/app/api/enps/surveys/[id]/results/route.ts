export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import type { EnpsCategory } from "@/types/enps";

// Calcula la categoría en función del scoreMax
function scoreToCategory(score: number, scoreMax: number): EnpsCategory {
  if (score >= scoreMax - 1) return "promoter";
  if (score >= scoreMax - 3) return "passive";
  return "detractor";
}

// GET: Resultados detallados de una campaña (admin/manager)
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id).single();
    const role = roleData?.role ?? "viewer";
    if (role !== "admin" && role !== "manager") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const survey = await prisma.enpsSurvey.findUnique({
      where: { id },
      include: {
        _count: { select: { responses: true, assignments: true } },
      },
    });
    if (!survey) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }

    const responses = await prisma.enpsSurveyResponse.findMany({
      where: { surveyId: id },
      include: {
        employee: {
          include: {
            personalInfo: { where: { esActual: true }, take: 1 },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    const scoreMax = survey.scoreMax;
    const scoreMin = survey.scoreMin;

    const scores     = responses.map((r) => r.score);
    const promoters  = scores.filter((s) => s >= scoreMax - 1).length;
    const passives   = scores.filter((s) => s >= scoreMax - 3 && s < scoreMax - 1).length;
    const detractors = scores.filter((s) => s <= scoreMax - 4).length;
    const total      = scores.length;
    const enpsScore  = total > 0
      ? Math.round((promoters / total - detractors / total) * 100)
      : null;

    // Umbrales para mostrar en la UI
    const promoterMin  = scoreMax - 1;
    const passiveMin   = scoreMax - 3;
    const passiveMax   = scoreMax - 2;
    const detractorMax = scoreMax - 4;

    return NextResponse.json({
      survey: {
        ...survey,
        responsesCount:   survey._count.responses,
        assignmentsCount: survey._count.assignments,
        enpsScore,
      },
      total,
      promoters,
      passives,
      detractors,
      score: enpsScore,
      promoterMin,
      passiveMin,
      passiveMax,
      detractorMax,
      responses: responses.map((r) => {
        const info = r.employee.personalInfo[0];
        const fullName = info
          ? [info.nombres, info.primerApellido, info.segundoApellido].filter(Boolean).join(" ")
          : r.employee.email;
        return {
          id:             r.id,
          employeeId:     r.employeeId,
          employeeName:   fullName,
          employeeEmail:  r.employee.email,
          score:          r.score,
          category:       scoreToCategory(r.score, scoreMax),
          followUpAnswer: r.followUpAnswer,
          submittedAt:    r.submittedAt,
        };
      }),
    });
  } catch (error) {
    console.error("[GET /api/enps/surveys/[id]/results]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
