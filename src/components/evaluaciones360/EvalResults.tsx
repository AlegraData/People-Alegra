"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, Download, BarChart2, User, ChevronDown, ChevronRight } from "lucide-react";
import * as XLSX from "xlsx";
import type { Evaluation360, Eval360Question, EvalType } from "@/types/evaluaciones360";
import { EVAL_TYPE_LABELS, EVAL_TYPE_COLORS } from "@/types/evaluaciones360";

interface Props {
  evaluation: Evaluation360;
  onBack: () => void;
}

interface TypeResult {
  score: number;
  submittedCount: number;
  questionScores: Record<string, { avg: number; weight: number; category?: string; text: string }>;
  categoryScores: Record<string, { avg: number; count: number }>;
}

interface EvaluateeResult {
  evaluateeEmail: string;
  evaluateeName: string;
  overallScore: number;
  totalSubmitted: number;
  byType: Partial<Record<EvalType, TypeResult>>;
}

interface ResultsData {
  evaluation: { id: string; title: string; status: string; typeWeights: Record<EvalType, number> };
  questionsMap: Record<EvalType, Eval360Question[]>;
  results: EvaluateeResult[];
}

export default function EvalResults({ evaluation, onBack }: Props) {
  const [data, setData]         = useState<ResultsData | null>(null);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/evaluaciones360/surveys/${evaluation.id}/results`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [evaluation.id]);

  const toggleExpand = (email: string) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(email) ? s.delete(email) : s.add(email); return s; });

  const toggleType = (key: string) =>
    setExpandedTypes((prev) => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });

  const handleExport = () => {
    if (!data) return;

    // Tipos que tienen peso > 0 (en el orden canónico)
    const exportTypes = (["ascendente", "descendente", "paralela", "autoevaluacion"] as EvalType[]).filter(
      (t) => (data.evaluation.typeWeights[t] ?? 0) > 0
    );

    // Construir encabezados dinámicos
    const headers: string[] = ["Evaluado", "Correo", "Score Global", "Total Evaluaciones"];
    exportTypes.forEach((type) => {
      const label  = EVAL_TYPE_LABELS[type];
      const typeQs = (data.questionsMap[type] ?? []).filter((q) => q.type === "rating");
      headers.push(`${label} - Score`);
      headers.push(`${label} - Respuestas`);
      typeQs.forEach((q) => {
        const cat = q.category ? `[${q.category}] ` : "";
        headers.push(`${label} - ${cat}${q.text} (${q.weight}%)`);
      });
    });

    // Una fila por evaluado, todo plano
    const dataRows = data.results.map((r) => {
      const row: Record<string, unknown> = {
        "Evaluado":           r.evaluateeName || r.evaluateeEmail,
        "Correo":             r.evaluateeEmail,
        "Score Global":       r.overallScore,
        "Total Evaluaciones": r.totalSubmitted,
      };
      exportTypes.forEach((type) => {
        const label  = EVAL_TYPE_LABELS[type];
        const tr     = r.byType[type];
        const typeQs = (data.questionsMap[type] ?? []).filter((q) => q.type === "rating");
        row[`${label} - Score`]      = tr?.score         ?? "";
        row[`${label} - Respuestas`] = tr?.submittedCount ?? 0;
        typeQs.forEach((q) => {
          const cat = q.category ? `[${q.category}] ` : "";
          row[`${label} - ${cat}${q.text} (${q.weight}%)`] = tr?.questionScores[q.id]?.avg ?? "";
        });
      });
      return row;
    });

    // aoa_to_sheet garantiza el orden exacto de columnas
    const aoa = [headers, ...dataRows.map((row) => headers.map((h) => row[h] ?? ""))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultados");
    XLSX.writeFile(wb, `resultados_360_${evaluation.title.replace(/\s+/g, "_")}.xlsx`);
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // Max de ratingMax ponderado entre todas las preguntas rating de todos los tipos
  const globalRatingMax = (() => {
    if (!data) return 5;
    const allRating = (Object.values(data.questionsMap) as Eval360Question[][]).flat().filter((q) => q.type === "rating");
    if (allRating.length === 0) return 5;
    const totalW = allRating.reduce((s, q) => s + q.weight, 0) || 1;
    return allRating.reduce((s, q) => s + (q.ratingMax ?? 5) * q.weight, 0) / totalW;
  })();

  const typeRatingMax = (type: EvalType): number => {
    const qs = (data?.questionsMap[type] ?? []).filter((q) => q.type === "rating");
    if (qs.length === 0) return globalRatingMax;
    const totalW = qs.reduce((s, q) => s + q.weight, 0) || 1;
    return qs.reduce((s, q) => s + (q.ratingMax ?? 5) * q.weight, 0) / totalW;
  };

  const qRatingMax = (type: EvalType, qId: string): number => {
    const q = data?.questionsMap[type]?.find((q) => q.id === qId);
    return q?.ratingMax ?? typeRatingMax(type);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-[#1e293b]">Resultados</h3>
            <p className="text-sm text-[#64748b]">{evaluation.title}</p>
          </div>
        </div>
        <button onClick={handleExport} className="flex items-center gap-2 text-sm font-bold text-[#64748b] hover:text-primary px-4 py-2 rounded-xl hover:bg-primary/10 transition-colors">
          <Download className="w-4 h-4" /> Exportar Excel
        </button>
      </div>

      {/* Weights info */}
      {data && (
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
          <p className="text-xs font-bold uppercase text-[#64748b] mb-3">Pesos por tipo de evaluación</p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(data.evaluation.typeWeights) as [EvalType, number][]).filter(([, w]) => w > 0).map(([type, w]) => (
              <span key={type} className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${EVAL_TYPE_COLORS[type]}`}>
                {EVAL_TYPE_LABELS[type]}: {w}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* No results yet */}
      {(!data || data.results.length === 0) && (
        <div className="bg-white rounded-[2rem] p-16 border border-slate-100 text-center">
          <BarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="font-bold text-[#1e293b]">Sin resultados aún</p>
          <p className="text-sm text-[#64748b] mt-1">Los resultados aparecen cuando los evaluadores envían sus respuestas</p>
        </div>
      )}

      {/* Per-evaluatee results */}
      {data?.results.map((r) => {
        const isExpanded = expanded.has(r.evaluateeEmail);
        const typeEntries = Object.entries(r.byType) as [EvalType, TypeResult][];

        return (
          <div key={r.evaluateeEmail} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Evaluatee header */}
            <button
              onClick={() => toggleExpand(r.evaluateeEmail)}
              className="w-full px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors text-left"
            >
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#1e293b]">{r.evaluateeName || r.evaluateeEmail}</p>
                <p className="text-xs text-[#94a3b8]">
                  {r.evaluateeEmail} · {r.totalSubmitted} evaluaci{r.totalSubmitted !== 1 ? "ones" : "ón"} recibida{r.totalSubmitted !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="text-right">
                  <p className="text-2xl font-black text-primary">{r.overallScore.toFixed(1)}</p>
                  <p className="text-[10px] font-bold uppercase text-[#64748b]">Score global</p>
                </div>
                {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
              </div>
            </button>

            {isExpanded && (
              <div className="px-6 pb-6 space-y-4 border-t border-slate-100">
                {/* Score bar global */}
                <div className="pt-4">
                  <ScoreBar value={r.overallScore} max={globalRatingMax} label="Score Global Ponderado" />
                </div>

                {/* Per type sections */}
                {typeEntries.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase text-[#64748b]">Por Tipo de Evaluación</p>
                    {typeEntries.map(([type, tr]) => {
                      const typeKey  = `${r.evaluateeEmail}-${type}`;
                      const isTypeEx = expandedTypes.has(typeKey);
                      const tMax     = typeRatingMax(type);
                      const categories = Object.entries(tr.categoryScores);
                      const qScores    = Object.entries(tr.questionScores);

                      return (
                        <div key={type} className={`rounded-xl border overflow-hidden ${EVAL_TYPE_COLORS[type].replace("text-", "border-")}`}>
                          {/* Type header */}
                          <button
                            onClick={() => toggleType(typeKey)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors text-left"
                          >
                            <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${EVAL_TYPE_COLORS[type]}`}>
                              {EVAL_TYPE_LABELS[type]}
                            </span>
                            <span className="text-xs font-semibold text-[#64748b]">
                              {tr.submittedCount} respuesta{tr.submittedCount !== 1 ? "s" : ""}
                            </span>
                            <div className="flex-1">
                              <ScoreBar value={tr.score} max={tMax} label="" compact />
                            </div>
                            <span className="text-lg font-black text-[#1e293b] shrink-0 w-12 text-right">{tr.score.toFixed(1)}</span>
                            {isTypeEx ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                          </button>

                          {isTypeEx && (
                            <div className="px-4 pb-4 space-y-4 border-t border-slate-100">
                              {/* Category scores */}
                              {categories.length > 0 && (
                                <div className="pt-3">
                                  <p className="text-[10px] font-bold uppercase text-[#64748b] mb-2">Por Categoría</p>
                                  <div className="space-y-2">
                                    {categories.map(([cat, cs]) => {
                                      const catMax = (() => {
                                        const catQs = (data.questionsMap[type] ?? []).filter((q) => q.type === "rating" && (q.category || "General") === cat);
                                        if (catQs.length === 0) return tMax;
                                        const totalW = catQs.reduce((s, q) => s + q.weight, 0) || 1;
                                        return catQs.reduce((s, q) => s + (q.ratingMax ?? 5) * q.weight, 0) / totalW;
                                      })();
                                      return <ScoreBar key={cat} value={cs.avg} max={catMax} label={cat} />;
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Per question */}
                              {qScores.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold uppercase text-[#64748b] mb-2">Por Pregunta</p>
                                  <div className="space-y-2">
                                    {qScores.map(([qId, qs]) => {
                                      const qMax = qRatingMax(type, qId);
                                      return (
                                        <div key={qId} className="flex items-center gap-3">
                                          <div className="flex-1 min-w-0">
                                            {qs.category && <p className="text-[10px] font-black uppercase text-primary mb-0.5">{qs.category}</p>}
                                            <p className="text-xs font-semibold text-[#1e293b] truncate">{qs.text}</p>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                              <div
                                                className="h-full bg-primary rounded-full"
                                                style={{ width: `${Math.min((qs.avg / qMax) * 100, 100)}%` }}
                                              />
                                            </div>
                                            <span className="text-sm font-black text-[#1e293b] w-8 text-right">{qs.avg}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScoreBar({ value, max, label, compact }: { value: number; max: number; label: string; compact?: boolean }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-semibold text-[#1e293b] flex-1 min-w-0 truncate">{label}</span>
      <div className="w-32 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-sm font-black text-primary w-10 text-right shrink-0">{value.toFixed(1)}</span>
    </div>
  );
}
