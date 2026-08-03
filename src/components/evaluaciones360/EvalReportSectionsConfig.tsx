"use client";
import { useState, useMemo } from "react";
import { Plus, Trash2, Check, X, Layers } from "lucide-react";
import type { Evaluation360, CustomReportSection, CommentGroup, BehaviorGroup, EvalType, ReportSectionPosition } from "@/types/evaluaciones360";
import { EVAL_TYPE_LABELS, normalizeQuestions } from "@/types/evaluaciones360";

interface Props {
  evaluation: Evaluation360;
  onSaved: (sections: CustomReportSection[]) => void;
}

const EVAL_TYPES: EvalType[] = ["ascendente", "descendente", "paralela", "autoevaluacion"];
// Tipos que sí alimentan el "resultado propio" de una sección personalizada en el reporte
// (buildEval360ReportData.ts calcula myPeerScore solo con estos tipos, nunca con autoevaluación).
const PEER_EVAL_TYPES: EvalType[] = ["ascendente", "descendente", "paralela"];

const POSITION_LABELS: Record<ReportSectionPosition, string> = {
  "after-alegra": "Después de Alegra",
  "after-team": "Después de Technical Team",
  "after-auto": "Después de Autoevaluación",
  "end": "Al final",
};

export default function EvalReportSectionsConfig({ evaluation, onSaved }: Props) {
  const questionsMap = useMemo(() => normalizeQuestions(evaluation.questions as unknown), [evaluation.questions]);
  const [sections, setSections] = useState<CustomReportSection[]>(evaluation.reportSections ?? []);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Grupos de comportamiento: combinan una pregunta rating equivalente de
  // ascendente/descendente/paralela (elegida a mano) bajo un solo nombre en
  // "Comportamientos evaluados" y "Resultados individuales por comportamiento".
  const [behaviorGroups, setBehaviorGroups] = useState<BehaviorGroup[]>(evaluation.behaviorGroups ?? []);
  const [creatingBehaviorGroup, setCreatingBehaviorGroup] = useState(false);
  const [bgSaving, setBgSaving] = useState(false);
  const [bgSavedMsg, setBgSavedMsg] = useState<string | null>(null);
  const [bgFormError, setBgFormError] = useState<string | null>(null);
  const [bgTitle, setBgTitle] = useState("");
  const [bgQuestionByType, setBgQuestionByType] = useState<Partial<Record<EvalType, string>>>({});

  // Grupos de comentarios: combinan la misma pregunta abierta redactada
  // distinto en ascendente/descendente/paralela bajo un solo título.
  const [commentGroups, setCommentGroups] = useState<CommentGroup[]>(evaluation.commentGroups ?? []);
  const [creatingCommentGroup, setCreatingCommentGroup] = useState(false);
  const [cgSaving, setCgSaving] = useState(false);
  const [cgSavedMsg, setCgSavedMsg] = useState<string | null>(null);
  const [cgFormError, setCgFormError] = useState<string | null>(null);
  const [cgTitle, setCgTitle] = useState("");
  const [cgQuestionByType, setCgQuestionByType] = useState<Partial<Record<EvalType, string>>>({});

  // Formulario de nueva sección
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState<ReportSectionPosition>("end");
  const [weightsById, setWeightsById] = useState<Record<string, number>>({});

  const questionTextById = useMemo(() => {
    const map = new Map<string, string>();
    EVAL_TYPES.forEach((type) => (questionsMap[type] ?? []).forEach((q) => map.set(q.id, q.text)));
    return map;
  }, [questionsMap]);

  const peerQuestionIds = useMemo(() => {
    const ids = new Set<string>();
    PEER_EVAL_TYPES.forEach((type) => (questionsMap[type] ?? []).forEach((q) => ids.add(q.id)));
    return ids;
  }, [questionsMap]);

  // Preguntas abiertas (no rating) por cada tipo peer — de ahí se eligen las
  // que van dentro de un mismo grupo de comentarios.
  const openQuestionsByType = useMemo(() => {
    const map: Partial<Record<EvalType, { id: string; text: string }[]>> = {};
    PEER_EVAL_TYPES.forEach((type) => {
      map[type] = (questionsMap[type] ?? []).filter((q) => q.type !== "rating").map((q) => ({ id: q.id, text: q.text }));
    });
    return map;
  }, [questionsMap]);

  // Preguntas rating por cada tipo peer — de ahí se eligen las que van
  // dentro de un mismo grupo de comportamiento (ej. "Compromiso").
  const ratingQuestionsByType = useMemo(() => {
    const map: Partial<Record<EvalType, { id: string; text: string }[]>> = {};
    PEER_EVAL_TYPES.forEach((type) => {
      map[type] = (questionsMap[type] ?? []).filter((q) => q.type === "rating").map((q) => ({ id: q.id, text: q.text }));
    });
    return map;
  }, [questionsMap]);

  // Preguntas rating que todavía no quedaron en ningún grupo de
  // comportamiento — para avisar al admin qué falta por asignar.
  const ungroupedRatingQuestions = useMemo(() => {
    const grouped = new Set(behaviorGroups.flatMap((g) => g.entries.map((e) => e.questionId)));
    const out: { type: EvalType; id: string; text: string }[] = [];
    PEER_EVAL_TYPES.forEach((type) => {
      (ratingQuestionsByType[type] ?? []).forEach((q) => {
        if (!grouped.has(q.id)) out.push({ type, id: q.id, text: q.text });
      });
    });
    return out;
  }, [behaviorGroups, ratingQuestionsByType]);

  async function persist(next: CustomReportSection[]) {
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/report-sections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportSections: next }),
      });
      if (!res.ok) throw new Error();
      setSections(next);
      onSaved(next);
      setSavedMsg("Guardado");
      setTimeout(() => setSavedMsg(null), 3000);
    } catch {
      setSavedMsg("No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setName(""); setDescription(""); setPosition("end"); setWeightsById({}); setCreating(false); setFormError(null);
  }

  function toggleQuestion(id: string, checked: boolean) {
    setFormError(null);
    setWeightsById((prev) => {
      const next = { ...prev };
      if (checked) next[id] = next[id] ?? 100;
      else delete next[id];
      return next;
    });
  }

  async function handleCreate() {
    const entries = Object.entries(weightsById).map(([questionId, weight]) => ({ questionId, weight }));
    if (!name.trim() || entries.length === 0) return;
    if (!entries.some((e) => peerQuestionIds.has(e.questionId))) {
      setFormError(
        "Incluye al menos una pregunta de Ascendente, Descendente o Paralela. Una sección con solo preguntas " +
        "de Autoevaluación no tiene un resultado propio que comparar y nunca aparecería en ningún reporte."
      );
      return;
    }
    setFormError(null);
    const section: CustomReportSection = {
      id: crypto.randomUUID(),
      name: name.trim(),
      description: description.trim() || undefined,
      position,
      entries,
    };
    await persist([...sections, section]);
    resetForm();
  }

  async function handleDelete(id: string) {
    await persist(sections.filter((s) => s.id !== id));
  }

  async function persistBehaviorGroups(next: BehaviorGroup[]) {
    setBgSaving(true);
    setBgSavedMsg(null);
    try {
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/report-sections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportSections: sections, behaviorGroups: next }),
      });
      if (!res.ok) throw new Error();
      setBehaviorGroups(next);
      setBgSavedMsg("Guardado");
      setTimeout(() => setBgSavedMsg(null), 3000);
    } catch {
      setBgSavedMsg("No se pudo guardar");
    } finally {
      setBgSaving(false);
    }
  }

  function resetBehaviorGroupForm() {
    setBgTitle(""); setBgQuestionByType({}); setCreatingBehaviorGroup(false); setBgFormError(null);
  }

  function setBgQuestion(type: EvalType, questionId: string) {
    setBgFormError(null);
    setBgQuestionByType((prev) => {
      const next = { ...prev };
      if (questionId) next[type] = questionId;
      else delete next[type];
      return next;
    });
  }

  async function handleCreateBehaviorGroup() {
    const entries = PEER_EVAL_TYPES
      .filter((type) => bgQuestionByType[type])
      .map((type) => ({ type, questionId: bgQuestionByType[type]! }));
    if (!bgTitle.trim() || entries.length === 0) return;
    const group: BehaviorGroup = { id: crypto.randomUUID(), title: bgTitle.trim(), entries };
    await persistBehaviorGroups([...behaviorGroups, group]);
    resetBehaviorGroupForm();
  }

  async function handleDeleteBehaviorGroup(id: string) {
    await persistBehaviorGroups(behaviorGroups.filter((g) => g.id !== id));
  }

  async function persistCommentGroups(next: CommentGroup[]) {
    setCgSaving(true);
    setCgSavedMsg(null);
    try {
      const res = await fetch(`/api/evaluaciones360/surveys/${evaluation.id}/report-sections`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportSections: sections, commentGroups: next }),
      });
      if (!res.ok) throw new Error();
      setCommentGroups(next);
      setCgSavedMsg("Guardado");
      setTimeout(() => setCgSavedMsg(null), 3000);
    } catch {
      setCgSavedMsg("No se pudo guardar");
    } finally {
      setCgSaving(false);
    }
  }

  function resetCommentGroupForm() {
    setCgTitle(""); setCgQuestionByType({}); setCreatingCommentGroup(false); setCgFormError(null);
  }

  function setCgQuestion(type: EvalType, questionId: string) {
    setCgFormError(null);
    setCgQuestionByType((prev) => {
      const next = { ...prev };
      if (questionId) next[type] = questionId;
      else delete next[type];
      return next;
    });
  }

  async function handleCreateCommentGroup() {
    const entries = PEER_EVAL_TYPES
      .filter((type) => cgQuestionByType[type])
      .map((type) => ({ type, questionId: cgQuestionByType[type]! }));
    if (!cgTitle.trim()) return;
    if (entries.length < 2) {
      setCgFormError("Elige al menos 2 tipos (ascendente/descendente/paralela) para que tenga sentido agruparlos — con solo 1 no hay nada que combinar.");
      return;
    }
    const group: CommentGroup = { id: crypto.randomUUID(), title: cgTitle.trim(), entries };
    await persistCommentGroups([...commentGroups, group]);
    resetCommentGroupForm();
  }

  async function handleDeleteCommentGroup(id: string) {
    await persistCommentGroups(commentGroups.filter((g) => g.id !== id));
  }

  return (
    <div className="space-y-8">

      {/* ── Recap de solo lectura: preguntas de la encuesta ────────────────── */}
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8] px-1 mb-3">Configuración de la encuesta</p>
        <div className="space-y-4">
          {EVAL_TYPES.filter((type) => (questionsMap[type] ?? []).length > 0).map((type) => (
            <div key={type} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <p className="text-sm font-bold text-[#1e293b] px-5 pt-4 pb-2">{EVAL_TYPE_LABELS[type]}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-2 text-left font-bold text-[#64748b] uppercase tracking-wider">Pregunta</th>
                      <th className="px-3 py-2 text-left font-bold text-[#64748b] uppercase tracking-wider">Categoría</th>
                      <th className="px-3 py-2 text-center font-bold text-[#64748b] uppercase tracking-wider">Peso</th>
                      <th className="px-3 py-2 text-center font-bold text-[#64748b] uppercase tracking-wider">Rango</th>
                      <th className="px-3 py-2 text-center font-bold text-[#64748b] uppercase tracking-wider">Obligatoria</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {(questionsMap[type] ?? []).map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-2 text-[#1e293b] max-w-md">{q.text}</td>
                        <td className="px-3 py-2 text-[#64748b]">{q.category ?? "—"}</td>
                        <td className="px-3 py-2 text-center text-[#64748b]">{q.type === "rating" ? `${q.weight}%` : "—"}</td>
                        <td className="px-3 py-2 text-center text-[#64748b]">{q.type === "rating" ? `${q.ratingMin ?? 1}–${q.ratingMax ?? 10}` : "—"}</td>
                        <td className="px-3 py-2 text-center text-[#64748b]">{q.required ? "Sí" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Grupos de comportamiento ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between px-1 mb-3">
          <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Agrupar comportamientos</p>
          {bgSavedMsg && <span className="text-xs font-semibold text-primary">{bgSavedMsg}</span>}
        </div>
        <p className="text-xs text-[#64748b] px-1 mb-4">
          Arma un grupo (ej. "Compromiso") eligiendo cuál pregunta calificada de ascendente, cuál de descendente y cuál
          de paralela corresponde a ese mismo comportamiento. "Comportamientos evaluados" y "Resultados individuales
          por comportamiento" muestran el promedio de cada grupo (respetando el peso propio de cada pregunta) en vez de
          una fila por pregunta individual. Sin ningún grupo definido, esos bloques siguen mostrando cada pregunta por
          separado, como siempre.
        </p>

        <div className="space-y-3">
          {behaviorGroups.map((group) => (
            <div key={group.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#1e293b]">{group.title}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {group.entries.map((e) => (
                      <span key={`${e.type}-${e.questionId}`} className="text-[10px] font-semibold bg-slate-50 text-[#64748b] px-2 py-1 rounded-lg border border-slate-100">
                        {EVAL_TYPE_LABELS[e.type]}: {(questionTextById.get(e.questionId) ?? "Pregunta eliminada").slice(0, 40)}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteBehaviorGroup(group.id)}
                  disabled={bgSaving}
                  className="p-2 text-[#94a3b8] hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                  title="Eliminar grupo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {behaviorGroups.length === 0 && !creatingBehaviorGroup && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
              <p className="text-sm text-[#64748b]">Todavía no hay grupos de comportamiento definidos.</p>
            </div>
          )}
        </div>

        {behaviorGroups.length > 0 && ungroupedRatingQuestions.length > 0 && (
          <div className="mt-3 bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-xs font-bold text-amber-800 mb-1.5">
              {ungroupedRatingQuestions.length} pregunta{ungroupedRatingQuestions.length === 1 ? "" : "s"} sin agrupar todavía
            </p>
            <div className="flex flex-wrap gap-1.5">
              {ungroupedRatingQuestions.map((q) => (
                <span key={`${q.type}-${q.id}`} className="text-[10px] font-semibold bg-white text-amber-800 px-2 py-1 rounded-lg border border-amber-200">
                  {EVAL_TYPE_LABELS[q.type]}: {q.text.slice(0, 40)}
                </span>
              ))}
            </div>
          </div>
        )}

        {!creatingBehaviorGroup ? (
          <button
            onClick={() => setCreatingBehaviorGroup(true)}
            className="mt-4 flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/5 px-4 py-2.5 rounded-xl border border-primary/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo grupo
          </button>
        ) : (
          <div className="mt-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-[#1e293b]">Nuevo grupo de comportamiento</p>
              <button onClick={resetBehaviorGroupForm} className="p-1.5 text-[#94a3b8] hover:text-[#64748b] rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#64748b] mb-1.5">Nombre del grupo (se muestra en el PDF)</label>
              <input
                value={bgTitle}
                onChange={(e) => setBgTitle(e.target.value)}
                placeholder="ej. Compromiso"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase text-[#64748b]">Pregunta equivalente por tipo</label>
              {PEER_EVAL_TYPES.map((type) => (
                <div key={type}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8] mb-1.5">{EVAL_TYPE_LABELS[type]}</p>
                  <select
                    value={bgQuestionByType[type] ?? ""}
                    onChange={(e) => setBgQuestion(type, e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">— Ninguna —</option>
                    {(ratingQuestionsByType[type] ?? []).map((q) => (
                      <option key={q.id} value={q.id}>{q.text}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {bgFormError && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                {bgFormError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={resetBehaviorGroupForm} className="px-4 py-2 text-xs font-bold text-[#64748b] hover:bg-slate-100 rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleCreateBehaviorGroup}
                disabled={bgSaving || !bgTitle.trim() || Object.keys(bgQuestionByType).length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1e293b] text-white rounded-xl text-xs font-bold hover:bg-primary transition-all disabled:opacity-40"
              >
                {bgSaving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar grupo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Secciones personalizadas de análisis ───────────────────────────── */}
      <div>
        <div className="flex items-center justify-between px-1 mb-3">
          <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Secciones adicionales del reporte</p>
          {savedMsg && <span className="text-xs font-semibold text-primary">{savedMsg}</span>}
        </div>
        <p className="text-xs text-[#64748b] px-1 mb-4">
          Toma cualquier subconjunto de preguntas ya existentes (de cualquier tipo) y arma una sección de análisis
          adicional en el reporte PDF — ej. "Alineación Cultural" — con un peso independiente del que ya tienen
          en su categoría normal.
        </p>

        <div className="space-y-3">
          {sections.map((section) => (
            <div key={section.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Layers className="w-4 h-4 text-primary shrink-0" />
                    <p className="font-bold text-[#1e293b]">{section.name}</p>
                    <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {POSITION_LABELS[section.position ?? "end"]}
                    </span>
                  </div>
                  {section.description && <p className="text-xs text-[#64748b] mt-1">{section.description}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {section.entries.map((e) => (
                      <span key={e.questionId} className="text-[10px] font-semibold bg-slate-50 text-[#64748b] px-2 py-1 rounded-lg border border-slate-100">
                        {(questionTextById.get(e.questionId) ?? "Pregunta eliminada").slice(0, 40)} · {e.weight}%
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(section.id)}
                  disabled={saving}
                  className="p-2 text-[#94a3b8] hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                  title="Eliminar sección"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {sections.length === 0 && !creating && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
              <p className="text-sm text-[#64748b]">Todavía no hay secciones adicionales definidas.</p>
            </div>
          )}
        </div>

        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="mt-4 flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/5 px-4 py-2.5 rounded-xl border border-primary/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nueva sección
          </button>
        ) : (
          <div className="mt-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-[#1e293b]">Nueva sección</p>
              <button onClick={resetForm} className="p-1.5 text-[#94a3b8] hover:text-[#64748b] rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#64748b] mb-1.5">Nombre</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ej. Alineación Cultural"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-[#64748b] mb-1.5">Descripción (opcional)</label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Se muestra bajo el título del gráfico en el PDF"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-[#64748b] mb-1.5">Posición en el documento</label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as ReportSectionPosition)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors cursor-pointer"
              >
                {(Object.keys(POSITION_LABELS) as ReportSectionPosition[]).map((p) => (
                  <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#64748b] mb-2">Preguntas incluidas y su peso</label>
              <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                {EVAL_TYPES.filter((type) => (questionsMap[type] ?? []).filter((q) => q.type === "rating").length > 0).map((type) => (
                  <div key={type}>
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8] mb-1.5">{EVAL_TYPE_LABELS[type]}</p>
                    <div className="space-y-1.5">
                      {(questionsMap[type] ?? []).filter((q) => q.type === "rating").map((q) => {
                        const checked = q.id in weightsById;
                        return (
                          <div key={q.id} className="flex items-center gap-2.5 bg-slate-50 rounded-xl px-3 py-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => toggleQuestion(q.id, e.target.checked)}
                              className="w-3.5 h-3.5 accent-primary shrink-0"
                            />
                            <span className="text-xs text-[#1e293b] flex-1 min-w-0 truncate">{q.text}</span>
                            {checked && (
                              <div className="flex items-center gap-1 shrink-0">
                                <input
                                  type="number"
                                  value={weightsById[q.id]}
                                  onChange={(e) => setWeightsById((prev) => ({ ...prev, [q.id]: parseFloat(e.target.value) || 0 }))}
                                  min={0} max={100} step={1}
                                  className="w-16 text-center text-xs font-bold bg-white border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-primary"
                                />
                                <span className="text-[10px] font-bold text-[#64748b]">%</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {formError && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={resetForm} className="px-4 py-2 text-xs font-bold text-[#64748b] hover:bg-slate-100 rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim() || Object.keys(weightsById).length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1e293b] text-white rounded-xl text-xs font-bold hover:bg-primary transition-all disabled:opacity-40"
              >
                {saving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar sección
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Grupos de comentarios ───────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between px-1 mb-3">
          <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Agrupar comentarios</p>
          {cgSavedMsg && <span className="text-xs font-semibold text-primary">{cgSavedMsg}</span>}
        </div>
        <p className="text-xs text-[#64748b] px-1 mb-4">
          Ascendente, descendente y paralela suelen hacer la misma pregunta abierta redactada distinto (ej. "tu líder" /
          "este colaborador" / "tu compañero/a"). Agrúpalas aquí para que salgan bajo un solo título de Comentarios en
          el PDF, con las respuestas de los 3 tipos juntas, en vez de una tarjeta repetida por cada tipo. Autoevaluación
          nunca se incluye.
        </p>

        <div className="space-y-3">
          {commentGroups.map((group) => (
            <div key={group.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-[#1e293b]">{group.title}</p>
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {group.entries.map((e) => (
                      <span key={`${e.type}-${e.questionId}`} className="text-[10px] font-semibold bg-slate-50 text-[#64748b] px-2 py-1 rounded-lg border border-slate-100">
                        {EVAL_TYPE_LABELS[e.type]}: {(questionTextById.get(e.questionId) ?? "Pregunta eliminada").slice(0, 40)}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteCommentGroup(group.id)}
                  disabled={cgSaving}
                  className="p-2 text-[#94a3b8] hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
                  title="Eliminar grupo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {commentGroups.length === 0 && !creatingCommentGroup && (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
              <p className="text-sm text-[#64748b]">Todavía no hay grupos de comentarios definidos.</p>
            </div>
          )}
        </div>

        {!creatingCommentGroup ? (
          <button
            onClick={() => setCreatingCommentGroup(true)}
            className="mt-4 flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/5 px-4 py-2.5 rounded-xl border border-primary/20 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nuevo grupo
          </button>
        ) : (
          <div className="mt-4 bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-[#1e293b]">Nuevo grupo de comentarios</p>
              <button onClick={resetCommentGroupForm} className="p-1.5 text-[#94a3b8] hover:text-[#64748b] rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-[#64748b] mb-1.5">Título (se muestra en el PDF)</label>
              <input
                value={cgTitle}
                onChange={(e) => setCgTitle(e.target.value)}
                placeholder="ej. ¿Cuál es su mayor fortaleza actualmente?"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary transition-colors"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold uppercase text-[#64748b]">Pregunta equivalente por tipo</label>
              {PEER_EVAL_TYPES.map((type) => (
                <div key={type}>
                  <p className="text-[10px] font-black uppercase tracking-wider text-[#94a3b8] mb-1.5">{EVAL_TYPE_LABELS[type]}</p>
                  <select
                    value={cgQuestionByType[type] ?? ""}
                    onChange={(e) => setCgQuestion(type, e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-slate-50 outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="">— Ninguna —</option>
                    {(openQuestionsByType[type] ?? []).map((q) => (
                      <option key={q.id} value={q.id}>{q.text}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            {cgFormError && (
              <p className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">
                {cgFormError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={resetCommentGroupForm} className="px-4 py-2 text-xs font-bold text-[#64748b] hover:bg-slate-100 rounded-xl transition-colors">
                Cancelar
              </button>
              <button
                onClick={handleCreateCommentGroup}
                disabled={cgSaving || !cgTitle.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#1e293b] text-white rounded-xl text-xs font-bold hover:bg-primary transition-all disabled:opacity-40"
              >
                {cgSaving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                Guardar grupo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
