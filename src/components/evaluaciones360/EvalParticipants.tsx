"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ArrowLeft, UserPlus, Trash2, Send, CheckCircle2, Clock,
  Upload, Download, X, Search, Users, Mail, MailX, Settings2, Save,
} from "lucide-react";
import EmployeeSearchCombobox, { type EmployeeResult } from "@/components/evaluaciones360/EmployeeSearchCombobox";
import EmailTemplateEditor from "@/components/clima/EmailTemplateEditor";
import type { EmailTemplateConfig } from "@/lib/emailTemplate";
import * as XLSX from "xlsx";
import type { Evaluation360, Evaluation360Assignment, EvalType, ParticipantRow } from "@/types/evaluaciones360";
import { EVAL_TYPE_LABELS, EVAL_TYPE_COLORS } from "@/types/evaluaciones360";

interface Props {
  evaluation: Evaluation360;
  onBack: () => void;
}

const ALL_TYPES: EvalType[] = ["ascendente", "descendente", "paralela", "autoevaluacion"];
const PAGE_SIZE = 10;

const STATUS_CONFIG: Record<string, { label: string; style: string; icon: React.ReactNode }> = {
  pending:     { label: "Pendiente",   style: "bg-slate-100 text-slate-500",     icon: <Clock className="w-3 h-3" /> },
  in_progress: { label: "En progreso", style: "bg-blue-100 text-blue-700",       icon: <Clock className="w-3 h-3" /> },
  completed:   { label: "Completada",  style: "bg-amber-100 text-amber-700",     icon: <CheckCircle2 className="w-3 h-3" /> },
  submitted:   { label: "Enviada",     style: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="w-3 h-3" /> },
};

