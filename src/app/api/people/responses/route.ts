export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

// POST: Guardar respuestas y marcar la asignación como completada
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { surveyId, answers } = body;

    if (!surveyId || !answers) {
      return NextResponse.json({ error: "Faltan datos requeridos: surveyId y answers" }, { status: 400 });
    }

    const employee = await prisma.employee.findUnique({ where: { email: user.email! } });
    if (!employee) {
      return NextResponse.json(
        { error: "No se encontró un perfil de empleado asociado a tu cuenta." },
        { status: 404 }
      );
    }

    const response = await prisma.peopleSurveyResponse.create({
      data: { surveyId, employeeId: employee.id, answers },
    });

    const { error: updateErr } = await supabaseAdmin
      .from("people_survey_assignments")
      .update({ completed_at: new Date().toISOString() })
      .eq("survey_id", surveyId)
      .eq("employee_id", employee.id);
    if (updateErr) {
      console.error("[POST /api/people/responses] completed_at update failed:", updateErr);
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ya respondiste esta encuesta." }, { status: 409 });
    }
    console.error("[POST /api/people/responses]", error);
    return NextResponse.json({ error: "Error interno al guardar las respuestas" }, { status: 500 });
  }
}

// GET: Obtener respuestas para exportación / resultados
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get("surveyId");

    const responses = await prisma.peopleSurveyResponse.findMany({
      where: surveyId ? { surveyId } : {},
      include: { employee: { select: { email: true } } },
      orderBy: { submittedAt: "desc" },
    });

    return NextResponse.json(responses);
  } catch (error) {
    console.error("[GET /api/people/responses]", error);
    return NextResponse.json({ error: "Error interno al obtener las respuestas" }, { status: 500 });
  }
}
