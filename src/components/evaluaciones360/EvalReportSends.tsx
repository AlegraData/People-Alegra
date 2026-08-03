"use client";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Search, X, Send, CheckCircle2, XCircle, Loader2, Mail, Save, StopCircle } from "lucide-react";
import type { Evaluation360, Evaluation360ReportSend } from "@/types/evaluaciones360";
import type { EmailTemplateConfig } from "@/lib/emailTemplate";
import EvalReportSendEmailEditor from "./EvalReportSendEmailEditor";

interface Props {
  evaluation: Evaluation360;
}

interface ReportPerson {
  evaluateeEmail: string;
  evaluateeName: string;
  team: string | null;
  totalSubmitted: number;
}

type RowProgress = { status: "idle" | "sending" | "sent" | "error"; error?: string };

// Envía una persona a la vez con un timeout razonable — un render de PDF
// colgado (Puppeteer) no debe dejar la sesión del admin esperando para siempre.
async function sendOne(evaluationId: string, evaluateeEmail: string): Promise<{ ok: boolean; error?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`/api/evaluaciones360/surveys/${evaluationId}/report-sends`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evaluateeEmail }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.error ?? "Error del servidor" };
    return { ok: !!data.ok, error: data.error };
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.name === "AbortError" ? "Se agotó el tiempo de espera" : "Error de red" };
  } finally {
    clearTimeout(timeout);
  }
}

