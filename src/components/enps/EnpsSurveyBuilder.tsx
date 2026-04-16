"use client";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, X, Plus } from "lucide-react";
import type { EnpsSurveyFormData, ScoreLabel } from "@/types/enps";
import type { Empleado } from "@/types/clima";
import ParticipantSelector from "@/components/clima/ParticipantSelector";

type Step = 1 | 2;

interface InitialData {
  title:            string;
  description:      string | null;
  followUpQuestion: string | null;
  scoreMin:         number;
  scoreMax:         number;
  scoreLabels:      ScoreLabel[] | null;
}

interface Props {
  onSave:       (data: EnpsSurveyFormData) => void;
  onCancel:     () => void;
  initialData?: InitialData;
}

// ── Colores populares predefinidos ────────────────────────────────────────────
const PRESET_COLORS = [
  { name: "Rojo",      hex: "#ef4444" },
  { name: "Naranja",   hex: "#f97316" },
  { name: "Ámbar",     hex: "#f59e0b" },
  { name: "Amarillo",  hex: "#eab308" },
  { name: "Lima",      hex: "#84cc16" },
  { name: "Verde",     hex: "#22c55e" },
  { name: "Teal",      hex: "#14b8a6" },
  { name: "Cyan",      hex: "#06b6d4" },
  { name: "Azul",      hex: "#3b82f6" },
  { name: "Índigo",    hex: "#6366f1" },
  { name: "Morado",    hex: "#a855f7" },
  { name: "Rosa",      hex: "#ec4899" },
  { name: "Gris",      hex: "#64748b" },
];

// Genera 3 etiquetas por defecto según el rango
function buildDefaultLabels(min: number, max: number): ScoreLabel[] {
  const detEnd = max - 4;
  const pasEnd = max - 2;
  return [
    { from: min,      to: detEnd, label: "Detractor — lamentamos que te sientas así", color: "#ef4444" },
    { from: detEnd + 1, to: pasEnd, label: "Pasivo — hay espacio para mejorar",       color: "#f59e0b" },
    { from: pasEnd + 1, to: max,   label: "¡Promotor! Te encanta Alegra",             color: "#22c55e" },
  ];
}

