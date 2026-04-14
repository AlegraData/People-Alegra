"use client";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, RotateCcw, UserX, CheckCircle2, Clock } from "lucide-react";
import type { Survey, SurveyParticipant } from "@/types/clima";

interface SurveyParticipantsProps {
  survey: Survey;
  onBack: () => void;
  onSurveyUpdated: () => void; // notifica al padre para refrescar counts
}

export default function SurveyParticipants({ survey, onBack, onSurveyUpdated }: SurveyParticipantsProps) {
  const [participants, setParticipants] = useState<SurveyParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const fetchParticipants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clima/surveys/${survey.id}/participants`);
      if (res.ok) setParticipants(await res.json());
    } finally {
      setLoading(false);
    }
  }, [survey.id]);

  useEffect(() => { fetchParticipants(); }, [fetchParticipants]);

  // Resetear confirmación de eliminar tras 3s
  useEffect(() => {
    if (!confirmRemoveId) return;
    const t = setTimeout(() => setConfirmRemoveId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmRemoveId]);

  const handleReset = async (p: SurveyParticipant) => {
    setActionLoading(`reset-${p.employee_id}`);
    try {
      await fetch(`/api/clima/surveys/${survey.id}/responses/${p.employee_id}`, {
        method: "DELETE",
      });
      await fetchParticipants();
      onSurveyUpdated();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (p: SurveyParticipant) => {
    if (confirmRemoveId !== p.employee_id) {
      setConfirmRemoveId(p.employee_id);
      return;
    }
    setConfirmRemoveId(null);
    setActionLoading(`remove-${p.employee_id}`);
    try {
      await fetch(`/api/clima/surveys/${survey.id}/assignments/${p.employee_id}`, {
        method: "DELETE",
      });
      setParticipants((prev) => prev.filter((x) => x.employee_id !== p.employee_id));
      onSurveyUpdated();
    } finally {
      setActionLoading(null);
    }
  };

  const responded = participants.filter((p) => p.completed_at);
  const pending   = participants.filter((p) => !p.completed_at);
  const pct = participants.length ? Math.round((responded.length / participants.length) * 100) : 0;

  return (
    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h3 className="text-xl font-bold">{survey.title}</h3>
          <p className="text-sm text-[#64748b]">Gestión de participantes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-slate-50 rounded-2xl p-4 text-center border border-slate-100">
          <p className="text-2xl font-black text-[#1e293b]">{participants.length}</p>
          <p className="text-xs font-bold uppercase text-[#64748b] tracking-widest mt-1">Asignados</p>
        </div>
        <div className="bg-[#10B981]/5 rounded-2xl p-4 text-center border border-[#10B981]/20">
          <p className="text-2xl font-black text-[#10B981]">{responded.length}</p>
          <p className="text-xs font-bold uppercase text-[#10B981]/70 tracking-widest mt-1">Respondieron</p>
        </div>
        <div className="bg-amber-50 rounded-2xl p-4 text-center border border-amber-100">
          <p className="text-2xl font-black text-amber-600">{pending.length}</p>
          <p className="text-xs font-bold uppercase text-amber-500 tracking-widest mt-1">Pendientes</p>
        </div>
      </div>

      {/* Barra de progreso */}
      {participants.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-between text-xs font-bold text-[#64748b] mb-1.5">
            <span>Progreso de respuestas</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-x-auto rounded-xl border border-slate-100">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-widest text-[#64748b] font-black">
              <th className="py-3 pl-4 pr-2">Participante</th>
              <th className="py-3 pr-4">Cargo / Equipo</th>
              <th className="py-3 pr-4">Estado</th>
              <th className="py-3 pr-4">Fecha respuesta</th>
              <th className="py-3 pr-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </td>
              </tr>
            ) : participants.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-[#64748b]">
                  No hay participantes asignados a esta encuesta.
                </td>
              </tr>
            ) : (
              participants.map((p) => {
                const isResetting = actionLoading === `reset-${p.employee_id}`;
                const isRemoving  = actionLoading === `remove-${p.employee_id}`;
                const confirmingRemove = confirmRemoveId === p.employee_id;
                return (
                  <tr key={p.employee_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 pl-4 pr-2">
                      <p className="font-semibold text-sm text-[#1e293b]">{p.nombre_completo}</p>
                      <p className="text-xs text-[#64748b]">{p.correo}</p>
                    </td>
                    <td className="py-3.5 pr-4">
                      <p className="text-sm text-[#64748b]">{p.cargo ?? "—"}</p>
                      <p className="text-xs text-[#94a3b8]">{p.equipo ?? "—"}</p>
                    </td>
                    <td className="py-3.5 pr-4">
                      {p.completed_at ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-[#10B981]/10 text-[#10B981]">
                          <CheckCircle2 className="w-3 h-3" />
                          Respondió
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-50 text-amber-600">
                          <Clock className="w-3 h-3" />
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 pr-4 text-xs text-[#64748b]">
                      {p.completed_at
                        ? new Date(p.completed_at).toLocaleDateString("es-CO", {
                            day: "2-digit", month: "short", year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* Reset — solo si ya respondió */}
                        {p.completed_at && (
                          <button
                            onClick={() => handleReset(p)}
                            disabled={!!actionLoading}
                            title="Resetear respuesta"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-40"
                          >
                            <RotateCcw className={`w-3 h-3 ${isResetting ? "animate-spin" : ""}`} />
                            {isResetting ? "Reseteando..." : "Resetear"}
                          </button>
                        )}
                        {/* Eliminar participante */}
                        <button
                          onClick={() => handleRemove(p)}
                          disabled={!!actionLoading}
                          title={confirmingRemove ? "Haz clic de nuevo para confirmar" : "Quitar de la encuesta"}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-40 ${
                            confirmingRemove
                              ? "bg-error text-white animate-pulse"
                              : "text-error bg-error/5 hover:bg-error/10"
                          }`}
                        >
                          <UserX className="w-3 h-3" />
                          {isRemoving ? "Quitando..." : confirmingRemove ? "¿Confirmar?" : "Quitar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
