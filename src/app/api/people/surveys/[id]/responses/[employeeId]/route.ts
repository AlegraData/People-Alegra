export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

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

    await prisma.peopleSurveyResponse.deleteMany({
      where: { surveyId, employeeId },
    });

    await supabaseAdmin
      .from("people_survey_assignments")
      .update({ completed_at: null })
      .eq("survey_id", surveyId)
      .eq("employee_id", employeeId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/people/surveys/[id]/responses/[employeeId]]", error);
    return NextResponse.json({ error: "Error interno al resetear respuesta" }, { status: 500 });
  }
}
