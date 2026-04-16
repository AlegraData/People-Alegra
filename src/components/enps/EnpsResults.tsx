"use client";
import { useState, useEffect } from "react";
import { ArrowLeft, MessageSquare, Download } from "lucide-react";
import type { EnpsSurvey, EnpsResults as EnpsResultsData, EnpsResponseDetail } from "@/types/enps";

interface Props {
  survey: EnpsSurvey;
  onBack: () => void;
}

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
          <div className="px-8 py-6 border-b border-slate-100">
            <h4 className="font-bold text-[#1e293b]">Respuestas individuales</h4>
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
                {responses.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                    <td className="px-8 py-3.5">
                      <p className="font-semibold text-sm text-[#1e293b] whitespace-nowrap">{r.employeeName}</p>
                      <p className="text-xs text-[#64748b]">{r.employeeEmail}</p>
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
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