// ── Avatar helpers ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-teal-100 text-teal-700",     "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700", "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",   "bg-cyan-100 text-cyan-700",
  "bg-emerald-100 text-emerald-700","bg-indigo-100 text-indigo-700",
];
function avatarColor(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(s: string) {
  if (!s?.trim()) return "?";
  const p = s.trim().split(/[\s@._-]+/);
  if (p.length >= 2 && p[0] && p[1]) return (p[0][0] + p[1][0]).toUpperCase();
  return s.trim().slice(0, 2).toUpperCase() || "?";
}
function AvatarCircle({ name, avatarUrl, size = "md" }: { name: string; avatarUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const [err, setErr] = useState(false);
  const sz = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-lg" : "w-11 h-11 text-sm";
  if (avatarUrl && !err) {
    return (
      <img src={avatarUrl} alt={name} onError={() => setErr(true)}
        className={`${sz} rounded-2xl object-cover shrink-0`} />
    );
  }
  return (
    <div className={`${sz} ${avatarColor(name)} rounded-2xl flex items-center justify-center font-bold shrink-0`}>
      {initials(name)}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function EvalParticipants({ evaluation, onBack }: Props) {
  const [assignments, setAssignments]   = useState<Evaluation360Assignment[]>([]);
  const [loading, setLoading]           = useState(true);
  const [showAdd, setShowAdd]           = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [search, setSearch]             = useState("");
  const [page, setPage]                 = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionId, setActionId]         = useState<string | null>(null);
  const [globalMsg, setGlobalMsg]       = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [sendInviteOnImport, setSendInviteOnImport] = useState(true);
  // Plantilla del correo de invitación — precargada con la configurada al crear la evaluación
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplateConfig>({
    subject:    evaluation.emailSubject    ?? null,
    body:       evaluation.emailBody       ?? null,
    buttonText: evaluation.emailButtonText ?? null,
    footer:     evaluation.emailFooter     ?? null,
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/participants`);
      if (res.ok) setAssignments(await res.json());
    } finally { setLoading(false); }
  }, [evaluation.id]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

  // Auto-clear message
  useEffect(() => {
    if (!globalMsg) return;
    const t = setTimeout(() => setGlobalMsg(null), 5000);
    return () => clearTimeout(t);
  }, [globalMsg]);

  const handleDelete = async (a: Evaluation360Assignment) => {
    if (confirmDeleteId !== a.id) { setConfirmDeleteId(a.id); return; }
    setConfirmDeleteId(null);
    setActionId(`del-${a.id}`);
    try {
      await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/participants`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: a.id }),
      });
      await fetchAssignments();
    } finally { setActionId(null); }
  };

  const handleSendReminder = async (a: Evaluation360Assignment) => {
    setActionId(`remind-${a.id}`);
    try {
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId: a.id }),
      });
      setGlobalMsg(res.ok
        ? { type: "success", msg: `Recordatorio enviado a ${a.evaluatorEmail}` }
        : { type: "error", msg: "Error al enviar recordatorio" });
    } finally { setActionId(null); }
  };

  const handleRemindAll = async () => {
    setActionId("remind-all");
    try {
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/remind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendToAll: true }),
      });
      if (res.ok) {
        const { sent } = await res.json();
        setGlobalMsg({ type: "success", msg: `Recordatorio enviado a ${sent} evaluador${sent !== 1 ? "es" : ""}` });
      } else {
        setGlobalMsg({ type: "error", msg: "Error al enviar recordatorios" });
      }
    } finally { setActionId(null); }
  };

  // ── Excel import ─────────────────────────────────────────────────────────────
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb   = XLSX.read(ev.target?.result, { type: "binary" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        const typeMap: Record<string, EvalType> = {
          ascendente: "ascendente", descendente: "descendente",
          paralela: "paralela", autoevaluacion: "autoevaluacion",
          "auto-evaluación": "autoevaluacion", autoevaluación: "autoevaluacion",
        };
        const participants: ParticipantRow[] = rows
          .filter((r) => r["Correo Evaluador"] || r["correo_evaluador"])
          .map((r) => ({
            evaluatorEmail: String(r["Correo Evaluador"] || r["correo_evaluador"] || "").trim().toLowerCase(),
            evaluatorName:  String(r["Nombre Evaluador"] || r["nombre_evaluador"] || "").trim(),
            evaluateeEmail: String(r["Correo Evaluado"]  || r["correo_evaluado"]  || "").trim().toLowerCase(),
            evaluateeName:  String(r["Nombre Evaluado"]  || r["nombre_evaluado"]  || "").trim(),
            team:           String(r["Equipo"] || r["equipo"] || "").trim(),
            evaluationType: typeMap[String(r["Tipo"] || r["tipo"] || "").trim().toLowerCase()] ?? "paralela",
          }))
          .filter((r) => r.evaluatorEmail && r.evaluateeEmail);

        const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participants,
            sendInvitation: sendInviteOnImport,
            emailTemplate: sendInviteOnImport ? emailTemplate : undefined,
          }),
        });
        if (res.ok) {
          const { created } = await res.json();
          const inviteMsg = sendInviteOnImport ? " · Invitaciones enviadas" : "";
          setGlobalMsg({ type: "success", msg: `${created} participante${created !== 1 ? "s" : ""} agregados${inviteMsg}` });
          await fetchAssignments();
        }
      } catch { setGlobalMsg({ type: "error", msg: "Error al importar el archivo." }); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleExport = () => {
    const rows = assignments.map((a) => ({
      "Correo Evaluador": a.evaluatorEmail,
      "Nombre Evaluador": a.evaluatorName || "",
      "Correo Evaluado":  a.evaluateeEmail,
      "Nombre Evaluado":  a.evaluateeName || "",
      "Equipo":           a.team || "",
      "Tipo":             EVAL_TYPE_LABELS[a.evaluationType as EvalType],
      "Estado":           STATUS_CONFIG[a.status]?.label || a.status,
      "Enviada en":       a.submittedAt ? new Date(a.submittedAt).toLocaleDateString("es-CO") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Participantes");
    XLSX.writeFile(wb, `evaluacion_360_${evaluation.title.replace(/\s+/g, "_")}_participantes.xlsx`);
  };

  // ── Build evaluatee map ───────────────────────────────────────────────────────
  const enabledTypes = ALL_TYPES.filter((t) => {
    const key = `has${t.charAt(0).toUpperCase() + t.slice(1)}` as keyof typeof evaluation;
    return evaluation[key];
  });

  const byEvaluatee = useMemo(() => {
    const map = new Map<string, { name: string; team: string | null; avatarUrl: string | null; byType: Map<EvalType, Evaluation360Assignment[]> }>();
    assignments.forEach((a) => {
      if (!map.has(a.evaluateeEmail)) {
        map.set(a.evaluateeEmail, {
          name: a.evaluateeName || a.evaluateeEmail,
          team: (a as { team?: string | null }).team ?? null,
          avatarUrl: (a as { evaluateeAvatarUrl?: string | null }).evaluateeAvatarUrl ?? null,
          byType: new Map(),
        });
      }
      const row = map.get(a.evaluateeEmail)!;
      if (!row.byType.has(a.evaluationType as EvalType)) row.byType.set(a.evaluationType as EvalType, []);
      row.byType.get(a.evaluationType as EvalType)!.push(a);
    });
    return map;
  }, [assignments]);

  const uniqueEvaluators = useMemo(
    () => new Set(assignments.map((a) => a.evaluatorEmail)).size,
    [assignments]
  );

  const totalSubmitted = assignments.filter((a) => a.status === "submitted").length;

  // ── Search + pagination ───────────────────────────────────────────────────────
  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    const entries = Array.from(byEvaluatee.entries());
    if (!q) return entries;
    return entries.filter(([email, row]) =>
      email.toLowerCase().includes(q) ||
      row.name.toLowerCase().includes(q) ||
      (row.team ?? "").toLowerCase().includes(q)
    );
  }, [byEvaluatee, search]);

  useEffect(() => setPage(1), [search]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const paged      = filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────────
  if (selectedEmail) {
    const row = byEvaluatee.get(selectedEmail);
    if (!row) { setSelectedEmail(null); return null; }
    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedEmail(null)}
          className="flex items-center gap-2 text-sm font-semibold text-[#64748b] hover:text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Volver a participantes
        </button>

        {/* Person card */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center gap-5">
          <AvatarCircle name={row.name} avatarUrl={row.avatarUrl} size="lg" />
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-black text-[#1e293b] truncate">{row.name}</h3>
            <p className="text-sm text-[#64748b]">{selectedEmail}</p>
            {row.team && (
              <span className="inline-block mt-1 text-[11px] font-bold bg-primary/10 text-primary px-2.5 py-1 rounded-full">
                {row.team}
              </span>
            )}
          </div>
          <div className="shrink-0 text-right">
            {(() => {
              const allForEvaluatee = Array.from(row.byType.values()).flat();
              const sent = allForEvaluatee.filter((a) => a.status === "submitted").length;
              return (
                <>
                  <p className="text-2xl font-black text-primary">{sent}/{allForEvaluatee.length}</p>
                  <p className="text-[10px] font-bold uppercase text-[#64748b]">enviadas</p>
                </>
              );
            })()}
          </div>
        </div>

        {/* Global message */}
        {globalMsg && (
          <div className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold ${
            globalMsg.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"
          }`}>
            {globalMsg.msg}
            <button onClick={() => setGlobalMsg(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* By type */}
        {enabledTypes.map((type) => {
          const typeAssignments = row.byType.get(type) ?? [];
          if (typeAssignments.length === 0) return null;
          return (
            <div key={type} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${EVAL_TYPE_COLORS[type]}`}>
                  {EVAL_TYPE_LABELS[type]}
                </span>
                <span className="text-xs text-[#94a3b8]">
                  {typeAssignments.length} evaluador{typeAssignments.length !== 1 ? "es" : ""}
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {typeAssignments.map((a) => {
                  const st = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.pending;
                  return (
                    <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                      <AvatarCircle name={a.evaluatorName || a.evaluatorEmail} avatarUrl={(a as { evaluatorAvatarUrl?: string | null }).evaluatorAvatarUrl} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#1e293b] truncate">
                          {a.evaluatorName || a.evaluatorEmail}
                        </p>
                        <p className="text-xs text-[#94a3b8] truncate">{a.evaluatorEmail}</p>
                      </div>
                      <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-1 rounded-full shrink-0 ${st.style}`}>
                        {st.icon} {st.label}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {a.status !== "submitted" && (
                          <button
                            onClick={() => handleSendReminder(a)}
                            disabled={!!actionId}
                            title="Enviar recordatorio"
                            className="p-1.5 text-[#64748b] hover:text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {actionId === `remind-${a.id}`
                              ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              : <Send className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(a)}
                          disabled={!!actionId}
                          title={confirmDeleteId === a.id ? "Confirmar eliminación" : "Eliminar"}
                          className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                            confirmDeleteId === a.id ? "text-white bg-red-500" : "text-red-400 hover:bg-red-50"
                          }`}
                        >
                          {actionId === `del-${a.id}`
                            ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h3 className="text-xl font-bold text-[#1e293b]">Participantes</h3>
            <p className="text-sm text-[#64748b]">{evaluation.title}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-bold text-[#64748b] hover:text-primary px-3 py-2 rounded-lg hover:bg-primary/10 transition-colors">
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
          <button
            onClick={() => setSendInviteOnImport((v) => !v)}
            title={sendInviteOnImport ? "Importar enviará invitaciones" : "Importar sin enviar invitaciones"}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg transition-colors ${
              sendInviteOnImport ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200" : "bg-slate-100 text-[#64748b] hover:bg-slate-200"
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            {sendInviteOnImport ? "Con invitación" : "Sin invitación"}
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-primary px-3 py-2 rounded-lg hover:bg-primary/20 transition-colors">
            <Upload className="w-3.5 h-3.5" /> Importar
          </button>
          <button
            onClick={handleRemindAll}
            disabled={actionId === "remind-all"}
            className="flex items-center gap-1.5 text-xs font-bold bg-amber-100 text-amber-700 px-3 py-2 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50"
          >
            {actionId === "remind-all"
              ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              : <Send className="w-3.5 h-3.5" />}
            Recordar a todos
          </button>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-bold bg-[#1e293b] text-white px-4 py-2 rounded-lg hover:bg-primary transition-colors"
          >
            <UserPlus className="w-3.5 h-3.5" />
            {showAdd ? "Cancelar" : "Agregar"}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
        </div>
      </div>

      {/* Global message */}
      {globalMsg && (
        <div className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-semibold ${
          globalMsg.type === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {globalMsg.msg}
          <button onClick={() => setGlobalMsg(null)}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Evaluados",        value: byEvaluatee.size,              color: "text-[#1e293b]",    icon: <Users className="w-4 h-4" /> },
          { label: "Evaluadores",      value: uniqueEvaluators,              color: "text-[#8b5cf6]",    icon: <Users className="w-4 h-4" /> },
          { label: "Enviadas",         value: totalSubmitted,                color: "text-emerald-600",  icon: <CheckCircle2 className="w-4 h-4" /> },
          { label: "Total asignaciones", value: assignments.length,          color: "text-[#64748b]",    icon: <Clock className="w-4 h-4" /> },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-slate-50 shrink-0 ${color}`}>{icon}</div>
            <div className="min-w-0">
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="text-[11px] font-semibold text-[#64748b] truncate">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <AddForm
          evaluation={evaluation}
          emailTemplate={emailTemplate}
          onTemplateChange={setEmailTemplate}
          onAdded={() => { fetchAssignments(); setShowAdd(false); setGlobalMsg({ type: "success", msg: "Participante agregado." }); }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : byEvaluatee.size === 0 ? (
        <div className="bg-white rounded-[2rem] p-16 border border-slate-100 text-center">
          <p className="text-[#64748b] font-semibold">Sin participantes aún</p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
            <input
              type="text"
              placeholder="Buscar por nombre, correo o equipo…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-10 py-3 rounded-2xl border border-slate-200 bg-white text-sm text-[#1e293b] placeholder:text-[#94a3b8] focus:outline-none focus:ring-2 focus:ring-primary/30 transition-shadow"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b]">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <p className="text-xs text-[#94a3b8] px-1">
            {filteredEntries.length} evaluado{filteredEntries.length !== 1 ? "s" : ""}
            {search ? ` que coinciden con "${search}"` : ""}
          </p>

          {/* Evaluatee cards */}
          <div className="space-y-2">
            {paged.map(([email, row]) => {
              const allAssignments = Array.from(row.byType.values()).flat();
              const sent    = allAssignments.filter((a) => a.status === "submitted").length;
              const pending = allAssignments.length - sent;
              const pct     = allAssignments.length > 0 ? Math.round((sent / allAssignments.length) * 100) : 0;

              return (
                <button
                  key={email}
                  onClick={() => setSelectedEmail(email)}
                  className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-4 hover:border-primary/30 hover:shadow-md transition-all text-left group"
                >
                  <AvatarCircle name={row.name} avatarUrl={row.avatarUrl} size="md" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[#1e293b] truncate">{row.name}</p>
                      {row.team && (
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                          {row.team}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#94a3b8] truncate">{email}</p>

                    {/* Mini type badges */}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {enabledTypes.map((type) => {
                        const ta = row.byType.get(type);
                        if (!ta || ta.length === 0) return null;
                        return (
                          <span key={type} className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-md ${EVAL_TYPE_COLORS[type]}`}>
                            {EVAL_TYPE_LABELS[type].slice(0, 4)} {ta.length}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Progress summary */}
                  <div className="shrink-0 flex flex-col items-end gap-1.5 min-w-[80px]">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: pct >= 80 ? "#00D6BC" : pct >= 50 ? "#f59e0b" : "#f43f5e" }}
                        />
                      </div>
                      <span className="text-xs font-black text-[#64748b] w-8 text-right">{pct}%</span>
                    </div>
                    <p className="text-[11px] text-[#94a3b8]">
                      <span className="text-emerald-600 font-bold">{sent}</span> / {allAssignments.length}
                      {pending > 0 && <span className="text-amber-600 font-bold ml-1">({pending} pend.)</span>}
                    </p>
                  </div>

                  <div className="text-slate-300 group-hover:text-primary transition-colors shrink-0">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-4 pt-2">
              <p className="text-xs text-[#94a3b8]">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredEntries.length)} de {filteredEntries.length}
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  Anterior
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1)
                  .reduce<(number | "…")[]>((acc, n, i, arr) => {
                    if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push("…");
                    acc.push(n);
                    return acc;
                  }, [])
                  .map((n, i) =>
                    n === "…" ? (
                      <span key={`d${i}`} className="px-1 text-[#94a3b8] text-xs">…</span>
                    ) : (
                      <button key={n} onClick={() => setPage(n as number)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${
                          page === n ? "bg-primary text-white" : "hover:bg-slate-100 text-[#64748b]"
                        }`}>{n}</button>
                    )
                  )}
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748b] hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Add participant form ────────────────────────────────────────────────────────
function AddForm({ evaluation, emailTemplate, onTemplateChange, onAdded }: {
  evaluation: Evaluation360;
  emailTemplate: EmailTemplateConfig;
  onTemplateChange: (v: EmailTemplateConfig) => void;
  onAdded: () => void;
}) {
  const [evaluator, setEvaluator] = useState<EmployeeResult | null>(null);
  const [evaluatee, setEvaluatee] = useState<EmployeeResult | null>(null);
  const [evalType, setEvalType]   = useState<EvalType>("paralela");
  const [sendInvite, setSendInvite] = useState(true);
  const [saving, setSaving]       = useState(false);
  const [evKey, setEvKey]         = useState(0);
  const [eeKey, setEeKey]         = useState(0);
  const [showEmailConfig, setShowEmailConfig] = useState(false);
  const [savingTemplate, setSavingTemplate]   = useState(false);
  const [templateMsg, setTemplateMsg] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const handleAdd = async () => {
    if (!evaluator || !evaluatee) { alert("Selecciona el evaluador y el evaluado."); return; }
    setSaving(true);
    try {
      const participant: ParticipantRow = {
        evaluatorEmail: evaluator.correo,
        evaluatorName:  evaluator.nombre_completo || evaluator.correo,
        evaluateeEmail: evaluatee.correo,
        evaluateeName:  evaluatee.nombre_completo || evaluatee.correo,
        team:           evaluatee.equipo || "",
        evaluationType: evalType,
      };
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participants: [participant],
          sendInvitation: sendInvite,
          emailTemplate: sendInvite ? emailTemplate : undefined,
        }),
      });
      if (res.ok) {
        setEvaluator(null); setEvaluatee(null); setEvalType("paralela");
        setEvKey((k) => k + 1); setEeKey((k) => k + 1);
        onAdded();
      }
    } finally { setSaving(false); }
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    setTemplateMsg(null);
    try {
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailSubject:    emailTemplate.subject    ?? "",
          emailBody:       emailTemplate.body       ?? "",
          emailButtonText: emailTemplate.buttonText ?? "",
          emailFooter:     emailTemplate.footer     ?? "",
        }),
      });
      setTemplateMsg(res.ok
        ? { type: "success", msg: "Plantilla guardada. Se usará también en próximas invitaciones y recordatorios." }
        : { type: "error", msg: "No se pudo guardar la plantilla." });
    } catch {
      setTemplateMsg({ type: "error", msg: "Error de red al guardar la plantilla." });
    } finally {
      setSavingTemplate(false);
      setTimeout(() => setTemplateMsg(null), 6000);
    }
  };

  return (
    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 space-y-4">
      <p className="text-sm font-bold text-[#1e293b]">Agregar participante</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <EmployeeSearchCombobox
          key={`ev-${evKey}`}
          label="Evaluador *"
          placeholder="Buscar por nombre o correo..."
          onSelect={setEvaluator}
        />
        <EmployeeSearchCombobox
          key={`ee-${eeKey}`}
          label="Evaluado *"
          placeholder="Buscar por nombre o correo..."
          onSelect={setEvaluatee}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase text-[#64748b] mb-1">Equipo</label>
          <input
            value={evaluatee?.equipo || ""}
            readOnly
            placeholder="Se toma del evaluado"
            className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 text-[#64748b] cursor-default"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase text-[#64748b] mb-1">Tipo de relación *</label>
          <select
            value={evalType}
            onChange={(e) => setEvalType(e.target.value as EvalType)}
            className="w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-primary"
          >
            {(Object.entries(EVAL_TYPE_LABELS) as [EvalType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Invitation toggle + email config */}
      <div className="flex items-center gap-3 pt-1 flex-wrap">
        <button
          type="button"
          onClick={() => setSendInvite((v) => !v)}
          className={`flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border-2 transition-all ${
            sendInvite
              ? "border-emerald-400 bg-emerald-50 text-emerald-700"
              : "border-slate-200 bg-white text-[#64748b]"
          }`}
        >
          {sendInvite ? <Mail className="w-4 h-4" /> : <MailX className="w-4 h-4" />}
          {sendInvite ? "Enviar correo de invitación" : "No enviar correo"}
        </button>
        {sendInvite && (
          <button
            type="button"
            onClick={() => setShowEmailConfig((v) => !v)}
            className={`flex items-center gap-2 text-sm font-bold px-4 py-2.5 rounded-xl border-2 transition-all ${
              showEmailConfig
                ? "border-primary bg-primary/10 text-primary"
                : "border-slate-200 bg-white text-[#64748b] hover:border-primary/40 hover:text-primary"
            }`}
          >
            <Settings2 className="w-4 h-4" />
            {showEmailConfig ? "Ocultar configuración" : "Configurar correo"}
          </button>
        )}
        <p className="text-xs text-[#94a3b8]">
          {sendInvite ? "El evaluador recibirá un correo con el enlace." : "Se agrega sin notificar al evaluador."}
        </p>
      </div>

      {/* Email template config */}
      {sendInvite && showEmailConfig && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#1e293b] flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" /> Correo de invitación
              </p>
              <p className="text-xs text-[#94a3b8] mt-0.5">
                Es el mismo correo configurado al crear la evaluación. Los cambios se usarán al agregar este participante;
                pulsa "Guardar plantilla" para aplicarlos también a próximos envíos y recordatorios.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
              className="flex items-center gap-1.5 text-xs font-bold bg-[#1e293b] text-white px-4 py-2 rounded-lg hover:bg-primary transition-colors disabled:opacity-50 shrink-0"
            >
              {savingTemplate
                ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Save className="w-3.5 h-3.5" />}
              Guardar plantilla
            </button>
          </div>

          {templateMsg && (
            <div className={`text-xs font-semibold px-3 py-2 rounded-lg border ${
              templateMsg.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-red-50 border-red-200 text-red-600"
            }`}>
              {templateMsg.msg}
            </div>
          )}

          <EmailTemplateEditor
            value={emailTemplate}
            onChange={onTemplateChange}
            surveyTitle={evaluation.title}
            surveyDescription={evaluation.description ?? ""}
            isReminder={false}
            surveyId={evaluation.id}
            module="360"
            showFallbackLink={false}
          />
        </div>
      )}

      <button
        onClick={handleAdd}
        disabled={saving || !evaluator || !evaluatee}
        className="flex items-center gap-2 bg-[#1e293b] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving
          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <UserPlus className="w-4 h-4" />}
        Agregar participante
      </button>
    </div>
  );
}
