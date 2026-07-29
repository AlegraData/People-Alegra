export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { getReportTemplateConfig, saveReportTemplateConfig, type ReportTemplateConfig } from "@/lib/reportTemplateConfig";

async function get360EffectiveRole(userId: string): Promise<string> {
  const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).single();
  const { data: modRoleData } = await supabaseAdmin
    .from("user_module_roles").select("role").eq("user_id", userId).eq("module", "360").single();
  return modRoleData?.role ?? roleData?.role ?? "viewer";
}

function isValidConfig(value: unknown): value is ReportTemplateConfig {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.colors === "object" && typeof v.logo === "object" && typeof v.layout === "object";
}

// Configuración visual GLOBAL de la plantilla PDF de reportes 360° — se aplica
// a todas las encuestas, presentes y futuras. Gestionada desde Reportes → Plantilla.
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const effectiveRole = await get360EffectiveRole(user.id);
    if (!["admin", "manager"].includes(effectiveRole))
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const config = await getReportTemplateConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("[GET report-template]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const effectiveRole = await get360EffectiveRole(user.id);
    if (!["admin", "manager"].includes(effectiveRole))
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const body = await request.json();
    if (!isValidConfig(body)) return NextResponse.json({ error: "Configuración inválida" }, { status: 400 });

    await saveReportTemplateConfig(body, user.email ?? null);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[PUT report-template]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