export default function EnpsSurveyBuilder({ onSave, onCancel, initialData }: Props) {
  const isEditMode = !!initialData;

  const [step, setStep]               = useState<Step>(1);
  const [title, setTitle]             = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [followUpQuestion, setFollowUpQuestion] = useState(initialData?.followUpQuestion ?? "");
  const [scoreMin, setScoreMin]       = useState(initialData?.scoreMin ?? 0);
  const [scoreMax, setScoreMax]       = useState(initialData?.scoreMax ?? 10);
  const [scoreLabels, setScoreLabels] = useState<ScoreLabel[]>(
    initialData?.scoreLabels ?? buildDefaultLabels(initialData?.scoreMin ?? 0, initialData?.scoreMax ?? 10)
  );
  const [selected, setSelected]       = useState<Map<string, Empleado>>(new Map());

  const STEPS = isEditMode
    ? [{ label: "Información" }]
    : [{ label: "Información" }, { label: "Participantes" }];

  // ── Score Labels helpers ────────────────────────────────────────────────────
  const updateLabel = (idx: number, field: keyof ScoreLabel, value: string | number) =>
    setScoreLabels((prev) =>
      prev.map((l, i) => i === idx ? { ...l, [field]: value } : l)
    );

  const addLabel = () =>
    setScoreLabels((prev) => [
      ...prev,
      { from: scoreMin, to: scoreMax, label: "", color: "#3b82f6" },
    ]);

  const removeLabel = (idx: number) =>
    setScoreLabels((prev) => prev.filter((_, i) => i !== idx));

  const resetLabels = () =>
    setScoreLabels(buildDefaultLabels(scoreMin, scoreMax));

  // ── Navegación ──────────────────────────────────────────────────────────────
  const goToStep2 = () => {
    if (!title.trim()) { alert("Añade un título a la campaña."); return; }
    if (scoreMax <= scoreMin) { alert("El valor máximo debe ser mayor al mínimo."); return; }
    setStep(2);
  };

  const handleConfirm = () => {
    if (!title.trim()) { alert("Añade un título a la campaña."); return; }
    if (scoreMax <= scoreMin) { alert("El valor máximo debe ser mayor al mínimo."); return; }
    if (!isEditMode && selected.size === 0) { alert("Selecciona al menos un participante."); return; }
    onSave({
      title:            title.trim(),
      description:      description.trim(),
      followUpQuestion: followUpQuestion.trim(),
      participantIds:   isEditMode ? [] : Array.from(selected.keys()),
      scoreMin,
      scoreMax,
      scoreLabels,
    });
  };

  return (
    <div className={`${step === 2 ? "max-w-5xl" : "max-w-3xl"} mx-auto space-y-6`}>

      {/* Indicador de pasos */}
      <div className="flex items-center">
        {STEPS.map((s, i) => {
          const num = (i + 1) as Step;
          const isActive   = step === num;
          const isComplete = step > num;
          return (
            <div key={num} className="flex items-center flex-1 last:flex-none">
              <div
                onClick={() => isComplete && setStep(num)}
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

      {/* ── Paso 1 — Información ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={onCancel} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-xl font-bold">
                {isEditMode ? "Editar Campaña eNPS" : "Nueva Campaña eNPS"}
              </h3>
              <p className="text-sm text-[#64748b]">Configura la encuesta</p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Título */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#64748b] mb-2">Título *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-primary transition-colors"
                placeholder="Ej: eNPS Q1 2025"
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#64748b] mb-2">Descripción (Opcional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-primary transition-colors resize-none"
                placeholder="Contexto o instrucciones adicionales para los participantes..."
              />
            </div>

            {/* Rango de puntaje */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#64748b] mb-3">Rango de Puntaje</label>
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase">Mínimo</span>
                  <input
                    type="number"
                    value={scoreMin}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v)) setScoreMin(v);
                    }}
                    className="w-20 text-center text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="mt-5 h-px w-6 bg-slate-300" />
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase">Máximo</span>
                  <input
                    type="number"
                    value={scoreMax}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      if (!isNaN(v)) setScoreMax(v);
                    }}
                    className="w-20 text-center text-sm font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 outline-none focus:border-primary transition-colors"
                  />
                </div>
                <div className="mt-5 ml-2 flex flex-wrap gap-1.5">
                  {Array.from({ length: Math.min(scoreMax - scoreMin + 1, 15) }, (_, i) => i + scoreMin).map((n) => (
                    <span key={n} className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-xs font-bold text-[#64748b]">{n}</span>
                  ))}
                  {scoreMax - scoreMin + 1 > 15 && (
                    <span className="text-xs text-[#94a3b8] self-center">…{scoreMax}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Etiquetas de puntaje */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-bold uppercase text-[#64748b]">
                  Etiquetas por rango de puntaje
                </label>
                <button
                  onClick={resetLabels}
                  className="text-xs font-bold text-[#64748b] hover:text-primary transition-colors"
                >
                  ↺ Restablecer por defecto
                </button>
              </div>

              <div className="space-y-2">
                {scoreLabels.map((lbl, idx) => (
                  <div
                    key={idx}
                    className="flex flex-wrap gap-3 items-center p-3 bg-slate-50 border border-slate-100 rounded-xl"
                  >
                    {/* Rango from–to */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <input
                        type="number"
                        value={lbl.from}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v)) updateLabel(idx, "from", v);
                        }}
                        className="w-14 text-center text-sm font-bold bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary transition-colors"
                      />
                      <span className="text-xs text-[#94a3b8] font-bold">–</span>
                      <input
                        type="number"
                        value={lbl.to}
                        onChange={(e) => {
                          const v = parseInt(e.target.value);
                          if (!isNaN(v)) updateLabel(idx, "to", v);
                        }}
                        className="w-14 text-center text-sm font-bold bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary transition-colors"
                      />
                    </div>

                    {/* Texto de la etiqueta */}
                    <input
                      value={lbl.label}
                      onChange={(e) => updateLabel(idx, "label", e.target.value)}
                      className="flex-1 min-w-[160px] text-sm bg-white border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-primary transition-colors"
                      placeholder="Mensaje para este rango..."
                    />

                    {/* Paleta de colores */}
                    <div className="flex flex-wrap gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          onClick={() => updateLabel(idx, "color", c.hex)}
                          style={{ backgroundColor: c.hex }}
                          title={c.name}
                          className={`w-5 h-5 rounded-full transition-all hover:scale-110 ${
                            lbl.color === c.hex
                              ? "ring-2 ring-offset-1 ring-slate-500 scale-110"
                              : ""
                          }`}
                        />
                      ))}
                    </div>

                    {/* Vista previa del color */}
                    <div
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shrink-0 max-w-[120px] truncate"
                      style={{ backgroundColor: lbl.color }}
                    >
                      {lbl.label || "Vista previa"}
                    </div>

                    {/* Quitar fila */}
                    {scoreLabels.length > 1 && (
                      <button
                        onClick={() => removeLabel(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  onClick={addLabel}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary/70 transition-colors mt-1"
                >
                  <Plus className="w-3 h-3" />
                  Agregar rango
                </button>
              </div>
            </div>

            {/* Pregunta de seguimiento */}
            <div>
              <label className="block text-xs font-bold uppercase text-[#64748b] mb-2">
                Pregunta de seguimiento (Opcional)
              </label>
              <input
                value={followUpQuestion}
                onChange={(e) => setFollowUpQuestion(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-primary transition-colors"
                placeholder="Ej: ¿Qué mejorarías en tu experiencia laboral?"
              />
              <p className="text-xs text-[#64748b] mt-2">
                Si la dejas vacía, la encuesta solo pedirá el puntaje.
              </p>
            </div>

            <div className="flex justify-end pt-4">
              {isEditMode ? (
                <button
                  onClick={handleConfirm}
                  className="bg-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all"
                >
                  Guardar Cambios
                </button>
              ) : (
                <button
                  onClick={goToStep2}
                  className="bg-[#1e293b] text-white px-8 py-3 rounded-xl font-bold hover:bg-primary transition-all"
                >
                  Siguiente: Participantes →
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Paso 2 — Participantes (solo creación) ───────────────────────────── */}
      {step === 2 && !isEditMode && (
        <ParticipantSelector
          selected={selected}
          onSelectionChange={setSelected}
          onBack={() => setStep(1)}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
