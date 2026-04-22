"use client";
import { useState } from "react";
import { Eye, Mail, Pencil, Send } from "lucide-react";
import type { EmailTemplateConfig, EmailTemplateContext } from "@/lib/emailTemplate";
import { buildEmailHtml } from "@/lib/emailTemplate";
import RichTextEditor from "./RichTextEditor";

interface Props {
  value: EmailTemplateConfig;
  onChange: (v: EmailTemplateConfig) => void;
  surveyTitle: string;
  surveyDescription?: string;
  isReminder?: boolean;
  surveyId?: string;
}

export default function EmailTemplateEditor({
  value, onChange, surveyTitle, surveyDescription, isReminder = false, surveyId,
}: Props) {
  const [tab, setTab]             = useState<"edit" | "preview">("edit");
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending]   = useState(false);
  const [testStatus, setTestStatus]     = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const mockCtx: EmailTemplateContext = {
    recipientName:    "Juan Pérez",
    surveyTitle:      surveyTitle || "Nombre de la encuesta",
    surveyDescription,
    surveyUrl:        "#",
    isReminder,
  };

  const handleTestSend = async () => {
    if (!testEmail.trim()) return;
    setTestSending(true);
    setTestStatus(null);
    try {
      const res = await fetch("/api/email/survey-invite", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testEmail:        testEmail.trim(),
          template:         value,
          surveyId:         surveyId,
          surveyTitle:      surveyTitle || "Encuesta de prueba",
          surveyDescription: surveyDescription,
          isReminder,
        }),
      });
      const data = await res.json();
      if (res.ok && data.sent > 0) {
        setTestStatus({ type: "success", msg: `Prueba enviada a ${testEmail}` });
      } else {
        setTestStatus({ type: "error", msg: data.error ?? "No se pudo enviar" });
      }
    } catch {
      setTestStatus({ type: "error", msg: "Error de red al enviar" });
    } finally {
      setTestSending(false);
      setTimeout(() => setTestStatus(null), 6000);
    }
  };

  return (
    <div className="space-y-4">

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        <button
          onClick={() => setTab("edit")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            tab === "edit" ? "bg-white text-[#1e293b] shadow-sm" : "text-[#64748b] hover:text-[#1e293b]"
          }`}
        >
          <Pencil className="w-3 h-3" />
          Editar
        </button>
        <button
          onClick={() => setTab("preview")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            tab === "preview" ? "bg-white text-[#1e293b] shadow-sm" : "text-[#64748b] hover:text-[#1e293b]"
          }`}
        >
          <Eye className="w-3 h-3" />
          Vista previa
        </button>
      </div>

      {/* ── Modo edición ──────────────────────────────────────────────────── */}
      {tab === "edit" && (
        <div className="space-y-5">

          {/* Asunto */}
          <div>
            <label className="block text-xs font-bold uppercase text-[#64748b] mb-1.5">Asunto del correo</label>
            <input
              value={value.subject ?? ""}
              onChange={(e) => onChange({ ...value, subject: e.target.value })}
              placeholder={
                isReminder
                  ? `Recordatorio: ${surveyTitle || "tu encuesta"} — aún puedes responder`
                  : `Invitación: ${surveyTitle || "tu encuesta"}`
              }
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Cuerpo */}
          <div>
            <label className="block text-xs font-bold uppercase text-[#64748b] mb-1.5">
              Contenido del mensaje
            </label>
            <RichTextEditor
              value={value.body ?? ""}
              onChange={(v) => onChange({ ...value, body: v })}
              placeholder={
                isReminder
                  ? "Escribe el mensaje del recordatorio... (por defecto: saludo + texto de recordatorio)"
                  : "Escribe el mensaje de invitación... (por defecto: saludo + texto de bienvenida)"
              }
              minHeight={120}
            />
            <p className="text-[10px] text-[#94a3b8] mt-1.5">
              La tarjeta con el nombre de la encuesta y el botón de acción se añaden automáticamente.
            </p>
          </div>

          {/* Texto del botón */}
          <div>
            <label className="block text-xs font-bold uppercase text-[#64748b] mb-1.5">Texto del botón</label>
            <input
              value={value.buttonText ?? ""}
              onChange={(e) => onChange({ ...value, buttonText: e.target.value })}
              placeholder={isReminder ? "Completar encuesta →" : "Comenzar encuesta →"}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Pie de correo */}
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
              placeholder="Este correo fue enviado por People Alegra. Tus respuestas son confidenciales y se procesarán de forma agregada."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors resize-none overflow-hidden"
            />
          </div>

          {/* Enviar prueba */}
          <div className="border-t border-slate-100 pt-4">
            <p className="text-xs font-bold uppercase text-[#64748b] mb-2 flex items-center gap-1.5">
              <Mail className="w-3 h-3" />
              Enviar prueba
            </p>
            {testStatus && (
              <div className={`text-xs font-semibold px-3 py-2 rounded-lg mb-2 border ${
                testStatus.type === "success"
                  ? "bg-[#10B981]/10 text-[#10B981] border-[#10B981]/20"
                  : "bg-red-50 text-red-600 border-red-200"
              }`}>
                {testStatus.msg}
              </div>
            )}
            <div className="flex gap-2">
              <input
                type="email"
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                onKeyDown={(e) => e.key === "Enter" && handleTestSend()}
              />
              <button
                onClick={handleTestSend}
                disabled={testSending || !testEmail.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1e293b] text-white rounded-xl text-xs font-bold hover:bg-primary transition-all disabled:opacity-40"
              >
                {testSending
                  ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send className="w-3 h-3" />}
                {testSending ? "Enviando..." : "Enviar prueba"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Vista previa ──────────────────────────────────────────────────── */}
      {tab === "preview" && (
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          {/* Barra de "navegador" decorativa */}
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-400" />
              <div className="w-3 h-3 rounded-full bg-amber-400" />
              <div className="w-3 h-3 rounded-full bg-green-400" />
            </div>
            <span className="text-xs text-[#94a3b8] font-medium flex-1 text-center">
              Vista previa · Correo a "Juan Pérez"
            </span>
          </div>
          <iframe
            key={JSON.stringify(value) + surveyTitle}
            srcDoc={buildEmailHtml(value, mockCtx)}
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
