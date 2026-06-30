const WEBHOOK_URL = process.env.GOOGLE_CHAT_WEBHOOK_360;

const TYPE_LABELS: Record<string, string> = {
  ascendente:     "Ascendente",
  descendente:    "Descendente",
  paralela:       "Paralela",
  autoevaluacion: "Autoevaluación",
};

export interface ChangeRequestNotifyPayload {
  evaluationTitle: string;
  requestorName:   string;
  requestorEmail:  string;
  action:          "add" | "remove";
  targetName:      string;
  targetEmail:     string;
  targetType:      string;
  status:          "pending" | "approved" | "rejected";
  adminNote?:      string | null;
  adminEmail?:     string | null;
  reason?:         string | null;
}

export function notifyChangeRequest(payload: ChangeRequestNotifyPayload): void {
  if (!WEBHOOK_URL) return;

  const actionLabel = payload.action === "add" ? "➕ Agregar evaluado" : "➖ Quitar evaluado";
  const statusEmoji = { pending: "🟡", approved: "✅", rejected: "❌" }[payload.status];
  const statusLabel = {
    pending:  "Pendiente — esperando aprobación",
    approved: "Aprobada",
    rejected: "Rechazada",
  }[payload.status];
  const typeLabel = TYPE_LABELS[payload.targetType] ?? payload.targetType;

  const widgets: object[] = [
    { decoratedText: { topLabel: "Acción",            text: actionLabel } },
    { decoratedText: { topLabel: "Solicitante",        text: `${payload.requestorName || payload.requestorEmail} <${payload.requestorEmail}>` } },
    { decoratedText: { topLabel: "Persona solicitada", text: `${payload.targetName || payload.targetEmail} <${payload.targetEmail}>` } },
    { decoratedText: { topLabel: "Tipo de evaluación", text: typeLabel } },
  ];
  if (payload.reason)     widgets.push({ decoratedText: { topLabel: "Motivo",                   text: payload.reason } });
  if (payload.adminEmail) widgets.push({ decoratedText: { topLabel: "Revisado por",              text: payload.adminEmail } });
  if (payload.adminNote)  widgets.push({ decoratedText: { topLabel: "Nota del administrador",   text: payload.adminNote } });

  const body = JSON.stringify({
    cardsV2: [{
      cardId: `cr-360-${Date.now()}`,
      card: {
        header: {
          title:    `${statusEmoji} Solicitud 360° — ${statusLabel}`,
          subtitle: payload.evaluationTitle,
        },
        sections: [{ widgets }],
      },
    }],
  });

  fetch(WEBHOOK_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch((err) => console.error("[googleChat.notifyChangeRequest]", err));
}
