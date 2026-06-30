"use client";
import { useState } from "react";
import { CheckCircle2, Clock, ChevronRight, Users, Settings2 } from "lucide-react";
import type { Evaluation360 } from "@/types/evaluaciones360";
import { EVAL_TYPE_LABELS, EVAL_TYPE_COLORS } from "@/types/evaluaciones360";
import type { EvalType } from "@/types/evaluaciones360";

const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500",
  "bg-rose-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500",
];
function getAvatarColor(s: string) {
  const hash = s.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function getInitials(s: string) {
  if (!s?.trim()) return "?";
  const parts = s.trim().split(/[\s@._-]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.trim().slice(0, 2).toUpperCase() || "?";
}
function AvatarCircle({ avatarUrl, name }: { avatarUrl?: string | null; name: string }) {
  const [err, setErr] = useState(false);
  const color    = getAvatarColor(name);
  const initials = getInitials(name);
  if (avatarUrl && !err) {
    return (
      <img src={avatarUrl} alt={name} onError={() => setErr(true)}
        className="w-11 h-11 rounded-2xl object-cover shrink-0" />
    );
  }
  return (
    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${color}`}>
      <span className="text-xs font-black text-white">{initials}</span>
    </div>
  );
}

interface Props {
  evaluations: Evaluation360[];
  onTake: (e: Evaluation360) => void;
  onManageRequest: (e: Evaluation360) => void;
}

export default function ViewerList({ evaluations, onTake, onManageRequest }: Props) {
  if (evaluations.length === 0) {
    return (
      <div className="bg-white rounded-[2rem] p-16 border border-slate-100 shadow-sm text-center flex flex-col items-center gap-4">
        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
          <CheckCircle2 className="w-8 h-8 text-slate-300" />
        </div>
        <div>
          <p className="text-xl font-bold text-[#1e293b]">¡Sin evaluaciones pendientes!</p>
          <p className="text-sm text-[#64748b] mt-1">No tienes evaluaciones asignadas en este momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-[#1e293b]">Mis Evaluaciones 360°</h2>
        <p className="text-sm text-[#64748b] mt-1">Evaluaciones en las que eres evaluador</p>
      </div>

      {evaluations.map((e) => {
        const total     = e.assignmentsCount;
        const submitted = e.submittedCount;
        const pending   = total - submitted;
        const pct       = total > 0 ? Math.round((submitted / total) * 100) : 0;
        const allDone   = submitted === total && total > 0;

        // Compute type distribution from myAssignments
        const typeMap = new Map<EvalType, number>();
        (e.myAssignments ?? []).forEach((a) => {
          typeMap.set(a.evaluationType, (typeMap.get(a.evaluationType) ?? 0) + 1);
        });

        return (
          <div key={e.id} className={`bg-white rounded-2xl border shadow-sm transition-all ${allDone ? "border-emerald-100" : "border-slate-100"}`}>
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${allDone ? "bg-emerald-100" : "bg-primary/10"}`}>
                    <Users className={`w-6 h-6 ${allDone ? "text-emerald-600" : "text-primary"}`} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-[#1e293b] truncate">{e.title}</h3>
                    {e.description && <p className="text-xs text-[#64748b] truncate mt-0.5">{e.description}</p>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      {Array.from(typeMap.entries()).map(([type, count]) => (
                        <span key={type} className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${EVAL_TYPE_COLORS[type]}`}>
                          {EVAL_TYPE_LABELS[type]}: {count}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    onClick={() => onTake(e)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                      allDone
                        ? "bg-slate-100 text-slate-500 cursor-default"
                        : "bg-[#1e293b] text-white hover:bg-primary hover:shadow-lg hover:shadow-primary/20"
                    }`}
                  >
                    {allDone ? (
                      <><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Completada</>
                    ) : (
                      <>Evaluar <ChevronRight className="w-4 h-4" /></>
                    )}
                  </button>
                  <button
                    onClick={() => onManageRequest(e)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#64748b] hover:text-primary transition-colors"
                  >
                    <Settings2 className="w-3.5 h-3.5" />
                    Gestionar evaluados
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-[#94a3b8]" />
                    <span className="text-xs text-[#64748b]">
                      {pending > 0 ? `${pending} pendiente${pending > 1 ? "s" : ""}` : "Todas enviadas"}
                    </span>
                  </div>
                  <span className="text-xs font-black text-primary">{pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-emerald-500" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-[#94a3b8] mt-1">{submitted} de {total} enviadas</p>
              </div>

              {/* Individual assignments */}
              {(e.myAssignments ?? []).length > 0 && (
                <div className="mt-4 space-y-1.5">
                  {(e.myAssignments ?? []).map((a) => {
                    const statusStyle = {
                      pending:     "text-slate-500 bg-slate-100",
                      in_progress: "text-blue-700 bg-blue-100",
                      completed:   "text-amber-700 bg-amber-100",
                      submitted:   "text-emerald-700 bg-emerald-100",
                    }[a.status] ?? "text-slate-500 bg-slate-100";
                    const statusLabel = { pending: "Pendiente", in_progress: "En progreso", completed: "Completada", submitted: "Enviada" }[a.status] ?? a.status;

                    return (
                      <div key={a.id} className="flex items-center justify-between gap-3 py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <AvatarCircle
                            avatarUrl={a.evaluateeAvatarUrl}
                            name={a.evaluateeName || a.evaluateeEmail}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#1e293b] truncate leading-tight">
                              {a.evaluateeName || a.evaluateeEmail}
                            </p>
                            <span className={`inline-block mt-0.5 text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full ${EVAL_TYPE_COLORS[a.evaluationType]}`}>
                              {EVAL_TYPE_LABELS[a.evaluationType]}
                            </span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${statusStyle}`}>
                          {statusLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
