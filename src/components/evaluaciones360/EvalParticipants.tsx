"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { ArrowLeft, UserPlus, Trash2, Send, CheckCircle2, Clock, Upload, Download, X } from "lucide-react";
import EmployeeSearchCombobox, { type EmployeeResult } from "@/components/evaluaciones360/EmployeeSearchCombobox";
import * as XLSX from "xlsx";
import type { Evaluation360, Evaluation360Assignment, EvalType, ParticipantRow } from "@/types/evaluaciones360";
import { EVAL_TYPE_LABELS, EVAL_TYPE_COLORS } from "@/types/evaluaciones360";

interface Props {
  evaluation: Evaluation360;
  onBack: () => void;
}

const ALL_TYPES: EvalType[] = ["ascendente", "descendente", "paralela", "autoevaluacion"];

const STATUS_CONFIG: Record<string, { label: string; style: string; icon: React.ReactNode }> = {
  pending:     { label: "Pendiente",   style: "bg-slate-100 text-slate-500",    icon: <Clock className="w-3 h-3" /> },
  in_progress: { label: "En progreso", style: "bg-blue-100 text-blue-700",      icon: <Clock className="w-3 h-3" /> },
  completed:   { label: "Completada",  style: "bg-amber-100 text-amber-700",    icon: <CheckCircle2 className="w-3 h-3" /> },
  submitted:   { label: "Enviada",     style: "bg-emerald-100 text-emerald-700", icon: <CheckCircle2 className="w-3 h-3" /> },
};

