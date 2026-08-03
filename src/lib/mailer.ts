import nodemailer from "nodemailer";
import type { EmailTemplateConfig, EmailTemplateContext } from "./emailTemplate";
import { buildEmailHtml, resolveSubject } from "./emailTemplate";

// Pool de conexiones: sin él, cada sendMail abre una conexión SMTP con login
// propio y Gmail bloquea la cuenta en envíos masivos (454 Too many login attempts).
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  pool: true,
  maxConnections: 3,
  maxMessages: 200,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export interface InvitationPayload {
  to: string;
  recipientName: string;
  surveyTitle: string;
  surveyDescription?: string | null;
  surveyUrl: string;
  isReminder?: boolean;
  template?: EmailTemplateConfig | null;
  showFallbackLink?: boolean;
}

export async function sendSurveyInvitation(payload: InvitationPayload) {
  const ctx: EmailTemplateContext = {
    recipientName:    payload.recipientName,
    surveyTitle:      payload.surveyTitle,
    surveyDescription: payload.surveyDescription,
    surveyUrl:        payload.surveyUrl,
    isReminder:       payload.isReminder ?? false,
    showFallbackLink: payload.showFallbackLink,
  };

  const cfg     = payload.template ?? {};
  const subject = resolveSubject(cfg, ctx);
  const html    = buildEmailHtml(cfg, ctx);

  await transporter.sendMail({
    from: `"People Alegra" <${process.env.GMAIL_USER}>`,
    to:   payload.to,
    subject,
    html,
  });
}

export interface ReportEmailPayload {
  to: string;
  recipientName: string;
  surveyTitle: string;
  /** URL a la que apunta el botón del correo (la app, donde ve/descarga el PDF). */
  appUrl: string;
  template?: EmailTemplateConfig | null;
  pdfBuffer: Buffer;
  pdfFileName: string;
}

// A diferencia de sendSurveyInvitation, acá SIEMPRE se resuelven subject/body/
// buttonText propios antes de llamar a buildEmailHtml — sus defaults internos
// ("Comenzar encuesta", saludo de invitación, etc.) son de encuesta, no de
// "tu reporte ya está disponible", así que depender de ellos daría un correo
// con el tono equivocado apenas el admin deje algún campo de la plantilla vacío.
export async function sendReportEmail(payload: ReportEmailPayload) {
  const firstName = payload.recipientName.split(" ")[0];
  const ctx: EmailTemplateContext = {
    recipientName: payload.recipientName,
    surveyTitle:   payload.surveyTitle,
    surveyUrl:     payload.appUrl,
    isReminder:    false,
    showFallbackLink: false,
  };

  const cfg: EmailTemplateConfig = {
    subject: payload.template?.subject?.trim() ||
      `Tu reporte de Feedback 360° — ${payload.surveyTitle} — ya está disponible`,
    body: payload.template?.body?.trim() || `
      <p style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1e293b;line-height:1.2;">¡Hola, ${firstName}!</p>
      <p style="margin:0;font-size:15px;color:#64748b;line-height:1.6;">Ya está disponible tu reporte de resultados de Feedback 360°. Lo encontrarás adjunto en PDF a este correo, y también puedes verlo o descargarlo desde la plataforma.</p>`,
    buttonText: payload.template?.buttonText?.trim() || "Ver mi reporte →",
    footer: payload.template?.footer,
  };

  const subject = resolveSubject(cfg, ctx);
  const html    = buildEmailHtml(cfg, ctx);

  await transporter.sendMail({
    from: `"People Alegra" <${process.env.GMAIL_USER}>`,
    to:   payload.to,
    subject,
    html,
    attachments: [{ filename: payload.pdfFileName, content: payload.pdfBuffer, contentType: "application/pdf" }],
  });
}
