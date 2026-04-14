"use client";
import { useState } from "react";
import { ArrowLeft, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import type { Question, QuestionType, Survey, SurveyFormData, Empleado } from "@/types/clima";
import ParticipantSelector from "./ParticipantSelector";

type Step = 1 | 2 | 3;
interface SurveyBuilderProps {
  onSave: (data: SurveyFormData) => void;
  onCancel: () => void;
  initialData?: Survey; // si existe → modo edición (2 pasos, sin participantes)
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  rating:  "Calificación 1-5",
  boolean: "Sí / No",
  text:    "Texto Abierto",
};

export default function SurveyBuilder({ onSave, onCancel, initialData }: SurveyBuilderProps) {
  const isEditMode = !!initialData;

  const [step, setStep]           = useState<Step>(1);
  const [title, setTitle]         = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [questions, setQuestions] = useState<Question[]>(
    (initialData?.questions as Question[]) ?? []
  );
  const [selectedParticipants, setSelectedParticipants] =
    useState<Map<string, Empleado>>(new Map());

  const addQuestion = (type: QuestionType) =>
    setQuestions((prev) => [...prev, { id: Date.now().toString(), text: "", type }]);

  const updateQuestion = (id: string, text: string) =>
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, text } : q)));

  const removeQuestion = (id: string) =>
    setQuestions((prev) => prev.filter((q) => q.id !== id));

  const goToStep = (next: Step) => {
    if (next >= 2 && !title.trim()) { alert("Añade un título."); return; }
    if (next >= 3 && questions.length === 0) { alert("Añade al menos una pregunta."); return; }
    setStep(next);
  };

  const handleConfirm = () =>
    onSave({ title, description, questions, participantIds: Array.from(selectedParticipants.keys()) });

  // Etiquetas y máximo de pasos según modo
  const STEPS = isEditMode
    ? [{ label: "Información" }, { label: "Preguntas" }]
    : [{ label: "Información" }, { label: "Preguntas" }, { label: "Participantes" }];

  const maxStep = isEditMode ? 2 : 3;

  return (
    <div className="max-w-3xl mx-auto space-y-6">

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
              <h3 className="text-xl font-bold">{isEditMode ? "Editar Encuesta" : "Nueva Encuesta"}</h3>
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
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-primary transition-colors resize-none"
                placeholder="Instrucciones o contexto para los participantes..."
              />
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

          {/* Advertencia en modo edición con respuestas existentes */}
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
                <span className="bg-slate-100 text-[#64748b] font-bold w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm">{i + 1}</span>
                <div className="flex-1">
                  <input
                    value={q.text}
                    onChange={(e) => updateQuestion(q.id, e.target.value)}
                    className="w-full bg-transparent border-b border-slate-200 py-1 outline-none focus:border-primary transition-colors font-medium mb-2"
                    placeholder="Escribe tu pregunta..."
                  />
                  <span className="text-[10px] font-bold uppercase text-primary bg-[#00D6BC]/10 px-2 py-1 rounded-md">
                    {QUESTION_TYPE_LABELS[q.type]}
                  </span>
                </div>
                <button onClick={() => removeQuestion(q.id)} className="text-error hover:bg-error/10 p-2 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <button onClick={() => addQuestion("rating")}  className="text-xs font-bold bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors">+ Calificación 1-5</button>
              <button onClick={() => addQuestion("boolean")} className="text-xs font-bold bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors">+ Sí / No</button>
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

      {/* Paso 3 — Participantes (solo modo creación) */}
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
