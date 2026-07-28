"use client";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, RotateCcw, UserX, CheckCircle2, Clock, UserPlus, Search, X, Filter } from "lucide-react";
import type { EnpsSurvey } from "@/types/enps";
import type { Empleado } from "@/types/clima";
import ParticipantSelector from "@/components/clima/ParticipantSelector";

interface EnpsParticipant {
  employee_id: string;
  nombre_completo: string;
  correo: string;
  cargo: string | null;
  equipo: string | null;
  avatar_url: string | null;
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
type StatusFilter = "all" | "responded" | "pending";
type PageSize = 10 | 20 | 50 | "all";
const PAGE_SIZES: PageSize[] = [10, 20, 50, "all"];

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

// ── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-teal-100 text-teal-700",    "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700","bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",  "bg-cyan-100 text-cyan-700",
  "bg-emerald-100 text-emerald-700","bg-indigo-100 text-indigo-700",
];

function avatarColor(s: string) {
  let hash = 0;
  for (const c of s) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(s: string) {
  if (!s?.trim()) return "?";
  const parts = s.trim().split(/[\s@._-]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.trim().slice(0, 2).toUpperCase() || "?";
}

function AvatarCircle({
  avatarUrl, name, size = "md",
}: { avatarUrl?: string | null; name: string; size?: "sm" | "md" | "lg" }) {
  const [err, setErr] = useState(false);
  const sz  = size === "sm" ? "w-9 h-9 text-xs" : size === "lg" ? "w-16 h-16 text-xl" : "w-11 h-11 text-sm";
  const col = avatarColor(name);
  if (avatarUrl && !err) {
    return (
      <img src={avatarUrl} alt={name} onError={() => setErr(true)}
        className={`${sz} rounded-2xl object-cover shrink-0`} />
    );
  }
  return (
    <div className={`${sz} rounded-2xl flex items-center justify-center font-bold shrink-0 ${col}`}>
      {getInitials(name)}
    </div>
  );
}

export default function EnpsParticipants({ survey, onBack, onSurveyUpdated }: Props) {
  const [mode, setMode]                   = useState<Mode>("list");
  const [participants, setParticipants]   = useState<EnpsParticipant[]>([]);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [toAdd, setToAdd]                 = useState<Map<string, Empleado>>(new Map());

  // Búsqueda + filtros + paginación
  const [search, setSearch]           = useState("");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");
  const [filterTeam, setFilterTeam]   = useState("all");
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState<PageSize>(10);

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

  useEffect(() => { setPage(1); }, [search, filterStatus, filterTeam, pageSize]);

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

  const teams = [...new Set(participants.map((p) => p.equipo).filter(Boolean) as string[])].sort();

  const q = search.trim().toLowerCase();
  const filteredParticipants = participants.filter((p) => {
    const matchesQuery = !q ||
      p.nombre_completo.toLowerCase().includes(q) ||
      p.correo.toLowerCase().includes(q) ||
      (p.cargo ?? "").toLowerCase().includes(q) ||
      (p.equipo ?? "").toLowerCase().includes(q);
    const matchesStatus = filterStatus === "all" ||
      (filterStatus === "responded" ? !!p.completed_at : !p.completed_at);
    const matchesTeam = filterTeam === "all" || p.equipo === filterTeam;
    return matchesQuery && matchesStatus && matchesTeam;
  });
  const totalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(filteredParticipants.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedParticipants = pageSize === "all"
    ? filteredParticipants
    : filteredParticipants.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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

      {/* Búsqueda + filtros */}
      {participants.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo, cargo o equipo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shrink-0">
            <Filter className="w-3.5 h-3.5 text-[#94a3b8]" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
              className="text-sm text-[#1e293b] bg-transparent outline-none cursor-pointer"
            >
              <option value="all">Todos los estados</option>
              <option value="responded">Respondió</option>
              <option value="pending">Pendiente</option>
            </select>
          </div>
          {teams.length > 1 && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 shrink-0">
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="text-sm text-[#1e293b] bg-transparent outline-none cursor-pointer"
              >
                <option value="all">Todos los equipos</option>
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          )}
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
            ) : paginatedParticipants.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-[#94a3b8]">
                  No hay participantes que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              paginatedParticipants.map((p) => {
                const isResetting      = actionLoading === `reset-${p.employee_id}`;
                const isRemoving       = actionLoading === `remove-${p.employee_id}`;
                const confirmingRemove = confirmRemoveId === p.employee_id;
                return (
                  <tr key={p.employee_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 pl-4 pr-2">
                      <div className="flex items-center gap-3">
                        <AvatarCircle avatarUrl={p.avatar_url} name={p.nombre_completo || p.correo} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-[#1e293b] whitespace-nowrap">{p.nombre_completo}</p>
                          <p className="text-xs text-[#64748b]">{p.correo}</p>
                        </div>
                      </div>
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

      {/* Paginación */}
      {participants.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4">
          <p className="text-xs text-[#64748b]">
            {filteredParticipants.length} participante{filteredParticipants.length !== 1 ? "s" : ""}
            {pageSize !== "all" && filteredParticipants.length > 0
              ? ` · ${(currentPage - 1) * pageSize + 1}–${Math.min(currentPage * pageSize, filteredParticipants.length)}`
              : ""}
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => setPageSize(size)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    pageSize === size ? "bg-white shadow-sm text-[#1e293b]" : "text-[#64748b] hover:text-[#1e293b]"
                  }`}
                >
                  {size === "all" ? "Todos" : size}
                </button>
              ))}
            </div>
            {pageSize !== "all" && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  ←
                </button>
                <span className="text-xs font-bold text-[#1e293b] px-1">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
