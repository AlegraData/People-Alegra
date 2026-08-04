export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";

async function get360EffectiveRole(userId: string): Promise<string> {
  const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).single();
  const { data: modRoleData } = await supabaseAdmin
    .from("user_module_roles").select("role").eq("user_id", userId).eq("module", "360").single();
  return modRoleData?.role ?? roleData?.role ?? "viewer";
}

// Autoservicio: cualquier usuario con sesión ve SUS PROPIOS reportes ya
// enviados (sin chequeo de rol — es su propio dato, filtrado por su email).
// Alimenta el aviso "tu reporte está disponible" en "Mis Evaluaciones 360°".
//
// `?previewAs=<email>`: solo admin/manager del módulo — herramienta de
// "vista previa" (panel /admin) para ver la pantalla tal como la vería
// cualquier correo, sin necesitar sus credenciales. Sin este parámetro el
// comportamiento es exactamente el de siempre (propio email de sesión).
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user?.email) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const previewAs = new URL(req.url).searchParams.get("previewAs")?.trim().toLowerCase();
    let targetEmail = user.email.trim().toLowerCase();
    if (previewAs) {
      const effectiveRole = await get360EffectiveRole(user.id);
      if (!["admin", "manager"].includes(effectiveRole))
        return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
      targetEmail = previewAs;
    }

    const rows = await prisma.evaluation360Report.findMany({
      where: { evaluateeEmail: targetEmail, status: "sent" },
      include: { evaluation: { select: { id: true, title: true } } },
      orderBy: { sentAt: "desc" },
    });

    return NextResponse.json({
      reports: rows.map((r) => ({
        evaluationId: r.evaluation.id,
        title:        r.evaluation.title,
        sentAt:       r.sentAt,
      })),
    });
  } catch (error) {
    console.error("[GET my-reports]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
