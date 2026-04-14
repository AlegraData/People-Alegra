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

    const employee = await prisma.employee.findUnique({
      where: { email: user.email! },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "No se encontró un perfil de empleado asociado a tu cuenta. Contacta al administrador." },
        { status: 404 }
      );
    }

    // Guardar la respuesta
    const response = await prisma.climateSurveyResponse.create({
      data: { surveyId, employeeId: employee.id, answers },
    });

    // Marcar la asignación como completada (si existe)
    await supabaseAdmin
      .from("climate_survey_assignments")
      .update({ completed_at: new Date().toISOString() })
      .eq("survey_id", surveyId)
      .eq("employee_id", employee.id);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Ya respondiste esta encuesta." }, { status: 409 });
    }
    console.error("[POST /api/clima/responses]", error);
    return NextResponse.json({ error: "Error interno al guardar las respuestas" }, { status: 500 });
  }
}

// GET: Obtener respuestas para exportación
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const surveyId = searchParams.get("surveyId");

    const responses = await prisma.climateSurveyResponse.findMany({
      where: surveyId ? { surveyId } : {},
      include: { employee: { select: { email: true } } },
      orderBy: { submittedAt: "desc" },
    });

    return NextResponse.json(responses);
  } catch (error) {
    console.error("[GET /api/clima/responses]", error);
    return NextResponse.json({ error: "Error interno al obtener las respuestas" }, { status: 500 });
  }
}
