"use client";
import { useState, useEffect, useMemo } from "react";
import { FileText, Search, X, Download, Users, MessageSquare, ThumbsUp, AlertTriangle } from "lucide-react";
import type { Evaluation360 } from "@/types/evaluaciones360";

interface Props {
  evaluation: Evaluation360;
}

interface ReportPerson {
  evaluateeEmail: string;
  evaluateeName: string;
  team: string | null;
  totalSubmitted: number;
}

interface AnalysisData {
  totalSubmitted: number;
  eligibleEvaluatees: number;
  categories: string[];
  teamCategoryTable: { team: string; categories: Record<string, number | null> }[];
  comments: {
    totalRaw: number;
    totalKept: number;
    totalFiltered: number;
    byQuestion: { type: string; questionText: string; total: number; kept: number }[];
  };
  sentiment: {
    positivo: number; neutral: number; atencion: number;
    positivoPct: number; neutralPct: number; atencionPct: number;
  };
}

const PAGE_SIZE = 10;
const RATE_COLOR = (v: number) => (v >= 8.5 ? "#00D6BC" : v >= 7 ? "#f59e0b" : "#f43f5e");

// ── Avatar helpers (mismo criterio visual del resto del módulo) ─────────────
const AVATAR_COLORS = [
  "bg-teal-100 text-teal-700",     "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700", "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",   "bg-cyan-100 text-cyan-700",
  "bg-emerald-100 text-emerald-700","bg-indigo-100 text-indigo-700",
];
function avatarColor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(s: string) {
  if (!s?.trim()) return "?";
  const p = s.trim().split(/[\s@._-]+/);
  if (p.length >= 2 && p[0] && p[1]) return (p[0][0] + p[1][0]).toUpperCase();
  return s.trim().slice(0, 2).toUpperCase() || "?";
}

