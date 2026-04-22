"use client";
import { useState, useEffect } from "react";
import { ClipboardList, Copy, Download, Plus, Pencil, Trash2, Users2, Lock, Unlock } from "lucide-react";
import type { Survey } from "@/types/clima";

interface AdminListProps {
  surveys: Survey[];
  onCreate: () => void;
  onEdit: (survey: Survey) => void;
  onDuplicate: (survey: Survey) => void;
  onViewResults: (survey: Survey) => void;
  onManageParticipants: (survey: Survey) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (id: string, currentIsActive: boolean) => void;
}

function CompletionBadge({ responses, assignments }: { responses: number; assignments: number }) {
  if (assignments === 0) {
    return <span className="text-sm text-[#64748b]">{responses} resp.</span>;
  }
  const pct = Math.round((responses / assignments) * 100);
  const color =
    pct >= 80 ? "text-[#10B981] bg-[#10B981]/10" :
    pct >= 40 ? "text-amber-600 bg-amber-50"      :
                "text-[#64748b] bg-slate-100";
  return (
    <div className="flex items-center gap-2">
      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${color}`}>{pct}%</span>
      <span className="text-xs text-[#64748b]">{responses}/{assignments}</span>
    </div>
  );
}

export default function AdminList({
  surveys, onCreate, onEdit, onDuplicate, onViewResults, onManageParticipants, onDelete, onToggleStatus,
}: AdminListProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Auto-cancelar confirmación tras 3 segundos
  useEffect(() => {
    if (!confirmDeleteId) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  const handleDeleteClick = (id: string) => {
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  return (
    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm card-shadow transition-all">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-xl font-bold flex items-center gap-2">
          <ClipboardList className="text-primary" />
          Gestión de Encuestas
        </h3>
        <button
          onClick={onCreate}
          className="flex items-center gap-2 bg-[#1e293b] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary transition-all"
        >
          <Plus className="w-4 h-4" />
          Crear Encuesta
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 text-[10px] uppercase tracking-widest text-[#64748b] font-black">
              <th className="pb-4">Nombre</th>
              <th className="pb-4">Participación</th>
              <th className="pb-4">Fecha Lanzada</th>
              <th className="pb-4">Estado</th>
              <th className="pb-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {surveys.map((s) => {
              const confirming = confirmDeleteId === s.id;
              return (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 font-bold text-[#1e293b]">{s.title}</td>
                  <td className="py-4">
                    <CompletionBadge responses={s.responsesCount} assignments={s.assignmentsCount} />
                  </td>
                  <td className="py-4 text-xs text-[#64748b] whitespace-nowrap">
                    {s.createdAt
                      ? new Date(s.createdAt).toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" })
                      : "—"}
                  </td>
                  <td className="py-4">
                    <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase ${
                      s.isActive ? "bg-[#10B981]/10 text-[#10B981]" : "bg-slate-100 text-slate-500"
                    }`}>
                      {s.isActive ? "Activa" : "Cerrada"}
                    </span>
                  </td>
                  <td className="py-4">
                    <div className="flex items-center justify-end gap-1">
                      {/* Editar */}
                      <button
                        onClick={() => onEdit(s)}
                        title="Editar encuesta"
                        className="p-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-white text-[#64748b] hover:text-primary transition-all"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {/* Duplicar */}
                      <button
                        onClick={() => onDuplicate(s)}
                        title="Duplicar encuesta"
                        className="p-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-white text-[#64748b] hover:text-primary transition-all"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      {/* Participantes */}
                      <button
                        onClick={() => onManageParticipants(s)}
                        title="Gestionar participantes"
                        className="p-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-white text-[#64748b] hover:text-primary transition-all"
                      >
                        <Users2 className="w-4 h-4" />
                      </button>
                      {/* Resultados */}
                      <button
                        onClick={() => onViewResults(s)}
                        title="Ver resultados y exportar"
                        className="p-2 rounded-lg border border-transparent hover:border-slate-200 hover:bg-white text-[#64748b] hover:text-primary transition-all"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {/* Finalizar / Reabrir */}
                      <button
                        onClick={() => onToggleStatus(s.id, s.isActive)}
                        title={s.isActive ? "Finalizar encuesta (ya no estará disponible)" : "Reabrir para pendientes"}
                        className={`p-2 rounded-lg border border-transparent transition-all ${
                          s.isActive
                            ? "text-amber-500 hover:bg-amber-50 hover:border-amber-200"
                            : "text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200"
                        }`}
                      >
                        {s.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                      </button>
                      {/* Eliminar con confirmación */}
                      <button
                        onClick={() => handleDeleteClick(s.id)}
                        title={confirming ? "Haz clic de nuevo para confirmar" : "Eliminar encuesta"}
                        className={`px-2 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          confirming
                            ? "bg-error text-white animate-pulse"
                            : "border border-transparent text-[#64748b] hover:text-error hover:border-error/20 hover:bg-error/5"
                        }`}
                      >
                        {confirming ? (
                          "¿Eliminar?"
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {surveys.length === 0 && (
              <tr>
                <td colSpan={5} className="py-12 text-center text-[#64748b]">
                  No hay encuestas creadas aún.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