function formatDate(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function EvalReportSends({ evaluation: initialEvaluation }: Props) {
  const [evaluation, setEvaluation] = useState(initialEvaluation);
  const [people, setPeople]     = useState<ReportPerson[]>([]);
  const [sends, setSends]       = useState<Record<string, Evaluation360ReportSend>>({});
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [filterTeam, setFilterTeam] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [showTemplate, setShowTemplate] = useState(false);
  const [template, setTemplate] = useState<EmailTemplateConfig>({
    subject:    initialEvaluation.reportEmailSubject    ?? null,
    body:       initialEvaluation.reportEmailBody       ?? null,
    buttonText: initialEvaluation.reportEmailButtonText ?? null,
    footer:     initialEvaluation.reportEmailFooter      ?? null,
  });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateMsg, setTemplateMsg] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [sending, setSending]     = useState(false);
  const [stopRequested, setStopRequested] = useState(false);
  // El loop de envío es una sola función async de punta a punta — leer
  // `stopRequested` (estado) adentro capturaría siempre su valor de cuando
  // arrancó el loop, nunca la actualización que dispara el botón "Detener"
  // mientras corre. Un ref sí se lee al vuelo en cada iteración.
  const stopRef = useRef(false);
  const [progress, setProgress]   = useState<Record<string, RowProgress>>({});
  const [sendSummary, setSendSummary] = useState<{ done: number; total: number } | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/evaluaciones360/surveys/${evaluation.id}/results`).then((r) => r.json()),
      fetch(`/api/evaluaciones360/surveys/${evaluation.id}/report-sends`).then((r) => r.json()),
    ])
      .then(([resultsData, sendsData]) => {
        const results = (resultsData.results ?? []) as ReportPerson[];
        setPeople(results.map((r) => ({
          evaluateeEmail: r.evaluateeEmail, evaluateeName: r.evaluateeName,
          team: r.team, totalSubmitted: r.totalSubmitted,
        })));
        const sendsList = (sendsData.sends ?? []) as Evaluation360ReportSend[];
        setSends(Object.fromEntries(sendsList.map((s) => [s.evaluateeEmail, s])));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [evaluation.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const teams = useMemo(
    () => [...new Set(people.map((p) => p.team).filter(Boolean) as string[])].sort(),
    [people],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return people.filter((p) => {
      const matchesTeam = filterTeam === "all" || p.team === filterTeam;
      const matchesQuery = !q ||
        p.evaluateeName.toLowerCase().includes(q) ||
        p.evaluateeEmail.toLowerCase().includes(q) ||
        (p.team ?? "").toLowerCase().includes(q);
      return matchesTeam && matchesQuery;
    });
  }, [people, search, filterTeam]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.evaluateeEmail));

  function toggleOne(email: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email); else next.add(email);
      return next;
    });
  }

  function toggleAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((p) => next.delete(p.evaluateeEmail));
      else filtered.forEach((p) => next.add(p.evaluateeEmail));
      return next;
    });
  }

  async function handleSaveTemplate() {
    setSavingTemplate(true);
    setTemplateMsg(null);
    try {
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportEmailSubject:    template.subject    ?? "",
          reportEmailBody:       template.body       ?? "",
          reportEmailButtonText: template.buttonText ?? "",
          reportEmailFooter:     template.footer     ?? "",
        }),
      });
      setTemplateMsg(res.ok
        ? { type: "success", msg: "Plantilla guardada." }
        : { type: "error", msg: "No se pudo guardar la plantilla." });
      if (res.ok) {
        const updated = await res.json();
        setEvaluation((prev) => ({ ...prev, ...updated }));
      }
    } catch {
      setTemplateMsg({ type: "error", msg: "Error de red al guardar la plantilla." });
    } finally {
      setSavingTemplate(false);
      setTimeout(() => setTemplateMsg(null), 6000);
    }
  }

  async function handleSend() {
    const targets = [...selected];
    if (targets.length === 0 || sending) return;
    setSending(true);
    setStopRequested(false);
    stopRef.current = false;
    setSendSummary({ done: 0, total: targets.length });
    setProgress(Object.fromEntries(targets.map((e) => [e, { status: "idle" as const }])));

    for (let i = 0; i < targets.length; i++) {
      if (stopRef.current) break;
      const email = targets[i];
      setProgress((prev) => ({ ...prev, [email]: { status: "sending" } }));
      const result = await sendOne(evaluation.id, email);
      setProgress((prev) => ({ ...prev, [email]: result.ok ? { status: "sent" } : { status: "error", error: result.error } }));
      if (result.ok) {
        setSends((prev) => ({
          ...prev,
          [email]: { evaluateeEmail: email, status: "sent", sentAt: new Date().toISOString() },
        }));
      }
      setSendSummary((prev) => (prev ? { ...prev, done: i + 1 } : prev));
    }

    setSending(false);
    // Reconciliar con el servidor (fuente de verdad) al terminar la tanda.
    fetch(`/api/evaluaciones360/surveys/${evaluation.id}/report-sends`)
      .then((r) => r.json())
      .then((d) => {
        const sendsList = (d.sends ?? []) as Evaluation360ReportSend[];
        setSends(Object.fromEntries(sendsList.map((s) => [s.evaluateeEmail, s])));
      })
      .catch(() => {});
  }

  const alreadySentSelectedCount = [...selected].filter((e) => sends[e]?.status === "sent").length;

  return (
    <div className="space-y-6">
      <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-3 text-xs text-[#64748b]">
        Elige a quién enviar el reporte PDF por correo (con el PDF adjunto). El envío se hace de a una persona
        a la vez, mostrando el progreso — quien ya lo recibió queda marcado y no se selecciona por error.
      </div>

      {/* Plantilla de correo */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
        <button
          type="button"
          onClick={() => setShowTemplate((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-5 py-4"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-[#1e293b]">
            <Mail className="w-4 h-4 text-primary" /> Plantilla de correo
          </span>
          <span className="text-xs font-semibold text-primary">{showTemplate ? "Ocultar" : "Editar"}</span>
        </button>
        {showTemplate && (
          <div className="px-5 pb-5 space-y-4 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-[#94a3b8]">Se usa para todos los envíos de esta encuesta.</p>
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
            <EvalReportSendEmailEditor value={template} onChange={setTemplate} surveyTitle={evaluation.title} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : people.length === 0 ? (
        <div className="bg-white rounded-[2rem] p-16 border border-slate-100 text-center">
          <Mail className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="font-bold text-[#1e293b]">Sin reportes disponibles todavía</p>
          <p className="text-sm text-[#64748b] mt-1">Los reportes se pueden enviar cuando haya evaluaciones enviadas.</p>
        </div>
      ) : (
        <>
          {/* Búsqueda + filtro de equipo */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
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
            {teams.length > 1 && (
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="text-sm border border-slate-200 rounded-2xl px-4 py-3 bg-white text-[#1e293b] focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
              >
                <option value="all">Todos los equipos</option>
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-xs font-semibold text-[#64748b] cursor-pointer">
              <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} className="w-4 h-4 rounded accent-primary" />
              Seleccionar todos los filtrados ({filtered.length})
            </label>
            <p className="text-xs text-[#94a3b8]">{selected.size} seleccionado{selected.size !== 1 ? "s" : ""}</p>
          </div>

          {/* Lista de personas */}
          <div className="space-y-2">
            {filtered.map((p) => {
              const send = sends[p.evaluateeEmail];
              const rowProgress = progress[p.evaluateeEmail];
              const isChecked = selected.has(p.evaluateeEmail);
              return (
                <div
                  key={p.evaluateeEmail}
                  className="w-full bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex items-center gap-4"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleOne(p.evaluateeEmail)}
                    className="w-4 h-4 rounded accent-primary shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-[#1e293b] truncate">{p.evaluateeName || p.evaluateeEmail}</p>
                      {p.team && (
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                          {p.team}
                        </span>
                      )}
                      {send?.status === "sent" && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full shrink-0">
                          <CheckCircle2 className="w-3 h-3" /> Enviado el {formatDate(send.sentAt)}
                        </span>
                      )}
                      {send?.status === "failed" && !rowProgress && (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-600 px-2 py-0.5 rounded-full shrink-0">
                          <XCircle className="w-3 h-3" /> Último intento falló
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#94a3b8] truncate">{p.evaluateeEmail}</p>
                  </div>
                  <div className="shrink-0 text-xs font-bold flex items-center gap-1.5">
                    {rowProgress?.status === "sending" && <><Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Enviando…</>}
                    {rowProgress?.status === "sent" && <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> <span className="text-emerald-700">Enviado</span></>}
                    {rowProgress?.status === "error" && (
                      <span className="flex items-center gap-1 text-red-600" title={rowProgress.error}>
                        <XCircle className="w-3.5 h-3.5" /> Falló
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Barra de envío */}
          <div className="sticky bottom-4 bg-white rounded-2xl border border-slate-200 shadow-lg px-5 py-4 space-y-3">
            {alreadySentSelectedCount > 0 && !sending && (
              <p className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {alreadySentSelectedCount} de los seleccionados ya recibieron este reporte antes — se les reenviará.
              </p>
            )}
            {sendSummary && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-[#1e293b]">
                  {sending ? `Enviando ${sendSummary.done} de ${sendSummary.total}…` : `Listo: ${sendSummary.done} de ${sendSummary.total} procesados`}
                </p>
                <div className="h-1.5 flex-1 max-w-[200px] bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${(sendSummary.done / sendSummary.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSend}
                disabled={selected.size === 0 || sending}
                className="flex items-center gap-2 bg-[#1e293b] text-white px-5 py-3 rounded-xl font-bold text-sm hover:bg-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Enviando…" : `Enviar a ${selected.size} seleccionado${selected.size !== 1 ? "s" : ""}`}
              </button>
              {sending && (
                <button
                  onClick={() => { stopRef.current = true; setStopRequested(true); }}
                  className="flex items-center gap-1.5 text-xs font-bold text-[#64748b] hover:text-red-600 px-3 py-3 transition-colors"
                >
                  <StopCircle className="w-4 h-4" /> Detener
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
