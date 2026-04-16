"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Send, CheckCircle2, Pencil, AlertCircle } from "lucide-react";
import type { EnpsSurvey, ScoreLabel } from "@/types/enps";

interface Props {
  survey:     EnpsSurvey;
  onComplete: () => void;
  onCancel:   () => void;
}

type Phase = "score" | "followup" | "review" | "done";

// Etiquetas por defecto si la campaña no las configura
const DEFAULT_LABELS: ScoreLabel[] = [
  { from: 0, to: 6,  label: "Detractor — lamentamos que te sientas así", color: "#ef4444" },
  { from: 7, to: 8,  label: "Pasivo — hay espacio para mejorar",          color: "#f59e0b" },
  { from: 9, to: 10, label: "¡Promotor! Te encanta Alegra",               color: "#22c55e" },
];

export default function EnpsTaker({ survey, onComplete, onCancel }: Props) {
  const [phase, setPhase]           = useState<Phase>("score");
  const [score, setScore]           = useState<number | null>(null);
  const [followUp, setFollowUp]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");
  const [visible, setVisible]       = useState(true);

  const scoreMin   = survey.scoreMin ?? 0;
  const scoreMax   = survey.scoreMax ?? 10;
  const labels     = (survey.scoreLabels as ScoreLabel[] | null) ?? DEFAULT_LABELS;
  const hasFollowUp = !!survey.followUpQuestion;
  const totalSteps  = 1 + (hasFollowUp ? 1 : 0);
  const currentStep = phase === "score" ? 1 : phase === "followup" ? 2 : totalSteps;
  const steps       = Array.from({ length: scoreMax - scoreMin + 1 }, (_, i) => i + scoreMin);
  const progress    = (currentStep / totalSteps) * 100;

  // Busca la etiqueta que aplica al puntaje seleccionado
  const getScoreLabel = (s: number) =>
    labels.find((l) => s >= l.from && s <= l.to) ?? null;

  // Fade suave entre fases
  const transition = (fn: () => void) => {
    setVisible(false);
    setTimeout(() => { fn(); setVisible(true); }, 180);
  };

  const goNext = () => {
    if (phase === "score") {
      if (score === null) { setError("Selecciona un puntaje para continuar."); return; }
      setError("");
      transition(() => setPhase(hasFollowUp ? "followup" : "review"));
    } else if (phase === "followup") {
      transition(() => setPhase("review"));
    }
  };

  const goBack = () => {
    if (phase === "followup") transition(() => setPhase("score"));
    else if (phase === "review") transition(() => setPhase(hasFollowUp ? "followup" : "score"));
  };

  const handleSubmit = async () => {
    if (score === null) { setError("Necesitas seleccionar un puntaje."); return; }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/enps/surveys/${survey.id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score, followUpAnswer: followUp }),
      });
      if (res.ok) {
        setPhase("done");
        setTimeout(() => onComplete(), 2500);
      } else {
        const data = await res.json();
        setError(data.error ?? "Error al enviar la respuesta.");
      }
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Pantalla de éxito ────────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="relative bg-white rounded-[2rem] p-14 border border-slate-100 shadow-sm text-center flex flex-col items-center overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <CheckCircle2 className="relative w-16 h-16 text-primary mb-6" />
          <h3 className="relative text-2xl font-bold text-[#1e293b] mb-2">¡Gracias por tu participación!</h3>
          <p className="relative text-[#64748b]">Tu respuesta nos ayuda a mejorar Alegra.</p>
        </div>
      </div>
    );
  }

  // ── Pantalla de revisión ─────────────────────────────────────────────────────
  if (phase === "review") {
    const scoreLbl = score !== null ? getScoreLabel(score) : null;
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={goBack}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-xl font-bold text-[#1e293b]">Revisa tu respuesta</h3>
              <p className="text-sm text-[#64748b]">Puedes editar antes de enviar</p>
            </div>
          </div>
        </div>

        {/* Puntaje */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-4 flex items-center justify-between gap-4 hover:border-slate-200 transition-colors">
          <div className="flex items-start gap-3 min-w-0">
            <span className="bg-slate-100 text-[#64748b] font-black w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 mt-0.5">
              1
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1e293b] leading-snug">
                ¿Qué tan probable es que recomiendes a Alegra como lugar de trabajo?
              </p>
              <div className="mt-1.5">
                {score !== null ? (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                    style={{ backgroundColor: scoreLbl?.color ?? "#64748b" }}
                  >
                    {score} — {scoreLbl?.label ?? score}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-bold">
                    <AlertCircle className="w-3 h-3" />
                    Sin respuesta
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => transition(() => setPhase("score"))}
            className="flex items-center gap-1.5 text-xs font-bold text-[#64748b] hover:text-primary px-3 py-2 rounded-xl hover:bg-primary/10 transition-all shrink-0"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar
          </button>
        </div>

        {/* Follow-up */}
        {hasFollowUp && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-6 py-4 flex items-center justify-between gap-4 hover:border-slate-200 transition-colors">
            <div className="flex items-start gap-3 min-w-0">
              <span className="bg-slate-100 text-[#64748b] font-black w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 mt-0.5">
                2
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#1e293b] leading-snug truncate">
                  {survey.followUpQuestion}
                </p>
                <div className="mt-1.5">
                  {followUp ? (
                    <span className="text-sm font-bold text-primary line-clamp-2">{followUp}</span>
                  ) : (
                    <span className="italic text-slate-400 text-xs">Sin comentario</span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => transition(() => setPhase("followup"))}
              className="flex items-center gap-1.5 text-xs font-bold text-[#64748b] hover:text-primary px-3 py-2 rounded-xl hover:bg-primary/10 transition-all shrink-0"
            >
              <Pencil className="w-3.5 h-3.5" />
              Editar
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 font-semibold bg-red-50 px-4 py-3 rounded-xl border border-red-200">
            {error}
          </p>
        )}

        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex items-center justify-between">
          <p className="text-xs text-[#64748b]">Tu respuesta es anónima para tu equipo.</p>
          <button
            onClick={handleSubmit}
            disabled={submitting || score === null}
            className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
          >
            {submitting
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send className="w-4 h-4" />
            }
            {submitting ? "Enviando..." : "Enviar respuesta"}
          </button>
        </div>
      </div>
    );
  }

  // ── Tarjeta de puntaje / follow-up ──────────────────────────────────────────
  const isScorePhase   = phase === "score";
  const isLastQuestion = !hasFollowUp || phase === "followup";
  const selectedLbl    = score !== null ? getScoreLabel(score) : null;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="p-2 hover:bg-slate-100 rounded-full transition-colors text-[#64748b]"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-[#1e293b] truncate">{survey.title}</p>
          <p className="text-xs text-[#64748b]">
            Pregunta {currentStep} de {totalSteps}
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Tarjeta con efecto glow */}
      <div
        className={`relative group/card transition-opacity duration-[180ms] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Blobs */}
        <div className="absolute -left-10 top-1/3 w-40 h-40 bg-[#00D6BC]/25 rounded-full blur-3xl opacity-0 group-hover/card:opacity-100 transition-all duration-700 pointer-events-none" />
        <div className="absolute -right-10 bottom-1/3 w-40 h-40 bg-[#00D6BC]/20 rounded-full blur-3xl opacity-0 group-hover/card:opacity-100 transition-all duration-700 pointer-events-none" />

        <div className="relative bg-white rounded-[2rem] px-10 py-12 border border-slate-100 shadow-sm">

          {/* ── Fase puntaje ── */}
          {isScorePhase && (
            <>
              <p className="text-xl font-bold text-[#1e293b] mb-3 leading-snug text-center">
                ¿Qué tan probable es que recomiendes a Alegra como lugar de trabajo a un amigo o colega?
              </p>
              {survey.description && (
                <p className="text-sm text-[#64748b] text-center mb-8">{survey.description}</p>
              )}

              {/* Botones de puntaje */}
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {steps.map((num) => {
                  const lbl        = getScoreLabel(num);
                  const isSelected = score === num;
                  return (
                    <button
                      key={num}
                      onClick={() => { setScore(num); setError(""); }}
                      style={isSelected && lbl ? { backgroundColor: lbl.color } : undefined}
                      className={`w-11 h-11 rounded-xl font-black text-base transition-all duration-200 ${
                        isSelected
                          ? "text-white scale-110 shadow-lg"
                          : "bg-slate-100 text-[#64748b] hover:bg-slate-200 hover:scale-105"
                      }`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>

              {/* Extremos */}
              <div className="flex justify-between px-1 mb-4">
                <span className="text-xs text-[#94a3b8]">{scoreMin} — Nada probable</span>
                <span className="text-xs text-[#94a3b8]">{scoreMax} — Muy probable</span>
              </div>

              {/* Etiqueta del puntaje seleccionado */}
              {score !== null && selectedLbl && (
                <div
                  className="text-center py-2.5 px-4 rounded-xl text-sm font-bold text-white transition-all"
                  style={{ backgroundColor: selectedLbl.color }}
                >
                  {selectedLbl.label}
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="text-center text-xs text-red-500 font-semibold mt-3">{error}</p>
              )}

              {score === null && (
                <p className="text-center text-xs text-[#94a3b8] mt-4">
                  Selecciona un número — o avanza sin responder
                </p>
              )}
            </>
          )}

          {/* ── Fase follow-up ── */}
          {phase === "followup" && (
            <>
              <p className="text-xl font-bold text-[#1e293b] mb-10 leading-snug text-center">
                {survey.followUpQuestion}
                <span className="block text-sm font-normal text-[#64748b] mt-2">(Opcional)</span>
              </p>
              <textarea
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-4 outline-none focus:border-primary transition-colors min-h-[120px] text-sm resize-none"
                placeholder="Comparte tu opinión..."
              />
            </>
          )}
        </div>
      </div>

      {/* Navegación */}
      <div className="flex items-center justify-between">
        <button
          onClick={isScorePhase ? onCancel : () => transition(() => setPhase("score"))}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-[#64748b] border border-slate-200 hover:bg-slate-50 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          {isScorePhase ? "Cancelar" : "Anterior"}
        </button>

        {/* Dots */}
        {totalSteps > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => transition(() => setPhase("score"))}
              className={`rounded-full transition-all duration-300 ${
                phase === "score"
                  ? "w-6 h-2.5 bg-primary"
                  : score !== null
                  ? "w-2.5 h-2.5 bg-primary/40 hover:bg-primary/70"
                  : "w-2.5 h-2.5 bg-slate-200 hover:bg-slate-300"
              }`}
            />
            {hasFollowUp && (
              <button
                onClick={() => {
                  if (score !== null) transition(() => setPhase("followup"));
                }}
                className={`rounded-full transition-all duration-300 ${
                  phase === "followup"
                    ? "w-6 h-2.5 bg-primary"
                    : followUp
                    ? "w-2.5 h-2.5 bg-primary/40 hover:bg-primary/70"
                    : "w-2.5 h-2.5 bg-slate-200 hover:bg-slate-300"
                }`}
              />
            )}
          </div>
        )}

        <button
          onClick={goNext}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#1e293b] text-white hover:bg-primary transition-all"
        >
          {isLastQuestion ? "Revisar" : "Siguiente"}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
