"use client";
import { BarChart2, Users } from "lucide-react";
import type { EnpsSurvey } from "@/types/enps";

interface Props {
  surveys: EnpsSurvey[];
  onViewResults: (s: EnpsSurvey) => void;
}

function EnpsScorePill({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-[#64748b]">
        Sin respuestas
      </span>
    );
  }
  const { bg, text } =
    score >= 50  ? { bg: "bg-[#00D6BC]/10", text: "text-primary" } :
    score >= 0   ? { bg: "bg-emerald-50",   text: "text-emerald-600" } :
                   { bg: "bg-red-50",        text: "text-red-600" };
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${bg} ${text}`}>
      eNPS {score > 0 ? "+" : ""}{score}
    </span>
  );
}

export default function EnpsManagerList({ surveys, onViewResults }: Props) {
  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-8 pb-6">
        <h3 className="text-xl font-bold text-[#1e293b]">Campañas eNPS</h3>
        <p className="text-sm text-[#64748b]">{surveys.length} campaña{surveys.length !== 1 ? "s" : ""}</p>
      </div>

      {surveys.length === 0 ? (
        <div className="px-8 pb-10 text-center">
          <div className="bg-slate-50 rounded-2xl py-16 border border-dashed border-slate-200">
            <BarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="text-sm text-[#64748b]">No hay campañas disponibles.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-8 py-3 text-[10px] uppercase tracking-widest text-[#64748b] font-black">Campaña</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-[#64748b] font-black">Participación</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-[#64748b] font-black">Resultado</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-[#64748b] font-black">Creada</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {surveys.map((s) => (
                <tr
                  key={s.id}
                  onClick={() => onViewResults(s)}
                  className="border-b border-slate-50 cursor-pointer hover:bg-slate-50/60 transition-colors"
                >
                  <td className="px-8 py-4">
                    <p className="font-semibold text-sm text-[#1e293b]">{s.title}</p>
                    {s.description && (
                      <p className="text-xs text-[#64748b] mt-0.5 line-clamp-1">{s.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-[#64748b]">
                      <Users className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-semibold text-[#1e293b]">{s.responsesCount}</span>
                      <span>/ {s.assignmentsCount}</span>
                    </div>
                    {s.assignmentsCount > 0 && (
                      <div className="mt-1.5 h-1.5 w-24 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.round((s.responsesCount / s.assignmentsCount) * 100)}%` }}
                        />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <EnpsScorePill score={s.enpsScore} />
                  </td>
                  <td className="px-4 py-4 text-xs text-[#64748b] whitespace-nowrap">
                    {new Date(s.createdAt).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => onViewResults(s)}
                      className="p-2 rounded-lg text-[#64748b] hover:bg-primary/10 hover:text-primary transition-colors"
                      title="Ver resultados"
                    >
                      <BarChart2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
