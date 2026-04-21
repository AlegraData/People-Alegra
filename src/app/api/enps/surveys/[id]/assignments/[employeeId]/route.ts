export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

async function isEnpsAdmin(userId: string) {
  const { data: roleData } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).single();
  const globalRole = roleData?.role ?? "viewer";

  const { data: moduleRoleData } = await supabaseAdmin
    .from("user_module_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("module", "enps")
    .single();

  return (moduleRoleData?.role ?? globalRole) === "admin";
}

// DELETE: Quitar participante de la campaña (elimina asignación y respuesta si existe)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; employeeId: string }> }
) {
  try {
    const { id: surveyId, employeeId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    if (!(await isEnpsAdmin(user.id)))
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    // Eliminar respuesta si existe (primero para respetar FK)
    await prisma.enpsSurveyResponse.deleteMany({ where: { surveyId, employeeId } });
    // Eliminar asignación
    await prisma.enpsSurveyAssignment.deleteMany({ where: { surveyId, employeeId } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/enps/surveys/[id]/assignments/[employeeId]]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
