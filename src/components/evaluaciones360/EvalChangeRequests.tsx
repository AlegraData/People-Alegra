"use client";
import { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, Check, MessageSquare, Plus, Minus, CheckCircle2, XCircle,
} from "lucide-react";
import type { Evaluation360, EvaluationChangeRequest, EvalType } from "@/types/evaluaciones360";
import { EVAL_TYPE_LABELS, EVAL_TYPE_COLORS } from "@/types/evaluaciones360";

interface Props {
  evaluation: Evaluation360;
  onBack: () => void;
}

type FilterTab = "pending" | "all";

const STATUS_STYLES: Record<string, string> = {
  pending:  "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-600",
};
const STATUS_LABELS: Record<string, string> = {
  pending:  "Pendiente",
  approved: "Aprobada",
  rejected: "Rechazada",
};

export default function EvalChangeRequests({ evaluation, onBack }: Props) {
  const [requests, setRequests]   = useState<EvaluationChangeRequest[]>([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<FilterTab>("pending");
  const [notes, setNotes]         = useState<Record<string, string>>({});
  const [reviewing, setReviewing] = useState<Record<string, boolean>>({});
  const [openNote, setOpenNote]   = useState<string | null>(null);
  const [apiError, setApiError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/change-requests`);
      if (res.ok) setRequests(await res.json());
    } finally { setLoading(false); }
  }, [evaluation.id]);

  useEffect(() => { load(); }, [load]);

  const handle = async (requestId: string, action: "approved" | "rejected") => {
    setReviewing((p) => ({ ...p, [requestId]: true }));
    setApiError(null);
    try {
      const res = await fetch(
        `/api/evaluaciones360/surveys/${evaluation.id}/change-requests/${requestId}`,
        {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ status: action, adminNote: notes[requestId] || null }),
        }
      );
      const data = await res.json();
      if (!res.ok) { setApiError(data.error || "Error al procesar"); return; }
      setRequests((p) => p.map((r) => (r.id === requestId ? data : r)));
      setOpenNote(null);
    } finally {
      setReviewing((p) => ({ ...p, [requestId]: false }));
    }
  };

  const filtered      = tab === "pending" ? requests.filter((r) => r.status === "pending") : requests;
  const pendingCount  = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748b] hover:text-primary transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Volver
      </button>

      <div>
        <h2 className="text-2xl font-black text-[#1e293b]">Solicitudes de cambio</h2>
        <p className="text-sm text-[#64748b] mt-1">{evaluation.title}</p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center bg-slate-100 rounded-2xl p-1 gap-1 w-fit">
        {(["pending", "all"] as FilterTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === t ? "bg-white text-[#1e293b] shadow-sm" : "text-[#64748b] hover:text-[#1e293b]"
            }`}
          >
            {t === "pending" ? "Pendientes" : "Todas"}
            {t === "pending" && pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {apiError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold">
          {apiError}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 animate-pulse">
              <div className="h-4 w-48 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-32 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-100 text-center">
          <CheckCircle2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="font-bold text-[#1e293b]">
            {tab === "pending" ? "Sin solicitudes pendientes" : "Sin solicitudes"}
          </p>
          <p className="text-sm text-[#64748b] mt-1">
            {tab === "pending"
              ? "No hay solicitudes esperando revisión."
              : "Aún no se han creado solicitudes de cambio."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              note={notes[r.id] ?? ""}
              onNoteChange={(v) => setNotes((p) => ({ ...p, [r.id]: v }))}
              noteOpen={openNote === r.id}
              onToggleNote={() => setOpenNote(openNote === r.id ? null : r.id)}
              onApprove={() => handle(r.id, "approved")}
              onReject={() => handle(r.id, "rejected")}
              reviewing={reviewing[r.id] ?? false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestCard({
  request, note, onNoteChange, noteOpen, onToggleNote, onApprove, onReject, reviewing,
}: {
  request: EvaluationChangeRequest;
  note: string;
  onNoteChange: (v: string) => void;
  noteOpen: boolean;
  onToggleNote: () => void;
  onApprove: () => void;
  onReject: () => void;
  reviewing: boolean;
}) {
  const isPending = request.status === "pending";
  const isAdd     = request.action === "add";
  const typeColor = EVAL_TYPE_COLORS[request.targetType as EvalType] ?? "bg-slate-100 text-slate-500";
  const typeLabel = EVAL_TYPE_LABELS[request.targetType as EvalType] ?? request.targetType;

  return (
    <div className={`bg-white rounded-2xl border transition-all ${
      isPending ? "border-amber-200 shadow-sm shadow-amber-50/50" : "border-slate-100"
    }`}>
      <div className="p-5">
        <div className="flex items-start gap-4 flex-wrap">
          {/* Action icon */}
          <div className={`mt-0.5 shrink-0 w-9 h-9 rounded-xl flex items-center justify-center ${isAdd ? "bg-emerald-100" : "bg-red-100"}`}>
            {isAdd
              ? <Plus className="w-4 h-4 text-emerald-600" />
              : <Minus className="w-4 h-4 text-red-500" />
            }
          </div>

          {/* Main info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isAdd ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
                {isAdd ? "Agregar evaluado" : "Quitar evaluado"}
              </span>
              <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[request.status]}`}>
                {STATUS_LABELS[request.status]}
              </span>
            </div>

            <p className="text-sm font-bold text-[#1e293b]">
              {request.requestorName || request.requestorEmail}
              <span className="font-normal text-[#64748b]"> solicita {isAdd ? "agregar a" : "quitar a"} </span>
              {request.targetName || request.targetEmail}
            </p>

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-xs text-[#64748b]">{request.targetEmail}</span>
              <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full ${typeColor}`}>
                {typeLabel}
              </span>
            </div>

            {request.reason && (
              <p className="mt-1.5 text-xs text-[#64748b] italic">"{request.reason}"</p>
            )}

            <p className="mt-1.5 text-[10px] text-[#94a3b8]">
              {new Date(request.createdAt).toLocaleDateString("es-CO", {
                day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </p>
          </div>

          {/* Pending actions */}
          {isPending && (
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
              <button
                onClick={onToggleNote}
                title="Agregar nota"
                className={`p-2 rounded-xl transition-colors ${
                  noteOpen ? "bg-slate-200 text-[#1e293b]" : "text-[#64748b] hover:bg-slate-100 hover:text-[#1e293b]"
                }`}
              >
                <MessageSquare className="w-4 h-4" />
              </button>
              <button
                onClick={onReject}
                disabled={reviewing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {reviewing
                  ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                  : <XCircle className="w-3.5 h-3.5" />
                }
                Rechazar
              </button>
              <button
                onClick={onApprove}
                disabled={reviewing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {reviewing
                  ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Check className="w-3.5 h-3.5" />
                }
                Aprobar
              </button>
            </div>
          )}

          {/* Reviewed by (resolved) */}
          {!isPending && request.reviewedBy && (
            <div className="text-right shrink-0">
              <p className="text-[10px] text-[#94a3b8]">Revisado por</p>
              <p className="text-xs font-semibold text-[#64748b]">{request.reviewedBy}</p>
              {request.reviewedAt && (
                <p className="text-[10px] text-[#94a3b8]">
                  {new Date(request.reviewedAt).toLocaleDateString("es-CO", { day: "2-digit", month: "short" })}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Note textarea (pending) */}
        {isPending && noteOpen && (
          <div className="mt-3 ml-13">
            <textarea
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Nota opcional para el evaluador..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        )}

        {/* Admin note (resolved) */}
        {!isPending && request.adminNote && (
          <div className="mt-3 px-3 py-2 bg-slate-50 rounded-xl">
            <p className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wide">Nota del administrador</p>
            <p className="text-sm text-[#64748b] mt-0.5">{request.adminNote}</p>
          </div>
        )}
      </div>
    </div>
  );
}
