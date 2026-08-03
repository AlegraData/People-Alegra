"use client";
import { useState } from "react";
import { Eye, Pencil } from "lucide-react";
import type { EmailTemplateConfig, EmailTemplateContext } from "@/lib/emailTemplate";
import { buildEmailHtml } from "@/lib/emailTemplate";
import RichTextEditor from "@/components/clima/RichTextEditor";

interface Props {
  value: EmailTemplateConfig;
  onChange: (v: EmailTemplateConfig) => void;
  surveyTitle: string;
}

// Editor de la plantilla del correo de ENVÍO DE REPORTES — hermano de
// clima/EmailTemplateEditor.tsx (el de invitación/recordatorio), no una
// generalización de ese componente: ya se comparte entre 3 módulos con una
// semántica de "invitación" (placeholders "Comenzar encuesta", envío de
// prueba contra /api/email/survey-invite) que no aplica a "tu reporte ya
// está disponible" — meter un tercer modo ahí hubiera ensuciado los 2 usos
// que ya funcionan por un ahorro de código bajo.
export default function EvalReportSendEmailEditor({ value, onChange, surveyTitle }: Props) {
  const [tab, setTab] = useState<"edit" | "preview">("edit");

  const mockCtx: EmailTemplateContext = {
    recipientName: "Juan Pérez",
    surveyTitle:   surveyTitle || "Feedback 360°",
    surveyUrl:     "#",
    isReminder:    false,
    showFallbackLink: false,
  };

  const previewCfg: EmailTemplateConfig = {
    subject:    value.subject?.trim() || `Tu reporte de Feedback 360° — ${mockCtx.surveyTitle} — ya está disponible`,
    body:       value.body?.trim() || `
      <p style="margin:0 0 8px;font-size:24px;font-weight:800;color:#1e293b;line-height:1.2;">¡Hola, Juan!</p>
      <p style="margin:0;font-size:15px;color:#64748b;line-height:1.6;">Ya está disponible tu reporte de resultados de Feedback 360°. Lo encontrarás adjunto en PDF a este correo, y también puedes verlo o descargarlo desde la plataforma.</p>`,
    buttonText: value.buttonText?.trim() || "Ver mi reporte →",
    footer:     value.footer,
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("edit")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            tab === "edit" ? "bg-white text-[#1e293b] shadow-sm" : "text-[#64748b] hover:text-[#1e293b]"
          }`}
        >
          <Pencil className="w-3 h-3" /> Editar
        </button>
        <button
          onClick={() => setTab("preview")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            tab === "preview" ? "bg-white text-[#1e293b] shadow-sm" : "text-[#64748b] hover:text-[#1e293b]"
          }`}
        >
          <Eye className="w-3 h-3" /> Vista previa
        </button>
      </div>

      {tab === "edit" && (
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase text-[#64748b] mb-1.5">Asunto del correo</label>
            <input
              value={value.subject ?? ""}
              onChange={(e) => onChange({ ...value, subject: e.target.value })}
              placeholder={`Tu reporte de Feedback 360° — ${surveyTitle || "tu encuesta"} — ya está disponible`}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <label className="block text-xs font-bold uppercase text-[#64748b]">Contenido del mensaje</label>
              <button
                type="button"
                onClick={() => onChange({ ...value, body: `${value.body ?? ""} [Nombre]` })}
                className="text-[10px] font-bold text-primary hover:underline shrink-0"
              >
                + Insertar [Nombre]
              </button>
            </div>
            <RichTextEditor
              value={value.body ?? ""}
              onChange={(v) => onChange({ ...value, body: v })}
              placeholder="Escribe el mensaje... (por defecto: saludo + aviso de que el reporte está disponible)"
              minHeight={120}
            />
            <p className="text-[10px] text-[#94a3b8] mt-1.5">
              Escribe <strong>[Nombre]</strong> en cualquier parte (asunto, mensaje, botón o pie) y se reemplaza
              automáticamente por el nombre de pila real de cada destinatario al enviar — usa
              <strong> [Nombre completo]</strong> si quieres el nombre completo. La tarjeta con el nombre de la
              encuesta y el botón de acción se añaden automáticamente. El PDF va adjunto al correo.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-[#64748b] mb-1.5">Texto del botón</label>
            <input
              value={value.buttonText ?? ""}
              onChange={(e) => onChange({ ...value, buttonText: e.target.value })}
              placeholder="Ver mi reporte →"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-[#64748b] mb-1.5">Pie de correo</label>
            <textarea
              value={value.footer ?? ""}
              onChange={(e) => {
                onChange({ ...value, footer: e.target.value });
                e.target.style.height = "auto";
                e.target.style.height = e.target.scrollHeight + "px";
              }}
              rows={2}
              style={{ minHeight: "60px" }}
              placeholder="Este correo fue enviado por People Alegra."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors resize-none overflow-hidden"
            />
          </div>
        </div>
      )}

      {tab === "preview" && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <span className="text-xs text-[#94a3b8] font-medium flex-1 text-center">
              Vista previa · Correo a &quot;Juan Pérez&quot;
            </span>
          </div>
          <iframe
            key={JSON.stringify(value) + surveyTitle}
            srcDoc={buildEmailHtml(previewCfg, mockCtx)}
            title="Vista previa del correo"
            className="w-full border-none"
            style={{ height: "560px" }}
            sandbox="allow-same-origin"
          />
        </div>
      )}
    </div>
  );
}