export default function EvalParticipants({ evaluation, onBack }: Props) {
  const [assignments, setAssignments] = useState<Evaluation360Assignment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [mode, setMode]               = useState<"matrix" | "add">("matrix");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionId, setActionId]       = useState<string | null>(null);
  const [globalMsg, setGlobalMsg]     = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/participants`);
      if (res.ok) setAssignments(await res.json());
    } finally { setLoading(false); }
  }, [evaluation.id]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  // ── Auto-clear confirm ────────────────────────────────────────────────────
  useEffect(() => {
    if (!confirmDeleteId) return;
    const t = setTimeout(() => setConfirmDeleteId(null), 3000);
    return () => clearTimeout(t);
  }, [confirmDeleteId]);

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
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participants: [{
            evaluatorEmail: a.evaluatorEmail, evaluatorName: a.evaluatorName,
            evaluateeEmail: a.evaluateeEmail, evaluateeName: a.evaluateeName,
            team: a.team, evaluationType: a.evaluationType,
          }],
          sendInvitation: true,
        }),
      });
      if (res.ok) setGlobalMsg({ type: "success", msg: `Recordatorio enviado a ${a.evaluatorEmail}` });
    } finally { setActionId(null); }
  };

  // ── Excel import (add participants) ───────────────────────────────────────
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb   = XLSX.read(ev.target?.result, { type: "binary" });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
        const typeMap: Record<string, EvalType> = {
          ascendente: "ascendente", descendente: "descendente",
          paralela: "paralela", autoevaluacion: "autoevaluacion",
          "auto-evaluación": "autoevaluacion", autoevaluación: "autoevaluacion",
        };
        const participants: ParticipantRow[] = rows
          .filter((r: any) => r["Correo Evaluador"] || r["correo_evaluador"])
          .map((r: any) => ({
            evaluatorEmail: (r["Correo Evaluador"] || r["correo_evaluador"] || "").toString().trim().toLowerCase(),
            evaluatorName:  (r["Nombre Evaluador"] || r["nombre_evaluador"] || "").toString().trim(),
            evaluateeEmail: (r["Correo Evaluado"]  || r["correo_evaluado"]  || "").toString().trim().toLowerCase(),
            evaluateeName:  (r["Nombre Evaluado"]  || r["nombre_evaluado"]  || "").toString().trim(),
            team:           (r["Equipo"] || r["equipo"] || "").toString().trim(),
            evaluationType: typeMap[(r["Tipo"] || r["tipo"] || "").toString().trim().toLowerCase()] ?? "paralela",
          }))
          .filter((r: ParticipantRow) => r.evaluatorEmail && r.evaluateeEmail);

        const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ participants, sendInvitation: false }),
        });
        if (res.ok) {
          const { created } = await res.json();
          setGlobalMsg({ type: "success", msg: `${created} participante${created !== 1 ? "s" : ""} agregados` });
          await fetchAssignments();
        }
      } catch { setGlobalMsg({ type: "error", msg: "Error al importar el archivo." }); }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  // ── Export current list ───────────────────────────────────────────────────
  const handleExport = () => {
    const rows = assignments.map((a) => ({
      "Correo Evaluador": a.evaluatorEmail,
      "Nombre Evaluador": a.evaluatorName || "",
      "Correo Evaluado":  a.evaluateeEmail,
      "Nombre Evaluado":  a.evaluateeName || "",
      "Equipo":           a.team || "",
      "Tipo":             EVAL_TYPE_LABELS[a.evaluationType],
      "Estado":           STATUS_CONFIG[a.status]?.label || a.status,
      "Enviada en":       a.submittedAt ? new Date(a.submittedAt).toLocaleDateString("es-CO") : "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Participantes");
    XLSX.writeFile(wb, `evaluacion_360_${evaluation.title.replace(/\s+/g, "_")}_participantes.xlsx`);
  };

  // ── Build matrix (evaluatees × types) ────────────────────────────────────
  const enabledTypes = ALL_TYPES.filter((t) => {
    const key = `has${t.charAt(0).toUpperCase() + t.slice(1)}` as keyof typeof evaluation;
    return evaluation[key];
  });

  const byEvaluatee = new Map<string, { name: string; byType: Map<EvalType, Evaluation360Assignment[]> }>();
  assignments.forEach((a) => {
    if (!byEvaluatee.has(a.evaluateeEmail)) {
      byEvaluatee.set(a.evaluateeEmail, { name: a.evaluateeName || a.evaluateeEmail, byType: new Map() });
    }
    const row = byEvaluatee.get(a.evaluateeEmail)!;
    if (!row.byType.has(a.evaluationType as EvalType)) row.byType.set(a.evaluationType as EvalType, []);
    row.byType.get(a.evaluationType as EvalType)!.push(a);
  });

  const total     = assignments.length;
  const submitted = assignments.filter((a) => a.status === "submitted").length;

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
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-bold text-[#64748b] hover:text-primary px-3 py-2 rounded-lg hover:bg-primary/10 transition-colors">
            <Download className="w-3.5 h-3.5" /> Exportar
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 text-xs font-bold bg-primary/10 text-primary px-3 py-2 rounded-lg hover:bg-primary/20 transition-colors">
            <Upload className="w-3.5 h-3.5" /> Importar
          </button>
          <button onClick={() => setMode(mode === "matrix" ? "add" : "matrix")}
            className="flex items-center gap-1.5 text-xs font-bold bg-[#1e293b] text-white px-4 py-2 rounded-lg hover:bg-primary transition-colors">
            <UserPlus className="w-3.5 h-3.5" />
            {mode === "add" ? "Ver matriz" : "Agregar"}
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total asignaciones", value: total, color: "text-[#1e293b]" },
          { label: "Enviadas",           value: submitted, color: "text-emerald-600" },
          { label: "Pendientes",         value: total - submitted, color: "text-amber-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm text-center">
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-xs font-semibold text-[#64748b] mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Add form */}
      {mode === "add" && (
        <AddForm evaluationId={evaluation.id} onAdded={() => { fetchAssignments(); setMode("matrix"); }} />
      )}

      {/* Matrix view */}
      {mode === "matrix" && (
        loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : byEvaluatee.size === 0 ? (
          <div className="bg-white rounded-[2rem] p-16 border border-slate-100 text-center">
            <p className="text-[#64748b] font-semibold">Sin participantes aún</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Array.from(byEvaluatee.entries()).map(([email, row]) => (
              <div key={email} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Evaluatee header */}
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-8 h-8 bg-primary/10 rounded-xl flex items-center justify-center">
                    <span className="text-xs font-black text-primary">{(row.name || email).charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#1e293b]">{row.name}</p>
                    <p className="text-xs text-[#94a3b8]">{email}</p>
                  </div>
                </div>

                {/* Evaluator rows by type */}
                {enabledTypes.map((type) => {
                  const typeAssignments = row.byType.get(type) ?? [];
                  if (typeAssignments.length === 0) return null;
                  return (
                    <div key={type} className="px-5 py-3 border-b border-slate-50 last:border-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${EVAL_TYPE_COLORS[type]}`}>
                          {EVAL_TYPE_LABELS[type]}
                        </span>
                        <span className="text-xs text-[#94a3b8]">{typeAssignments.length} evaluador{typeAssignments.length !== 1 ? "es" : ""}</span>
                      </div>
                      <div className="space-y-1.5">
                        {typeAssignments.map((a) => {
                          const st = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.pending;
                          return (
                            <div key={a.id} className="flex items-center gap-3 py-1">
                              <div className="flex-1 min-w-0">
                                <span className="text-sm font-semibold text-[#1e293b]">{a.evaluatorName || a.evaluatorEmail}</span>
                                <span className="text-xs text-[#94a3b8] ml-2">{a.evaluatorEmail}</span>
                              </div>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${st.style}`}>
                                {st.icon} {st.label}
                              </span>
                              <div className="flex items-center gap-1">
                                {a.status !== "submitted" && (
                                  <button
                                    onClick={() => handleSendReminder(a)}
                                    disabled={actionId === `remind-${a.id}`}
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
                                    confirmDeleteId === a.id
                                      ? "text-white bg-red-500"
                                      : "text-red-400 hover:bg-red-50"
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
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ── Add participant form with employee search ─────────────────────────────────
function AddForm({ evaluationId, onAdded }: { evaluationId: string; onAdded: () => void }) {
  const [evaluator, setEvaluator] = useState<EmployeeResult | null>(null);
  const [evaluatee, setEvaluatee] = useState<EmployeeResult | null>(null);
  const [evalType, setEvalType]   = useState<EvalType>("paralela");
  const [saving, setSaving]       = useState(false);
  const [evKey, setEvKey]         = useState(0);
  const [eeKey, setEeKey]         = useState(0);

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
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluationId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participants: [participant], sendInvitation: true }),
      });
      if (res.ok) {
        setEvaluator(null); setEvaluatee(null); setEvalType("paralela");
        setEvKey((k) => k + 1); setEeKey((k) => k + 1);
        onAdded();
      }
    } finally { setSaving(false); }
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
      <button
        onClick={handleAdd}
        disabled={saving || !evaluator || !evaluatee}
        className="flex items-center gap-2 bg-[#1e293b] text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving
          ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <UserPlus className="w-4 h-4" />}
        Agregar y enviar invitación
      </button>
    </div>
  );
}
