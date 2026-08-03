export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { buildEval360ReportData } from "@/lib/buildEval360ReportData";
import { buildTeamByEmail } from "@/lib/eval360TeamMap";
import { buildReportHtml } from "@/lib/eval360ReportTemplate";
import { generatePdfFromHtml } from "@/lib/generatePdf";
import { loadReportIcons, resolveReportIcons } from "@/lib/reportIcons";
import { getReportTemplateConfig } from "@/lib/reportTemplateConfig";

type Ctx = { params: Promise<{ id: string; email: string }> };

async function get360EffectiveRole(userId: string): Promise<string> {
  const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).single();
  const { data: modRoleData } = await supabaseAdmin
    .from("user_module_roles").select("role").eq("user_id", userId).eq("module", "360").single();
  return modRoleData?.role ?? roleData?.role ?? "viewer";
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id, email } = await params;
    const evaluateeEmail = decodeURIComponent(email).trim().toLowerCase();

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const effectiveRole = await get360EffectiveRole(user.id);
    if (!["admin", "manager"].includes(effectiveRole))
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const evaluation = await prisma.evaluation360.findUnique({ where: { id } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const submitted = await prisma.evaluation360Assignment.findMany({
      where: { evaluationId: id, status: "submitted" },
    });
    if (submitted.length === 0) {
      return NextResponse.json({ error: "Esta evaluación aún no tiene respuestas enviadas" }, { status: 400 });
    }

    const teamByEmail = await buildTeamByEmail(submitted);
    const [templateConfig, fileIcons] = await Promise.all([getReportTemplateConfig(), Promise.resolve(loadReportIcons())]);

    const reportData = buildEval360ReportData({
      questionsRaw: evaluation.questions,
      reportSectionsRaw: evaluation.reportSections,
      submitted,
      evaluateeEmail,
      teamByEmail,
      icons: resolveReportIcons(fileIcons, templateConfig),
      templateConfig,
      behaviorGroupsRaw: evaluation.behaviorGroups,
      commentGroupsRaw: evaluation.commentGroups,
    });
    if (!reportData) {
      return NextResponse.json({ error: "Esta persona no tiene evaluaciones recibidas todavía" }, { status: 404 });
    }

    const html = buildReportHtml(reportData);
    const pdf = await generatePdfFromHtml(html, {
      marginPx: templateConfig.layout.pageMarginY,
      backgroundColor: templateConfig.colors.background,
    });
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="Feedback_360_${reportData.evaluateeName.replace(/\s+/g, "_")}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[GET reports/:email]", error);
    return NextResponse.json({ error: "Error interno al generar el reporte" }, { status: 500 });
  }
}