export default function EvalReportsSummary({ evaluation }: Props) {
  const [people, setPeople]   = useState<ReportPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [filterTeam, setFilterTeam] = useState("all");
  const [page, setPage]       = useState(1);
  const [analysis, setAnalysis]         = useState<AnalysisData | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/evaluaciones360/surveys/${evaluation.id}/results`)
      .then((r) => r.json())
      .then((d) => {
        const results = (d.results ?? []) as {
          evaluateeEmail: string; evaluateeName: string; team: string | null; totalSubmitted: number;
        }[];
        setPeople(results.map((r) => ({
          evaluateeEmail: r.evaluateeEmail, evaluateeName: r.evaluateeName,
          team: r.team, totalSubmitted: r.totalSubmitted,
        })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [evaluation.id]);

  useEffect(() => {
    setAnalysisLoading(true);
    fetch(`/api/evaluaciones360/surveys/${evaluation.id}/reports/analysis`)
      .then((r) => r.json())
      .then((d) => setAnalysis(d))
      .catch(() => {})
      .finally(() => setAnalysisLoading(false));
  }, [evaluation.id]);

  const teams = useMemo(
    () => [...new Set(people.map((p) => p.team).filter(Boolean) as string[])].sort(),
    [people],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      const matchesTeam = filterTeam === "all" || p.team === filterTeam;
      const matchesQuery = !q ||
        p.evaluateeName.toLowerCase().includes(q) ||
        p.evaluateeEmail.toLowerCase().includes(q) ||
        (p.team ?? "").toLowerCase().includes(q);
      return matchesTeam && matchesQuery;
    });
  }, [people, search, filterTeam]);

  useEffect(() => setPage(1), [search, filterTeam]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">

      {/* ── Panel de análisis macro ─────────────────────────────────────── */}
      {analysisLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : analysis && analysis.totalSubmitted > 0 ? (
        <div className="space-y-4">
          <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8] px-1">Análisis de la encuesta</p>

          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Evaluados con reporte", value: analysis.eligibleEvaluatees, icon: <Users className="w-4 h-4" />, color: "#8b5cf6" },
              { label: "Evaluaciones enviadas", value: analysis.totalSubmitted, icon: <FileText className="w-4 h-4" />, color: "#3b82f6" },
              { label: "Comentarios válidos", value: analysis.comments.totalKept, icon: <MessageSquare className="w-4 h-4" />, color: "#00b8a3" },
              { label: "Comentarios filtrados (basura)", value: analysis.comments.totalFiltered, icon: <X className="w-4 h-4" />, color: "#94a3b8" },
            ].map(({ label, value, icon, color }) => (
              <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="p-2 rounded-xl bg-slate-50 shrink-0" style={{ color }}>{icon}</div>
                <div className="min-w-0">
                  <p className="text-2xl font-black" style={{ color }}>{value}</p>
                  <p className="text-[11px] font-semibold text-[#64748b] truncate">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Sentimiento de comentarios */}
          {analysis.comments.totalKept > 0 && (
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
              <p className="text-sm font-bold text-[#1e293b] mb-1">Tono de los comentarios</p>
              <p className="text-xs text-[#94a3b8] mb-4">
                Según la calificación numérica de la misma evaluación en la que se escribió cada comentario.
              </p>
              <div className="flex h-3 rounded-full overflow-hidden mb-3">
                <div style={{ width: `${analysis.sentiment.positivoPct}%`, backgroundColor: "#00D6BC" }} />
                <div style={{ width: `${analysis.sentiment.neutralPct}%`, backgroundColor: "#f59e0b" }} />
                <div style={{ width: `${analysis.sentiment.atencionPct}%`, backgroundColor: "#f43f5e" }} />
              </div>
              <div className="flex flex-wrap gap-4 text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-[#1e293b]">
                  <ThumbsUp className="w-3.5 h-3.5" style={{ color: "#00b8a3" }} />
                  Positivo: <strong>{analysis.sentiment.positivo}</strong> ({analysis.sentiment.positivoPct}%)
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-[#1e293b]">
                  <span className="w-3.5 h-3.5 rounded-full inline-block" style={{ backgroundColor: "#f59e0b" }} />
                  Neutral: <strong>{analysis.sentiment.neutral}</strong> ({analysis.sentiment.neutralPct}%)
                </span>
                <span className="flex items-center gap-1.5 font-semibold text-[#1e293b]">
                  <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#f43f5e" }} />
                  Necesitan atención: <strong>{analysis.sentiment.atencion}</strong> ({analysis.sentiment.atencionPct}%)
                </span>
              </div>
            </div>
          )}

          {/* Tabla equipo × competencia */}
          {analysis.categories.length > 0 && analysis.teamCategoryTable.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <p className="text-sm font-bold text-[#1e293b] px-5 pt-4 pb-1">Resultados por equipo y competencia</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-2.5 text-left font-bold text-[#64748b] uppercase tracking-wider">Equipo</th>
                      {analysis.categories.map((cat) => (
                        <th key={cat} className="px-4 py-2.5 text-center font-bold text-[#64748b] uppercase tracking-wider">{cat}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {analysis.teamCategoryTable.map((row) => (
                      <tr key={row.team} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-2.5 font-semibold text-[#1e293b]">{row.team}</td>
                        {analysis.categories.map((cat) => {
                          const v = row.categories[cat];
                          return (
                            <td key={cat} className="px-4 py-2.5 text-center font-bold" style={{ color: v != null ? RATE_COLOR(v) : "#cbd5e1" }}>
                              {v != null ? v.toFixed(1) : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 text-xs text-[#64748b]">
        Genera el reporte individual en PDF de cada persona con resultados recibidos. Por ahora se genera al
        vuelo cada vez que lo abres — más adelante se podrá enviar por correo a todos.
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : people.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-16 border border-slate-100 text-center">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="font-bold text-[#1e293b]">Sin reportes disponibles todavía</p>
          <p className="text-sm text-[#64748b] mt-1">Los reportes se pueden generar cuando haya evaluaciones enviadas.</p>
        </div>
      ) : (
        <>
          {/* Search + team filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
              <input
                type="text"
                placeholder="Buscar por nombre, correo o equipo…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {teams.length > 1 && (
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="text-sm border border-slate-200 rounded-2xl px-4 py-3 bg-white text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              >
                <option value="all">Todos los equipos</option>
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>

          <p className="text-xs text-[#94a3b8] px-1">
            {filtered.length} persona{filtered.length !== 1 ? "s" : ""}
            {search ? ` que coinciden con "${search}"` : ""}
          </p>

          {/* Person cards */}
          <div className="space-y-2">
            {paginated.map((p) => (
              <div
                key={p.evaluateeEmail}
                className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-4"
              >
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${avatarColor(p.evaluateeName || p.evaluateeEmail)}`}>
                  {initials(p.evaluateeName || p.evaluateeEmail)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-[#1e293b] truncate">{p.evaluateeName || p.evaluateeEmail}</p>
                    {p.team && (
                      <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                        {p.team}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#94a3b8] truncate">
                    {p.evaluateeName ? `${p.evaluateeEmail} · ` : ""}
                    {p.totalSubmitted} evaluaci{p.totalSubmitted !== 1 ? "ones" : "ón"} recibida{p.totalSubmitted !== 1 ? "s" : ""}
                  </p>
                </div>
                <a
                  href={`/api/evaluaciones360/surveys/${evaluation.id}/reports/${encodeURIComponent(p.evaluateeEmail)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-bold bg-[#1e293b] text-white px-4 py-2.5 rounded-xl hover:bg-primary transition-colors shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  Ver PDF
                </a>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 pt-2">
              <p className="text-xs text-[#94a3b8]">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} de {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
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
                      <button key={n} onClick={() => setPage(n as number)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          page === n ? "bg-primary text-white" : "hover:bg-slate-100 text-[#64748b]"
                        }`}>{n}</button>
                    )
                  )}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
