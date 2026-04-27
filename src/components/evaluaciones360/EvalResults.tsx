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

interface EvaluateeResult {
  evaluateeEmail: string;
  evaluateeName: string;
  overallScore: number;
  totalSubmitted: number;
  questionScores: Record<string, { avg: number; weight: number; category?: string; text: string }>;
  categoryScores: Record<string, { avg: number; count: number }>;
  byType: Record<string, Record<string, number>>;
}

interface ResultsData {
  evaluation: { id: string; title: string; status: string; typeWeights: Record<EvalType, number> };
  questions: Eval360Question[];
  results: EvaluateeResult[];
}

export default function EvalResults({ evaluation, onBack }: Props) {
  const [data, setData]       = useState<ResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/evaluaciones360/surveys/${evaluation.id}/results`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [evaluation.id]);

  const toggleExpand = (email: string) =>
    setExpanded((prev) => { const s = new Set(prev); s.has(email) ? s.delete(email) : s.add(email); return s; });

  const handleExport = () => {
    if (!data) return;
    const rows: any[] = [];
    data.results.forEach((r) => {
      rows.push({ "Evaluado": r.evaluateeName || r.evaluateeEmail, "Score Global": r.overallScore, "Evaluaciones recibidas": r.totalSubmitted, "": "" });
      Object.entries(r.categoryScores).forEach(([cat, score]) => {
        rows.push({ "Evaluado": "", "Categoría": cat, "Score Promedio": score.avg });
      });
      Object.entries(r.questionScores).forEach(([qId, qs]) => {
        rows.push({ "Evaluado": "", "Pregunta": qs.text, "Categoría": qs.category || "", "Score Ponderado": qs.avg, "Peso": `${qs.weight}%` });
      });
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultados");
    XLSX.writeFile(wb, `resultados_360_${evaluation.title.replace(/\s+/g, "_")}.xlsx`);
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const ratingQuestions = data?.questions.filter((q) => q.type === "rating") ?? [];

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
        const categories = Object.entries(r.categoryScores);

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
                <p className="text-xs text-[#94a3b8]">{r.evaluateeEmail} · {r.totalSubmitted} evaluaci{r.totalSubmitted !== 1 ? "ones" : "ón"} recibida{r.totalSubmitted !== 1 ? "s" : ""}</p>
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
              <div className="px-6 pb-6 space-y-5 border-t border-slate-100">
                {/* Score bar global */}
                <div className="pt-4">
                  <ScoreBar value={r.overallScore} max={ratingQuestions[0]?.ratingMax ?? 5} label="Score Global Ponderado" />
                </div>

                {/* By category */}
                {categories.length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase text-[#64748b] mb-3">Por Categoría</p>
                    <div className="space-y-3">
                      {categories.map(([cat, score]) => (
                        <ScoreBar key={cat} value={score.avg} max={ratingQuestions[0]?.ratingMax ?? 5} label={cat} />
                      ))}
                    </div>
                  </div>
                )}

                {/* By type */}
                {Object.keys(r.byType).length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase text-[#64748b] mb-3">Por Tipo de Evaluación</p>
                    <div className="grid grid-cols-2 gap-3">
                      {(Object.entries(r.byType) as [EvalType, Record<string, number>][]).map(([type, typeScores]) => {
                        const avg = Object.values(typeScores).length > 0
                          ? Object.values(typeScores).reduce((a, b) => a + b, 0) / Object.values(typeScores).length
                          : 0;
                        return (
                          <div key={type} className={`p-3 rounded-xl border ${EVAL_TYPE_COLORS[type].replace("text-", "border-").replace("bg-", "bg-")}`}>
                            <p className={`text-xs font-black uppercase mb-1 ${EVAL_TYPE_COLORS[type]}`}>{EVAL_TYPE_LABELS[type]}</p>
                            <p className="text-xl font-black text-[#1e293b]">{avg.toFixed(1)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Per question */}
                {Object.keys(r.questionScores).length > 0 && (
                  <div>
                    <p className="text-xs font-bold uppercase text-[#64748b] mb-3">Por Pregunta</p>
                    <div className="space-y-2.5">
                      {Object.entries(r.questionScores).map(([qId, qs]) => (
                        <div key={qId} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            {qs.category && <p className="text-[10px] font-black uppercase text-primary mb-0.5">{qs.category}</p>}
                            <p className="text-xs font-semibold text-[#1e293b] truncate">{qs.text}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full"
                                style={{ width: `${(qs.avg / (ratingQuestions[0]?.ratingMax ?? 5)) * 100}%` }}
                              />
                            </div>
                            <span className="text-sm font-black text-[#1e293b] w-8 text-right">{qs.avg}</span>
                          </div>
                        </div>
                      ))}
                    </div>
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

function ScoreBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
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
