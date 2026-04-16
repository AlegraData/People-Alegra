"use client";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, RotateCcw, UserX, CheckCircle2, Clock, UserPlus } from "lucide-react";
import type { EnpsSurvey } from "@/types/enps";
import type { Empleado } from "@/types/clima";
import ParticipantSelector from "@/components/clima/ParticipantSelector";

interface EnpsParticipant {
  employee_id: string;
  nombre_completo: string;
  correo: string;
  cargo: string | null;
  equipo: string | null;
  assigned_at: string;
  completed_at: string | null;
  score: number | null;
  submitted_at: string | null;
}

interface Props {
  survey: EnpsSurvey;
  onBack: () => void;
  onSurveyUpdated: () => void;
}

type Mode = "list" | "add";

function scoreBadge(score: number) {
  const color =
    score >= 9 ? "text-emerald-700 bg-emerald-50" :
    score >= 7 ? "text-amber-700 bg-amber-50" :
                 "text-red-700 bg-red-50";
  return (
    <span className={`font-black text-sm px-2 py-0.5 rounded-lg ${color}`}>
      {score}
    </span>
  );
}

export default function EnpsParticipants({ survey, onBack, onSurveyUpdated }: Props) {
  const [mode, setMode]                   = useState<Mode>("list");
  const [participants, setParticipants]   = useState<EnpsParticipant[]>([]);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [toAdd, setToAdd]                 = useState<Map<string, Empleado>>(new Map());

  const fetchParticipants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/enps/surveys/${survey.id}/participants`);
      if (res.ok) setParticipants(await res.json());
    } finally {
      setLoading(false);
    }
  }, [survey.id]);

  useEffect(() => { fetchParticipants(); }, [fetchParticipants]);

  // Auto-cancelar confirmación de quitar tras 3s
  useEffect(() => {
    if (!confirmRemoveId) return;
    const t = setTimeout(() => setConfirmRemoveId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmRemoveId]);

  // ── Resetear respuesta ──────────────────────────────────────────────────────
  const handleReset = async (p: EnpsParticipant) => {
    setActionLoading(`reset-${p.employee_id}`);
    try {
      await fetch(`/api/enps/surveys/${survey.id}/responses/${p.employee_id}`, { method: "DELETE" });
      await fetchParticipants();
      onSurveyUpdated();
    } finally {
      setActionLoading(null);
    }
  };

  // ── Quitar participante ─────────────────────────────────────────────────────
  const handleRemove = async (p: EnpsParticipant) => {
    if (confirmRemoveId !== p.employee_id) {
      setConfirmRemoveId(p.employee_id);
      return;
    }
    setConfirmRemoveId(null);
    setActionLoading(`remove-${p.employee_id}`);
    try {
      await fetch(`/api/enps/surveys/${survey.id}/assignments/${p.employee_id}`, { method: "DELETE" });
      setParticipants((prev) => prev.filter((x) => x.employee_id !== p.employee_id));
      onSurveyUpdated();
    } finally {
      setActionLoading(null);
    }
  };

  // ── Agregar participantes ───────────────────────────────────────────────────
  const handleAddConfirm = async () => {
    if (toAdd.size === 0) return;
    setActionLoading("adding");
    try {
      const res = await fetch(`/api/enps/surveys/${survey.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: Array.from(toAdd.keys()) }),
      });
      if (res.ok) {
        setToAdd(new Map());
        setMode("list");
        await fetchParticipants();
        onSurveyUpdated();
      }
    } finally {
      setActionLoading(null);
    }
  };

  // ── Vista "agregar participantes" ───────────────────────────────────────────
  if (mode === "add") {
    return (
      <div className="max-w-5xl mx-auto">
        <ParticipantSelector
          selected={toAdd}
          onSelectionChange={setToAdd}
          onBack={() => { setMode("list"); setToAdd(new Map()); }}
          onConfirm={handleAddConfirm}
        />
      </div>
    );
  }

  const responded = participants.filter((p) => p.completed_at);
  const pending   = participants.filter((p) => !p.completed_at);
  const pct = participants.length ? Math.round((responded.length / participants.length) * 100) : 0;

  return (
    <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-[#1e293b]">{survey.title}</h3>
            <p className="text-sm text-[#64748b]">Gestión de participantes</p>
          </div>
        </div>
        <button
          onClick={() => setMode("add")}
          className="flex items-center gap-2 bg-[#1e293b] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary transition-all shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          Agregar participantes
        </button>
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
            <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
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
              <th className="py-3 pr-4">Puntaje</th>
              <th className="py-3 pr-4">Fecha respuesta</th>
              <th className="py-3 pr-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </td>
              </tr>
            ) : participants.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-[#64748b]">
                  No hay participantes asignados.
                </td>
              </tr>
            ) : (
              participants.map((p) => {
                const isResetting      = actionLoading === `reset-${p.employee_id}`;
                const isRemoving       = actionLoading === `remove-${p.employee_id}`;
                const confirmingRemove = confirmRemoveId === p.employee_id;
                return (
                  <tr key={p.employee_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 pl-4 pr-2">
                      <p className="font-semibold text-sm text-[#1e293b] whitespace-nowrap">{p.nombre_completo}</p>
                      <p className="text-xs text-[#64748b]">{p.correo}</p>
                    </td>
                    <td className="py-3.5 pr-4">
                      <p className="text-sm text-[#64748b] whitespace-nowrap">{p.cargo ?? "—"}</p>
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
                    <td className="py-3.5 pr-4">
                      {p.score !== null ? scoreBadge(p.score) : <span className="text-slate-300 text-sm">—</span>}
                    </td>
                    <td className="py-3.5 pr-4 text-xs text-[#64748b] whitespace-nowrap">
                      {p.completed_at
                        ? new Date(p.completed_at).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" })
                        : "—"}
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center justify-end gap-2">
                        {p.completed_at && (
                          <button
                            onClick={() => handleReset(p)}
                            disabled={!!actionLoading}
                            title="Resetear respuesta para que pueda volver a responder"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-40"
                          >
                            <RotateCcw className={`w-3 h-3 ${isResetting ? "animate-spin" : ""}`} />
                            {isResetting ? "Reseteando..." : "Resetear"}
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(p)}
                          disabled={!!actionLoading}
                          title={confirmingRemove ? "Haz clic de nuevo para confirmar" : "Quitar de la campaña"}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all disabled:opacity-40 ${
                            confirmingRemove
                              ? "bg-red-600 text-white animate-pulse"
                              : "text-red-600 bg-red-50 hover:bg-red-100"
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
