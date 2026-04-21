export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { user: null, error: "No autenticado" };

  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .single();

  if (roleData?.role !== "admin") return { user: null, error: "Acceso denegado" };
  return { user, error: null };
}

// PATCH: Cambia el rol de un usuario
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { user, error } = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error }, { status: error === "No autenticado" ? 401 : 403 });
    }

    const { userId } = await params;
    const { role } = await request.json();

    if (!["admin", "manager", "viewer"].includes(role)) {
      return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
    }

    // Prevenir que el admin se quite su propio rol de admin
    if (userId === user.id && role !== "admin") {
      return NextResponse.json(
        { error: "No puedes cambiar tu propio rol de administrador." },
        { status: 400 }
      );
    }

    const { data, error: dbError } = await supabaseAdmin
      .from("user_roles")
      .update({ role, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .select()
      .single();

    if (dbError) throw dbError;
    return NextResponse.json(data);
  } catch (error) {
    console.error("[PATCH /api/admin/usuarios/:userId]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// DELETE: Elimina el acceso de un usuario (lo remueve de user_roles)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { user, error } = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error }, { status: error === "No autenticado" ? 401 : 403 });
    }

    const { userId } = await params;

    // Prevenir auto-eliminación
    if (userId === user.id) {
      return NextResponse.json(
        { error: "No puedes eliminarte a ti mismo." },
        { status: 400 }
      );
    }

    const { error: dbError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", userId);

    if (dbError) throw dbError;
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE /api/admin/usuarios/:userId]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
