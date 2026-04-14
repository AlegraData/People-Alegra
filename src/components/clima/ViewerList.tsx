"use client";
import { ClipboardList, CheckCircle2 } from "lucide-react";
import type { Survey } from "@/types/clima";

interface ViewerListProps {
  surveys: Survey[];
  onTake: (survey: Survey) => void;
}

export default function ViewerList({ surveys, onTake }: ViewerListProps) {
  const activeSurveys = surveys.filter((s) => s.isActive);
  const pending    = activeSurveys.filter((s) => !s.hasResponded);
  const completed  = activeSurveys.filter((s) =>  s.hasResponded);

  return (
    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm card-shadow">
      <h3 className="text-xl font-bold flex items-center gap-2 mb-8">
        <ClipboardList className="text-primary" />
        Mis Encuestas
      </h3>

      {activeSurveys.length === 0 && (
        <div className="py-8 text-center text-[#64748b]">No tienes encuestas asignadas.</div>
      )}

      {/* Pendientes */}
      {pending.length > 0 && (
        <div className="mb-8">
          <p className="text-xs font-black uppercase tracking-widest text-[#64748b] mb-4">
            Pendientes — {pending.length}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {pending.map((s) => (
              <div key={s.id} className="border border-slate-100 p-6 rounded-2xl bg-slate-50 flex flex-col">
                <h4 className="font-bold text-[#1e293b] mb-2">{s.title}</h4>
                <p className="text-sm text-[#64748b] mb-6 flex-1">{s.description}</p>
                <button
                  onClick={() => onTake(s)}
                  className="w-full bg-[#1e293b] text-white py-3 rounded-xl font-bold text-sm hover:bg-primary transition-all"
                >
                  Comenzar Encuesta
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ya respondidas */}
      {completed.length > 0 && (
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-[#64748b] mb-4">
            Ya respondidas — {completed.length}
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {completed.map((s) => (
              <div key={s.id} className="border border-[#10B981]/20 p-6 rounded-2xl bg-[#10B981]/5 flex flex-col opacity-75">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-bold text-[#1e293b]">{s.title}</h4>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#10B981]/10 text-[#10B981] shrink-0 ml-2">
                    <CheckCircle2 className="w-3 h-3" />
                    Completada
                  </span>
                </div>
                <p className="text-sm text-[#64748b]">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
