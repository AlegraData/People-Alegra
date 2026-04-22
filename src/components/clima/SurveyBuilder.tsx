"use client";
import { useState } from "react";
import { ArrowLeft, Copy, Trash2, CheckCircle2, AlertTriangle, X, Plus, MonitorPlay, ShieldCheck, Mail } from "lucide-react";
import type { Question, QuestionType, Survey, SurveyFormData, EmailTemplateConfig, Empleado } from "@/types/clima";
import ParticipantSelector from "./ParticipantSelector";
import RichTextEditor from "./RichTextEditor";
import EmailTemplateEditor from "./EmailTemplateEditor";

type Step = 1 | 2 | 3;
interface SurveyBuilderProps {
  onSave: (data: SurveyFormData) => void;
  onCancel: () => void;
  initialData?: Survey;
  isDuplicate?: boolean;
}


function questionLabel(q: Question): string {
  if (q.type === "rating") return `Calificación ${q.ratingMin ?? 1}–${q.ratingMax ?? 5}`;
  if (q.type === "boolean") return "Sí / No";
  if (q.type === "choice")  return "Opción múltiple";
  return "Texto abierto";
}

export default function SurveyBuilder({ onSave, onCancel, initialData, isDuplicate }: SurveyBuilderProps) {
  const isEditMode = !!initialData && !isDuplicate;

  const [step, setStep]           = useState<Step>(1);
  const [title, setTitle]         = useState(isDuplicate ? `Copia de ${initialData?.title ?? ""}` : (initialData?.title ?? ""));
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [questions, setQuestions] = useState<Question[]>(
    (initialData?.questions as Question[]) ?? []
  );
  const [selectedParticipants, setSelectedParticipants] =
    useState<Map<string, Empleado>>(new Map());

  // ── Pantalla introductoria ────────────────────────────────────────────────────
  const [introEnabled, setIntroEnabled] = useState(initialData?.introEnabled ?? true);
  const [introMessage, setIntroMessage] = useState(initialData?.introMessage ?? "");
  const [termsEnabled, setTermsEnabled] = useState(initialData?.termsEnabled ?? false);
  const [termsText, setTermsText]       = useState(initialData?.termsText ?? "");

  // ── Plantilla de correo ───────────────────────────────────────────────────────
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplateConfig>({
    subject:    isDuplicate ? null : (initialData?.emailSubject    ?? null),
    body:       isDuplicate ? null : (initialData?.emailBody       ?? null),
    buttonText: isDuplicate ? null : (initialData?.emailButtonText ?? null),
    footer:     isDuplicate ? null : (initialData?.emailFooter     ?? null),
  });

  // ── Gestión de preguntas ──────────────────────────────────────────────────────
  const addQuestion = (type: QuestionType) => {
    const base: Question = { id: Date.now().toString(), text: "", type };
    if (type === "rating") base.ratingMin = 1, base.ratingMax = 5;
    if (type === "choice") base.options = ["", "", ""];
    setQuestions((prev) => [...prev, base]);
  };

  const patchQuestion = (id: string, patch: Partial<Question>) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const removeQuestion = (id: string) =>
    setQuestions((prev) => prev.filter((q) => q.id !== id));

  const duplicateQuestion = (id: string) =>
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.id === id);
      if (idx === -1) return prev;
      const clone = { ...prev[idx], options: [...(prev[idx].options ?? [])], id: Date.now().toString() };
      return [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)];
    });

  // Opciones de preguntas choice
  const addOption = (qId: string) =>
    setQuestions((prev) =>
      prev.map((q) => q.id === qId ? { ...q, options: [...(q.options ?? []), ""] } : q)
    );

  const updateOption = (qId: string, idx: number, value: string) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId
          ? { ...q, options: (q.options ?? []).map((o, i) => (i === idx ? value : o)) }
          : q
      )
    );

  const removeOption = (qId: string, idx: number) =>
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qId ? { ...q, options: (q.options ?? []).filter((_, i) => i !== idx) } : q
      )
    );

  // ── Navegación ────────────────────────────────────────────────────────────────
  const goToStep = (next: Step) => {
    if (next >= 2 && !title.trim()) { alert("Añade un título."); return; }
    if (next >= 3 && questions.length === 0) { alert("Añade al menos una pregunta."); return; }
    // Validar que las preguntas choice tengan al menos 2 opciones no vacías
    if (next >= 3) {
      const invalid = questions.find(
        (q) => q.type === "choice" && (q.options ?? []).filter((o) => o.trim()).length < 2
      );
      if (invalid) { alert("Cada pregunta de opción múltiple debe tener al menos 2 opciones."); return; }
    }
    setStep(next);
  };

  const handleConfirm = () => {
    const invalid = questions.find(
      (q) => q.type === "choice" && (q.options ?? []).filter((o) => o.trim()).length < 2
    );
    if (invalid) { alert("Cada pregunta de opción múltiple debe tener al menos 2 opciones."); return; }
    onSave({
      title, description, questions,
      participantIds: Array.from(selectedParticipants.keys()),
      introEnabled, introMessage: introMessage.trim(),
      termsEnabled, termsText: termsText.trim(),
      emailSubject:    emailTemplate.subject?.trim()    ?? "",
      emailBody:       emailTemplate.body?.trim()       ?? "",
      emailButtonText: emailTemplate.buttonText?.trim() ?? "",
      emailFooter:     emailTemplate.footer?.trim()     ?? "",
    });
  };

  const STEPS = isEditMode
    ? [{ label: "Información" }, { label: "Preguntas" }]
    : [{ label: "Información" }, { label: "Preguntas" }, { label: "Participantes" }];

  return (
    <div className={`${step === 3 ? "max-w-5xl" : "max-w-3xl"} mx-auto space-y-6`}>

      {/* Indicador de pasos */}
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const num = (i + 1) as Step;
          const isActive   = step === num;
          const isComplete = step > num;
          return (
            <div key={num} className="flex items-center flex-1 last:flex-none">
              <div
                onClick={() => isComplete && goToStep(num)}
                className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl text-sm font-bold transition-all ${
                  isActive   ? "bg-[#1e293b] text-white" :
                  isComplete ? "bg-primary/10 text-primary cursor-pointer hover:bg-primary/20" :
                               "bg-slate-100 text-[#64748b]"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                  isActive   ? "bg-white text-[#1e293b]" :
                  isComplete ? "bg-primary text-white"   :
                               "bg-slate-200 text-[#64748b]"
                }`}>
                  {isComplete ? <CheckCircle2 className="w-3 h-3" /> : num}
                </span>
                <span className="hidden sm:block">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-2 ${step > num ? "bg-primary" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Paso 1 — Información */}
      {step === 1 && (
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-xl font-bold">{isEditMode ? "Editar Encuesta" : isDuplicate ? "Duplicar Encuesta" : "Nueva Encuesta"}</h3>
              <p className="text-sm text-[#64748b]">Título y descripción</p>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase text-[#64748b] mb-2">Título *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-primary transition-colors"
                placeholder="Ej: Satisfacción Laboral 2025"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-[#64748b] mb-2">Descripción (Opcional)</label>
              <textarea
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = e.target.scrollHeight + "px";
                }}
                rows={3}
                style={{ minHeight: "80px" }}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-primary transition-colors resize-none overflow-hidden"
                placeholder="Instrucciones o contexto para los participantes..."
              />
            </div>

            {/* ── Pantalla introductoria ─────────────────────────────────── */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              {/* Cabecera del bloque */}
              <div className="flex items-center justify-between px-5 py-4 bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                    <MonitorPlay className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1e293b]">Pantalla de bienvenida</p>
                    <p className="text-xs text-[#64748b]">Presentación antes de la primera pregunta</p>
                  </div>
                </div>
                {/* Toggle introEnabled */}
                <button
                  type="button"
                  onClick={() => setIntroEnabled((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                    introEnabled ? "bg-primary" : "bg-slate-200"
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    introEnabled ? "translate-x-6" : "translate-x-1"
                  }`} />
                </button>
              </div>

              {/* Cuerpo expandible */}
              {introEnabled && (
                <div className="px-5 py-5 space-y-5 border-t border-slate-200">
                  {/* Vista previa del contenido automático */}
                  <div className="bg-[#00D6BC]/5 border border-[#00D6BC]/20 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-wider text-primary mb-1.5">
                      Se mostrará automáticamente
                    </p>
                    <p className="text-xs text-[#64748b]">
                      El <strong>título</strong> y la <strong>descripción</strong> de la encuesta aparecerán siempre en la pantalla de bienvenida.
                    </p>
                  </div>

                  {/* Mensaje adicional */}
                  <div>
                    <label className="block text-xs font-bold uppercase text-[#64748b] mb-2">
                      Mensaje de bienvenida adicional <span className="normal-case text-[#94a3b8]">(Opcional)</span>
                    </label>
                    <RichTextEditor
                      value={introMessage}
                      onChange={setIntroMessage}
                      placeholder="Ej: Esta encuesta es completamente anónima. Tus respuestas nos ayudan a mejorar el ambiente de trabajo. Tómate entre 5 y 10 minutos para completarla."
                      minHeight={100}
                    />
                  </div>

                  {/* Toggle términos */}
                  <div className="flex items-start justify-between gap-4 py-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                        <ShieldCheck className="w-4 h-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#1e293b]">Aceptación de términos</p>
                        <p className="text-xs text-[#64748b]">El participante deberá aceptar antes de comenzar</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTermsEnabled((v) => !v)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none ${
                        termsEnabled ? "bg-amber-400" : "bg-slate-200"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        termsEnabled ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  {/* Texto de términos */}
                  {termsEnabled && (
                    <div>
                      <label className="block text-xs font-bold uppercase text-[#64748b] mb-2">
                        Texto de términos y condiciones
                      </label>
                      <textarea
                        value={termsText}
                        onChange={(e) => {
                          setTermsText(e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = e.target.scrollHeight + "px";
                        }}
                        rows={4}
                        style={{ minHeight: "96px" }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-primary transition-colors resize-none overflow-hidden"
                        placeholder="Ej: La información proporcionada es estrictamente confidencial y será utilizada únicamente con fines de análisis organizacional. Las respuestas individuales no serán compartidas con nadie y se procesarán de forma agregada."
                      />
                      <p className="text-[10px] text-[#94a3b8] mt-1.5">
                        Si se deja vacío, se usará un texto de confidencialidad predeterminado.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Plantilla de correo ───────────────────────────────────── */}
            <div className="border border-slate-200 rounded-2xl overflow-hidden">
              <button
                type="button"
                onClick={() => setEmailExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#1e293b]/10 rounded-xl flex items-center justify-center shrink-0">
                    <Mail className="w-4 h-4 text-[#1e293b]" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-bold text-[#1e293b]">Correo de invitación</p>
                    <p className="text-xs text-[#64748b]">Personaliza el correo que recibirán los participantes</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-[#64748b]">{emailExpanded ? "▲" : "▼"}</span>
              </button>

              {emailExpanded && (
                <div className="px-5 py-5 border-t border-slate-200">
                  {!isEditMode && (
                    <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 font-medium">
                      El correo de prueba apuntará a la lista de encuestas hasta que guardes esta encuesta. Una vez creada, el correo real incluirá el enlace directo.
                    </div>
                  )}
                  <EmailTemplateEditor
                    value={emailTemplate}
                    onChange={setEmailTemplate}
                    surveyTitle={title}
                    surveyDescription={description}
                    isReminder={false}
                    surveyId={isEditMode ? initialData?.id : undefined}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <button onClick={() => goToStep(2)} className="bg-[#1e293b] text-white px-8 py-3 rounded-xl font-bold hover:bg-primary transition-all">
                Siguiente: Preguntas →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Paso 2 — Preguntas */}
      {step === 2 && (
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-6">
            <button onClick={() => setStep(1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-xl font-bold">Preguntas</h3>
              <p className="text-sm text-[#64748b]">Construye el formulario</p>
            </div>
          </div>

          {isEditMode && initialData.responsesCount > 0 && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-6">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 font-medium">
                Esta encuesta ya tiene <strong>{initialData.responsesCount} respuestas</strong>. Modificar las preguntas puede afectar la interpretación de los datos existentes.
              </p>
            </div>
          )}

          <div className="space-y-4">
            {questions.length === 0 && (
              <div className="py-8 text-center text-sm text-[#64748b] bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Aún no hay preguntas. Usa los botones de abajo para agregar.
              </div>
            )}

            {questions.map((q, i) => (
              <div key={q.id} className="flex gap-4 items-start p-4 border border-slate-100 rounded-xl hover:border-slate-200 transition-colors">
                <span className="bg-slate-100 text-[#64748b] font-bold w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm mt-0.5">{i + 1}</span>

                <div className="flex-1 min-w-0">
                  {/* Texto de la pregunta */}
                  <input
                    value={q.text}
                    onChange={(e) => patchQuestion(q.id, { text: e.target.value })}
                    className="w-full bg-transparent border-b border-slate-200 py-1 outline-none focus:border-primary transition-colors font-medium mb-3"
                    placeholder="Escribe tu pregunta..."
                  />

                  {/* Badge del tipo + toggle obligatoria */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-bold uppercase text-primary bg-[#00D6BC]/10 px-2 py-1 rounded-md">
                      {questionLabel(q)}
                    </span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={q.required ?? false}
                        onChange={(e) => patchQuestion(q.id, { required: e.target.checked })}
                        className="w-3.5 h-3.5 accent-primary rounded"
                      />
                      <span className="text-[10px] font-bold uppercase text-[#64748b]">Obligatoria</span>
                    </label>
                  </div>

                  {/* ── Opciones de Calificación ── */}
                  {q.type === "rating" && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs font-bold text-[#64748b]">Rango:</span>
                      <input
                        type="number"
                        value={q.ratingMin ?? 1}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) patchQuestion(q.id, { ratingMin: val });
                        }}
                        className="w-16 text-center text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-primary transition-colors"
                      />
                      <span className="text-xs text-[#64748b] font-bold">hasta</span>
                      <input
                        type="number"
                        value={q.ratingMax ?? 5}
                        onChange={(e) => {
                          const val = parseInt(e.target.value);
                          if (!isNaN(val)) patchQuestion(q.id, { ratingMax: val });
                        }}
                        className="w-16 text-center text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  )}

                  {/* ── Opciones múltiples ── */}
                  {q.type === "choice" && (
                    <div className="mt-3 space-y-2">
                      {(q.options ?? []).map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                          <input
                            value={opt}
                            onChange={(e) => updateOption(q.id, idx, e.target.value)}
                            className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-primary transition-colors"
                            placeholder={`Opción ${idx + 1}`}
                          />
                          {(q.options ?? []).length > 2 && (
                            <button
                              onClick={() => removeOption(q.id, idx)}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => addOption(q.id)}
                        className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/70 transition-colors mt-1"
                      >
                        <Plus className="w-3 h-3" />
                        Agregar opción
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    onClick={() => duplicateQuestion(q.id)}
                    title="Duplicar pregunta"
                    className="text-[#64748b] hover:text-primary hover:bg-primary/10 p-2 rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => removeQuestion(q.id)}
                    title="Eliminar pregunta"
                    className="text-error hover:bg-error/10 p-2 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}

            {/* Botones para agregar preguntas */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button onClick={() => addQuestion("rating")}  className="text-xs font-bold bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors">+ Calificación</button>
              <button onClick={() => addQuestion("boolean")} className="text-xs font-bold bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors">+ Sí / No</button>
              <button onClick={() => addQuestion("choice")}  className="text-xs font-bold bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors">+ Opción múltiple</button>
              <button onClick={() => addQuestion("text")}    className="text-xs font-bold bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors">+ Texto abierto</button>
            </div>

            <div className="flex justify-between pt-8 border-t border-slate-100">
              <button onClick={() => setStep(1)} className="text-sm font-bold text-[#64748b] hover:text-[#1e293b] transition-colors">← Volver</button>
              {isEditMode ? (
                <button onClick={handleConfirm} className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all">
                  Guardar Cambios
                </button>
              ) : (
                <button onClick={() => goToStep(3)} className="bg-[#1e293b] text-white px-8 py-3 rounded-xl font-bold hover:bg-primary transition-all">
                  Siguiente: Participantes →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Paso 3 — Participantes */}
      {step === 3 && !isEditMode && (
        <ParticipantSelector
          selected={selectedParticipants}
          onSelectionChange={setSelectedParticipants}
          onBack={() => setStep(2)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
