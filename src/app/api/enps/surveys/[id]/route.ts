import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

async function getAdminUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, isAdmin: false };

  // Rol global
  const { data: roleData } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", user.id).single();
  const globalRole = roleData?.role ?? "viewer";

  // Override por módulo (misma lógica que /api/auth/role)
  const { data: moduleRoleData } = await supabaseAdmin
    .from("user_module_roles")
    .select("role")
    .eq("user_id", user.id)
    .eq("module", "enps")
    .single();

  const effectiveRole = moduleRoleData?.role ?? globalRole;
  return { user, isAdmin: effectiveRole === "admin" };
}

// PATCH: Editar campaña (admin)
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, isAdmin } = await getAdminUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!isAdmin) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const body = await request.json();
    const { title, description, followUpQuestion, scoreMin, scoreMax, scoreLabels, isActive } = body;

    // Si solo se cambia isActive, no se requiere título
    if (title !== undefined && !title?.trim())
      return NextResponse.json({ error: "El título es requerido" }, { status: 400 });

    const updated = await prisma.enpsSurvey.update({
      where: { id },
      data: {
        ...(title !== undefined            && { title:            title.trim() }),
        ...(description !== undefined      && { description:      description?.trim() || null }),
        ...(followUpQuestion !== undefined && { followUpQuestion: followUpQuestion?.trim() || null }),
        ...(typeof scoreMin === "number"   && { scoreMin }),
        ...(typeof scoreMax === "number"   && { scoreMax }),
        ...(Array.isArray(scoreLabels)     && { scoreLabels }),
        ...(isActive !== undefined         && { isActive: Boolean(isActive) }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("[PATCH /api/enps/surveys/[id]]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE: Eliminar campaña (admin)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { user, isAdmin } = await getAdminUser();
    if (!user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    if (!isAdmin) return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    await prisma.enpsSurvey.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/enps/surveys/[id]]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
