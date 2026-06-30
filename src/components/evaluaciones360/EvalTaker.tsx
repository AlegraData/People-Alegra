"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, Pencil, AlertCircle,
  ChevronRight, Clock, Users,
} from "lucide-react";
import type { Evaluation360, Evaluation360Assignment, Eval360Question, EvalType } from "@/types/evaluaciones360";
import { EVAL_TYPE_LABELS, EVAL_TYPE_COLORS, normalizeQuestions } from "@/types/evaluaciones360";

interface Props {
  evaluation: Evaluation360;
  onBack: () => void;
  userEmail: string;
}

type TakePhase = "list" | "intro" | "question" | "review" | "completed";

const STATUS_LABELS: Record<string, { label: string; style: string }> = {
  pending:     { label: "Pendiente",    style: "bg-slate-100 text-slate-600" },
  in_progress: { label: "En progreso",  style: "bg-blue-100 text-blue-700" },
  completed:   { label: "Completada",   style: "bg-amber-100 text-amber-700" },
  submitted:   { label: "Enviada",      style: "bg-emerald-100 text-emerald-700" },
};

export default function EvalTaker({ evaluation, onBack, userEmail }: Props) {
  const questionsMap  = normalizeQuestions(evaluation.questions as unknown);
  const myAssignments = evaluation.myAssignments ?? [];

  const [phase, setPhase]                     = useState<TakePhase>("list");
  const [selectedAssignment, setSelected]     = useState<Evaluation360Assignment | null>(null);
  const [assignments, setAssignments]         = useState<Evaluation360Assignment[]>(myAssignments);
  const [currentIndex, setCurrentIndex]       = useState(0);
  const [answers, setAnswers]                 = useState<Record<string, string | number>>({});
  const [highlightMissing, setHighlightMissing] = useState<Set<string>>(new Set());
  const [error, setError]                     = useState<string | null>(null);
  const [submitting, setSubmitting]           = useState(false);
  const [visible, setVisible]                 = useState(true);
  const [saveStatus, setSaveStatus]           = useState<"idle" | "saving" | "saved" | "error">("idle");
  const autoSaveTimeout                       = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => () => { if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current); }, []);

  const questions: Eval360Question[] = selectedAssignment
    ? (questionsMap[selectedAssignment.evaluationType] ?? [])
    : [];
  const currentQ = questions[currentIndex];
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  // ── Auto-save ─────────────────────────────────────────────────────────────
  const autoSave = useCallback(
    async (currentAnswers: Record<string, string | number>, assignmentId: string) => {
      if (!assignmentId) return;
      setSaveStatus("saving");
      try {
        await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/assignments/${assignmentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftAnswers: currentAnswers, status: "in_progress" }),
        });
        setSaveStatus("saved");
        // Update local state
        setAssignments((prev) =>
          prev.map((a) => a.id === assignmentId ? { ...a, status: "in_progress", draftAnswers: currentAnswers } : a)
        );
      } catch {
        setSaveStatus("error");
      } finally {
        setTimeout(() => setSaveStatus("idle"), 2000);
      }
    },
    [evaluation.id]
  );

  const setAnswer = (qId: string, v: string | number) => {
    const next = { ...answers, [qId]: v };
    setAnswers(next);
    setHighlightMissing((prev) => { const s = new Set(prev); s.delete(qId); return s; });

    // Debounce auto-save
    if (autoSaveTimeout.current) clearTimeout(autoSaveTimeout.current);
    if (selectedAssignment) {
      autoSaveTimeout.current = setTimeout(() => autoSave(next, selectedAssignment.id), 800);
    }
  };

  // ── Select an assignment to evaluate ─────────────────────────────────────
  const selectAssignment = (a: Evaluation360Assignment) => {
    setSelected(a);
    // Load saved draft or empty
    const draft = (a.draftAnswers ?? a.finalAnswers ?? {}) as Record<string, string | number>;
    setAnswers(draft);
    setCurrentIndex(0);
    setError(null);
    setHighlightMissing(new Set());
    setPhase("intro");
  };

  const transition = (fn: () => void) => {
    setVisible(false);
    setTimeout(() => { fn(); setVisible(true); }, 180);
  };

  const goNext = () => {
    if (currentQ.required && (answers[currentQ.id] === undefined || answers[currentQ.id] === "")) {
      setError("Esta pregunta es obligatoria."); return;
    }
    setError(null);
    transition(() =>
      currentIndex < questions.length - 1 ? setCurrentIndex((i) => i + 1) : setPhase("review")
    );
  };

  const goPrev = () => {
    if (currentIndex > 0) { setError(null); transition(() => setCurrentIndex((i) => i - 1)); }
  };

  // ── Enviar evaluación directamente ───────────────────────────────────────
  const handleComplete = async () => {
    const unanswered = questions.filter((q) => q.required && (answers[q.id] === undefined || answers[q.id] === ""));
    if (unanswered.length > 0) {
      setHighlightMissing(new Set(unanswered.map((q) => q.id)));
      setError(`${unanswered.length} pregunta${unanswered.length > 1 ? "s" : ""} obligatoria${unanswered.length > 1 ? "s" : ""} sin responder.`);
      return;
    }
    if (!selectedAssignment) return;
    setSubmitting(true);
    try {
      await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/assignments/${selectedAssignment.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalAnswers: answers }),
      });
      setAssignments((prev) =>
        prev.map((a) => a.id === selectedAssignment.id ? { ...a, status: "submitted" } : a)
      );
      setPhase("list");
      setSelected(null);
    } catch { setError("Error al enviar. Intenta de nuevo."); }
    finally { setSubmitting(false); }
  };

  // ── LIST PHASE ────────────────────────────────────────────────────────────
  if (phase === "list") {
    const total     = assignments.length;
    const submitted = assignments.filter((a) => a.status === "submitted").length;
    const pct       = total > 0 ? Math.round((submitted / total) * 100) : 0;

    return (
      <div className="max-w-full space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-[#1e293b]">{evaluation.title}</h2>
            <p className="text-sm text-[#64748b]">Selecciona a quién vas a evaluar</p>
          </div>
        </div>

        {/* Progress summary */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-[#1e293b]">Tu progreso</span>
            <span className="text-sm font-black text-primary">{submitted}/{total} enviadas</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          {submitted === total && total > 0 && (
            <p className="text-xs text-emerald-600 font-bold mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              ¡Has completado todas tus evaluaciones!
            </p>
          )}
        </div>

        {/* Evaluatee list */}
        <div className="space-y-2">
          {assignments.map((a) => {
            const st = STATUS_LABELS[a.status] ?? STATUS_LABELS.pending;
            const isSubmitted = a.status === "submitted";
            return (
              <button
                key={a.id}
                onClick={() => selectAssignment(a)}
                className={`w-full bg-white rounded-2xl p-4 border transition-all text-left flex items-center gap-4 cursor-pointer ${
                  isSubmitted
                    ? "border-emerald-100 hover:border-primary/30 hover:shadow-sm"
                    : "border-slate-100 hover:border-primary/30 hover:shadow-sm"
                }`}
              >
                <AvatarCircle
                  avatarUrl={a.evaluateeAvatarUrl}
                  name={a.evaluateeName || a.evaluateeEmail}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[#1e293b] truncate">{a.evaluateeName || a.evaluateeEmail}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <TypeBadge type={a.evaluationType} />
                    {a.team && <span className="text-[10px] font-semibold text-[#94a3b8]">{a.team}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${st.style}`}>{st.label}</span>
                  {isSubmitted
                    ? <Pencil className="w-4 h-4 text-slate-400" />
                    : <ChevronRight className="w-4 h-4 text-slate-300" />}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── INTRO PHASE ───────────────────────────────────────────────────────────
  if (phase === "intro") {
    return (
      <div className="max-w-full">
        <div className="relative bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-primary via-[#00b8a3] to-primary/60" />
          <div className="px-10 py-12">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <TypeBadge type={selectedAssignment!.evaluationType} large />
            </div>

            <h2 className="text-3xl font-extrabold text-[#1e293b] leading-tight mb-2">
              Evaluación de {selectedAssignment!.evaluateeName || selectedAssignment!.evaluateeEmail}
            </h2>
            <p className="text-[#64748b] mb-6">{evaluation.title}</p>

            {evaluation.instructions && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 mb-6">
                <p className="text-sm text-[#475569] whitespace-pre-wrap">{evaluation.instructions}</p>
              </div>
            )}

            {selectedAssignment?.status === "submitted" && (
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-6">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-amber-800">
                  Estás editando una evaluación ya enviada. Al enviar, tus respuestas anteriores serán reemplazadas.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 mb-8">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64748b] bg-slate-100 px-3 py-1.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {questions.length} pregunta{questions.length !== 1 ? "s" : ""}
              </span>
              {selectedAssignment?.status === "in_progress" && (
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">
                  <Clock className="w-3 h-3" />
                  Progreso guardado
                </span>
              )}
            </div>

            <div className="flex items-center justify-between">
              <button onClick={() => setPhase("list")} className="flex items-center gap-2 text-sm font-bold text-[#64748b] hover:text-[#1e293b] transition-colors">
                <ArrowLeft className="w-4 h-4" /> Volver
              </button>
              <button
                onClick={() => { setPhase("question"); setCurrentIndex(0); }}
                className="flex items-center gap-2 bg-[#1e293b] text-white px-8 py-3.5 rounded-2xl font-bold hover:bg-primary hover:shadow-lg hover:shadow-primary/20 transition-all"
              >
                {selectedAssignment?.status === "submitted"
                  ? "Editar evaluación"
                  : selectedAssignment?.status === "in_progress"
                  ? "Continuar evaluación"
                  : "Comenzar evaluación"}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── QUESTION PHASE ────────────────────────────────────────────────────────
  if (phase === "question") {
    return (
      <div className="max-w-full space-y-5">
        {/* Header card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-4 flex items-center gap-4">
            <button
              onClick={() => setPhase("intro")}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors text-[#64748b] shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <AvatarCircle
              avatarUrl={selectedAssignment!.evaluateeAvatarUrl}
              name={selectedAssignment!.evaluateeName || selectedAssignment!.evaluateeEmail}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <p className="text-base font-extrabold text-[#1e293b] truncate leading-tight">
                {selectedAssignment!.evaluateeName || selectedAssignment!.evaluateeEmail}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <TypeBadge type={selectedAssignment!.evaluationType} />
                <span className="text-xs text-[#94a3b8]">·</span>
                <span className="text-xs text-[#64748b]">Pregunta {currentIndex + 1} de {questions.length}</span>
                {saveStatus === "saving" && <span className="text-[10px] text-[#94a3b8]">Guardando...</span>}
                {saveStatus === "saved"  && <span className="text-[10px] text-emerald-500 font-bold">✓ Guardado</span>}
                {saveStatus === "error"  && <span className="text-[10px] text-red-500 font-bold">Error al guardar</span>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <span className="text-lg font-black text-primary">{Math.round(progress)}%</span>
            </div>
          </div>
          {/* Progress bar at the bottom of the card */}
          <div className="h-1.5 bg-slate-100">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Question card */}
        <div className={`relative group/card transition-opacity duration-[180ms] ${visible ? "opacity-100" : "opacity-0"}`}>
          <div className="absolute -left-10 top-1/3 w-40 h-40 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover/card:opacity-100 transition-all duration-700 pointer-events-none" />
          <div className="relative bg-white rounded-[2rem] px-10 py-12 border border-slate-100 shadow-sm">
            {currentQ.category && (
              <p className="text-xs font-black uppercase tracking-wider text-primary mb-3">{currentQ.category}</p>
            )}
            <div className="mb-10 text-center">
              <p className="text-xl font-bold text-[#1e293b] leading-snug">
                {currentQ.text || <span className="text-slate-400 italic">Sin texto</span>}
                {currentQ.required && <span className="inline-block ml-1 animate-pulse text-red-400 text-2xl leading-none align-middle select-none">*</span>}
              </p>
            </div>
            <QuestionInput q={currentQ} value={answers[currentQ.id]} onChange={(v) => setAnswer(currentQ.id, v)} />
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 font-semibold bg-red-50 px-4 py-3 rounded-xl border border-red-200 text-center">{error}</p>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button onClick={goPrev} disabled={currentIndex === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-[#64748b] border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-30">
            <ArrowLeft className="w-4 h-4" /> Anterior
          </button>

          {/* Dots */}
          <div className="flex items-center gap-1.5">
            {questions.map((_, idx) => (
              <button key={idx} onClick={() => transition(() => setCurrentIndex(idx))}
                className={`rounded-full transition-all duration-300 ${
                  idx === currentIndex ? "w-6 h-2.5 bg-primary" :
                  answers[questions[idx].id] !== undefined ? "w-2.5 h-2.5 bg-primary/40 hover:bg-primary/70" :
                  "w-2.5 h-2.5 bg-slate-200 hover:bg-slate-300"
                }`} />
            ))}
          </div>

          <button onClick={goNext}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-[#1e293b] text-white hover:bg-primary transition-all">
            {currentIndex === questions.length - 1 ? "Revisar" : "Siguiente"}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── REVIEW PHASE ──────────────────────────────────────────────────────────
  if (phase === "review") {
    return (
      <div className="max-w-full space-y-4">
        <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <button onClick={() => transition(() => setPhase("question"))} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <AvatarCircle
              avatarUrl={selectedAssignment!.evaluateeAvatarUrl}
              name={selectedAssignment!.evaluateeName || selectedAssignment!.evaluateeEmail}
              size="md"
            />
            <div>
              <h3 className="text-xl font-bold text-[#1e293b]">Revisa tus respuestas</h3>
              <p className="text-sm text-[#64748b]">Para {selectedAssignment!.evaluateeName || selectedAssignment!.evaluateeEmail}</p>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          {questions.map((q, idx) => {
            const isMissing = highlightMissing.has(q.id);
            return (
              <div key={q.id}
                className={`rounded-2xl shadow-sm px-6 py-4 flex items-center justify-between gap-4 transition-all ${
                  isMissing ? "bg-red-50 border-2 border-red-400 animate-pulse" : "bg-white border border-slate-100 hover:border-slate-200"
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className={`font-black w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 mt-0.5 ${
                    isMissing ? "bg-red-100 text-red-500" : "bg-slate-100 text-[#64748b]"
                  }`}>{idx + 1}</span>
                  <div className="min-w-0">
                    {q.category && <p className="text-[10px] font-black uppercase tracking-wider text-primary mb-0.5">{q.category}</p>}
                    <p className="text-sm font-semibold text-[#1e293b] leading-snug">{q.text || "(Sin texto)"}</p>
                    <div className="mt-1.5">
                      {answers[q.id] !== undefined && answers[q.id] !== ""
                        ? <span className="text-sm font-bold text-primary">{String(answers[q.id])}</span>
                        : <span className={`inline-flex items-center gap-1 text-xs font-bold ${q.required ? "text-red-500" : "text-amber-600"}`}>
                            <AlertCircle className="w-3 h-3" />{q.required ? "Obligatoria — falta responder" : "Sin respuesta"}
                          </span>
                      }
                    </div>
                  </div>
                </div>
                <button onClick={() => { setCurrentIndex(idx); setPhase("question"); }}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#64748b] hover:text-primary px-3 py-2 rounded-xl hover:bg-primary/10 transition-all shrink-0">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
              </div>
            );
          })}
        </div>

        {selectedAssignment?.status === "submitted" && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm font-semibold text-amber-800">
              Estás editando una evaluación ya enviada. Al enviar, tus respuestas anteriores serán reemplazadas.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600 font-semibold bg-red-50 px-4 py-3 rounded-xl border border-red-200">{error}</p>}

        <div className="bg-white rounded-[2rem] p-6 border border-slate-100 shadow-sm flex justify-end">
          <button onClick={handleComplete} disabled={submitting}
            className="flex items-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50">
            {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {submitting ? "Enviando..." : "Enviar evaluación"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Question input component ──────────────────────────────────────────────────
function QuestionInput({ q, value, onChange }: { q: Eval360Question; value: string | number | undefined; onChange: (v: string | number) => void }) {
  if (q.type === "rating") {
    const min   = q.ratingMin ?? 1;
    const max   = q.ratingMax ?? 5;
    const steps = Array.from({ length: max - min + 1 }, (_, k) => k + min);
    return (
      <div>
        <div className="flex flex-wrap gap-2 justify-center">
          {steps.map((num) => (
            <button key={num} onClick={() => onChange(num)}
              className={`w-12 h-12 rounded-xl font-bold text-lg transition-all duration-200 ${
                value === num ? "bg-primary text-white scale-110 shadow-lg shadow-primary/30" : "bg-slate-100 text-[#64748b] hover:bg-slate-200 hover:scale-105"
              }`}>
              {num}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (q.type === "boolean") {
    return (
      <div className="flex gap-3 justify-center">
        {["Sí", "No"].map((opt) => (
          <button key={opt} onClick={() => onChange(opt)}
            className={`px-12 py-3.5 rounded-xl font-bold text-lg transition-all duration-200 ${
              value === opt ? "bg-primary text-white scale-105 shadow-lg shadow-primary/30" : "bg-slate-100 text-[#64748b] hover:bg-slate-200 hover:scale-105"
            }`}>
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
          <button key={opt} onClick={() => onChange(opt)}
            className={`flex-1 min-w-[80px] flex flex-col items-center gap-3 px-4 py-5 rounded-xl border-2 transition-all duration-200 ${
              value === opt ? "bg-primary/10 border-primary text-primary" : "bg-slate-50 border-slate-200 text-[#64748b] hover:border-primary/40 hover:bg-slate-100"
            }`}>
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${value === opt ? "bg-primary text-white" : "bg-slate-200 text-[#64748b]"}`}>{idx + 1}</span>
            <span className="text-xs font-semibold text-center leading-snug">{opt}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <textarea value={(value as string) ?? ""}
      onChange={(e) => { onChange(e.target.value); e.currentTarget.style.height = "auto"; e.currentTarget.style.height = e.currentTarget.scrollHeight + "px"; }}
      rows={4}
      className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-4 outline-none focus:border-primary transition-colors text-sm resize-none overflow-hidden"
      placeholder="Escribe tu respuesta aquí..."
    />
  );
}

function TypeBadge({ type, large }: { type: EvalType; large?: boolean }) {
  return (
    <span className={`inline-block rounded-full font-black uppercase ${large ? "text-xs px-3 py-1" : "text-[10px] px-2 py-0.5"} ${EVAL_TYPE_COLORS[type]}`}>
      {EVAL_TYPE_LABELS[type]}
    </span>
  );
}

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500",
  "bg-rose-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500",
];

function getAvatarColor(str: string) {
  const hash = str.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(nameOrEmail: string) {
  if (!nameOrEmail?.trim()) return "?";
  const parts = nameOrEmail.trim().split(/[\s@._-]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return nameOrEmail.trim().slice(0, 2).toUpperCase() || "?";
}

const AVATAR_SIZES = {
  sm: { wrap: "w-10 h-10 rounded-xl",   text: "text-xs" },
  md: { wrap: "w-12 h-12 rounded-2xl",  text: "text-sm" },
  lg: { wrap: "w-14 h-14 rounded-2xl",  text: "text-base" },
};

function AvatarCircle({ avatarUrl, name, size = "sm" }: { avatarUrl?: string | null; name: string; size?: keyof typeof AVATAR_SIZES }) {
  const [imgError, setImgError] = useState(false);
  const color    = getAvatarColor(name);
  const initials = getInitials(name);
  const sz       = AVATAR_SIZES[size];

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className={`${sz.wrap} object-cover shrink-0`}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div className={`${sz.wrap} flex items-center justify-center shrink-0 ${color}`}>
      <span className={`${sz.text} font-black text-white`}>{initials}</span>
    </div>
  );
}
