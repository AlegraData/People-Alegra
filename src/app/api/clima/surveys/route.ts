export const dynamic = "force-dynamic";
import { NextResponse }         from "next/server";
import prisma                   from "@/lib/prisma";
import { createClient }         from "@/utils/supabase/server";
import { supabaseAdmin }        from "@/utils/supabase/admin";
import { sendSurveyInvitation } from "@/lib/mailer";

// GET: Encuestas según el rol del usuario
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id).single();
    const role = roleData?.role ?? "viewer";

    // ── Admin / Manager: todas las encuestas con conteos ──────────────────
    if (role === "admin" || role === "manager") {
      const surveys = await prisma.climateSurvey.findMany({
        include: { _count: { select: { responses: true } } },
        orderBy: { createdAt: "desc" },
      });

      const surveyIds = surveys.map((s) => s.id);
      const { data: assignmentRows } = surveyIds.length
        ? await supabaseAdmin.from("climate_survey_assignments").select("survey_id").in("survey_id", surveyIds)
        : { data: [] };

      const assignmentMap = new Map<string, number>();
      (assignmentRows ?? []).forEach((a) => {
        const sid = a.survey_id as string;
        assignmentMap.set(sid, (assignmentMap.get(sid) ?? 0) + 1);
      });

      // Compute hasResponded for the current user (needed when admin participates)
      let respondedIds = new Set<string>();
      const employee = await prisma.employee.findUnique({ where: { email: user.email! } });
      if (employee && surveyIds.length) {
        const myResponses = await prisma.climateSurveyResponse.findMany({
          where: { employeeId: employee.id, surveyId: { in: surveyIds } },
          select: { surveyId: true },
        });
        respondedIds = new Set(myResponses.map((r) => r.surveyId));
      }

      return NextResponse.json(
        surveys.map((s) => ({
          ...s,
          responsesCount:   s._count.responses,
          assignmentsCount: assignmentMap.get(s.id) ?? 0,
          hasResponded:     respondedIds.has(s.id),
        }))
      );
    }

    // ── Viewer: solo encuestas asignadas (o sin asignación) + hasResponded ─
    const employee = await prisma.employee.findUnique({ where: { email: user.email! } });
    if (!employee) return NextResponse.json([]);

    const [{ data: myAssignments }, { data: allAssignments }] = await Promise.all([
      supabaseAdmin.from("climate_survey_assignments").select("survey_id").eq("employee_id", employee.id),
      supabaseAdmin.from("climate_survey_assignments").select("survey_id"),
    ]);

    const myIds                  = new Set((myAssignments  ?? []).map((a) => a.survey_id as string));
    const idsWithAnyAssignment   = new Set((allAssignments ?? []).map((a) => a.survey_id as string));

    const surveys = await prisma.climateSurvey.findMany({
      where: { isActive: true },
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: "desc" },
    });

    const visible = surveys.filter((s) => !idsWithAnyAssignment.has(s.id) || myIds.has(s.id));
    const visibleIds = visible.map((s) => s.id);

    // Comprobar cuáles ya respondió este empleado
    const myResponses = await prisma.climateSurveyResponse.findMany({
      where: { employeeId: employee.id, surveyId: { in: visibleIds } },
      select: { surveyId: true },
    });
    const respondedIds = new Set(myResponses.map((r) => r.surveyId));

    return NextResponse.json(
      visible.map((s) => ({
        ...s,
        responsesCount:   s._count.responses,
        assignmentsCount: 0,
        hasResponded:     respondedIds.has(s.id),
      }))
    );
  } catch (error) {
    console.error("[GET /api/clima/surveys]", error);
    return NextResponse.json({ error: "Error interno al obtener encuestas" }, { status: 500 });
  }
}

// POST: Crear encuesta con participantes
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const {
      title, description, questions, participantIds,
      introEnabled, introMessage, termsEnabled, termsText,
      emailSubject, emailBody, emailButtonText, emailFooter,
    } = body;

    if (!title?.trim())
      return NextResponse.json({ error: "El título es requerido" }, { status: 400 });
    if (!Array.isArray(questions) || questions.length === 0)
      return NextResponse.json({ error: "Se requiere al menos una pregunta" }, { status: 400 });
    if (!Array.isArray(participantIds) || participantIds.length === 0)
      return NextResponse.json({ error: "Se requiere al menos un participante" }, { status: 400 });

    const survey = await prisma.climateSurvey.create({
      data: {
        title: title.trim(),
        description: description?.trim() ?? "",
        questions,
        isActive: true,
        introEnabled: introEnabled ?? true,
        introMessage: introMessage?.trim() || null,
        termsEnabled: termsEnabled ?? false,
        termsText: termsText?.trim() || null,
        emailSubject:    emailSubject?.trim()    || null,
        emailBody:       emailBody?.trim()       || null,
        emailButtonText: emailButtonText?.trim() || null,
        emailFooter:     emailFooter?.trim()     || null,
      },
    });

    await supabaseAdmin.from("climate_survey_assignments").insert(
      (participantIds as string[]).map((employeeId) => ({ survey_id: survey.id, employee_id: employeeId }))
    );

    // Auto-envío de invitaciones en segundo plano (no bloquea la respuesta)
    sendInvitationsToAll(survey.id, {
      title: survey.title,
      description: survey.description ?? "",
      emailSubject:    survey.emailSubject,
      emailBody:       survey.emailBody,
      emailButtonText: survey.emailButtonText,
      emailFooter:     survey.emailFooter,
    }).catch((err) => console.error("[auto-invite] Error enviando correos:", err));

    return NextResponse.json(
      { ...survey, responsesCount: 0, assignmentsCount: participantIds.length },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/clima/surveys]", error);
    return NextResponse.json({ error: "Error interno al crear la encuesta" }, { status: 500 });
  }
}

async function sendInvitationsToAll(
  surveyId: string,
  info: { title: string; description: string; emailSubject?: string | null; emailBody?: string | null; emailButtonText?: string | null; emailFooter?: string | null }
) {
  const { data: assignments } = await supabaseAdmin
    .from("climate_survey_assignments")
    .select(`
      employee_id,
      employees!inner(
        email,
        employee_personal_info(nombres, primer_apellido, es_actual)
      )
    `)
    .eq("survey_id", surveyId);

  if (!assignments?.length) return;

  const appUrl    = process.env.APP_URL ?? "http://localhost:3000";
  const surveyUrl = `${appUrl}/clima/encuesta/${surveyId}`;
  const template  = {
    subject:    info.emailSubject,
    body:       info.emailBody,
    buttonText: info.emailButtonText,
    footer:     info.emailFooter,
  };

  await Promise.allSettled(
    assignments.map(async (a: any) => {
      const emp      = a.employees;
      const infoList = emp.employee_personal_info ?? [];
      const active   = infoList.find((i: any) => i.es_actual) ?? infoList[0];
      const name     = active
        ? `${active.nombres ?? ""} ${active.primer_apellido ?? ""}`.trim()
        : emp.email;

      await sendSurveyInvitation({
        to: emp.email, recipientName: name || emp.email,
        surveyTitle: info.title, surveyDescription: info.description,
        surveyUrl, isReminder: false, template,
      });
    })
  );
}
