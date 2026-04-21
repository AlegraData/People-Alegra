export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, ok: false };

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
  return { user, ok: effectiveRole === "admin" };
}

// GET: Lista de participantes con su estado de respuesta
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    // 1. Asignaciones
    const { data: assignments } = await supabaseAdmin
      .from("enps_survey_assignments")
      .select("employee_id, assigned_at, completed_at")
      .eq("survey_id", surveyId);

    if (!assignments?.length) return NextResponse.json([]);

    const employeeIds = assignments.map((a) => a.employee_id as string);

    // 2. Emails por UUID
    const { data: employees } = await supabaseAdmin
      .from("employees").select("id, email").in("id", employeeIds);

    const idToEmail = new Map((employees ?? []).map((e) => [e.id as string, e.email as string]));
    const emails = [...idToEmail.values()];

    // 3. Detalles desde vista
    const { data: empDetails } = emails.length
      ? await supabaseAdmin
          .from("v_empleados_activos_completa")
          .select("correo, nombre_completo, cargo, equipo")
          .in("correo", emails)
      : { data: [] };

    const detailsByEmail = new Map((empDetails ?? []).map((e) => [e.correo as string, e]));

    // 4. Respuestas existentes (incluye score)
    const { data: responses } = await supabaseAdmin
      .from("enps_survey_responses")
      .select("employee_id, score, submitted_at")
      .eq("survey_id", surveyId);

    const responseByEmployee = new Map(
      (responses ?? []).map((r) => [r.employee_id as string, r])
    );

    // 5. Merge
    const participants = assignments.map((a) => {
      const email  = idToEmail.get(a.employee_id as string) ?? "";
      const detail = detailsByEmail.get(email);
      const resp   = responseByEmployee.get(a.employee_id as string);
      return {
        employee_id:     a.employee_id as string,
        correo:          email,
        nombre_completo: (detail?.nombre_completo as string) ?? email,
        cargo:           (detail?.cargo as string)  ?? null,
        equipo:          (detail?.equipo as string) ?? null,
        assigned_at:     a.assigned_at as string,
        completed_at:    (a.completed_at as string) ?? null,
        score:           resp ? (resp.score as number) : null,
        submitted_at:    resp ? (resp.submitted_at as string) : null,
      };
    });

    participants.sort((a, b) => {
      if (!!a.completed_at !== !!b.completed_at) return a.completed_at ? -1 : 1;
      return a.nombre_completo.localeCompare(b.nombre_completo);
    });

    return NextResponse.json(participants);
  } catch (error) {
    console.error("[GET /api/enps/surveys/[id]/participants]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// POST: Agregar participantes a la campaña
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: surveyId } = await params;
    const { ok, user } = await requireAdmin();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!ok)   return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const { employeeIds } = await request.json();
    if (!Array.isArray(employeeIds) || employeeIds.length === 0)
      return NextResponse.json({ error: "Se requiere al menos un participante" }, { status: 400 });

    await prisma.enpsSurveyAssignment.createMany({
      data: (employeeIds as string[]).map((employeeId) => ({ surveyId, employeeId })),
      skipDuplicates: true,
    });

    return NextResponse.json({ ok: true, added: employeeIds.length });
  } catch (error) {
    console.error("[POST /api/enps/surveys/[id]/participants]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
