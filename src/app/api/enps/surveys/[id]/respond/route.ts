export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";

// POST: Enviar respuesta eNPS
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const employee = await prisma.employee.findUnique({ where: { email: user.email! } });
    if (!employee) {
      return NextResponse.json({ error: "Empleado no encontrado" }, { status: 404 });
    }

    const survey = await prisma.enpsSurvey.findUnique({ where: { id: surveyId } });
    if (!survey) {
      return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
    }

    const body = await request.json();
    const { score, followUpAnswer } = body;

    if (typeof score !== "number" || score < 0 || score > 10) {
      return NextResponse.json({ error: "Score inválido (0–10)" }, { status: 400 });
    }

    const trimmedFollowUp = followUpAnswer?.trim() || null;
    if (survey.followUpRequired && !trimmedFollowUp) {
      return NextResponse.json({ error: "El comentario es obligatorio para esta encuesta" }, { status: 400 });
    }

    const existing = await prisma.enpsSurveyResponse.findUnique({
      where: { surveyId_employeeId: { surveyId, employeeId: employee.id } },
    });

    // Ya respondió por completo (no falta el comentario obligatorio) → no se puede volver a responder
    if (existing && (!survey.followUpRequired || existing.followUpAnswer?.trim())) {
      return NextResponse.json({ error: "Ya respondiste esta campaña" }, { status: 409 });
    }

    const response = await prisma.$transaction(async (tx) => {
      const res = existing
        ? await tx.enpsSurveyResponse.update({
            where: { id: existing.id },
            data:  { followUpAnswer: trimmedFollowUp },
          })
        : await tx.enpsSurveyResponse.create({
            data: {
              surveyId,
              employeeId:     employee.id,
              score:          Math.round(score),
              followUpAnswer: trimmedFollowUp,
            },
          });

      // Marcar completed_at si existe asignación
      await tx.enpsSurveyAssignment.updateMany({
        where: { surveyId, employeeId: employee.id },
        data:  { completedAt: new Date() },
      });

      return res;
    });

    return NextResponse.json(response, { status: existing ? 200 : 201 });
  } catch (error: unknown) {
    // Unique constraint → ya respondió
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ error: "Ya respondiste esta campaña" }, { status: 409 });
    }
    console.error("[POST /api/enps/surveys/[id]/respond]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
