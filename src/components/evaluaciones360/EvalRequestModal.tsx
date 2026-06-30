"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, Plus, Minus, Clock, CheckCircle2, Search, X } from "lucide-react";
import type {
  Evaluation360, Evaluation360Assignment,
  EvaluationChangeRequest, EvalType,
} from "@/types/evaluaciones360";
import { EVAL_TYPE_LABELS, EVAL_TYPE_COLORS } from "@/types/evaluaciones360";

interface Props {
  evaluation: Evaluation360;
  onBack: () => void;
}

type TabType = "requests" | "add" | "remove";

const EVAL_TYPES: EvalType[] = ["ascendente", "descendente", "paralela", "autoevaluacion"];

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

// ── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-emerald-500",
  "bg-rose-500", "bg-indigo-500", "bg-teal-500", "bg-orange-500",
];
function getAvatarColor(s: string) {
  const hash = (s || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
function getInitials(s: string) {
  if (!s?.trim()) return "?";
  const parts = s.trim().split(/[\s@._-]+/);
  if (parts.length >= 2 && parts[0] && parts[1]) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.trim().slice(0, 2).toUpperCase() || "?";
}
function AvatarCircle({ avatarUrl, name, size = "md" }: {
  avatarUrl?: string | null; name: string; size?: "sm" | "md" | "lg";
}) {
  const [err, setErr] = useState(false);
  const color    = getAvatarColor(name);
  const initials = getInitials(name);
  const sz = { sm: "w-9 h-9 rounded-xl", md: "w-12 h-12 rounded-2xl", lg: "w-14 h-14 rounded-2xl" }[size];
  const tx = { sm: "text-xs", md: "text-sm", lg: "text-base" }[size];
  if (avatarUrl && !err) {
    return (
      <img src={avatarUrl} alt={name} onError={() => setErr(true)}
        className={`${sz} object-cover shrink-0`} />
    );
  }
  return (
    <div className={`${sz} flex items-center justify-center shrink-0 ${color}`}>
      <span className={`${tx} font-black text-white`}>{initials}</span>
    </div>
  );
}

// ── User lookup result type ───────────────────────────────────────────────────
interface UserLookupResult {
  email:     string;
  fullName:  string | null;
  avatarUrl: string | null;
}

// ── User search combobox ──────────────────────────────────────────────────────
function UserSearchField({
  onSelect, resetKey,
}: {
  onSelect: (u: UserLookupResult | null) => void;
  resetKey: number;
}) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState<UserLookupResult[]>([]);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState<UserLookupResult | null>(null);
  const [showDrop, setShowDrop] = useState(false);
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Reset when parent clears the form
  useEffect(() => {
    setQuery(""); setResults([]); setSelected(null); setShowDrop(false);
  }, [resetKey]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleChange = (q: string) => {
    setQuery(q);
    if (selected) { setSelected(null); onSelect(null); }
    clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/evaluaciones360/user-lookup?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data: UserLookupResult[] = await res.json();
          setResults(data);
          setShowDrop(true);
        }
      } finally { setLoading(false); }
    }, 300);
  };

  const pick = (u: UserLookupResult) => {
    setSelected(u);
    setQuery(u.fullName || u.email);
    setResults([]);
    setShowDrop(false);
    onSelect(u);
  };

  const clear = () => {
    setSelected(null);
    setQuery("");
    setResults([]);
    setShowDrop(false);
    onSelect(null);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94a3b8]" />
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (results.length > 0 && !selected) setShowDrop(true); }}
          onBlur={() => setTimeout(() => setShowDrop(false), 150)}
          placeholder="Buscar por nombre o correo..."
          className={`w-full pl-10 pr-9 py-2.5 text-sm rounded-xl border outline-none transition-colors ${
            selected
              ? "border-primary bg-primary/5 text-[#1e293b]"
              : "border-slate-200 focus:border-primary bg-white"
          }`}
        />
        {(query || selected) && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={clear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Preview card when selected */}
      {selected && (
        <div className="mt-3 flex items-center gap-3 px-4 py-3 bg-slate-50 rounded-xl border border-slate-200">
          <AvatarCircle avatarUrl={selected.avatarUrl} name={selected.fullName || selected.email} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1e293b] truncate">
              {selected.fullName || selected.email}
            </p>
            <p className="text-xs text-[#64748b] truncate">{selected.email}</p>
          </div>
        </div>
      )}

      {/* Dropdown results */}
      {showDrop && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
          {loading ? (
            <div className="py-5 flex justify-center">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#64748b]">Sin resultados</p>
          ) : (
            <ul className="max-h-52 overflow-y-auto divide-y divide-slate-50">
              {results.map((u) => (
                <li
                  key={u.email}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(u)}
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <AvatarCircle avatarUrl={u.avatarUrl} name={u.fullName || u.email} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1e293b] truncate">{u.fullName || u.email}</p>
                    <p className="text-xs text-[#64748b] truncate">{u.email}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function EvalRequestModal({ evaluation, onBack }: Props) {
  const [tab, setTab]               = useState<TabType>("requests");
  const [myRequests, setMyRequests] = useState<EvaluationChangeRequest[]>([]);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [success, setSuccess]       = useState<string | null>(null);
  const [removePending, setRemovePending] = useState<Set<string>>(new Set());

  // Add form state
  const [selectedTarget, setSelectedTarget] = useState<UserLookupResult | null>(null);
  const [targetType, setTargetType]         = useState<EvalType>("ascendente");
  const [reason, setReason]                 = useState("");
  const [searchResetKey, setSearchResetKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/change-requests`);
      if (res.ok) setMyRequests(await res.json());
    } finally { setLoading(false); }
  }, [evaluation.id]);

  useEffect(() => { load(); }, [load]);

  const removableAssignments = (evaluation.myAssignments ?? []).filter((a) => {
    if (a.status === "submitted") return false;
    return !myRequests.some(
      (r) =>
        r.action === "remove" &&
        r.status === "pending" &&
        r.targetEmail === a.evaluateeEmail &&
        r.targetType === a.evaluationType
    );
  });

  const submitRequest = async (payload: {
    action:       "add" | "remove";
    targetEmail:  string;
    targetName?:  string;
    targetType:   string;
    reason?:      string;
  }) => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/change-requests`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al enviar solicitud"); return; }
      setMyRequests((p) => [data, ...p]);
      setSuccess(
        payload.action === "add"
          ? "Solicitud de agregar enviada. El administrador la revisará pronto."
          : "Solicitud de quitar enviada. El administrador la revisará pronto."
      );
      // Reset add form
      setSelectedTarget(null);
      setTargetType("ascendente");
      setReason("");
      setSearchResetKey((k) => k + 1);
      setTab("requests");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTarget) { setError("Selecciona una persona de la lista"); return; }

    const alreadyAssigned = (evaluation.myAssignments ?? []).some(
      (a) =>
        a.evaluateeEmail.toLowerCase() === selectedTarget.email.toLowerCase() &&
        a.evaluationType === targetType
    );
    if (alreadyAssigned) {
      setError(`Ya tienes a ${selectedTarget.fullName || selectedTarget.email} asignado como ${EVAL_TYPE_LABELS[targetType]}.`);
      return;
    }

    await submitRequest({
      action:      "add",
      targetEmail: selectedTarget.email,
      targetName:  selectedTarget.fullName || undefined,
      targetType,
      reason:      reason.trim() || undefined,
    });
  };

  const handleRemove = async (a: Evaluation360Assignment) => {
    setRemovePending((p) => new Set(p).add(a.id));
    await submitRequest({
      action:      "remove",
      targetEmail: a.evaluateeEmail,
      targetName:  a.evaluateeName || undefined,
      targetType:  a.evaluationType,
    });
    setRemovePending((p) => { const s = new Set(p); s.delete(a.id); return s; });
  };

  const pendingCount = myRequests.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-bold text-[#64748b] hover:text-primary transition-colors"
      >
        <ChevronLeft className="w-4 h-4" /> Volver
      </button>

      <div>
        <h2 className="text-2xl font-black text-[#1e293b]">Gestionar evaluados</h2>
        <p className="text-sm text-[#64748b] mt-1">{evaluation.title}</p>
      </div>

      <div className="px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
        Puedes solicitar agregar o quitar personas de tu lista de evaluados. El administrador aprobará o rechazará tu solicitud.
      </div>

      {/* Tabs */}
      <div className="flex items-center bg-slate-100 rounded-2xl p-1 gap-1 w-fit flex-wrap">
        {([
          { key: "requests", label: "Mis solicitudes" },
          { key: "add",      label: "Agregar"         },
          { key: "remove",   label: "Quitar"          },
        ] as { key: TabType; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setError(null); setSuccess(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              tab === key ? "bg-white text-[#1e293b] shadow-sm" : "text-[#64748b] hover:text-[#1e293b]"
            }`}
          >
            {key === "add"    && <Plus  className="w-3.5 h-3.5" />}
            {key === "remove" && <Minus className="w-3.5 h-3.5" />}
            {label}
            {key === "requests" && pendingCount > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full leading-none">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 font-semibold">
          {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 font-semibold">
          {success}
        </div>
      )}

      {/* ── Mis solicitudes ──────────────────────────────────────────────── */}
      {tab === "requests" && (
        loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-slate-100 animate-pulse">
                <div className="h-4 w-48 bg-slate-200 rounded mb-2" />
                <div className="h-3 w-32 bg-slate-100 rounded" />
              </div>
            ))}
          </div>
        ) : myRequests.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-slate-100 text-center">
            <Clock className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="font-bold text-[#1e293b]">Sin solicitudes</p>
            <p className="text-sm text-[#64748b] mt-1">Aún no has enviado solicitudes de cambio.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {myRequests.map((r) => (
              <div key={r.id} className="bg-white rounded-2xl p-4 border border-slate-100">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`mt-0.5 shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${r.action === "add" ? "bg-emerald-100" : "bg-red-100"}`}>
                      {r.action === "add"
                        ? <Plus  className="w-3.5 h-3.5 text-emerald-600" />
                        : <Minus className="w-3.5 h-3.5 text-red-500" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-[#1e293b] truncate">
                        {r.action === "add" ? "Agregar: " : "Quitar: "}
                        {r.targetName || r.targetEmail}
                      </p>
                      <p className="text-xs text-[#64748b] truncate">{r.targetEmail}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full ${EVAL_TYPE_COLORS[r.targetType as EvalType] ?? "bg-slate-100 text-slate-500"}`}>
                          {EVAL_TYPE_LABELS[r.targetType as EvalType] ?? r.targetType}
                        </span>
                      </div>
                      {r.adminNote && (
                        <p className="mt-1.5 text-xs text-[#64748b] italic">Nota: "{r.adminNote}"</p>
                      )}
                    </div>
                  </div>
                  <span className={`shrink-0 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${STATUS_STYLES[r.status]}`}>
                    {STATUS_LABELS[r.status]}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ── Agregar evaluado (con buscador) ──────────────────────────────── */}
      {tab === "add" && (
        <form onSubmit={handleAdd} className="bg-white rounded-2xl p-5 border border-slate-100 space-y-4">
          <div>
            <label className="block text-sm font-bold text-[#1e293b] mb-2">
              Buscar persona *
            </label>
            <UserSearchField
              onSelect={setSelectedTarget}
              resetKey={searchResetKey}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-[#1e293b] mb-1">Tipo de evaluación *</label>
            <select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as EvalType)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
            >
              {EVAL_TYPES.map((t) => (
                <option key={t} value={t}>{EVAL_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#1e293b] mb-1">Motivo (opcional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="¿Por qué quieres agregar a esta persona?"
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !selectedTarget}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1e293b] text-white font-bold text-sm hover:bg-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting
              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <Plus className="w-4 h-4" />
            }
            Enviar solicitud
          </button>
        </form>
      )}

      {/* ── Quitar evaluado ──────────────────────────────────────────────── */}
      {tab === "remove" && (
        <div className="space-y-3">
          {removableAssignments.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 border border-slate-100 text-center">
              <CheckCircle2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="font-bold text-[#1e293b]">Sin evaluados disponibles</p>
              <p className="text-sm text-[#64748b] mt-1">
                Todos tus evaluados tienen solicitudes pendientes o ya has enviado sus evaluaciones.
              </p>
            </div>
          ) : (
            removableAssignments.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl p-4 border border-slate-100 flex items-center gap-4">
                <AvatarCircle
                  avatarUrl={a.evaluateeAvatarUrl}
                  name={a.evaluateeName || a.evaluateeEmail}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1e293b] truncate">
                    {a.evaluateeName || a.evaluateeEmail}
                  </p>
                  <p className="text-xs text-[#64748b] truncate">{a.evaluateeEmail}</p>
                  <span className={`inline-block mt-0.5 text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full ${EVAL_TYPE_COLORS[a.evaluationType]}`}>
                    {EVAL_TYPE_LABELS[a.evaluationType]}
                  </span>
                </div>
                <button
                  onClick={() => handleRemove(a)}
                  disabled={submitting || removePending.has(a.id)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold text-red-600 border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {removePending.has(a.id)
                    ? <div className="w-3.5 h-3.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    : <Minus className="w-3.5 h-3.5" />
                  }
                  Solicitar quitar
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
