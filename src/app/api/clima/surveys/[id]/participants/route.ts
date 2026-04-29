export const dynamic = "force-dynamic";
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

    // 1. Asignaciones con datos de empleado via JOIN directo (evita depender de v_empleados_activos_completa
    //    y no tiene límites de URL con grandes volúmenes de participantes)
    const { data: assignments, error: aErr } = await supabaseAdmin
      .from("climate_survey_assignments")
      .select(`
        employee_id,
        assigned_at,
        completed_at,
        employees!inner(
          email,
          employee_personal_info(nombres, primer_apellido, segundo_apellido, es_actual),
          employee_events(role_name, technical_team, es_actual)
        )
      `)
      .eq("survey_id", surveyId);

    if (aErr || !assignments?.length) {
      return NextResponse.json([]);
    }

    // 2. Respuestas existentes
    const { data: responses } = await supabaseAdmin
      .from("climate_survey_responses")
      .select("id, employee_id")
      .eq("survey_id", surveyId);

    const responseByEmployee = new Map(
      (responses ?? []).map((r) => [r.employee_id as string, r.id as string])
    );

    // 3. Merge
    const participants: SurveyParticipant[] = assignments.map((a) => {
      const emp   = (a as any).employees;
      const email = (emp?.email as string) ?? "";

      const infoList = (emp?.employee_personal_info ?? []) as any[];
      const info     = infoList.find((i) => i.es_actual) ?? infoList[0];
      const nombre_completo = info
        ? `${info.nombres ?? ""} ${info.primer_apellido ?? ""} ${info.segundo_apellido ?? ""}`.trim()
        : email;

      const eventList = (emp?.employee_events ?? []) as any[];
      const event     = eventList.find((e) => e.es_actual) ?? eventList[0];

      return {
        employee_id:     a.employee_id as string,
        correo:          email,
        nombre_completo: nombre_completo || email,
        cargo:           (event?.role_name      as string) ?? null,
        equipo:          (event?.technical_team as string) ?? null,
        assigned_at:     a.assigned_at as string,
        completed_at:    (a.completed_at as string) ?? null,
        response_id:     responseByEmployee.get(a.employee_id as string) ?? null,
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

// POST: Agregar nuevos participantes a una encuesta existente
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { id: surveyId } = await params;
    const { employeeIds } = await request.json();

    if (!Array.isArray(employeeIds) || employeeIds.length === 0)
      return NextResponse.json({ error: "Se requiere al menos un participante" }, { status: 400 });

    // Ignorar los que ya están asignados (evitar duplicados)
    const { data: existing } = await supabaseAdmin
      .from("climate_survey_assignments")
      .select("employee_id")
      .eq("survey_id", surveyId)
      .in("employee_id", employeeIds);

    const existingIds = new Set((existing ?? []).map((a) => a.employee_id as string));
    const newIds = (employeeIds as string[]).filter((id) => !existingIds.has(id));

    if (newIds.length === 0)
      return NextResponse.json({ added: 0, message: "Todos ya estaban asignados" });

    const { error: insertError } = await supabaseAdmin
      .from("climate_survey_assignments")
      .insert(newIds.map((employeeId) => ({ survey_id: surveyId, employee_id: employeeId })));

    if (insertError)
      return NextResponse.json({ error: "Error al agregar participantes" }, { status: 500 });

    return NextResponse.json({ added: newIds.length, addedIds: newIds });
  } catch (error) {
    console.error("[POST /api/clima/surveys/[id]/participants]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
