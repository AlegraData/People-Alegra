export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { sendSurveyInvitation } from "@/lib/mailer";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();
    const { data: modRoleData } = await supabaseAdmin
      .from("user_module_roles").select("role").eq("user_id", user.id).eq("module", "360").single();
    const effectiveRole = modRoleData?.role ?? roleData?.role ?? "viewer";
    if (!["admin", "manager"].includes(effectiveRole))
      return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const evaluation = await prisma.evaluation360.findUnique({ where: { id } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const body = await request.json();
    const { assignmentId, sendToAll } = body as { assignmentId?: string; sendToAll?: boolean };

    let toRemind: { evaluatorEmail: string; evaluatorName: string | null }[] = [];

    if (sendToAll) {
      toRemind = await prisma.evaluation360Assignment.findMany({
        where: { evaluationId: id, status: { not: "submitted" } },
        select: { evaluatorEmail: true, evaluatorName: true },
        distinct: ["evaluatorEmail"],
      });
    } else if (assignmentId) {
      const assignment = await prisma.evaluation360Assignment.findUnique({
        where: { id: assignmentId, evaluationId: id },
      });
      if (!assignment) return NextResponse.json({ error: "Asignación no encontrada" }, { status: 404 });
      if (assignment.status === "submitted")
        return NextResponse.json({ error: "La evaluación ya fue enviada" }, { status: 400 });
      toRemind = [{ evaluatorEmail: assignment.evaluatorEmail, evaluatorName: assignment.evaluatorName }];
    } else {
      return NextResponse.json({ error: "Se requiere assignmentId o sendToAll: true" }, { status: 400 });
    }

    if (toRemind.length === 0) return NextResponse.json({ sent: 0 });

    const appUrl  = process.env.APP_URL ?? "http://localhost:3000";
    const evalUrl = `${appUrl}/evaluaciones360`;
    const template = {
      subject:    evaluation.emailSubject,
      body:       evaluation.emailBody,
      buttonText: evaluation.emailButtonText,
      footer:     evaluation.emailFooter,
    };

    await Promise.allSettled(
      toRemind.map((a) =>
        sendSurveyInvitation({
          to:               a.evaluatorEmail,
          recipientName:    a.evaluatorName || a.evaluatorEmail,
          surveyTitle:      evaluation.title,
          surveyDescription: evaluation.description ?? "",
          surveyUrl:        evalUrl,
          isReminder:       true,
          template,
          showFallbackLink: false,
        })
      )
    );

    return NextResponse.json({ sent: toRemind.length });
  } catch (error) {
    console.error("[POST remind]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
