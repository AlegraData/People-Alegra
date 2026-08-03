export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { generateEval360ReportPdf } from "@/lib/eval360ReportGenerator";
import { sendReportEmail } from "@/lib/mailer";

type Ctx = { params: Promise<{ id: string }> };

async function get360EffectiveRole(userId: string): Promise<string> {
  const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).single();
  const { data: modRoleData } = await supabaseAdmin
    .from("user_module_roles").select("role").eq("user_id", userId).eq("module", "360").single();
  return modRoleData?.role ?? roleData?.role ?? "viewer";
}

// Estado de envío por evaluado — sin recalcular nada, solo lo que ya quedó
// guardado en Evaluation360Report (ver GET más abajo). Alimenta el tab
// "Envíos": quién ya recibió el reporte, para no reenviarle sin querer.
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const effectiveRole = await get360EffectiveRole(user.id);
    if (!["admin", "manager"].includes(effectiveRole))
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const sends = await prisma.evaluation360Report.findMany({ where: { evaluationId: id } });
    return NextResponse.json({
      sends: sends.map((s) => ({
        evaluateeEmail: s.evaluateeEmail,
        evaluateeName:  s.evaluateeName,
        status:         s.status,
        sentAt:         s.sentAt,
        error:          s.error,
      })),
    });
  } catch (error) {
    console.error("[GET report-sends]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

// Envía el reporte PDF por correo a UNA persona (no a un arreglo) — el
// cliente (EvalReportSends.tsx) orquesta el envío masivo llamando este
// endpoint una vez por seleccionado, en un loop secuencial, para poder
// mostrar progreso en vivo y no saturar Chromium/Gmail de golpe. Nunca lanza
// fuera del try/catch: un fallo puntual se guarda como "failed" y devuelve
// `ok:false`, para que el loop del cliente siga con el siguiente sin cortarse.
export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const effectiveRole = await get360EffectiveRole(user.id);
    if (!["admin", "manager"].includes(effectiveRole))
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const evaluateeEmail = (body?.evaluateeEmail as string | undefined)?.trim().toLowerCase();
    if (!evaluateeEmail) return NextResponse.json({ error: "Se requiere evaluateeEmail" }, { status: 400 });

    const evaluation = await prisma.evaluation360.findUnique({ where: { id } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const result = await generateEval360ReportPdf(id, evaluateeEmail);
    if (!result.ok) {
      await prisma.evaluation360Report.upsert({
        where:  { evaluationId_evaluateeEmail: { evaluationId: id, evaluateeEmail } },
        create: { evaluationId: id, evaluateeEmail, status: "failed", error: result.message },
        update: { status: "failed", error: result.message },
      });
      return NextResponse.json({ ok: false, error: result.message });
    }

    try {
      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      await sendReportEmail({
        to:            evaluateeEmail,
        recipientName: result.reportData.evaluateeName,
        surveyTitle:   evaluation.title,
        appUrl:        `${appUrl}/evaluaciones360`,
        template: {
          subject:    evaluation.reportEmailSubject,
          body:       evaluation.reportEmailBody,
          buttonText: evaluation.reportEmailButtonText,
          footer:     evaluation.reportEmailFooter,
        },
        pdfBuffer:   result.pdf,
        pdfFileName: `Feedback_360_${result.reportData.evaluateeName.replace(/\s+/g, "_")}.pdf`,
      });

      await prisma.evaluation360Report.upsert({
        where:  { evaluationId_evaluateeEmail: { evaluationId: id, evaluateeEmail } },
        create: {
          evaluationId: id, evaluateeEmail, evaluateeName: result.reportData.evaluateeName,
          status: "sent", sentAt: new Date(), error: null,
        },
        update: {
          evaluateeName: result.reportData.evaluateeName,
          status: "sent", sentAt: new Date(), error: null,
        },
      });
      return NextResponse.json({ ok: true });
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Error al enviar el correo";
      await prisma.evaluation360Report.upsert({
        where:  { evaluationId_evaluateeEmail: { evaluationId: id, evaluateeEmail } },
        create: { evaluationId: id, evaluateeEmail, evaluateeName: result.reportData.evaluateeName, status: "failed", error: message },
        update: { status: "failed", error: message },
      });
      console.error("[POST report-sends] envío falló", evaluateeEmail, sendError);
      return NextResponse.json({ ok: false, error: message });
    }
  } catch (error) {
    console.error("[POST report-sends]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
