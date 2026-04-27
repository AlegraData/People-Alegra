"use client";
import { useState, useRef } from "react";
import {
  ArrowLeft, Copy, Trash2, CheckCircle2, AlertTriangle, X, Plus, Mail, Upload, Download,
} from "lucide-react";
import EmployeeSearchCombobox, { type EmployeeResult } from "@/components/evaluaciones360/EmployeeSearchCombobox";
import * as XLSX from "xlsx";
import type {
  Eval360Question, EvalFormData, ParticipantRow, EvalType, Evaluation360,
} from "@/types/evaluaciones360";
import { EVAL_TYPE_LABELS } from "@/types/evaluaciones360";
import EmailTemplateEditor from "@/components/clima/EmailTemplateEditor";
import type { EmailTemplateConfig } from "@/types/clima";

type Step = 1 | 2 | 3;
type QuestionType = Eval360Question["type"];

interface Props {
  onSave: (data: EvalFormData) => void;
  onCancel: () => void;
  initialData?: Evaluation360;
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  rating:  "Calificación",
  boolean: "Sí / No",
  choice:  "Opción múltiple",
  text:    "Texto abierto",
};

const ALL_TYPES: EvalType[] = ["ascendente", "descendente", "paralela", "autoevaluacion"];

export default function EvalBuilder({ onSave, onCancel, initialData }: Props) {
  const isEditMode = !!initialData;

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [step, setStep]               = useState<Step>(1);
  const [title, setTitle]             = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [instructions, setInstructions] = useState(initialData?.instructions ?? "");

  const [hasAscendente,    setHasAscendente]    = useState(initialData?.hasAscendente    ?? true);
  const [hasDescendente,   setHasDescendente]   = useState(initialData?.hasDescendente   ?? true);
  const [hasParalela,      setHasParalela]       = useState(initialData?.hasParalela      ?? true);
  const [hasAutoevaluacion, setHasAutoevaluacion] = useState(initialData?.hasAutoevaluacion ?? true);

  const [weightAscendente,     setWeightAscendente]     = useState(initialData?.weightAscendente    ?? 25);
  const [weightDescendente,    setWeightDescendente]    = useState(initialData?.weightDescendente   ?? 25);
  const [weightParalela,       setWeightParalela]       = useState(initialData?.weightParalela      ?? 25);
  const [weightAutoevaluacion, setWeightAutoevaluacion] = useState(initialData?.weightAutoevaluacion ?? 25);

  const [emailExpanded, setEmailExpanded] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplateConfig>({
    subject:    initialData?.emailSubject    ?? null,
    body:       initialData?.emailBody       ?? null,
    buttonText: initialData?.emailButtonText ?? null,
    footer:     initialData?.emailFooter     ?? null,
  });

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<Eval360Question[]>(
    (initialData?.questions as Eval360Question[]) ?? []
  );
  const questionsFileRef = useRef<HTMLInputElement>(null);

  // ── Step 3 state ──────────────────────────────────────────────────────────
  const [participants, setParticipants] = useState<ParticipantRow[]>([]);
  const participantsFileRef = useRef<HTMLInputElement>(null);

  // ── Weights validation ────────────────────────────────────────────────────
  const totalTypeWeight = [
    hasAscendente    ? weightAscendente    : 0,
    hasDescendente   ? weightDescendente   : 0,
    hasParalela      ? weightParalela      : 0,
    hasAutoevaluacion ? weightAutoevaluacion : 0,
  ].reduce((a, b) => a + b, 0);

  const totalQuestionWeight = questions.reduce((s, q) => s + (q.weight ?? 0), 0);

  // ── Question helpers ──────────────────────────────────────────────────────
  const addQuestion = (type: QuestionType) => {
    const base: Eval360Question = { id: Date.now().toString(), text: "", type, weight: 0, required: true };
    if (type === "rating") { base.ratingMin = 1; base.ratingMax = 5; }
    if (type === "choice") base.options = ["", ""];
    setQuestions((prev) => [...prev, base]);
  };

  const patchQuestion = (id: string, patch: Partial<Eval360Question>) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q)));

  const removeQuestion = (id: string) => setQuestions((prev) => prev.filter((q) => q.id !== id));

  const duplicateQuestion = (id: string) =>
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.id === id);
      if (idx === -1) return prev;
      const clone = { ...prev[idx], options: [...(prev[idx].options ?? [])], id: Date.now().toString() };
      return [...prev.slice(0, idx + 1), clone, ...prev.slice(idx + 1)];
    });

  const addOption  = (qId: string) => setQuestions((prev) => prev.map((q) => q.id === qId ? { ...q, options: [...(q.options ?? []), ""] } : q));
  const updateOption = (qId: string, idx: number, value: string) =>
    setQuestions((prev) => prev.map((q) => q.id === qId ? { ...q, options: (q.options ?? []).map((o, i) => i === idx ? value : o) } : q));
  const removeOption = (qId: string, idx: number) =>
    setQuestions((prev) => prev.map((q) => q.id === qId ? { ...q, options: (q.options ?? []).filter((_, i) => i !== idx) } : q));

  // ── Excel import — questions ──────────────────────────────────────────────
  const handleQuestionsExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
        const imported: Eval360Question[] = rows
          .filter((r) => r["Pregunta"] || r["pregunta"])
          .map((r, i) => {
            const type = (r["Tipo"] || r["tipo"] || "rating").toString().toLowerCase().trim() as QuestionType;
            const q: Eval360Question = {
              id:       `imported-${Date.now()}-${i}`,
              text:     (r["Pregunta"] || r["pregunta"] || "").toString().trim(),
              type:     ["rating", "boolean", "choice", "text"].includes(type) ? type : "rating",
              category: (r["Categoría"] || r["Categoria"] || r["categoria"] || "").toString().trim() || undefined,
              weight:   parseFloat(r["Peso"] || r["peso"] || "0") || 0,
              required: true,
            };
            if (q.type === "rating") {
              q.ratingMin = parseInt(r["Min"] || r["min"] || "1") || 1;
              q.ratingMax = parseInt(r["Max"] || r["max"] || "5") || 5;
            }
            if (q.type === "choice") {
              const opts = (r["Opciones"] || r["opciones"] || "").toString().split("|").map((o: string) => o.trim()).filter(Boolean);
              q.options = opts.length >= 2 ? opts : ["", ""];
            }
            return q;
          });
        setQuestions((prev) => [...prev, ...imported]);
      } catch { alert("Error al leer el archivo. Verifica el formato."); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  // ── Excel import — participants ───────────────────────────────────────────
  const handleParticipantsExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
        const typeMap: Record<string, EvalType> = {
          ascendente: "ascendente", descendente: "descendente",
          paralela: "paralela", autoevaluacion: "autoevaluacion",
          "auto-evaluación": "autoevaluacion", autoevaluación: "autoevaluacion",
        };
        const imported: ParticipantRow[] = rows
          .filter((r) => r["Correo Evaluador"] || r["correo_evaluador"])
          .map((r) => ({
            evaluatorEmail: (r["Correo Evaluador"] || r["correo_evaluador"] || "").toString().trim().toLowerCase(),
            evaluatorName:  (r["Nombre Evaluador"] || r["nombre_evaluador"] || "").toString().trim(),
            evaluateeEmail: (r["Correo Evaluado"] || r["correo_evaluado"] || "").toString().trim().toLowerCase(),
            evaluateeName:  (r["Nombre Evaluado"] || r["nombre_evaluado"] || "").toString().trim(),
            team:           (r["Equipo"] || r["equipo"] || "").toString().trim(),
            evaluationType: typeMap[(r["Tipo"] || r["tipo"] || "").toString().trim().toLowerCase()] ?? "paralela",
          }))
          .filter((r) => r.evaluatorEmail && r.evaluateeEmail);
        setParticipants((prev) => [...prev, ...imported]);
      } catch { alert("Error al leer el archivo de participantes."); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const downloadQuestionsTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Categoría", "Pregunta", "Tipo", "Peso", "Min", "Max", "Opciones"],
      ["Liderazgo", "¿Comunica la visión claramente?", "rating", 15, 1, 5, ""],
      ["Liderazgo", "¿Inspira con el ejemplo?", "rating", 10, 1, 5, ""],
      ["Comunicación", "¿Es asertivo en su comunicación?", "rating", 12, 1, 5, ""],
      ["Comunicación", "¿Escucha activamente?", "boolean", 8, "", "", ""],
      ["General", "¿Qué mejorarías de esta persona?", "text", 5, "", "", ""],
      ["General", "¿Cómo calificarías su desempeño?", "choice", 10, "", "", "Excelente|Bueno|Regular|Bajo"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Preguntas");
    XLSX.writeFile(wb, "plantilla_preguntas_360.xlsx");
  };

  const downloadParticipantsTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Correo Evaluador", "Nombre Evaluador", "Correo Evaluado", "Nombre Evaluado", "Equipo", "Tipo"],
      ["juan@empresa.com", "Juan Pérez", "maria@empresa.com", "María García", "Tech", "descendente"],
      ["pedro@empresa.com", "Pedro López", "maria@empresa.com", "María García", "Tech", "paralela"],
      ["maria@empresa.com", "María García", "maria@empresa.com", "María García", "Tech", "autoevaluacion"],
      ["maria@empresa.com", "María García", "juan@empresa.com", "Juan Pérez", "Tech", "ascendente"],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Participantes");
    XLSX.writeFile(wb, "plantilla_participantes_360.xlsx");
  };

  const removeParticipant = (idx: number) => setParticipants((prev) => prev.filter((_, i) => i !== idx));

  // ── Navigation ────────────────────────────────────────────────────────────
  const goToStep = (next: Step) => {
    if (next >= 2 && !title.trim()) { alert("Agrega un título a la evaluación."); return; }
    if (next >= 2 && Math.abs(totalTypeWeight - 100) > 1) {
      alert(`Los pesos por tipo de evaluación deben sumar 100%. Suma actual: ${totalTypeWeight}%`); return;
    }
    if (next >= 3 && questions.length === 0) { alert("Agrega al menos una pregunta."); return; }
    setStep(next);
  };

  const handleConfirm = () => {
    if (Math.abs(totalQuestionWeight - 100) > 1) {
      alert(`Los pesos de las preguntas deben sumar 100%. Suma actual: ${totalQuestionWeight}%`); return;
    }
    if (!isEditMode && participants.length === 0) { alert("Agrega al menos un participante."); return; }
    onSave({
      title, description, instructions,
      hasAscendente, hasDescendente, hasParalela, hasAutoevaluacion,
      weightAscendente, weightDescendente, weightParalela, weightAutoevaluacion,
      questions, participants,
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

      {/* Step indicator */}
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

      {/* ─── STEP 1: Información ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-xl font-bold">{isEditMode ? "Editar Evaluación" : "Nueva Evaluación 360°"}</h3>
              <p className="text-sm text-[#64748b]">Información general y configuración</p>
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-bold uppercase text-[#64748b] mb-2">Título *</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-primary transition-colors"
              placeholder="Ej: Evaluación 360° Q2 2025"
            />
          </div>

          {/* Descripción */}
          <div>
            <label className="block text-xs font-bold uppercase text-[#64748b] mb-2">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              rows={2}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-primary transition-colors resize-none overflow-hidden"
              placeholder="Contexto o propósito de esta evaluación..."
            />
          </div>

          {/* Instrucciones */}
          <div>
            <label className="block text-xs font-bold uppercase text-[#64748b] mb-2">Instrucciones para evaluadores</label>
            <textarea
              value={instructions}
              onChange={(e) => { setInstructions(e.target.value); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
              rows={3}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-primary transition-colors resize-none overflow-hidden"
              placeholder="Describe cómo deben completar la evaluación..."
            />
          </div>

          {/* Tipos y pesos */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <div className="bg-slate-50 px-5 py-4 border-b border-slate-200">
              <p className="text-sm font-bold text-[#1e293b]">Tipos de evaluación y pesos</p>
              <p className="text-xs text-[#64748b]">Los pesos habilitados deben sumar 100%</p>
            </div>
            <div className="p-5 space-y-3">
              {ALL_TYPES.map((type) => {
                const enabled = { ascendente: hasAscendente, descendente: hasDescendente, paralela: hasParalela, autoevaluacion: hasAutoevaluacion }[type];
                const weight  = { ascendente: weightAscendente, descendente: weightDescendente, paralela: weightParalela, autoevaluacion: weightAutoevaluacion }[type];
                const setEnabled = { ascendente: setHasAscendente, descendente: setHasDescendente, paralela: setHasParalela, autoevaluacion: setHasAutoevaluacion }[type];
                const setWeight  = { ascendente: setWeightAscendente, descendente: setWeightDescendente, paralela: setWeightParalela, autoevaluacion: setWeightAutoevaluacion }[type];
                return (
                  <div key={type} className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setEnabled((v) => !v)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0 ${enabled ? "bg-primary" : "bg-slate-200"}`}
                    >
                      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                    <span className={`text-sm font-semibold flex-1 ${enabled ? "text-[#1e293b]" : "text-slate-400"}`}>{EVAL_TYPE_LABELS[type]}</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        disabled={!enabled}
                        value={weight}
                        onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                        min={0} max={100} step={5}
                        className="w-20 text-center text-sm font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary transition-colors disabled:opacity-40"
                      />
                      <span className="text-xs font-bold text-[#64748b]">%</span>
                    </div>
                  </div>
                );
              })}
              <div className={`flex items-center justify-end gap-2 pt-2 border-t border-slate-100 ${Math.abs(totalTypeWeight - 100) > 1 ? "text-red-500" : "text-emerald-600"}`}>
                <span className="text-xs font-bold">Total:</span>
                <span className="text-sm font-black">{totalTypeWeight}%</span>
                {Math.abs(totalTypeWeight - 100) > 1 && <AlertTriangle className="w-4 h-4" />}
                {Math.abs(totalTypeWeight - 100) <= 1 && <CheckCircle2 className="w-4 h-4" />}
              </div>
            </div>
          </div>

          {/* Email template */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setEmailExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#1e293b]/10 rounded-xl flex items-center justify-center">
                  <Mail className="w-4 h-4 text-[#1e293b]" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-bold text-[#1e293b]">Correo de invitación</p>
                  <p className="text-xs text-[#64748b]">Personaliza el correo de convocatoria</p>
                </div>
              </div>
              <span className="text-xs font-bold text-[#64748b]">{emailExpanded ? "▲" : "▼"}</span>
            </button>
            {emailExpanded && (
              <div className="px-5 py-5 border-t border-slate-200">
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

          <div className="flex justify-end pt-2">
            <button onClick={() => goToStep(2)} className="bg-[#1e293b] text-white px-8 py-3 rounded-xl font-bold hover:bg-primary transition-all">
              Siguiente: Preguntas →
            </button>
          </div>
        </div>
      )}

      {/* ─── STEP 2: Preguntas ───────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setStep(1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h3 className="text-xl font-bold">Preguntas</h3>
              <p className="text-sm text-[#64748b]">Aplican a todos los tipos de evaluación</p>
            </div>
            {/* Excel import */}
            <div className="flex items-center gap-2">
              <button
                onClick={downloadQuestionsTemplate}
                className="flex items-center gap-1.5 text-xs font-bold text-[#64748b] hover:text-primary px-3 py-2 rounded-lg hover:bg-primary/10 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                Plantilla
              </button>
              <button
                onClick={() => questionsFileRef.current?.click()}
                className="flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-primary px-3 py-2 rounded-lg hover:bg-primary/20 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" />
                Import Excel
              </button>
              <input ref={questionsFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleQuestionsExcel} />
            </div>
          </div>

          {/* Indicador de peso total */}
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
            questions.length === 0 ? "border-slate-200 bg-slate-50" :
            Math.abs(totalQuestionWeight - 100) <= 1 ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
          }`}>
            <span className="text-xs font-semibold text-[#64748b]">Peso total de preguntas:</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-black ${Math.abs(totalQuestionWeight - 100) <= 1 ? "text-emerald-700" : "text-amber-700"}`}>
                {totalQuestionWeight}%
              </span>
              {questions.length > 0 && (
                Math.abs(totalQuestionWeight - 100) <= 1
                  ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  : <AlertTriangle className="w-4 h-4 text-amber-500" />
              )}
            </div>
          </div>

          {/* Lista de preguntas */}
          {questions.length === 0 && (
            <div className="py-10 text-center text-sm text-[#64748b] bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              Sin preguntas aún. Agrega manualmente o importa desde Excel.
            </div>
          )}

          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={q.id} className="flex gap-3 items-start p-4 border border-slate-100 rounded-xl hover:border-slate-200 transition-colors">
                <span className="bg-slate-100 text-[#64748b] font-bold w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Categoría */}
                  <input
                    value={q.category ?? ""}
                    onChange={(e) => patchQuestion(q.id, { category: e.target.value })}
                    className="w-full text-xs font-bold text-primary bg-transparent outline-none placeholder:text-slate-300"
                    placeholder="Categoría (opcional)"
                  />
                  {/* Texto */}
                  <input
                    value={q.text}
                    onChange={(e) => patchQuestion(q.id, { text: e.target.value })}
                    className="w-full bg-transparent border-b border-slate-200 py-1 outline-none focus:border-primary transition-colors font-medium"
                    placeholder="Escribe la pregunta..."
                  />
                  {/* Controles */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-bold uppercase text-primary bg-primary/10 px-2 py-0.5 rounded-md">
                      {QUESTION_TYPE_LABELS[q.type]}
                    </span>
                    <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input type="checkbox" checked={q.required ?? true} onChange={(e) => patchQuestion(q.id, { required: e.target.checked })} className="w-3.5 h-3.5 accent-primary" />
                      <span className="text-[10px] font-bold uppercase text-[#64748b]">Obligatoria</span>
                    </label>
                    <div className="flex items-center gap-1.5 ml-auto">
                      <span className="text-[10px] font-bold text-[#64748b]">Peso:</span>
                      <input
                        type="number"
                        value={q.weight}
                        onChange={(e) => patchQuestion(q.id, { weight: parseFloat(e.target.value) || 0 })}
                        min={0} max={100} step={1}
                        className="w-16 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-primary"
                      />
                      <span className="text-[10px] font-bold text-[#64748b]">%</span>
                    </div>
                  </div>
                  {/* Rating config */}
                  {q.type === "rating" && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs font-bold text-[#64748b]">Rango:</span>
                      <input type="number" value={q.ratingMin ?? 1} onChange={(e) => patchQuestion(q.id, { ratingMin: parseInt(e.target.value) || 1 })}
                        className="w-14 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-primary" />
                      <span className="text-xs text-[#64748b] font-bold">a</span>
                      <input type="number" value={q.ratingMax ?? 5} onChange={(e) => patchQuestion(q.id, { ratingMax: parseInt(e.target.value) || 5 })}
                        className="w-14 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-primary" />
                    </div>
                  )}
                  {/* Choice options */}
                  {q.type === "choice" && (
                    <div className="mt-2 space-y-1.5">
                      {(q.options ?? []).map((opt, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full border-2 border-slate-300 shrink-0" />
                          <input value={opt} onChange={(e) => updateOption(q.id, idx, e.target.value)}
                            className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-1 outline-none focus:border-primary"
                            placeholder={`Opción ${idx + 1}`} />
                          {(q.options ?? []).length > 2 && (
                            <button onClick={() => removeOption(q.id, idx)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => addOption(q.id)} className="flex items-center gap-1 text-xs font-bold text-primary hover:opacity-70 transition-opacity mt-1">
                        <Plus className="w-3 h-3" /> Agregar opción
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => duplicateQuestion(q.id)} title="Duplicar" className="text-[#64748b] hover:text-primary hover:bg-primary/10 p-1.5 rounded-lg transition-colors">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => removeQuestion(q.id)} title="Eliminar" className="text-red-400 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Agregar preguntas */}
          <div className="flex flex-wrap gap-2">
            {(["rating", "boolean", "choice", "text"] as QuestionType[]).map((type) => (
              <button key={type} onClick={() => addQuestion(type)}
                className="text-xs font-bold bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors">
                + {QUESTION_TYPE_LABELS[type]}
              </button>
            ))}
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
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
      )}

      {/* ─── STEP 3: Participantes ───────────────────────────────────────────── */}
      {step === 3 && !isEditMode && (
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setStep(2)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h3 className="text-xl font-bold">Participantes</h3>
              <p className="text-sm text-[#64748b]">Define quién evalúa a quién y el tipo de relación</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={downloadParticipantsTemplate} className="flex items-center gap-1.5 text-xs font-bold text-[#64748b] hover:text-primary px-3 py-2 rounded-lg hover:bg-primary/10 transition-colors">
                <Download className="w-3.5 h-3.5" /> Plantilla
              </button>
              <button onClick={() => participantsFileRef.current?.click()} className="flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-primary px-3 py-2 rounded-lg hover:bg-primary/20 transition-colors">
                <Upload className="w-3.5 h-3.5" /> Import Excel
              </button>
              <input ref={participantsFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleParticipantsExcel} />
            </div>
          </div>

          {/* Agregar manual */}
          <AddParticipantForm onAdd={(p) => setParticipants((prev) => [...prev, p])} />

          {/* Lista */}
          {participants.length === 0 ? (
            <div className="py-10 text-center text-sm text-[#64748b] bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              Sin participantes aún. Importa desde Excel o agrega manualmente.
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold text-[#1e293b]">{participants.length} participante{participants.length !== 1 ? "s" : ""}</p>
                <button onClick={() => setParticipants([])} className="text-xs font-bold text-red-500 hover:text-red-600">Limpiar todo</button>
              </div>
              <div className="overflow-x-auto rounded-xl border border-slate-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {["Evaluador", "Evaluado", "Equipo", "Tipo", ""].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-bold text-[#64748b] uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {participants.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-[#1e293b]">{p.evaluatorName || p.evaluatorEmail}</p>
                          <p className="text-[#94a3b8]">{p.evaluatorEmail}</p>
                        </td>
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-[#1e293b]">{p.evaluateeName || p.evaluateeEmail}</p>
                          <p className="text-[#94a3b8]">{p.evaluateeEmail}</p>
                        </td>
                        <td className="px-4 py-2.5 text-[#64748b]">{p.team || "—"}</td>
                        <td className="px-4 py-2.5">
                          <TypeBadge type={p.evaluationType} />
                        </td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => removeParticipant(idx)} className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <button onClick={() => setStep(2)} className="text-sm font-bold text-[#64748b] hover:text-[#1e293b] transition-colors">← Volver</button>
            <button onClick={handleConfirm} className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all">
              Crear Evaluación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Form para agregar un participante con búsqueda de empleados ───────────────
function AddParticipantForm({ onAdd }: { onAdd: (p: ParticipantRow) => void }) {
  const [evaluator, setEvaluator] = useState<EmployeeResult | null>(null);
  const [evaluatee, setEvaluatee] = useState<EmployeeResult | null>(null);
  const [evalType, setEvalType]   = useState<EvalType>("paralela");
  const [team, setTeam]           = useState("");
  const [evKey, setEvKey]         = useState(0);
  const [eeKey, setEeKey]         = useState(0);

  const handleAdd = () => {
    if (!evaluator || !evaluatee) {
      alert("Selecciona el evaluador y el evaluado desde la base de datos.");
      return;
    }
    onAdd({
      evaluatorEmail: evaluator.correo,
      evaluatorName:  evaluator.nombre_completo || evaluator.correo,
      evaluateeEmail: evaluatee.correo,
      evaluateeName:  evaluatee.nombre_completo || evaluatee.correo,
      team:           team.trim() || evaluatee.equipo || "",
      evaluationType: evalType,
    });
    setEvaluator(null);
    setEvaluatee(null);
    setTeam("");
    setEvalType("paralela");
    setEvKey((k) => k + 1);
    setEeKey((k) => k + 1);
  };

  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
      <p className="text-xs font-bold text-[#64748b] uppercase">Agregar participante</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <EmployeeSearchCombobox
          key={`ev-${evKey}`}
          label="Evaluador *"
          placeholder="Buscar por nombre o correo..."
          onSelect={setEvaluator}
        />
        <EmployeeSearchCombobox
          key={`ee-${eeKey}`}
          label="Evaluado *"
          placeholder="Buscar por nombre o correo..."
          onSelect={setEvaluatee}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase text-[#64748b] mb-1">Equipo</label>
          <input
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            placeholder={evaluatee?.equipo || "Equipo (opcional)"}
            className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-[#64748b] mb-1">Tipo de relación *</label>
          <select
            value={evalType}
            onChange={(e) => setEvalType(e.target.value as EvalType)}
            className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary"
          >
            {(Object.entries(EVAL_TYPE_LABELS) as [EvalType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      <button
        onClick={handleAdd}
        disabled={!evaluator || !evaluatee}
        className="flex items-center gap-1.5 text-xs font-bold bg-[#1e293b] text-white px-4 py-2 rounded-lg hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus className="w-3.5 h-3.5" /> Agregar
      </button>
    </div>
  );
}

function TypeBadge({ type }: { type: EvalType }) {
  const styles: Record<EvalType, string> = {
    ascendente:     "bg-blue-100 text-blue-700",
    descendente:    "bg-violet-100 text-violet-700",
    paralela:       "bg-amber-100 text-amber-700",
    autoevaluacion: "bg-emerald-100 text-emerald-700",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${styles[type]}`}>
      {EVAL_TYPE_LABELS[type]}
    </span>
  );
}
