"use client";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Pencil, Send, AlertCircle } from "lucide-react";
import type { Survey, Question } from "@/types/clima";

interface Props {
  survey: Survey;
  onComplete: () => void;
  onCancel: () => void;
}

type Phase = "question" | "review" | "done";

// ── Input según tipo de pregunta ──────────────────────────────────────────────
function QuestionInput({
  q, value, onChange,
}: {
  q: Question;
  value: string | number | undefined;
  onChange: (v: string | number) => void;
}) {
  if (q.type === "rating") {
    const min   = q.ratingMin ?? 1;
    const max   = q.ratingMax ?? 5;
    const steps = Array.from({ length: max - min + 1 }, (_, k) => k + min);
    return (
      <div>
        <div className="flex flex-wrap gap-2 justify-center">
          {steps.map((num) => (
            <button
              key={num}
              onClick={() => onChange(num)}
              className={`w-12 h-12 rounded-xl font-bold text-lg transition-all duration-200 ${
                value === num
                  ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30"
                  : "bg-slate-100 text-[#64748b] hover:bg-slate-200 hover:scale-105"
              }`}
            >
              {num}
            </button>
          ))}
        </div>
        {steps.length > 5 && (
          <div className="flex justify-between mt-2 px-1">
            <span className="text-xs text-[#94a3b8]">{min} — Nada probable</span>
            <span className="text-xs text-[#94a3b8]">{max} — Muy probable</span>
          </div>
        )}
      </div>
    );
  }

  if (q.type === "boolean") {
    return (
      <div className="flex gap-3 justify-center">
        {["Sí", "No"].map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-12 py-3.5 rounded-xl font-bold text-lg transition-all duration-200 ${
              value === opt
                ? "bg-primary text-white scale-105 shadow-lg shadow-primary/30"
                : "bg-slate-100 text-[#64748b] hover:bg-slate-200 hover:scale-105"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (q.type === "choice") {
    return (
      <div className="flex flex-wrap gap-3 w-full">
        {(q.options ?? []).filter((o) => o.trim()).map((opt, idx) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`flex-1 min-w-[80px] flex flex-col items-center gap-3 px-4 py-5 rounded-xl border-2 transition-all duration-200 ${
              value === opt
                ? "bg-primary/10 border-primary text-primary"
                : "bg-slate-50 border-slate-200 text-[#64748b] hover:border-primary/40 hover:bg-slate-100"
            }`}
          >
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 transition-all ${
              value === opt ? "bg-primary text-white" : "bg-slate-200 text-[#64748b]"
            }`}>
              {idx + 1}
            </span>
            <span className="text-xs font-semibold text-center leading-snug">{opt}</span>
          </button>
        ))}
      </div>
    );
  }

  // text
  return (
    <textarea
      value={(value as string) ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-4 outline-none focus:border-primary transition-colors min-h-[120px] text-sm resize-none"
      placeholder="Escribe tu respuesta aquí..."
    />
  );
}

// ── Etiqueta de respuesta en pantalla de revisión ─────────────────────────────
function AnswerLabel({ value, required }: { value: string | number | undefined; required?: boolean }) {
  if (value === undefined || value === "") {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold ${required ? "text-red-500" : "text-amber-600"}`}>
        <AlertCircle className="w-3 h-3" />
        {required ? "Obligatoria — falta responder" : "Sin respuesta"}
      </span>
    );
  }
  return <span className="text-sm font-bold text-primary">{String(value)}</span>;
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function SurveyTaker({ survey, onComplete, onCancel }: Props) {
  const questions                       = survey.questions as Question[];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers]           = useState<Record<string, string | number>>({});
  const [phase, setPhase]               = useState<Phase>("question");
  const [error, setError]               = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [visible, setVisible]           = useState(true);
  const [highlightMissing, setHighlightMissing] = useState<Set<string>>(new Set());

  const currentQ = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;

  const setAnswer = (qId: string, v: string | number) => {
    setAnswers((prev) => ({ ...prev, [qId]: v }));
    setHighlightMissing((prev) => { const next = new Set(prev); next.delete(qId); return next; });
  };

  // Fade suave entre preguntas
  const transition = (fn: () => void) => {
    setVisible(false);
    setTimeout(() => { fn(); setVisible(true); }, 180);
  };

  const goNext = () => {
    if (
      currentQ.required &&
      (answers[currentQ.id] === undefined || answers[currentQ.id] === "")
    ) {
      setError("Esta pregunta es obligatoria. Respóndela antes de continuar.");
      return;
    }
    setError(null);
    transition(() =>
      currentIndex < questions.length - 1
        ? setCurrentIndex((i) => i + 1)
        : setPhase("review")
    );
  };

  const goPrev = () => {
    if (currentIndex > 0) { setError(null); transition(() => setCurrentIndex((i) => i - 1)); }
  };

  const goToQuestion = (idx: number) =>
    transition(() => { setCurrentIndex(idx); setPhase("question"); });

  const handleSubmit = async () => {
    // Validate required questions
    const unanswered = questions.filter(
      (q) => q.required && (answers[q.id] === undefined || answers[q.id] === "")
    );
    if (unanswered.length > 0) {
      setHighlightMissing(new Set(unanswered.map((q) => q.id)));
      setError(
        `Hay ${unanswered.length} pregunta${unanswered.length > 1 ? "s" : ""} obligatoria${unanswered.length > 1 ? "s" : ""} sin responder.`
      );
      return;
    }

    setError(null);
    setSubmitting(true);
    setHighlightMissing(new Set());
    try {
      const res = await fetch("/api/clima/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId: survey.id, answers }),
      });
      if (res.ok) {
        setPhase("done");
      } else {
        const data = await res.json();
        setError(data.error || "Error al enviar.");
      }
    } catch {
      setError("Error de red. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Pantalla de éxito ─────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="relative bg-white rounded-[2rem] p-14 border border-slate-100 shadow-sm text-center flex flex-col items-center overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <CheckCircle2 className="relative w-16 h-16 text-primary mb-6" />
          <h3 className="relative text-2xl font-bold text-[#1e293b] mb-2">¡Gracias por tu participación!</h3>
          <p className="relative text-[#64748b] mb-8">Tus respuestas nos ayudan a mejorar la cultura.</p>
          <button
            onClick={onComplete}
            className="relative flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // ── Pantalla de revisión ──────────────────────────────────────────────────
  if (phase === "review") {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button
              onClick={() => transition(() => { setPhase("question"); })}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-xl font-bold text-[#1e293b]">Revisa tus respuestas</h3>
              <p className="text-sm text-[#64748b]">Puedes editar cualquier respuesta antes de enviar</p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {questions.map((q, idx) => {
            const isMissing = highlightMissing.has(q.id);
            return (
              <div
                key={q.id}
                className={`rounded-2xl shadow-sm px-6 py-4 flex items-center justify-between gap-4 transition-all ${
                  isMissing
                    ? "bg-red-50 border-2 border-red-400 animate-pulse"
                    : "bg-white border border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`font-black w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                    isMissing ? "bg-red-100 text-red-500" : "bg-slate-100 text-[#64748b]"
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[#1e293b] leading-snug truncate">
                        {q.text || "(Sin pregunta)"}
                      </p>
                      {q.required && (
                        <span className="text-[10px] font-bold text-red-500 uppercase shrink-0">* Obligatoria</span>
                      )}
                    </div>
                    <div className="mt-1.5">
                      <AnswerLabel value={answers[q.id]} required={q.required} />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => goToQuestion(idx)}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#64748b] hover:text-primary px-3 py-2 rounded-xl hover:bg-primary/10 transition-all shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
              </div>
            );
          })}
        </div>

        {error && (
          <p className="text-sm text-red-600 font-semibold bg-red-50 px-4 py-3 rounded-xl border border-red-200">
            {error}
          </p>
        )}

        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
          >
            {submitting
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Send className="w-4 h-4" />
            }
            {submitting ? "Enviando..." : "Enviar respuestas"}
          </button>
        </div>
      </div>
    );
  }

  // ── Tarjeta de pregunta ───────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header: volver + título + progreso numérico */}
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
            Pregunta {currentIndex + 1} de {questions.length}
          </p>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-[#64748b]">
            {currentIndex + 1} / {questions.length} preguntas
          </span>
          <span className="text-xs font-bold text-primary">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Tarjeta con efecto glow */}
      <div
        className={`relative group/card transition-opacity duration-[180ms] ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {/* Blob izquierdo */}
        <div className="absolute -left-10 top-1/3 w-40 h-40 bg-[#00D6BC]/25 rounded-full blur-3xl opacity-0 group-hover/card:opacity-100 transition-all duration-700 pointer-events-none" />
        {/* Blob derecho */}
        <div className="absolute -right-10 bottom-1/3 w-40 h-40 bg-[#00D6BC]/20 rounded-full blur-3xl opacity-0 group-hover/card:opacity-100 transition-all duration-700 pointer-events-none" />

        <div className="relative bg-white rounded-[2rem] px-10 py-12 border border-slate-100 shadow-sm">
          {/* Texto de la pregunta */}
          <div className="mb-10 text-center">
            <p className="text-xl font-bold text-[#1e293b] leading-snug">
              {currentQ.text || (
                <span className="text-slate-400 italic">Sin texto</span>
              )}
            </p>
            {currentQ.required && (
              <span className="inline-block mt-2 text-[10px] font-black uppercase text-red-500 bg-red-50 px-2 py-0.5 rounded-md">
                * Obligatoria
              </span>
            )}
          </div>

          {/* Input */}
          <QuestionInput
            q={currentQ}
            value={answers[currentQ.id]}
            onChange={(v) => setAnswer(currentQ.id, v)}
          />

          {/* Hint */}
          {answers[currentQ.id] === undefined && (
            <p className={`text-center text-xs mt-6 ${currentQ.required ? "text-red-400 font-semibold" : "text-[#94a3b8]"}`}>
              {currentQ.required
                ? "* Esta pregunta es obligatoria"
                : "Selecciona una opción — o avanza sin responder"}
            </p>
          )}
        </div>
      </div>

      {/* Error obligatoria */}
      {error && (
        <p className="text-sm text-red-600 font-semibold bg-red-50 px-4 py-3 rounded-xl border border-red-200 text-center">
          {error}
        </p>
      )}

      {/* Navegación */}
      <div className="flex items-center justify-between">
        {/* Anterior */}
        <button
          onClick={goPrev}
          disabled={currentIndex === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-[#64748b] border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-30"
        >
          <ArrowLeft className="w-4 h-4" />
          Anterior
        </button>

        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => transition(() => setCurrentIndex(idx))}
              title={`Pregunta ${idx + 1}`}
              className={`rounded-full transition-all duration-300 ${
                idx === currentIndex
                  ? "w-6 h-2.5 bg-primary"
                  : answers[questions[idx].id] !== undefined
                  ? "w-2.5 h-2.5 bg-primary/40 hover:bg-primary/70"
                  : "w-2.5 h-2.5 bg-slate-200 hover:bg-slate-300"
              }`}
            />
          ))}
        </div>

        {/* Siguiente / Revisar */}
        <button
          onClick={goNext}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#1e293b] text-white hover:bg-primary transition-all"
        >
          {currentIndex === questions.length - 1 ? "Revisar" : "Siguiente"}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
