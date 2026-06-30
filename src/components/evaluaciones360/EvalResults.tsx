"use client";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Download, BarChart2, ChevronDown, ChevronRight, Users, Search, X } from "lucide-react";
import * as XLSX from "xlsx";
import type { Evaluation360, Eval360Question, EvalType } from "@/types/evaluaciones360";
import { EVAL_TYPE_LABELS, EVAL_TYPE_COLORS } from "@/types/evaluaciones360";
import EvalParticipation from "./EvalParticipation";

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
  evaluateeName:  string;
  avatarUrl:      string | null;
  overallScore:   number;
  totalSubmitted: number;
  byType:         Partial<Record<EvalType, TypeResult>>;
}

interface ResultsData {
  evaluation:  { id: string; title: string; status: string; typeWeights: Record<EvalType, number> };
  questionsMap: Record<EvalType, Eval360Question[]>;
  results:     EvaluateeResult[];
}

type ResultsTab = "scores" | "participation";

const PAGE_SIZE = 10;

// ── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-teal-100 text-teal-700",    "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700","bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",  "bg-cyan-100 text-cyan-700",
  "bg-emerald-100 text-emerald-700","bg-indigo-100 text-indigo-700",
];

function avatarColor(s: string) {
  let hash = 0;
  for (const c of s) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(s: string) {
  if (!s?.trim()) return "?";
  const parts = s.trim().split(/[\s@._-]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.trim().slice(0, 2).toUpperCase() || "?";
}

function AvatarCircle({
  avatarUrl, name, size = "md",
}: { avatarUrl?: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const [err, setErr] = useState(false);
  const sz  = size === "sm" ? "w-9 h-9 text-xs" : size === "lg" ? "w-16 h-16 text-xl" : "w-11 h-11 text-sm";
  const col = avatarColor(name);
  if (avatarUrl && !err) {
    return (
      <img src={avatarUrl} alt={name} onError={() => setErr(true)}
        className={`${sz} rounded-2xl object-cover shrink-0`} />
    );
  }
  return (
    <div className={`${sz} rounded-2xl flex items-center justify-center font-bold shrink-0 ${col}`}>
      {getInitials(name)}
    </div>
  );
}

// ── Score bar ─────────────────────────────────────────────────────────────────
function ScoreBar({ value, max, label, compact }: { value: number; max: number; label: string; compact?: boolean }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  if (compact) return (
    <div className="flex items-center gap-2 flex-1">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
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

// ─────────────────────────────────────────────────────────────────────────────

export default function EvalResults({ evaluation, onBack }: Props) {
  const [data, setData]             = useState<ResultsData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [resultsTab, setResultsTab] = useState<ResultsTab>("scores");

  // List state
  const [search, setSearch] = useState("");
  const [page, setPage]     = useState(1);

  // Detail state
  const [selected, setSelected]           = useState<EvaluateeResult | null>(null);
  const [expandedTypes, setExpandedTypes] = useState<Set<EvalType>>(new Set());

  useEffect(() => {
    fetch(`/api/evaluaciones360/surveys/${evaluation.id}/results`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [evaluation.id]);

  // Reset on tab change
  useEffect(() => {
    setSelected(null);
    setSearch("");
    setPage(1);
  }, [resultsTab]);

  const toggleType = (t: EvalType) =>
    setExpandedTypes((prev) => {
      const s = new Set(prev);
      s.has(t) ? s.delete(t) : s.add(t);
      return s;
    });

  // ── Score helpers ─────────────────────────────────────────────────────────
  const globalRatingMax = useMemo(() => {
    if (!data) return 5;
    const all = (Object.values(data.questionsMap) as Eval360Question[][]).flat().filter((q) => q.type === "rating");
    if (all.length === 0) return 5;
    const tw = all.reduce((s, q) => s + q.weight, 0) || 1;
    return all.reduce((s, q) => s + (q.ratingMax ?? 5) * q.weight, 0) / tw;
  }, [data]);

  const typeRatingMax = (type: EvalType): number => {
    const qs = (data?.questionsMap[type] ?? []).filter((q) => q.type === "rating");
    if (qs.length === 0) return globalRatingMax;
    const tw = qs.reduce((s, q) => s + q.weight, 0) || 1;
    return qs.reduce((s, q) => s + (q.ratingMax ?? 5) * q.weight, 0) / tw;
  };

  const qRatingMax = (type: EvalType, qId: string): number => {
    const q = data?.questionsMap[type]?.find((q) => q.id === qId);
    return q?.ratingMax ?? typeRatingMax(type);
  };

  // ── Filtered + paginated list ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return data.results;
    return data.results.filter(
      (r) =>
        (r.evaluateeName || "").toLowerCase().includes(q) ||
        r.evaluateeEmail.toLowerCase().includes(q)
    );
  }, [data, search]);

  useEffect(() => setPage(1), [search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!data) return;
    const exportTypes = (["ascendente", "descendente", "paralela", "autoevaluacion"] as EvalType[]).filter(
      (t) => (data.evaluation.typeWeights[t] ?? 0) > 0
    );
    const headers: string[] = ["Evaluado", "Correo", "Score Global", "Total Evaluaciones"];
    exportTypes.forEach((type) => {
      const label  = EVAL_TYPE_LABELS[type];
      const typeQs = (data.questionsMap[type] ?? []).filter((q) => q.type === "rating");
      headers.push(`${label} - Score`, `${label} - Respuestas`);
      typeQs.forEach((q) => {
        const cat = q.category ? `[${q.category}] ` : "";
        headers.push(`${label} - ${cat}${q.text} (${q.weight}%)`);
      });
    });
    const rows = data.results.map((r) => {
      const row: Record<string, unknown> = {
        "Evaluado": r.evaluateeName || r.evaluateeEmail,
        "Correo": r.evaluateeEmail,
        "Score Global": r.overallScore,
        "Total Evaluaciones": r.totalSubmitted,
      };
      exportTypes.forEach((type) => {
        const label  = EVAL_TYPE_LABELS[type];
        const tr     = r.byType[type];
        const typeQs = (data.questionsMap[type] ?? []).filter((q) => q.type === "rating");
        row[`${label} - Score`]      = tr?.score          ?? "";
        row[`${label} - Respuestas`] = tr?.submittedCount ?? 0;
        typeQs.forEach((q) => {
          const cat = q.category ? `[${q.category}] ` : "";
          row[`${label} - ${cat}${q.text} (${q.weight}%)`] = tr?.questionScores[q.id]?.avg ?? "";
        });
      });
      return row;
    });
    const aoa = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))];
    const ws  = XLSX.utils.aoa_to_sheet(aoa);
    const wb  = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultados");
    XLSX.writeFile(wb, `resultados_360_${evaluation.title.replace(/\s+/g, "_")}.xlsx`);
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading && resultsTab === "scores") return (
    <div className="flex justify-center py-20">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  if (selected) {
    const typeEntries = Object.entries(selected.byType) as [EvalType, TypeResult][];
    return (
      <div className="space-y-6">

        {/* Back */}
        <button
          onClick={() => { setSelected(null); setExpandedTypes(new Set()); }}
          className="flex items-center gap-2 text-sm font-semibold text-[#64748b] hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a resultados
        </button>

        {/* Person card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center gap-5">
          <AvatarCircle avatarUrl={selected.avatarUrl} name={selected.evaluateeName || selected.evaluateeEmail} size="lg" />
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-black text-[#1e293b] truncate">
              {selected.evaluateeName || selected.evaluateeEmail}
            </h3>
            <p className="text-sm text-[#64748b] truncate">{selected.evaluateeEmail}</p>
            <p className="text-xs text-[#94a3b8] mt-1">
              {selected.totalSubmitted} evaluaci{selected.totalSubmitted !== 1 ? "ones" : "ón"} recibida{selected.totalSubmitted !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-4xl font-black text-primary">{selected.overallScore.toFixed(1)}</p>
            <p className="text-[10px] font-bold uppercase text-[#64748b]">Score global</p>
          </div>
        </div>

        {/* Global bar */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <p className="text-xs font-bold uppercase text-[#64748b] mb-3">Score Ponderado Global</p>
          <ScoreBar value={selected.overallScore} max={globalRatingMax} label="Score Global" />
        </div>

        {/* By type */}
        {typeEntries.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase text-[#64748b] px-1">Por tipo de evaluación</p>
            {typeEntries.map(([type, tr]) => {
              const isOpen     = expandedTypes.has(type);
              const tMax       = typeRatingMax(type);
              const categories = Object.entries(tr.categoryScores);
              const qScores    = Object.entries(tr.questionScores);

              return (
                <div key={type} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <button
                    onClick={() => toggleType(type)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors text-left"
                  >
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1.5 rounded-full shrink-0 ${EVAL_TYPE_COLORS[type]}`}>
                      {EVAL_TYPE_LABELS[type]}
                    </span>
                    <span className="text-xs font-semibold text-[#64748b] shrink-0">
                      {tr.submittedCount} respuesta{tr.submittedCount !== 1 ? "s" : ""}
                    </span>
                    <div className="flex-1">
                      <ScoreBar value={tr.score} max={tMax} label="" compact />
                    </div>
                    <span className="text-xl font-black text-[#1e293b] shrink-0 w-12 text-right">
                      {tr.score.toFixed(1)}
                    </span>
                    {isOpen
                      ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 space-y-5 border-t border-slate-100">
                      {categories.length > 0 && (
                        <div className="pt-4">
                          <p className="text-[10px] font-bold uppercase text-[#64748b] mb-3">Por Categoría</p>
                          <div className="space-y-2">
                            {categories.map(([cat, cs]) => {
                              const catQs = (data!.questionsMap[type] ?? []).filter(
                                (q) => q.type === "rating" && (q.category || "General") === cat
                              );
                              const catMax = catQs.length === 0
                                ? tMax
                                : catQs.reduce((s, q) => s + (q.ratingMax ?? 5) * q.weight, 0) /
                                  (catQs.reduce((s, q) => s + q.weight, 0) || 1);
                              return <ScoreBar key={cat} value={cs.avg} max={catMax} label={cat} />;
                            })}
                          </div>
                        </div>
                      )}

                      {qScores.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold uppercase text-[#64748b] mb-3">Por Pregunta</p>
                          <div className="space-y-3">
                            {qScores.map(([qId, qs]) => (
                              <div key={qId} className="flex items-center gap-3">
                                <div className="flex-1 min-w-0">
                                  {qs.category && (
                                    <p className="text-[10px] font-black uppercase text-primary mb-0.5">{qs.category}</p>
                                  )}
                                  <p className="text-sm font-semibold text-[#1e293b]">{qs.text}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-primary rounded-full"
                                      style={{ width: `${Math.min((qs.avg / qRatingMax(type, qId)) * 100, 100)}%` }}
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
        )}
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
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
        {resultsTab === "scores" && (
          <button
            onClick={handleExport}
            className="flex items-center gap-2 text-sm font-bold text-[#64748b] hover:text-primary px-4 py-2 rounded-xl hover:bg-primary/10 transition-colors"
          >
            <Download className="w-4 h-4" /> Exportar Excel
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex items-center bg-slate-100 rounded-2xl p-1 gap-1 w-fit">
        <button
          onClick={() => setResultsTab("scores")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            resultsTab === "scores"
              ? "bg-[#1e293b] text-white shadow-sm"
              : "text-[#64748b] hover:text-[#1e293b]"
          }`}
        >
          <BarChart2 className="w-4 h-4" /> Calificaciones
        </button>
        <button
          onClick={() => setResultsTab("participation")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
            resultsTab === "participation"
              ? "bg-primary text-white shadow-sm"
              : "text-[#64748b] hover:text-[#1e293b]"
          }`}
        >
          <Users className="w-4 h-4" /> Participación
        </button>
      </div>

      {/* ── PARTICIPATION ─────────────────────────────────────────────────── */}
      {resultsTab === "participation" && (
        <EvalParticipation evaluationId={evaluation.id} />
      )}

      {/* ── SCORES ────────────────────────────────────────────────────────── */}
      {resultsTab === "scores" && (
        <>
          {/* Weights */}
          {data && (
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <p className="text-xs font-bold uppercase text-[#64748b] mb-3">Pesos por tipo de evaluación</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(data.evaluation.typeWeights) as [EvalType, number][])
                  .filter(([, w]) => w > 0)
                  .map(([type, w]) => (
                    <span key={type} className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${EVAL_TYPE_COLORS[type]}`}>
                      {EVAL_TYPE_LABELS[type]}: {w}%
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Empty */}
          {(!data || data.results.length === 0) && (
            <div className="bg-white rounded-[2rem] p-16 border border-slate-100 text-center">
              <BarChart2 className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <p className="font-bold text-[#1e293b]">Sin resultados aún</p>
              <p className="text-sm text-[#64748b] mt-1">Los resultados aparecen cuando los evaluadores envían sus respuestas</p>
            </div>
          )}

          {data && data.results.length > 0 && (
            <>
              {/* Search bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <input
                  type="text"
                  placeholder="Buscar por nombre o correo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              <p className="text-xs text-[#94a3b8] px-1">
                {filtered.length} evaluado{filtered.length !== 1 ? "s" : ""}
                {search ? ` que coinciden con "${search}"` : ""}
              </p>

              {/* Cards list */}
              <div className="space-y-2">
                {paginated.map((r) => (
                  <button
                    key={r.evaluateeEmail}
                    onClick={() => { setSelected(r); setExpandedTypes(new Set()); }}
                    className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-4 hover:border-primary/30 hover:shadow-md transition-all text-left group"
                  >
                    <AvatarCircle
                      avatarUrl={r.avatarUrl}
                      name={r.evaluateeName || r.evaluateeEmail}
                      size="md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[#1e293b] truncate">
                        {r.evaluateeName || r.evaluateeEmail}
                      </p>
                      <p className="text-xs text-[#94a3b8] truncate">
                        {r.evaluateeName ? `${r.evaluateeEmail} · ` : ""}
                        {r.totalSubmitted} evaluaci{r.totalSubmitted !== 1 ? "ones" : "ón"} recibida{r.totalSubmitted !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      {/* Mini type scores */}
                      <div className="hidden sm:flex gap-1.5">
                        {(Object.entries(r.byType) as [EvalType, TypeResult][]).map(([type, tr]) => (
                          <span key={type} className={`text-[9px] font-black uppercase px-1.5 py-1 rounded-md ${EVAL_TYPE_COLORS[type]}`}>
                            {EVAL_TYPE_LABELS[type].slice(0, 4)} {tr.score.toFixed(1)}
                          </span>
                        ))}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-primary leading-none">{r.overallScore.toFixed(1)}</p>
                        <p className="text-[9px] font-bold uppercase text-[#64748b] mt-0.5">Score</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary transition-colors" />
                    </div>
                  </button>
                ))}

                {paginated.length === 0 && (
                  <div className="bg-white rounded-2xl border border-slate-100 p-10 text-center">
                    <p className="text-sm text-[#94a3b8]">No hay resultados para &ldquo;{search}&rdquo;</p>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between gap-4 pt-2">
                  <p className="text-xs text-[#94a3b8]">
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Anterior
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                      .reduce<(number | "…")[]>((acc, n, i, arr) => {
                        if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push("…");
                        acc.push(n);
                        return acc;
                      }, [])
                      .map((n, i) =>
                        n === "…" ? (
                          <span key={`d${i}`} className="px-1 text-[#94a3b8] text-xs">…</span>
                        ) : (
                          <button
                            key={n}
                            onClick={() => setPage(n as number)}
                            className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                              page === n ? "bg-primary text-white" : "hover:bg-slate-100 text-[#64748b]"
                            }`}
                          >{n}</button>
                        )
                      )}
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

    </div>
  );
}
