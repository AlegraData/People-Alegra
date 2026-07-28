"use client";
import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, MessageSquare, Download, Search, X, Filter } from "lucide-react";
import type { EnpsSurvey, EnpsResults as EnpsResultsData, EnpsResponseDetail } from "@/types/enps";

interface Props {
  survey: EnpsSurvey;
  onBack: () => void;
}

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

type PageSize = 10 | 20 | 50 | "all";
const PAGE_SIZES: PageSize[] = [10, 20, 50, "all"];

function ScoreDisplay({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="text-center">
        <p className="text-6xl font-black text-slate-300">—</p>
        <p className="text-sm text-[#64748b] mt-2">Sin respuestas aún</p>
      </div>
    );
  }
  const color =
    score >= 50  ? "text-primary" :
    score >= 0   ? "text-emerald-500" :
                   "text-red-500";
  const label =
    score >= 50  ? "Excelente" :
    score >= 30  ? "Muy bueno" :
    score >= 0   ? "Mejorable" :
                   "Crítico";

  return (
    <div className="text-center">
      <p className={`text-7xl font-black ${color}`}>
        {score > 0 ? "+" : ""}{score}
      </p>
      <p className={`text-sm font-bold mt-2 ${color}`}>{label}</p>
      <p className="text-xs text-[#64748b] mt-1">eNPS Score</p>
    </div>
  );
}

