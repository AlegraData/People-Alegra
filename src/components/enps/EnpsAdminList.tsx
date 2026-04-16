"use client";
import { Trash2, BarChart2, Plus, Users, Users2, Pencil, Lock, Unlock } from "lucide-react";
import type { EnpsSurvey } from "@/types/enps";

interface Props {
  surveys:             EnpsSurvey[];
  onCreate:            () => void;
  onEdit:              (s: EnpsSurvey) => void;
  onViewResults:       (s: EnpsSurvey) => void;
  onManageParticipants:(s: EnpsSurvey) => void;
  onDelete:            (id: string) => void;
  onToggleStatus:      (id: string, currentIsActive: boolean) => void;
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

export default function EnpsAdminList({
  surveys, onCreate, onEdit, onViewResults, onManageParticipants, onDelete, onToggleStatus,
}: Props) {
  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("¿Eliminar esta campaña eNPS? Esta acción no se puede deshacer.")) {
      onDelete(id);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-8 pb-6">
        <div>
          <h3 className="text-xl font-bold text-[#1e293b]">Campañas eNPS</h3>
          <p className="text-sm text-[#64748b]">{surveys.length} campaña{surveys.length !== 1 ? "s" : ""} creada{surveys.length !== 1 ? "s" : ""}</p>
        </div>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 bg-[#1e293b] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary transition-all"
        >
          <Plus className="w-4 h-4" />
          Nueva Campaña
        </button>
      </div>

      {/* Empty state */}
      {surveys.length === 0 ? (
        <div className="px-8 pb-10 text-center">
          <div className="bg-slate-50 rounded-2xl py-16 border border-dashed border-slate-200">
            <BarChart2 className="w-10 h-10 text-slate-300 mx-auto mb-4" />
            <p className="font-bold text-[#1e293b] mb-1">Sin campañas aún</p>
            <p className="text-sm text-[#64748b]">Crea tu primera campaña eNPS para empezar a medir.</p>
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
                <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-[#64748b] font-black">Fecha Lanzada</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-[#64748b] font-black">Estado</th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-widest text-[#64748b] font-black text-right">Acciones</th>
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
                    <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                      s.isActive ? "bg-[#10B981]/10 text-[#10B981]" : "bg-slate-100 text-slate-500"
                    }`}>
                      {s.isActive ? "Activa" : "Cerrada"}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onViewResults(s)}
                        className="p-2 rounded-lg text-[#64748b] hover:bg-primary/10 hover:text-primary transition-colors"
                        title="Ver resultados"
                      >
                        <BarChart2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onManageParticipants(s)}
                        className="p-2 rounded-lg text-[#64748b] hover:bg-slate-100 hover:text-[#1e293b] transition-colors"
                        title="Gestionar participantes"
                      >
                        <Users2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onEdit(s)}
                        className="p-2 rounded-lg text-[#64748b] hover:bg-slate-100 hover:text-[#1e293b] transition-colors"
                        title="Editar campaña"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {/* Finalizar / Reabrir */}
                      <button
                        onClick={() => onToggleStatus(s.id, s.isActive)}
                        title={s.isActive ? "Finalizar campaña (ya no estará disponible)" : "Reabrir para pendientes"}
                        className={`p-2 rounded-lg border border-transparent transition-colors ${
                          s.isActive
                            ? "text-amber-500 hover:bg-amber-50 hover:border-amber-200"
                            : "text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"
                        }`}
                      >
                        {s.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={(e) => handleDelete(e, s.id)}
                        className="p-2 rounded-lg text-[#64748b] hover:bg-red-50 hover:text-red-600 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
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
