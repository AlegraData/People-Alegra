import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import type { Role } from "@/types/clima";

// GET /api/auth/role
// GET /api/auth/role?module=clima  → devuelve el rol efectivo para ese módulo
//
// Lógica de resolución:
//   1. Obtiene el rol global del usuario desde user_roles (default: "viewer")
//   2. Si se pasa ?module=X, busca en user_module_roles
//   3. Si existe rol específico para ese módulo → lo devuelve (override)
//   4. Si no → devuelve el rol global
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // Rol global
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    const globalRole: Role = roleData?.role ?? "viewer";

    // Rol específico de módulo (si se solicita)
    const { searchParams } = new URL(request.url);
    const module = searchParams.get("module");

    if (module) {
      const { data: moduleRoleData } = await supabaseAdmin
        .from("user_module_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("module", module)
        .single();

      if (moduleRoleData?.role) {
        return NextResponse.json({ role: moduleRoleData.role as Role, source: "module" });
      }
    }

    return NextResponse.json({ role: globalRole, source: "global" });
  } catch (error) {
    console.error("[GET /api/auth/role]", error);
    return NextResponse.json({ error: "Error interno al obtener el rol" }, { status: 500 });
  }
}
