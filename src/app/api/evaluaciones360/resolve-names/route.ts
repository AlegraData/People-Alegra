export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { emails } = await request.json() as { emails: string[] };
    if (!Array.isArray(emails) || emails.length === 0)
      return NextResponse.json({ names: {} });

    const clean = emails.map((e) => e.trim().toLowerCase()).filter(Boolean);
    const names: Record<string, string> = {};

    // 1. Primary: employee directory (has proper full names + team)
    const { data: empRows } = await supabaseAdmin
      .from("v_empleados_activos_completa")
      .select("correo, nombre_completo")
      .in("correo", clean);

    (empRows ?? []).forEach((r: { correo: string; nombre_completo: string | null }) => {
      if (r.nombre_completo) names[r.correo] = r.nombre_completo;
    });

    // 2. Fallback: user_roles (Google display name)
    const missing = clean.filter((e) => !names[e]);
    if (missing.length > 0) {
      const { data: roleRows } = await supabaseAdmin
        .from("user_roles")
        .select("email, full_name")
        .in("email", missing);

      (roleRows ?? []).forEach((r: { email: string; full_name: string | null }) => {
        if (r.full_name) names[r.email] = r.full_name;
      });
    }

    return NextResponse.json({ names });
  } catch (error) {
    console.error("[POST /api/evaluaciones360/resolve-names]", error);
    return NextResponse.json({ names: {} });
  }
}
