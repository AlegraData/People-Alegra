export const dynamic = "force-dynamic";
import { NextResponse }  from "next/server";
import { createClient }  from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

// GET /api/empleados/teams — lista de equipos únicos
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data, error } = await supabaseAdmin
      .from("v_empleados_activos_completa")
      .select("equipo")
      .not("equipo", "is", null)
      .order("equipo", { ascending: true });

    if (error) return NextResponse.json({ error: "Error al obtener equipos" }, { status: 500 });

    const teams = [...new Set((data ?? []).map((r: any) => r.equipo as string))].filter(Boolean);
    return NextResponse.json(teams);
  } catch {
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
