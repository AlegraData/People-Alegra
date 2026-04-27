export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/utils/supabase/admin";
import { sendSurveyInvitation } from "@/lib/mailer";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();
    const role = roleData?.role ?? "viewer";

    if (role === "admin" || role === "manager") {
      const evals = await prisma.evaluation360.findMany({ orderBy: { createdAt: "desc" } });
      const evalIds = evals.map((e) => e.id);

      const [allCounts, submittedCounts] = evalIds.length
        ? await Promise.all([
            prisma.evaluation360Assignment.groupBy({ by: ["evaluationId"], _count: { _all: true }, where: { evaluationId: { in: evalIds } } }),
            prisma.evaluation360Assignment.groupBy({ by: ["evaluationId"], _count: { _all: true }, where: { evaluationId: { in: evalIds }, status: "submitted" } }),
          ])
        : [[], []];

      const countMap     = new Map(allCounts.map((c) => [c.evaluationId, c._count._all]));
      const submittedMap = new Map(submittedCounts.map((c) => [c.evaluationId, c._count._all]));

      // Also include the current user's own assignments so admins can participate as evaluators
      const myOwnAssignments = evalIds.length
        ? await prisma.evaluation360Assignment.findMany({
            where: { evaluationId: { in: evalIds }, evaluatorEmail: user.email! },
          })
        : [];

      const myAssignmentsByEval = new Map<string, typeof myOwnAssignments>();
      myOwnAssignments.forEach((a) => {
        myAssignmentsByEval.set(a.evaluationId, [...(myAssignmentsByEval.get(a.evaluationId) ?? []), a]);
      });

      return NextResponse.json(
        evals.map((e) => ({
          ...e,
          assignmentsCount: countMap.get(e.id) ?? 0,
          submittedCount:   submittedMap.get(e.id) ?? 0,
          myAssignments:    myAssignmentsByEval.get(e.id) ?? [],
        }))
      );
    }

    // Viewer: evaluaciones donde el usuario es evaluador
    const myAssignments = await prisma.evaluation360Assignment.findMany({
      where: { evaluatorEmail: user.email! },
      select: { evaluationId: true },
      distinct: ["evaluationId"],
    });
    const myEvalIds = myAssignments.map((a) => a.evaluationId);
    if (!myEvalIds.length) return NextResponse.json([]);

    const evals = await prisma.evaluation360.findMany({
      where: { id: { in: myEvalIds }, status: "active" },
      orderBy: { createdAt: "desc" },
    });

    const userAssignments = await prisma.evaluation360Assignment.findMany({
      where: { evaluationId: { in: myEvalIds }, evaluatorEmail: user.email! },
    });

    const assignmentsByEval = new Map<string, typeof userAssignments>();
    userAssignments.forEach((a) => {
      assignmentsByEval.set(a.evaluationId, [...(assignmentsByEval.get(a.evaluationId) ?? []), a]);
    });

    return NextResponse.json(
      evals.map((e) => ({
        ...e,
        assignmentsCount: assignmentsByEval.get(e.id)?.length ?? 0,
        submittedCount:   assignmentsByEval.get(e.id)?.filter((a) => a.status === "submitted").length ?? 0,
        myAssignments:    assignmentsByEval.get(e.id) ?? [],
      }))
    );
  } catch (error) {
    console.error("[GET /api/evaluaciones360/surveys]", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: roleData } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", user.id).single();
    if (roleData?.role !== "admin") return NextResponse.json({ error: "Solo administradores pueden crear evaluaciones" }, { status: 403 });

    const body = await request.json();
    const {
      title, description, instructions,
      hasAscendente, hasDescendente, hasParalela, hasAutoevaluacion,
      weightAscendente, weightDescendente, weightParalela, weightAutoevaluacion,
      questions, participants,
      emailSubject, emailBody, emailButtonText, emailFooter,
    } = body;

    if (!title?.trim()) return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
    if (!Array.isArray(questions) || questions.length === 0) return NextResponse.json({ error: "Se requiere al menos una pregunta" }, { status: 400 });
    if (!Array.isArray(participants) || participants.length === 0) return NextResponse.json({ error: "Se requiere al menos un participante" }, { status: 400 });

    const evaluation = await prisma.evaluation360.create({
      data: {
        title:                title.trim(),
        description:          description?.trim() || null,
        instructions:         instructions?.trim() || null,
        status:               "active",
        hasAscendente:        hasAscendente ?? true,
        hasDescendente:       hasDescendente ?? true,
        hasParalela:          hasParalela ?? true,
        hasAutoevaluacion:    hasAutoevaluacion ?? true,
        weightAscendente:     weightAscendente ?? 25,
        weightDescendente:    weightDescendente ?? 25,
        weightParalela:       weightParalela ?? 25,
        weightAutoevaluacion: weightAutoevaluacion ?? 25,
        questions,
        emailSubject:         emailSubject?.trim() || null,
        emailBody:            emailBody?.trim() || null,
        emailButtonText:      emailButtonText?.trim() || null,
        emailFooter:          emailFooter?.trim() || null,
      },
    });

    await prisma.evaluation360Assignment.createMany({
      data: (participants as any[]).map((p) => ({
        evaluationId:   evaluation.id,
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

    sendInvitationsToAll(evaluation.id, {
      title:          evaluation.title,
      description:    evaluation.description ?? "",
      emailSubject:   evaluation.emailSubject,
      emailBody:      evaluation.emailBody,
      emailButtonText: evaluation.emailButtonText,
      emailFooter:    evaluation.emailFooter,
    }).catch((err) => console.error("[auto-invite 360]", err));

    return NextResponse.json({ ...evaluation, assignmentsCount: participants.length, submittedCount: 0 }, { status: 201 });
  } catch (error) {
    console.error("[POST /api/evaluaciones360/surveys]", error);
    return NextResponse.json({ error: "Error interno al crear la evaluación" }, { status: 500 });
  }
}

async function sendInvitationsToAll(
  evaluationId: string,
  info: { title: string; description: string; emailSubject?: string | null; emailBody?: string | null; emailButtonText?: string | null; emailFooter?: string | null }
) {
  const assignments = await prisma.evaluation360Assignment.findMany({
    where: { evaluationId },
    select: { evaluatorEmail: true, evaluatorName: true },
    distinct: ["evaluatorEmail"],
  });

  const appUrl  = process.env.APP_URL ?? "http://localhost:3000";
  const evalUrl = `${appUrl}/evaluaciones360`;
  const template = { subject: info.emailSubject, body: info.emailBody, buttonText: info.emailButtonText, footer: info.emailFooter };

  await Promise.allSettled(
    assignments.map((a) =>
      sendSurveyInvitation({
        to:               a.evaluatorEmail,
        recipientName:    a.evaluatorName || a.evaluatorEmail,
        surveyTitle:      info.title,
        surveyDescription: info.description,
        surveyUrl:        evalUrl,
        isReminder:       false,
        template,
      })
    )
  );
}
