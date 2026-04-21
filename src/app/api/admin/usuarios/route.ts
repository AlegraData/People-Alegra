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

// GET: Lista todos los usuarios con sus roles globales y roles por módulo
export async function GET() {
  try {
    const { user, error } = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error }, { status: error === "No autenticado" ? 401 : 403 });
    }

    // Obtener usuarios y module roles en paralelo
    const [usersResult, moduleRolesResult] = await Promise.all([
      supabaseAdmin
        .from("user_roles")
        .select("id, user_id, email, full_name, avatar_url, role, created_at, updated_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("user_module_roles")
        .select("user_id, module, role"),
    ]);

    if (usersResult.error) throw usersResult.error;

    // Agrupar module roles por user_id
    const moduleRolesByUser = new Map<string, { module: string; role: string }[]>();
    (moduleRolesResult.data ?? []).forEach((mr) => {
      const list = moduleRolesByUser.get(mr.user_id) ?? [];
      list.push({ module: mr.module, role: mr.role });
      moduleRolesByUser.set(mr.user_id, list);
    });

    const data = (usersResult.data ?? []).map((u) => ({
      ...u,
      moduleRoles: moduleRolesByUser.get(u.user_id) ?? [],
    }));

    return NextResponse.json(data);
  } catch (error) {
    console.error("[GET /api/admin/usuarios]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
