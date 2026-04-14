import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import type { Role } from "@/types/clima";

// GET: Retorna el rol del usuario autenticado.
// Usa el cliente admin (SERVICE_ROLE_KEY) para bypasear RLS sin afectar otras apps.
export async function GET() {
  try {
    // 1. Verificar sesión con el cliente normal (anon key)
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    // 2. Consultar el rol con el cliente admin (bypasea RLS)
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (roleError || !roleData) {
      // Si no tiene rol asignado, defaultear a viewer
      return NextResponse.json({ role: "viewer" as Role });
    }

    return NextResponse.json({ role: roleData.role as Role });
  } catch (error) {
    console.error("[GET /api/auth/role]", error);
    return NextResponse.json({ error: "Error interno al obtener el rol" }, { status: 500 });
  }
}
