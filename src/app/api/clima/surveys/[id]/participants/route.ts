import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import type { SurveyParticipant } from "@/types/clima";

// GET: Lista de participantes asignados con su estado de respuesta
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { id: surveyId } = await params;

    // 1. Asignaciones con employee_id y timestamps
    const { data: assignments, error: aErr } = await supabaseAdmin
      .from("climate_survey_assignments")
      .select("employee_id, assigned_at, completed_at")
      .eq("survey_id", surveyId);

    if (aErr || !assignments?.length) {
      return NextResponse.json([]);
    }

    // 2. Emails por UUID
    const employeeIds = assignments.map((a) => a.employee_id as string);
    const { data: employees } = await supabaseAdmin
      .from("employees")
      .select("id, email")
      .in("id", employeeIds);

    const idToEmail = new Map((employees ?? []).map((e) => [e.id as string, e.email as string]));
    const emails = [...idToEmail.values()];

    // 3. Detalles desde la vista
    const { data: empDetails } = emails.length
      ? await supabaseAdmin
          .from("v_empleados_activos_completa")
          .select("correo, nombre_completo, cargo, equipo")
          .in("correo", emails)
      : { data: [] };

    const detailsByEmail = new Map(
      (empDetails ?? []).map((e) => [e.correo as string, e])
    );

    // 4. Respuestas existentes
    const { data: responses } = await supabaseAdmin
      .from("climate_survey_responses")
      .select("id, employee_id")
      .eq("survey_id", surveyId);

    const responseByEmployee = new Map(
      (responses ?? []).map((r) => [r.employee_id as string, r.id as string])
    );

    // 5. Merge
    const participants: SurveyParticipant[] = assignments.map((a) => {
      const email = idToEmail.get(a.employee_id as string) ?? "";
      const detail = detailsByEmail.get(email);
      return {
        employee_id:    a.employee_id as string,
        correo:         email,
        nombre_completo: (detail?.nombre_completo as string) ?? email,
        cargo:          (detail?.cargo as string)  ?? null,
        equipo:         (detail?.equipo as string) ?? null,
        assigned_at:    a.assigned_at as string,
        completed_at:   (a.completed_at as string) ?? null,
        response_id:    responseByEmployee.get(a.employee_id as string) ?? null,
      };
    });

    // Ordenar: respondidos primero, luego por nombre
    participants.sort((a, b) => {
      if (!!a.completed_at !== !!b.completed_at) return a.completed_at ? -1 : 1;
      return a.nombre_completo.localeCompare(b.nombre_completo);
    });

    return NextResponse.json(participants);
  } catch (error) {
    console.error("[GET /api/clima/surveys/[id]/participants]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
