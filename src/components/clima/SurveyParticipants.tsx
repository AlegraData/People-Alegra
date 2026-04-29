"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { ArrowLeft, RotateCcw, UserX, CheckCircle2, Clock, Mail, Send, UserPlus, X, Search, SlidersHorizontal, Users } from "lucide-react";
import type { Survey, SurveyParticipant, Empleado, EmailTemplateConfig } from "@/types/clima";
import ParticipantSelector from "./ParticipantSelector";
import EmailTemplateEditor from "./EmailTemplateEditor";

interface SurveyParticipantsProps {
  survey: Survey;
  onBack: () => void;
  onSurveyUpdated: () => void;
}

type Mode = "list" | "add";
type FilterStatus = "all" | "responded" | "pending";
type PageSize = 25 | 50 | 100 | "all";

// Modal de recordatorio
type ReminderTarget =
  | { type: "all" }
  | { type: "one"; employeeId: string; correo: string }
  | { type: "selected"; employeeIds: string[] };

const PAGE_SIZES: PageSize[] = [25, 50, 100, "all"];

export default function SurveyParticipants({ survey, onBack, onSurveyUpdated }: SurveyParticipantsProps) {
  const [mode, setMode]             = useState<Mode>("list");
  const [toAdd, setToAdd]           = useState<Map<string, Empleado>>(new Map());
  const [participants, setParticipants] = useState<SurveyParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // ── Filtros y paginación ─────────────────────────────────────────────────
  const [search, setSearch]           = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState<PageSize>(25);
  const [showFilters, setShowFilters] = useState(false);
  const [filterEquipo, setFilterEquipo] = useState("");

  // ── Selección múltiple ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  // ── Modal de recordatorio ────────────────────────────────────────────────
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null);
  const [reminderTemplate, setReminderTemplate] = useState<EmailTemplateConfig>(() => ({
    subject:    survey.emailSubject    ?? null,
    body:       survey.emailBody       ?? null,
    buttonText: survey.emailButtonText ?? null,
    footer:     survey.emailFooter     ?? null,
  }));
  const [reminderSending, setReminderSending] = useState(false);

  // ── Modal de invitación (post agregar participantes) ─────────────────────
  const [invitationIds, setInvitationIds]     = useState<string[] | null>(null);
  const [invitationTemplate, setInvitationTemplate] = useState<EmailTemplateConfig>({});
  const [invitationSending, setInvitationSending]   = useState(false);

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

  useEffect(() => {
    if (!confirmRemoveId) return;
    const t = setTimeout(() => setConfirmRemoveId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmRemoveId]);

  // Debounce del buscador
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Volver a página 1 y limpiar selección cuando cambian filtros
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [debouncedSearch, filterStatus, pageSize, filterEquipo]);

  const handleReset = async (p: SurveyParticipant) => {
    setActionLoading(`reset-${p.employee_id}`);
    try {
      await fetch(`/api/clima/surveys/${survey.id}/responses/${p.employee_id}`, { method: "DELETE" });
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
      await fetch(`/api/clima/surveys/${survey.id}/assignments/${p.employee_id}`, { method: "DELETE" });
      setParticipants((prev) => prev.filter((x) => x.employee_id !== p.employee_id));
      onSurveyUpdated();
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddConfirm = async () => {
    if (toAdd.size === 0) return;
    setActionLoading("adding");
    try {
      const res = await fetch(`/api/clima/surveys/${survey.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds: Array.from(toAdd.keys()) }),
      });
      if (res.ok) {
        const data = await res.json();
        setToAdd(new Map());
        setMode("list");
        await fetchParticipants();
        onSurveyUpdated();
        if (data.addedIds?.length > 0) {
          setInvitationTemplate({
            subject:    survey.emailSubject    ?? null,
            body:       survey.emailBody       ?? null,
            buttonText: survey.emailButtonText ?? null,
            footer:     survey.emailFooter     ?? null,
          });
          setInvitationIds(data.addedIds);
        }
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleSendInvitation = async () => {
    if (!invitationIds) return;
    setInvitationSending(true);
    try {
      const res = await fetch("/api/email/survey-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          surveyId:    survey.id,
          employeeIds: invitationIds,
          isReminder:  false,
          template:    invitationTemplate,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const count = data.sent ?? invitationIds.length;
        showEmailStatus("success", `Invitación enviada a ${count} participante${count !== 1 ? "s" : ""}.`);
      } else {
        showEmailStatus("error", data.error ?? "Error al enviar correos.");
      }
    } finally {
      setInvitationSending(false);
      setInvitationIds(null);
    }
  };

  const showEmailStatus = (type: "success" | "error", msg: string) => {
    setEmailStatus({ type, msg });
    setTimeout(() => setEmailStatus(null), 5000);
  };

  // Abrir modal de recordatorio
  const openReminderModal = (target: ReminderTarget) => {
    setReminderTarget(target);
    // Reinicializar con el template almacenado en la encuesta
    setReminderTemplate({
      subject:    survey.emailSubject    ?? null,
      body:       survey.emailBody       ?? null,
      buttonText: survey.emailButtonText ?? null,
      footer:     survey.emailFooter     ?? null,
    });
  };

  // Enviar recordatorio desde el modal
  const handleSendReminder = async () => {
    if (!reminderTarget) return;
    setReminderSending(true);
    try {
      const body: Record<string, unknown> = {
        surveyId:   survey.id,
        isReminder: true,
        template:   reminderTemplate,
      };
      if (reminderTarget.type === "one") {
        body.employeeIds = [reminderTarget.employeeId];
      } else if (reminderTarget.type === "selected") {
        body.employeeIds = reminderTarget.employeeIds;
      }
      const res  = await fetch("/api/email/survey-invite", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        const count = data.sent ?? 1;
        showEmailStatus(
          "success",
          reminderTarget.type === "one"
            ? `Recordatorio enviado a ${reminderTarget.correo}.`
            : `Recordatorio enviado a ${count} participante${count !== 1 ? "s" : ""}.`
        );
      } else {
        showEmailStatus("error", data.error ?? "Error al enviar correos.");
      }
    } finally {
      setReminderSending(false);
      setReminderTarget(null);
    }
  };

  // Usar response_id como fallback por si completed_at no se actualizó correctamente
  const hasResponded = (p: SurveyParticipant) => !!(p.completed_at || p.response_id);
  const responded = participants.filter(hasResponded);
  const pending   = participants.filter((p) => !hasResponded(p));
  const pct = participants.length ? Math.round((responded.length / participants.length) * 100) : 0;

  // ── Filtrado y paginación client-side ────────────────────────────────────
  const teams = useMemo(() => {
    const set = new Set(participants.map((p) => p.equipo).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [participants]);

  const hasActiveFilters = !!filterEquipo;

  const filtered = useMemo(() => {
    let list = participants;
    if (filterStatus === "responded") list = list.filter(hasResponded);
    else if (filterStatus === "pending") list = list.filter((p) => !hasResponded(p));
    if (filterEquipo) list = list.filter((p) => p.equipo === filterEquipo);
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter((p) =>
        p.nombre_completo.toLowerCase().includes(q) ||
        p.correo.toLowerCase().includes(q) ||
        (p.cargo  ?? "").toLowerCase().includes(q) ||
        (p.equipo ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [participants, filterStatus, filterEquipo, debouncedSearch]);

  const totalPages = pageSize === "all" ? 1 : Math.ceil(filtered.length / (pageSize as number));
  const safePage   = Math.min(page, Math.max(1, totalPages));
  const paginated  = pageSize === "all"
    ? filtered
    : filtered.slice((safePage - 1) * (pageSize as number), safePage * (pageSize as number));

  const visiblePages = (() => {
    const pages: number[] = [];
    const start = Math.max(1, safePage - 2);
    const end   = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  })();

  // ── Selección ────────────────────────────────────────────────────────────
  const isAllPageSelected    = paginated.length > 0 && paginated.every((p) => selectedIds.has(p.employee_id));
  const isPartialPageSelected = paginated.some((p) => selectedIds.has(p.employee_id)) && !isAllPageSelected;
  const pendingSelected       = paginated.filter((p) => selectedIds.has(p.employee_id) && !hasResponded(p));
  const totalSelected         = paginated.filter((p) => selectedIds.has(p.employee_id)).length;

  // Indeterminate en el checkbox de cabecera
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = isPartialPageSelected;
  }, [isPartialPageSelected]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isAllPageSelected) paginated.forEach((p) => next.delete(p.employee_id));
      else                    paginated.forEach((p) => next.add(p.employee_id));
      return next;
    });
  };

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

  return (
    <>
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-bold truncate">{survey.title}</h3>
            <p className="text-sm text-[#64748b]">Gestión de participantes</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {pending.length > 0 && (
              <button
                onClick={() => openReminderModal({ type: "all" })}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all"
              >
                <Send className="w-4 h-4" />
                Recordatorio ({pending.length})
              </button>
            )}
            <button
              onClick={() => setMode("add")}
              className="flex items-center gap-2 bg-[#1e293b] text-white px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-primary transition-all"
            >
              <UserPlus className="w-4 h-4" />
              Agregar participantes
            </button>
          </div>
        </div>

        {/* Feedback de correo */}
        {emailStatus && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold mb-4 ${
            emailStatus.type === "success"
              ? "bg-[#10B981]/10 text-[#10B981] border border-[#10B981]/20"
              : "bg-red-50 text-red-600 border border-red-200"
          }`}>
            <Mail className="w-4 h-4 shrink-0" />
            {emailStatus.msg}
          </div>
        )}

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

        {/* ── Fila 1: búsqueda + botón filtros + estado + page size ─────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-3">
          {/* Buscador */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748b]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, correo, cargo o equipo..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Botón Filtros */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all shrink-0 ${
              hasActiveFilters
                ? "bg-primary/10 text-primary border-primary/30"
                : showFilters
                  ? "bg-slate-100 text-[#1e293b] border-slate-200"
                  : "bg-slate-50 text-[#64748b] border-slate-200 hover:border-slate-300"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {hasActiveFilters && (
              <span className="bg-primary text-white text-[10px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                1
              </span>
            )}
          </button>

          {/* Filtro de estado */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
            {(["all", "responded", "pending"] as FilterStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filterStatus === s ? "bg-white shadow-sm text-[#1e293b]" : "text-[#64748b] hover:text-[#1e293b]"
                }`}
              >
                {s === "all" ? "Todos" : s === "responded" ? "Respondieron" : "Pendientes"}
              </button>
            ))}
          </div>

          {/* Tamaño de página */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 shrink-0">
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
        </div>

        {/* ── Fila 2: panel de filtros avanzados (colapsable) ───────────────── */}
        {showFilters && (
          <div className="flex flex-wrap gap-3 mb-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex flex-col gap-1 min-w-[220px] flex-1">
              <label className="text-[10px] font-black uppercase text-[#64748b] tracking-widest">Equipo</label>
              <select
                value={filterEquipo}
                onChange={(e) => setFilterEquipo(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-primary transition-colors cursor-pointer"
              >
                <option value="">Todos los equipos</option>
                {teams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {hasActiveFilters && (
              <div className="flex items-end">
                <button
                  onClick={() => setFilterEquipo("")}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-error bg-error/5 hover:bg-error/10 rounded-xl transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Limpiar filtros
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tag de filtro activo (cuando panel cerrado) */}
        {!showFilters && hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-primary px-3 py-1 rounded-full">
              Equipo: {filterEquipo}
              <button onClick={() => setFilterEquipo("")} className="hover:opacity-70">
                <X className="w-3 h-3" />
              </button>
            </span>
          </div>
        )}

        {/* ── Banner de selección ──────────────────────────────────────────── */}
        {totalSelected > 0 && (
          <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-primary">
                {totalSelected} participante{totalSelected !== 1 ? "s" : ""} seleccionado{totalSelected !== 1 ? "s" : ""}
              </span>
              {pendingSelected.length > 0 && pendingSelected.length < totalSelected && (
                <span className="text-xs text-[#64748b]">
                  ({pendingSelected.length} pendiente{pendingSelected.length !== 1 ? "s" : ""})
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {pendingSelected.length > 0 && (
                <button
                  onClick={() => openReminderModal({ type: "selected", employeeIds: pendingSelected.map((p) => p.employee_id) })}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-bold hover:shadow-md hover:shadow-primary/20 transition-all"
                >
                  <Send className="w-3 h-3" />
                  Recordatorio ({pendingSelected.length})
                </button>
              )}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs font-bold text-[#64748b] hover:text-error transition-colors"
              >
                Limpiar selección
              </button>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-widest text-[#64748b] font-black">
                <th className="py-3 pl-4 pr-2 w-10">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={isAllPageSelected}
                    onChange={toggleAllPage}
                    className="rounded accent-primary w-4 h-4 cursor-pointer"
                  />
                </th>
                <th className="py-3 pr-2">Participante</th>
                <th className="py-3 pr-4">Cargo / Equipo</th>
                <th className="py-3 pr-4">Estado</th>
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
                    No hay participantes asignados a esta encuesta.
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-[#64748b]">
                    No se encontraron participantes con los filtros aplicados.
                  </td>
                </tr>
              ) : (
                paginated.map((p) => {
                  const isResetting      = actionLoading === `reset-${p.employee_id}`;
                  const isRemoving       = actionLoading === `remove-${p.employee_id}`;
                  const confirmingRemove = confirmRemoveId === p.employee_id;
                  const isSelected       = selectedIds.has(p.employee_id);
                  return (
                    <tr key={p.employee_id} className={`border-b border-slate-50 transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-slate-50/50"}`}>
                      <td className="py-3.5 pl-4 pr-2 w-10 align-middle">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(p.employee_id)}
                          className="rounded accent-primary w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-3.5 pr-2">
                        <p className="font-semibold text-sm text-[#1e293b]">{p.nombre_completo}</p>
                        <p className="text-xs text-[#64748b]">{p.correo}</p>
                      </td>
                      <td className="py-3.5 pr-4">
                        <p className="text-sm text-[#64748b]">{p.cargo ?? "—"}</p>
                        <p className="text-xs text-[#94a3b8]">{p.equipo ?? "—"}</p>
                      </td>
                      <td className="py-3.5 pr-4">
                        {hasResponded(p) ? (
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
                          : hasResponded(p) ? "Fecha no registrada" : "—"}
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center justify-end gap-2">
                          {/* Recordatorio — solo pendientes */}
                          {!hasResponded(p) && (
                            <button
                              onClick={() => openReminderModal({ type: "one", employeeId: p.employee_id, correo: p.correo })}
                              disabled={!!actionLoading}
                              title="Enviar recordatorio por correo"
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors disabled:opacity-40"
                            >
                              <Mail className="w-3 h-3" />
                              Recordatorio
                            </button>
                          )}
                          {/* Reset — solo respondidos */}
                          {hasResponded(p) && (
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

        {/* ── Paginación ──────────────────────────────────────────────────── */}
        {pageSize !== "all" && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4">
            <p className="text-xs text-[#64748b]">
              {filtered.length} participante{filtered.length !== 1 ? "s" : ""} · página {safePage} de {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                ← Anterior
              </button>
              {visiblePages.map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 text-xs font-bold rounded-lg transition-colors ${
                    safePage === p ? "bg-primary text-white" : "text-[#64748b] hover:bg-slate-100"
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
        {pageSize === "all" && !loading && filtered.length > 0 && (
          <p className="text-xs text-[#64748b] mt-4">{filtered.length} participante{filtered.length !== 1 ? "s" : ""} en total</p>
        )}
      </div>

      {/* ── Modal de invitación (post agregar) ────────────────────────────── */}
      {invitationIds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 shrink-0">
              <div>
                <h4 className="text-lg font-bold text-[#1e293b]">
                  Enviar invitación a {invitationIds.length} nuevo{invitationIds.length !== 1 ? "s" : ""} participante{invitationIds.length !== 1 ? "s" : ""}
                </h4>
                <p className="text-xs text-[#64748b] mt-0.5">
                  Personaliza el correo de invitación o saltea este paso
                </p>
              </div>
              <button
                onClick={() => setInvitationIds(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-[#64748b]" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              <EmailTemplateEditor
                value={invitationTemplate}
                onChange={setInvitationTemplate}
                surveyTitle={survey.title}
                surveyDescription={survey.description}
                isReminder={false}
                surveyId={survey.id}
              />
            </div>

            <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100 shrink-0 gap-4">
              <button
                onClick={() => setInvitationIds(null)}
                className="text-sm font-bold text-[#64748b] hover:text-[#1e293b] transition-colors"
              >
                No enviar correo
              </button>
              <button
                onClick={handleSendInvitation}
                disabled={invitationSending}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
              >
                {invitationSending
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />}
                {invitationSending
                  ? "Enviando..."
                  : `Enviar a ${invitationIds.length} participante${invitationIds.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de recordatorio ──────────────────────────────────────────── */}
      {reminderTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Cabecera del modal */}
            <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100 shrink-0">
              <div>
                <h4 className="text-lg font-bold text-[#1e293b]">
                  {reminderTarget.type === "all"
                    ? `Recordatorio para ${pending.length} pendiente${pending.length !== 1 ? "s" : ""}`
                    : reminderTarget.type === "selected"
                      ? `Recordatorio para ${reminderTarget.employeeIds.length} seleccionado${reminderTarget.employeeIds.length !== 1 ? "s" : ""}`
                      : `Recordatorio · ${reminderTarget.correo}`}
                </h4>
                <p className="text-xs text-[#64748b] mt-0.5">
                  Personaliza el correo antes de enviarlo
                </p>
              </div>
              <button
                onClick={() => setReminderTarget(null)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-[#64748b]" />
              </button>
            </div>

            {/* Contenido scrollable */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              <EmailTemplateEditor
                value={reminderTemplate}
                onChange={setReminderTemplate}
                surveyTitle={survey.title}
                surveyDescription={survey.description}
                isReminder
                surveyId={survey.id}
              />
            </div>

            {/* Footer del modal */}
            <div className="flex items-center justify-between px-8 py-5 border-t border-slate-100 shrink-0 gap-4">
              <button
                onClick={() => setReminderTarget(null)}
                className="text-sm font-bold text-[#64748b] hover:text-[#1e293b] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSendReminder}
                disabled={reminderSending}
                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
              >
                {reminderSending
                  ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Send className="w-4 h-4" />}
                {reminderSending
                  ? "Enviando..."
                  : reminderTarget.type === "all"
                    ? `Enviar a ${pending.length} participante${pending.length !== 1 ? "s" : ""}`
                    : reminderTarget.type === "selected"
                      ? `Enviar a ${reminderTarget.employeeIds.length} participante${reminderTarget.employeeIds.length !== 1 ? "s" : ""}`
                      : "Enviar recordatorio"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
