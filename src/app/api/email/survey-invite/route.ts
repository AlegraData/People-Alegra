export const dynamic = "force-dynamic";
import { NextResponse }         from "next/server";
import { createClient }         from "@/utils/supabase/server";
import { supabaseAdmin }        from "@/utils/supabase/admin";
import prisma                   from "@/lib/prisma";
import { sendSurveyInvitation } from "@/lib/mailer";
import type { EmailTemplateConfig } from "@/lib/emailTemplate";

// POST /api/email/survey-invite
// Modos:
//   1. Test send:   { testEmail, template, surveyTitle, surveyDescription?, isReminder? }
//   2. Real send:   { surveyId, employeeIds?, isReminder?, template? }
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user)
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });

    const { data: roleData } = await supabaseAdmin
      .from("user_roles").select("role").eq("user_id", user.id).single();
    if (roleData?.role !== "admin")
      return NextResponse.json({ error: "Sin permisos" }, { status: 403 });

    const body = await request.json();
    const {
      surveyId,
      employeeIds,
      isReminder   = false,
      testEmail,
      template,
      surveyTitle:   bodyTitle,
      surveyDescription: bodyDesc,
    } = body as {
      surveyId?: string;
      employeeIds?: string[];
      isReminder?: boolean;
      testEmail?: string;
      template?: EmailTemplateConfig;
      surveyTitle?: string;
      surveyDescription?: string;
    };

    const appUrl    = process.env.APP_URL ?? "http://localhost:3000";
    const surveyUrl = `${appUrl}/clima`;

    // ── Modo test: enviar solo al correo de prueba ──────────────────────────
    if (testEmail) {
      let title = bodyTitle || "Vista previa";
      let desc  = bodyDesc  || undefined;
      let tmpl  = template  ?? {};

      // Si hay surveyId, combinar con el template almacenado (el body override gana)
      if (surveyId) {
        const survey = await prisma.climateSurvey.findUnique({ where: { id: surveyId } });
        if (survey) {
          title = survey.title;
          desc  = survey.description ?? undefined;
          tmpl  = {
            subject:    template?.subject    ?? survey.emailSubject,
            body:       template?.body       ?? survey.emailBody,
            buttonText: template?.buttonText ?? survey.emailButtonText,
            footer:     template?.footer     ?? survey.emailFooter,
          };
        }
      }

      await sendSurveyInvitation({
        to:               testEmail,
        recipientName:    "Juan Pérez",
        surveyTitle:      title,
        surveyDescription: desc,
        surveyUrl,
        isReminder,
        template:         tmpl,
      });

      return NextResponse.json({ sent: 1 });
    }

    // ── Modo real: requiere surveyId ────────────────────────────────────────
    if (!surveyId)
      return NextResponse.json({ error: "surveyId requerido" }, { status: 400 });

    const survey = await prisma.climateSurvey.findUnique({ where: { id: surveyId } });
    if (!survey)
      return NextResponse.json({ error: "Encuesta no encontrada" }, { status: 404 });

    // Template a usar: override del body > almacenado en la encuesta
    const resolvedTemplate: EmailTemplateConfig = {
      subject:    template?.subject    ?? survey.emailSubject,
      body:       template?.body       ?? survey.emailBody,
      buttonText: template?.buttonText ?? survey.emailButtonText,
      footer:     template?.footer     ?? survey.emailFooter,
    };

    let query = supabaseAdmin
      .from("climate_survey_assignments")
      .select(`
        employee_id,
        completed_at,
        employees!inner(
          id,
          email,
          employee_personal_info(nombres, primer_apellido, es_actual)
        )
      `)
      .eq("survey_id", surveyId);

    if (employeeIds?.length) {
      query = query.in("employee_id", employeeIds);
    } else {
      query = query.is("completed_at", null);
    }

    const { data: assignments, error: assignError } = await query;
    if (assignError)
      return NextResponse.json({ error: "Error al obtener participantes" }, { status: 500 });

    if (!assignments || assignments.length === 0)
      return NextResponse.json({ sent: 0, message: "No hay destinatarios pendientes" });

    let sent = 0;
    const errors: string[] = [];
    const chunks = chunkArray(assignments, 10);

    for (const chunk of chunks) {
      await Promise.allSettled(
        chunk.map(async (a: any) => {
          const emp      = a.employees;
          const infoList = emp.employee_personal_info ?? [];
          const info     = infoList.find((i: any) => i.es_actual) ?? infoList[0];
          const name     = info
            ? `${info.nombres ?? ""} ${info.primer_apellido ?? ""}`.trim()
            : emp.email;

          try {
            await sendSurveyInvitation({
              to:               emp.email,
              recipientName:    name || emp.email,
              surveyTitle:      survey.title,
              surveyDescription: survey.description,
              surveyUrl,
              isReminder,
              template:         resolvedTemplate,
            });
            sent++;
          } catch (err: any) {
            errors.push(`${emp.email}: ${err.message}`);
          }
        })
      );
    }

    return NextResponse.json({
      sent,
      total: assignments.length,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    console.error("[POST /api/email/survey-invite]", error);
    return NextResponse.json({ error: "Error interno al enviar correos" }, { status: 500 });
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}
