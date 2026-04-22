export interface EmailTemplateConfig {
  subject?: string | null;
  body?: string | null;
  buttonText?: string | null;
  footer?: string | null;
}

export interface EmailTemplateContext {
  recipientName: string;
  surveyTitle: string;
  surveyDescription?: string | null;
  surveyUrl: string;
  isReminder: boolean;
}

export function resolveSubject(cfg: EmailTemplateConfig, ctx: EmailTemplateContext): string {
  return (
    cfg.subject?.trim() ||
    (ctx.isReminder
      ? `Recordatorio: ${ctx.surveyTitle} — aún puedes responder`
      : `Invitación: ${ctx.surveyTitle}`)
  );
}

export function buildEmailHtml(cfg: EmailTemplateConfig, ctx: EmailTemplateContext): string {
  const action    = ctx.isReminder ? "Recordatorio" : "Invitación";
  const firstName = ctx.recipientName.split(" ")[0];

  const defaultBody = `
    <p style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1e293b;line-height:1.2;">
      ¡Hola, ${firstName}!
    </p>
    <p style="margin:0 0 0;font-size:15px;color:#64748b;line-height:1.6;">
      ${ctx.isReminder
        ? "Recordatorio: aún tienes una encuesta pendiente"
        : "Te invitamos a participar en una encuesta de clima organizacional"}
    </p>`;

  const bodyHtml   = cfg.body?.trim() || defaultBody;
  const buttonText = cfg.buttonText?.trim() || (ctx.isReminder ? "Completar encuesta →" : "Comenzar encuesta →");
  const footerHtml = cfg.footer?.trim() ||
    'Este correo fue enviado por <strong style="color:#64748b;">People Alegra</strong>.<br/>Tus respuestas son confidenciales y se procesarán de forma agregada.';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${action}: ${ctx.surveyTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:#1e293b;border-radius:20px 20px 0 0;padding:28px 40px;text-align:center;">
              <span style="font-size:22px;font-weight:900;color:#ffffff;letter-spacing:-0.5px;">
                People <span style="color:#00D6BC;">Alegra</span>
              </span>
            </td>
          </tr>

          <!-- Banda decorativa -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#00D6BC,#00b8a3,rgba(0,214,188,0.4));"></td>
          </tr>

          <!-- Cuerpo -->
          <tr>
            <td style="background:#ffffff;padding:40px 40px 32px;">

              <!-- Contenido personalizado -->
              <div style="font-family:'Segoe UI',Arial,sans-serif;font-size:15px;color:#64748b;line-height:1.6;margin-bottom:24px;">
                ${bodyHtml}
              </div>

              <!-- Tarjeta encuesta -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;margin-bottom:28px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:800;color:#00b8a3;text-transform:uppercase;letter-spacing:1px;">
                      Encuesta
                    </p>
                    <p style="margin:0 0 10px;font-size:18px;font-weight:800;color:#1e293b;line-height:1.3;">
                      ${ctx.surveyTitle}
                    </p>
                    ${ctx.surveyDescription ? `
                    <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6;">
                      ${ctx.surveyDescription}
                    </p>` : ""}
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#1e293b;border-radius:12px;">
                    <a href="${ctx.surveyUrl}"
                      style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:0.3px;">
                      ${buttonText}
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Nota -->
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
                <a href="${ctx.surveyUrl}" style="color:#00b8a3;word-break:break-all;">${ctx.surveyUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-radius:0 0 20px 20px;padding:20px 40px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                ${footerHtml}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
