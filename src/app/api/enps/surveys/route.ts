import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

// Calcula el eNPS usando los 2 valores más altos como promotores y el resto
// de acuerdo al umbral estándar relativo al scoreMax.
function computeEnps(scores: number[], scoreMax = 10): number | null {
  if (scores.length === 0) return null;
  const promoters  = scores.filter((s) => s >= scoreMax - 1).length;
  const detractors = scores.filter((s) => s <= scoreMax - 4).length;
  return Math.round((promoters / scores.length - detractors / scores.length) * 100);
}

// GET: Lista de campañas eNPS según el rol del usuario
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id).single();
    const role = roleData?.role ?? "viewer";

    // ── Admin / Manager: todas las campañas con métricas ─────────────────────
    if (role === "admin" || role === "manager") {
      const surveys = await prisma.enpsSurvey.findMany({
        include: {
          _count: { select: { responses: true, assignments: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const surveyIds = surveys.map((s) => s.id);

      // Scores para calcular eNPS de cada campaña
      const allResponses = surveyIds.length
        ? await prisma.enpsSurveyResponse.findMany({
            where: { surveyId: { in: surveyIds } },
            select: { surveyId: true, score: true },
          })
        : [];

      const scoresBySurvey = new Map<string, number[]>();
      allResponses.forEach((r) => {
        if (!scoresBySurvey.has(r.surveyId)) scoresBySurvey.set(r.surveyId, []);
        scoresBySurvey.get(r.surveyId)!.push(r.score);
      });

      // hasResponded para cuando el admin participa
      let respondedIds = new Set<string>();
      const employee = await prisma.employee.findUnique({ where: { email: user.email! } });
      if (employee && surveyIds.length) {
        const mine = await prisma.enpsSurveyResponse.findMany({
          where: { employeeId: employee.id, surveyId: { in: surveyIds } },
          select: { surveyId: true },
        });
        respondedIds = new Set(mine.map((r) => r.surveyId));
      }

      return NextResponse.json(
        surveys.map((s) => ({
          ...s,
          responsesCount:   s._count.responses,
          assignmentsCount: s._count.assignments,
          enpsScore:        computeEnps(scoresBySurvey.get(s.id) ?? [], s.scoreMax),
          hasResponded:     respondedIds.has(s.id),
        }))
      );
    }

    // ── Viewer: solo campañas asignadas a este empleado ───────────────────────
    const employee = await prisma.employee.findUnique({ where: { email: user.email! } });
    if (!employee) return NextResponse.json([]);

    const myAssignments = await prisma.enpsSurveyAssignment.findMany({
      where: { employeeId: employee.id },
      select: { surveyId: true },
    });
    const myIds = myAssignments.map((a) => a.surveyId);

    // Encuestas sin asignaciones (abiertas a todos)
    const surveysWithAssignments = await prisma.enpsSurveyAssignment.groupBy({
      by: ["surveyId"],
    });
    const idsWithAnyAssignment = new Set(surveysWithAssignments.map((a) => a.surveyId));

    const allActive = await prisma.enpsSurvey.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });

    const visible = allActive.filter(
      (s) => !idsWithAnyAssignment.has(s.id) || myIds.includes(s.id)
    );
    const visibleIds = visible.map((s) => s.id);

    const myResponses = await prisma.enpsSurveyResponse.findMany({
      where: { employeeId: employee.id, surveyId: { in: visibleIds } },
      select: { surveyId: true },
    });
    const respondedIds = new Set(myResponses.map((r) => r.surveyId));

    return NextResponse.json(
      visible.map((s) => ({
        ...s,
        responsesCount:   0,
        assignmentsCount: 0,
        enpsScore:        null,
        hasResponded:     respondedIds.has(s.id),
      }))
    );
  } catch (error) {
    console.error("[GET /api/enps/surveys]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST: Crear campaña eNPS (admin)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id).single();
    const globalRole = roleData?.role ?? "viewer";
    const { data: moduleRoleData } = await supabaseAdmin
      .from("user_module_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("module", "enps")
      .single();
    const effectiveRole = moduleRoleData?.role ?? globalRole;
    if (effectiveRole !== "admin") {
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
    }

    const body = await request.json();
    const { title, description, followUpQuestion, participantIds, scoreMin, scoreMax, scoreLabels } = body;

    if (!title?.trim())
      return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
    if (!Array.isArray(participantIds) || participantIds.length === 0)
      return NextResponse.json({ error: "Se requiere al menos un participante" }, { status: 400 });

    const survey = await prisma.enpsSurvey.create({
      data: {
        title:            title.trim(),
        description:      description?.trim() || null,
        followUpQuestion: followUpQuestion?.trim() || null,
        isActive:         true,
        scoreMin:         typeof scoreMin === "number" ? scoreMin : 0,
        scoreMax:         typeof scoreMax === "number" ? scoreMax : 10,
        scoreLabels:      Array.isArray(scoreLabels) ? scoreLabels : undefined,
      },
    });

    await prisma.enpsSurveyAssignment.createMany({
      data: (participantIds as string[]).map((employeeId) => ({
        surveyId:   survey.id,
        employeeId,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json(
      {
        ...survey,
        responsesCount:   0,
        assignmentsCount: participantIds.length,
        enpsScore:        null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/enps/surveys]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
