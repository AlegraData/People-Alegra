import nodemailer from "nodemailer";
import type { EmailTemplateConfig, EmailTemplateContext } from "./emailTemplate";
import { buildEmailHtml, resolveSubject } from "./emailTemplate";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
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
}

export async function sendSurveyInvitation(payload: InvitationPayload) {
  const ctx: EmailTemplateContext = {
    recipientName:    payload.recipientName,
    surveyTitle:      payload.surveyTitle,
    surveyDescription: payload.surveyDescription,
    surveyUrl:        payload.surveyUrl,
    isReminder:       payload.isReminder ?? false,
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
