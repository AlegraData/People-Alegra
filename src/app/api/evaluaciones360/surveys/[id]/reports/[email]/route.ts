export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { generateEval360ReportPdf } from "@/lib/eval360ReportGenerator";
import { isDescendantOf } from "@/lib/orgHierarchy";

type Ctx = { params: Promise<{ id: string; email: string }> };

async function get360EffectiveRole(userId: string): Promise<string> {
  const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).single();
  const { data: modRoleData } = await supabaseAdmin
    .from("user_module_roles").select("role").eq("user_id", userId).eq("module", "360").single();
  return modRoleData?.role ?? roleData?.role ?? "viewer";
}

// Un evaluado puede ver/descargar SU PROPIO reporte (sin ser admin/manager)
// únicamente si ya se le envió por correo desde el tab "Envíos" — evita que
// pueda adelantarse a ver el reporte antes de que el admin decida enviarlo.
// Se filtra por evaluationId además del email: el `@@unique` de
// Evaluation360Report es por (evaluación, evaluado), así que sin este filtro
// alguien podría reusar el "sent" de OTRA encuesta para colarse en esta.
async function hasSentReport(evaluationId: string, evaluateeEmail: string): Promise<boolean> {
  const row = await prisma.evaluation360Report.findUnique({
    where: { evaluationId_evaluateeEmail: { evaluationId, evaluateeEmail } },
  });
  return row?.status === "sent";
}

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { id, email } = await params;
    const evaluateeEmail = decodeURIComponent(email).trim().toLowerCase();

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const effectiveRole = await get360EffectiveRole(user.id);
    const isAdminOrManager = ["admin", "manager"].includes(effectiveRole);
    const sessionEmail = (user.email ?? "").trim().toLowerCase();
    const isSelf = sessionEmail === evaluateeEmail;

    // Un líder (de cualquier nivel, según la jerarquía REAL de hoy en
    // v_hc_activo_compartida) también puede ver el reporte de alguien de su
    // equipo descendente — misma política que el propio evaluado: solo si
    // ya quedó "sent" (nunca antes de que el admin decida enviarlo).
    if (!isAdminOrManager) {
      const sent = await hasSentReport(id, evaluateeEmail);
      const allowedAsSelf = isSelf && sent;
      const allowedAsLeader = !allowedAsSelf && sent && (await isDescendantOf(sessionEmail, evaluateeEmail));
      if (!allowedAsSelf && !allowedAsLeader) {
        return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
      }
    }

    const result = await generateEval360ReportPdf(id, evaluateeEmail);
    if (!result.ok) {
      const status = result.reason === "evaluation_not_found" ? 404 : result.reason === "no_submissions" ? 400 : 404;
      return NextResponse.json({ error: result.message }, { status });
    }

    const download = new URL(req.url).searchParams.get("download") === "1";
    const filename = `Feedback_360_${result.reportData.evaluateeName.replace(/\s+/g, "_")}.pdf`;
    return new NextResponse(new Uint8Array(result.pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
        // Es un reporte de desempeño individual — nunca debe quedar cacheado
        // por un proxy compartido ni persistido en el caché de disco del
        // navegador (relevante en un computador compartido/público).
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("[GET reports/:email]", error);
    return NextResponse.json({ error: "Error interno al generar el reporte" }, { status: 500 });
  }
}
