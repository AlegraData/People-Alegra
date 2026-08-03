import prisma from "@/lib/prisma";
import { buildEval360ReportData } from "@/lib/buildEval360ReportData";
import { buildTeamByEmail } from "@/lib/eval360TeamMap";
import { buildReportHtml, type Eval360ReportData } from "@/lib/eval360ReportTemplate";
import { generatePdfFromHtml } from "@/lib/generatePdf";
import { loadReportIcons, resolveReportIcons } from "@/lib/reportIcons";
import { getReportTemplateConfig } from "@/lib/reportTemplateConfig";

export type Eval360ReportGenerationResult =
  | { ok: true; pdf: Buffer; reportData: Eval360ReportData }
  | { ok: false; reason: "evaluation_not_found" | "no_submissions" | "no_data_for_evaluatee"; message: string };

/**
 * Pipeline compartido para generar el PDF individual de un evaluado — extraído
 * de `reports/[email]/route.ts` (la vista de admin) para que el envío por
 * correo (`report-sends/route.ts`) use exactamente la misma lógica, sin
 * duplicarla ni arriesgar que los dos flujos diverjan con el tiempo.
 */
export async function generateEval360ReportPdf(evaluationId: string, evaluateeEmail: string): Promise<Eval360ReportGenerationResult> {
  const evaluation = await prisma.evaluation360.findUnique({ where: { id: evaluationId } });
  if (!evaluation) {
    return { ok: false, reason: "evaluation_not_found", message: "Evaluación no encontrada" };
  }

  const submitted = await prisma.evaluation360Assignment.findMany({
    where: { evaluationId, status: "submitted" },
  });
  if (submitted.length === 0) {
    return { ok: false, reason: "no_submissions", message: "Esta evaluación aún no tiene respuestas enviadas" };
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
    return { ok: false, reason: "no_data_for_evaluatee", message: "Esta persona no tiene evaluaciones recibidas todavía" };
  }

  const html = buildReportHtml(reportData);
  const pdf = await generatePdfFromHtml(html, {
    marginPx: templateConfig.layout.pageMarginY,
    backgroundColor: templateConfig.colors.background,
  });

  return { ok: true, pdf, reportData };
}
