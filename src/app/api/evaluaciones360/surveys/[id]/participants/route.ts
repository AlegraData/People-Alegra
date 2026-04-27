export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { sendSurveyInvitation } from "@/lib/mailer";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();
    if (!["admin", "manager"].includes(roleData?.role)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const assignments = await prisma.evaluation360Assignment.findMany({
      where: { evaluationId: id },
      orderBy: [{ evaluateeEmail: "asc" }, { evaluationType: "asc" }],
    });

    return NextResponse.json(assignments);
  } catch (error) {
    console.error("[GET participants]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();
    if (roleData?.role !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const evaluation = await prisma.evaluation360.findUnique({ where: { id } });
    if (!evaluation) return NextResponse.json({ error: "Evaluación no encontrada" }, { status: 404 });

    const body = await request.json();
    const { participants, sendInvitation } = body as { participants: any[]; sendInvitation?: boolean };

    if (!Array.isArray(participants) || participants.length === 0) {
      return NextResponse.json({ error: "Sin participantes" }, { status: 400 });
    }

    const created = await prisma.evaluation360Assignment.createMany({
      data: participants.map((p) => ({
        evaluationId:   id,
        evaluatorEmail: p.evaluatorEmail.trim().toLowerCase(),
        evaluatorName:  p.evaluatorName?.trim() || null,
        evaluateeEmail: p.evaluateeEmail.trim().toLowerCase(),
        evaluateeName:  p.evaluateeName?.trim() || null,
        team:           p.team?.trim() || null,
        evaluationType: p.evaluationType,
        status:         "pending",
      })),
      skipDuplicates: true,
    });

    if (sendInvitation) {
      const uniqueEvaluators = new Map<string, string>();
      participants.forEach((p) => {
        uniqueEvaluators.set(p.evaluatorEmail.toLowerCase(), p.evaluatorName || p.evaluatorEmail);
      });

      const appUrl  = process.env.APP_URL ?? "http://localhost:3000";
      const evalUrl = `${appUrl}/evaluaciones360`;
      const template = {
        subject:    evaluation.emailSubject,
        body:       evaluation.emailBody,
        buttonText: evaluation.emailButtonText,
        footer:     evaluation.emailFooter,
      };

      Promise.allSettled(
        Array.from(uniqueEvaluators.entries()).map(([email, name]) =>
          sendSurveyInvitation({
            to: email, recipientName: name,
            surveyTitle: evaluation.title, surveyDescription: evaluation.description ?? "",
            surveyUrl: evalUrl, isReminder: true, template,
          })
        )
      ).catch((err) => console.error("[invite new 360]", err));
    }

    return NextResponse.json({ created: created.count });
  } catch (error) {
    console.error("[POST participants]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();
    if (roleData?.role !== "admin") return NextResponse.json({ error: "Sin permiso" }, { status: 403 });

    const { assignmentId } = await request.json();
    await prisma.evaluation360Assignment.delete({ where: { id: assignmentId, evaluationId: id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[DELETE participant]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
