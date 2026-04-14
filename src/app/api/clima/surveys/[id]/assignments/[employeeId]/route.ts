import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

// DELETE: Quitar participante de la encuesta (elimina asignación y su respuesta si existe)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; employeeId: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id: surveyId, employeeId } = await params;

    // Eliminar respuesta si existe
    await prisma.climateSurveyResponse.deleteMany({
      where: { surveyId, employeeId },
    });

    // Eliminar asignación
    await supabaseAdmin
      .from("climate_survey_assignments")
      .delete()
      .eq("survey_id", surveyId)
      .eq("employee_id", employeeId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/clima/surveys/[id]/assignments/[employeeId]]", error);
    return NextResponse.json({ error: "Error interno al eliminar participante" }, { status: 500 });
  }
}
