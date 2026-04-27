"use client";
import { useState } from "react";
import { Plus, Users, BarChart2, Pencil, Trash2, Power, PowerOff, CheckCircle2, Clock } from "lucide-react";
import type { Evaluation360 } from "@/types/evaluaciones360";

interface Props {
  evaluations: Evaluation360[];
  onCreateNew: () => void;
  onEdit: (e: Evaluation360) => void;
  onParticipants: (e: Evaluation360) => void;
  onResults: (e: Evaluation360) => void;
  onRefresh: () => void;
}

export default function AdminList({ evaluations, onCreateNew, onEdit, onParticipants, onResults, onRefresh }: Props) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleDelete = async (e: Evaluation360) => {
    if (confirmDeleteId !== e.id) { setConfirmDeleteId(e.id); return; }
    setConfirmDeleteId(null);
    setLoadingId(`del-${e.id}`);
    try {
      await fetch(`/api/evaluaciones360/surveys/${e.id}`, { method: "DELETE" });
      onRefresh();
    } finally { setLoadingId(null); }
  };

  const handleToggleStatus = async (e: Evaluation360) => {
    setLoadingId(`status-${e.id}`);
    try {
      const newStatus = e.status === "active" ? "closed" : "active";
      await fetch(`/api/evaluaciones360/surveys/${e.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      onRefresh();
    } finally { setLoadingId(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1e293b]">Evaluaciones 360°</h2>
          <p className="text-sm text-[#64748b] mt-1">Gestiona las evaluaciones de retroalimentación</p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 bg-[#1e293b] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary transition-all"
        >
          <Plus className="w-4 h-4" />
          Nueva Evaluación
        </button>
      </div>

      {evaluations.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-16 border border-slate-100 shadow-sm text-center flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Users className="w-8 h-8 text-primary" />
          </div>
          <div>
            <p className="text-xl font-bold text-[#1e293b]">Sin evaluaciones aún</p>
            <p className="text-sm text-[#64748b] mt-1">Crea la primera evaluación 360° para tu equipo</p>
          </div>
          <button onClick={onCreateNew} className="mt-2 flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all">
            <Plus className="w-4 h-4" />
            Crear Evaluación
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.map((e) => {
            const progress = e.assignmentsCount > 0 ? Math.round((e.submittedCount / e.assignmentsCount) * 100) : 0;
            const isActive = e.status === "active";
            return (
              <div key={e.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:border-slate-200 transition-all">
                <div className="p-5 flex items-center gap-4">
                  {/* Icono */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isActive ? "bg-primary/10" : "bg-slate-100"}`}>
                    <Users className={`w-6 h-6 ${isActive ? "text-primary" : "text-slate-400"}`} />
                  </div>

                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <h3 className="font-bold text-[#1e293b] truncate">{e.title}</h3>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {isActive ? "Activa" : "Cerrada"}
                      </span>
                    </div>
                    {e.description && <p className="text-xs text-[#64748b] truncate mb-2">{e.description}</p>}

                    {/* Progreso */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 max-w-[180px]">
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-[#64748b] whitespace-nowrap">
                        {e.submittedCount}/{e.assignmentsCount} enviadas
                      </span>
                      <span className="text-xs font-bold text-primary">{progress}%</span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                    <ActionBtn
                      onClick={() => onParticipants(e)}
                      icon={<Users className="w-4 h-4" />}
                      label="Participantes"
                      variant="default"
                    />
                    <ActionBtn
                      onClick={() => onResults(e)}
                      icon={<BarChart2 className="w-4 h-4" />}
                      label="Resultados"
                      variant="default"
                    />
                    <ActionBtn
                      onClick={() => onEdit(e)}
                      icon={<Pencil className="w-4 h-4" />}
                      label="Editar"
                      variant="default"
                    />
                    <ActionBtn
                      onClick={() => handleToggleStatus(e)}
                      loading={loadingId === `status-${e.id}`}
                      icon={isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                      label={isActive ? "Cerrar" : "Activar"}
                      variant={isActive ? "warning" : "success"}
                    />
                    <ActionBtn
                      onClick={() => handleDelete(e)}
                      loading={loadingId === `del-${e.id}`}
                      icon={confirmDeleteId === e.id ? <CheckCircle2 className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                      label={confirmDeleteId === e.id ? "Confirmar" : "Eliminar"}
                      variant="danger"
                    />
                  </div>
                </div>

                {/* Stats row */}
                <div className="px-5 pb-4 flex items-center gap-4">
                  {[
                    { label: "Evaluaciones asignadas", value: e.assignmentsCount, icon: <Clock className="w-3 h-3" /> },
                    { label: "Enviadas", value: e.submittedCount, icon: <CheckCircle2 className="w-3 h-3 text-emerald-500" /> },
                  ].map(({ label, value, icon }) => (
                    <div key={label} className="flex items-center gap-1.5 text-xs text-[#64748b]">
                      {icon}
                      <span className="font-bold text-[#1e293b]">{value}</span>
                      <span>{label}</span>
                    </div>
                  ))}
                  <span className="text-xs text-[#94a3b8] ml-auto">
                    {new Date(e.createdAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActionBtn({
  onClick, icon, label, variant = "default", loading = false,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant?: "default" | "danger" | "warning" | "success";
  loading?: boolean;
}) {
  const styles = {
    default:  "text-[#64748b] hover:text-primary hover:bg-primary/10",
    danger:   "text-red-500 hover:bg-red-50",
    warning:  "text-amber-600 hover:bg-amber-50",
    success:  "text-emerald-600 hover:bg-emerald-50",
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      title={label}
      className={`p-2 rounded-xl transition-colors disabled:opacity-50 ${styles[variant]}`}
    >
      {loading
        ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        : icon
      }
    </button>
  );
}
