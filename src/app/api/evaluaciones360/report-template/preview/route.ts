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
import { DEFAULT_TEMPLATE_CONFIG, type ReportTemplateConfig } from "@/lib/reportTemplateConfig";

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

// Genera un PDF de vista previa con un config BORRADOR (sin guardar) contra
// datos reales de un evaluado — así Reportes → Plantilla puede mostrar el
// resultado exacto antes de que el admin decida guardar el cambio.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const effectiveRole = await get360EffectiveRole(user.id);
    if (!["admin", "manager"].includes(effectiveRole))
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const body = await request.json();
    const { surveyId, evaluateeEmail, config, format } = body as { surveyId?: string; evaluateeEmail?: string; config?: unknown; format?: "html" | "pdf" };
    if (!surveyId || !evaluateeEmail) {
      return NextResponse.json({ error: "Faltan surveyId/evaluateeEmail" }, { status: 400 });
    }
    const templateConfig = isValidConfig(config) ? config : DEFAULT_TEMPLATE_CONFIG;

    const evaluation = await prisma.evaluation360.findUnique({ where: { id: surveyId } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const submitted = await prisma.evaluation360Assignment.findMany({
      where: { evaluationId: surveyId, status: "submitted" },
    });
    if (submitted.length === 0) {
      return NextResponse.json({ error: "Esta evaluación aún no tiene respuestas enviadas" }, { status: 400 });
    }

    const teamByEmail = await buildTeamByEmail(submitted);
    const fileIcons = loadReportIcons();

    const reportData = buildEval360ReportData({
      questionsRaw: evaluation.questions,
      reportSectionsRaw: evaluation.reportSections,
      submitted,
      evaluateeEmail,
      teamByEmail,
      icons: resolveReportIcons(fileIcons, templateConfig),
      templateConfig,
    });
    if (!reportData) {
      return NextResponse.json({ error: "Esa persona no tiene evaluaciones recibidas todavía" }, { status: 404 });
    }

    const html = buildReportHtml(reportData);
    // El editor pide "html" para la vista previa en vivo (arrastrar/redimensionar
    // sobre el propio DOM, sin el costo de Puppeteer en cada micro-cambio); el
    // PDF real (con paginación exacta) solo se genera bajo demanda ("Ver PDF real").
    if (format === "html") {
      return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    const pdf = await generatePdfFromHtml(html);
    return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf" } });
  } catch (error) {
    console.error("[POST report-template/preview]", error);
    return NextResponse.json({ error: "Error interno al generar la vista previa" }, { status: 500 });
  }
}
