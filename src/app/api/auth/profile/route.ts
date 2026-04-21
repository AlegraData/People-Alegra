export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

// GET /api/auth/profile
// Devuelve el cargo del empleado autenticado desde v_empleados_activos_completa.
// Si no tiene perfil de empleado devuelve cargo: null (sin error).
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.json({ cargo: null });

    const { data } = await supabaseAdmin
      .from("v_empleados_activos_completa")
      .select("cargo")
      .eq("correo", user.email!)
      .single();

    return NextResponse.json({ cargo: data?.cargo ?? null });
  } catch {
    return NextResponse.json({ cargo: null });
  }
}
