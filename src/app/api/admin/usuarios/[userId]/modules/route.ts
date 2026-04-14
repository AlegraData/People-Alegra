import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

const VALID_MODULES = ["clima", "enps", "360"];
const VALID_ROLES   = ["admin", "manager", "viewer"];

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

// PUT: Reemplaza todos los module roles de un usuario de una sola vez.
// Body: { clima: "manager", enps: "", "360": "admin" }
// Valor vacío ("") = sin asignación para ese módulo (se elimina si existía)
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { user, error } = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error }, { status: error === "No autenticado" ? 401 : 403 });
    }

    const { userId } = await params;
    const body: Record<string, string> = await request.json();

    // 1. Eliminar todos los module roles actuales del usuario
    await supabaseAdmin
      .from("user_module_roles")
      .delete()
      .eq("user_id", userId);

    // 2. Insertar los que tienen valor asignado
    const toInsert = VALID_MODULES
      .filter((m) => body[m] && VALID_ROLES.includes(body[m]))
      .map((m) => ({
        user_id: userId,
        module:  m,
        role:    body[m],
        updated_at: new Date().toISOString(),
      }));

    if (toInsert.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from("user_module_roles")
        .insert(toInsert);
      if (insertError) throw insertError;
    }

    return NextResponse.json({
      ok: true,
      assigned: toInsert.map((r) => ({ module: r.module, role: r.role })),
    });
  } catch (error) {
    console.error("[PUT /api/admin/usuarios/:userId/modules]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
