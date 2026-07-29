"use client";
import { useState, useMemo } from "react";
import { Plus, Trash2, Check, X, Layers } from "lucide-react";
import type { Evaluation360, CustomReportSection, EvalType, ReportSectionPosition } from "@/types/evaluaciones360";
import { EVAL_TYPE_LABELS, normalizeQuestions } from "@/types/evaluaciones360";

interface Props {
  evaluation: Evaluation360;
  onSaved: (sections: CustomReportSection[]) => void;
}

const EVAL_TYPES: EvalType[] = ["ascendente", "descendente", "paralela", "autoevaluacion"];

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
    setName(""); setDescription(""); setPosition("end"); setWeightsById({}); setCreating(false);
  }

  function toggleQuestion(id: string, checked: boolean) {
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
    </div>
  );
}
