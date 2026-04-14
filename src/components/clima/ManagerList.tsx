"use client";
import { Eye } from "lucide-react";
import type { Survey } from "@/types/clima";

interface ManagerListProps {
  surveys: Survey[];
  onViewResults: (survey: Survey) => void;
}

export default function ManagerList({ surveys, onViewResults }: ManagerListProps) {
  const activeSurveys = surveys.filter((s) => s.isActive);

  return (
    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm card-shadow">
      <h3 className="text-xl font-bold flex items-center gap-2 mb-8">
        <Eye className="text-primary" />
        Resultados de tu Equipo
      </h3>
      <div className="grid gap-4">
        {activeSurveys.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 hover:border-primary transition-all"
          >
            <div>
              <p className="font-bold text-[#1e293b]">{s.title}</p>
              <p className="text-xs text-[#64748b] mt-1">
                {s.responsesCount || 0} respuestas de tu equipo
              </p>
            </div>
            <button
              onClick={() => onViewResults(s)}
              className="text-sm font-bold text-primary hover:text-[#1e293b] transition-colors"
            >
              Ver Detalle
            </button>
          </div>
        ))}
        {activeSurveys.length === 0 && (
          <p className="text-center text-[#64748b] py-4">
            No hay encuestas activas en este momento.
          </p>
        )}
      </div>
    </div>
  );
}