function CategoryBadge({ category }: { category: EnpsResponseDetail["category"] }) {
  const map = {
    promoter:  { label: "Promotor",  cls: "bg-emerald-50 text-emerald-700" },
    passive:   { label: "Pasivo",    cls: "bg-amber-50 text-amber-700" },
    detractor: { label: "Detractor", cls: "bg-red-50 text-red-700" },
  };
  const { label, cls } = map[category];
  return (
    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${cls}`}>
      {label}
    </span>
  );
}

function scoreColor(score: number, scoreMax: number) {
  if (score >= scoreMax - 1) return "text-emerald-500";
  if (score >= scoreMax - 3) return "text-amber-500";
  return "text-red-500";
}

export default function EnpsResults({ survey, onBack }: Props) {
  const [data, setData]       = useState<EnpsResultsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  // Búsqueda + filtros + paginación de "Respuestas individuales"
  const [search, setSearch]           = useState("");
  const [filterCategory, setFilterCategory] = useState<"all" | EnpsResponseDetail["category"]>("all");
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState<PageSize>(10);

  useEffect(() => {
    fetch(`/api/enps/surveys/${survey.id}/results`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Error al cargar los resultados."))
      .finally(() => setLoading(false));
  }, [survey.id]);

  useEffect(() => { setPage(1); }, [search, filterCategory, pageSize]);

  if (loading) {
    return (
      <div className="flex-1 flex justify-center items-center py-20">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm text-center">
        <p className="text-red-600 font-medium">{error || "Error desconocido."}</p>
        <button onClick={onBack} className="mt-4 text-sm font-bold text-[#64748b] hover:text-primary transition-colors">
          ← Volver
        </button>
      </div>
    );
  }

  const {
    total, promoters, passives, detractors, score, responses,
    promoterMin, passiveMin, passiveMax, detractorMax,
  } = data;

  const scoreMax = data.survey.scoreMax ?? 10;
  const scoreMin = data.survey.scoreMin ?? 0;

  const pPct = total > 0 ? Math.round((promoters  / total) * 100) : 0;
  const nPct = total > 0 ? Math.round((passives   / total) * 100) : 0;
  const dPct = total > 0 ? Math.round((detractors / total) * 100) : 0;

  // Búsqueda + filtro por categoría + paginación
  const q = search.trim().toLowerCase();
  const filteredResponses = responses.filter((r) => {
    const matchesQuery = !q ||
      r.employeeName.toLowerCase().includes(q) ||
      r.employeeEmail.toLowerCase().includes(q) ||
      (r.team ?? "").toLowerCase().includes(q);
    const matchesCategory = filterCategory === "all" || r.category === filterCategory;
    return matchesQuery && matchesCategory;
  });
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filteredResponses.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedResponses = pageSize === "all"
    ? filteredResponses
    : filteredResponses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleExportCSV = () => {
    if (responses.length === 0) { alert("No hay respuestas para exportar."); return; }

    const categoryLabel = (c: string) =>
      c === "promoter" ? "Promotor" : c === "passive" ? "Pasivo" : "Detractor";

    const headers = ["Participante", "Email", "Puntaje", "Categoría", "Comentario", "Fecha"];
    const rows = responses.map((r) => [
      r.employeeName,
      r.employeeEmail,
      r.score,
      categoryLabel(r.category),
      r.followUpAnswer ?? "",
      new Date(r.submittedAt).toLocaleDateString("es-CO"),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
        .join("\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `enps_${survey.title.replace(/\s+/g, "_")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h3 className="text-xl font-bold text-[#1e293b]">{survey.title}</h3>
              {survey.description && (
                <p className="text-sm text-[#64748b] mt-0.5">{survey.description}</p>
              )}
            </div>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={responses.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-[#64748b] hover:bg-slate-50 hover:text-[#1e293b] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Download className="w-4 h-4" />
            Descargar CSV
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Score */}
          <div className="flex items-center justify-center py-6 bg-slate-50 rounded-2xl">
            <ScoreDisplay score={score} />
          </div>

          {/* Breakdown */}
          <div className="space-y-4 py-4">
            <p className="text-xs font-black uppercase tracking-widest text-[#64748b] mb-4">
              {total} respuesta{total !== 1 ? "s" : ""} · {survey.assignmentsCount} participante{survey.assignmentsCount !== 1 ? "s" : ""}
            </p>

            {/* Promotores */}
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-semibold text-emerald-700">
                  Promotores ({promoterMin}–{scoreMax})
                </span>
                <span className="font-bold text-emerald-700">{promoters} · {pPct}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pPct}%` }} />
              </div>
            </div>

            {/* Pasivos */}
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-semibold text-amber-700">
                  Pasivos ({passiveMin}–{passiveMax})
                </span>
                <span className="font-bold text-amber-700">{passives} · {nPct}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full" style={{ width: `${nPct}%` }} />
              </div>
            </div>

            {/* Detractores */}
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-semibold text-red-700">
                  Detractores ({scoreMin}–{detractorMax})
                </span>
                <span className="font-bold text-red-700">{detractors} · {dPct}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: `${dPct}%` }} />
              </div>
            </div>

            <p className="text-[10px] text-[#64748b] mt-3">
              eNPS = % Promotores − % Detractores
            </p>
          </div>
        </div>
      </div>

      {/* Respuestas individuales */}
      {responses.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-8 py-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
            <h4 className="font-bold text-[#1e293b]">Respuestas individuales</h4>

            {/* Búsqueda + filtro por categoría */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, correo o equipo…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64 pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
                />
                {search && (
                  <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shrink-0">
                <Filter className="w-3.5 h-3.5 text-[#94a3b8]" />
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value as typeof filterCategory)}
                  className="text-sm text-[#1e293b] bg-transparent outline-none cursor-pointer"
                >
                  <option value="all">Todas las categorías</option>
                  <option value="promoter">Promotor</option>
                  <option value="passive">Pasivo</option>
                  <option value="detractor">Detractor</option>
                </select>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-3 text-[10px] uppercase tracking-widest text-[#64748b] font-black">Participante</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-[#64748b] font-black">Puntaje</th>
                  <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-[#64748b] font-black">Categoría</th>
                  {survey.followUpQuestion && (
                    <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-[#64748b] font-black">
                      <div className="flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3" />
                        Comentario
                      </div>
                    </th>
                  )}
                  <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-[#64748b] font-black">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {paginatedResponses.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                    <td className="px-8 py-3.5">
                      <div className="flex items-center gap-3">
                        <AvatarCircle avatarUrl={r.avatarUrl} name={r.employeeName || r.employeeEmail} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-[#1e293b] whitespace-nowrap">{r.employeeName}</p>
                          <p className="text-xs text-[#64748b]">{r.employeeEmail}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-2xl font-black ${scoreColor(r.score, scoreMax)}`}>
                        {r.score}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <CategoryBadge category={r.category} />
                    </td>
                    {survey.followUpQuestion && (
                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="text-sm text-[#64748b] line-clamp-2">
                          {r.followUpAnswer || <span className="italic text-slate-300">Sin comentario</span>}
                        </p>
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-xs text-[#64748b] whitespace-nowrap">
                      {new Date(r.submittedAt).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
                {paginatedResponses.length === 0 && (
                  <tr>
                    <td colSpan={survey.followUpQuestion ? 5 : 4} className="py-12 text-center text-sm text-[#94a3b8]">
                      No hay respuestas que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-8 py-4 border-t border-slate-100">
            <p className="text-xs text-[#64748b]">
              {filteredResponses.length} respuesta{filteredResponses.length !== 1 ? "s" : ""}
              {pageSize !== "all" && filteredResponses.length > 0
                ? ` · ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredResponses.length)}`
                : ""}
            </p>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
                {PAGE_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => setPageSize(size)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      pageSize === size ? "bg-white shadow-sm text-[#1e293b]" : "text-[#64748b] hover:text-[#1e293b]"
                    }`}
                  >
                    {size === "all" ? "Todos" : size}
                  </button>
                ))}
              </div>
              {pageSize !== "all" && totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    ←
                  </button>
                  <span className="text-xs font-bold text-[#1e293b] px-1">
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
