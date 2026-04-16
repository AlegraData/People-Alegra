"use client";
import { CheckCircle2, TrendingUp } from "lucide-react";
import type { EnpsSurvey } from "@/types/enps";

interface Props {
  surveys: EnpsSurvey[];
  onAnswer: (s: EnpsSurvey) => void;
}

export default function EnpsViewerList({ surveys, onAnswer }: Props) {
  const pending   = surveys.filter((s) => !s.hasResponded);
  const completed = surveys.filter((s) => s.hasResponded);

  return (
    <div className="space-y-6">
      {/* Pendientes */}
      {pending.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-[#64748b]">Pendientes</h3>
          {pending.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 flex flex-col sm:flex-row sm:items-center gap-6"
            >
              <div className="bg-[#00D6BC]/10 w-14 h-14 rounded-2xl flex items-center justify-center shrink-0">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-[#1e293b]">{s.title}</h4>
                {s.description && (
                  <p className="text-sm text-[#64748b] mt-1 leading-relaxed">{s.description}</p>
                )}
                <p className="text-xs text-[#64748b] mt-2">
                  Lanzada el {new Date(s.createdAt).toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" })}
                </p>
              </div>
              <button
                onClick={() => onAnswer(s)}
                className="shrink-0 bg-[#1e293b] text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary hover:shadow-lg hover:shadow-primary/20 transition-all"
              >
                Responder →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Completadas */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-black uppercase tracking-widest text-[#64748b]">Completadas</h3>
          {completed.map((s) => (
            <div
              key={s.id}
              className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 flex items-center gap-4 opacity-70"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold text-sm text-[#1e293b]">{s.title}</p>
                {s.description && (
                  <p className="text-xs text-[#64748b] mt-0.5 line-clamp-1">{s.description}</p>
                )}
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full shrink-0">
                Respondida
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {surveys.length === 0 && (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-16 text-center">
          <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-4" />
          <p className="font-bold text-[#1e293b] mb-1">No tienes encuestas pendientes</p>
          <p className="text-sm text-[#64748b]">Cuando el equipo lance una campaña eNPS, aparecerá aquí.</p>
        </div>
      )}
    </div>
  );
}
