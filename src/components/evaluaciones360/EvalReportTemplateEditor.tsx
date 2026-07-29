"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Check, Image as ImageIcon, Trash2, Info } from "lucide-react";
import type { Evaluation360 } from "@/types/evaluaciones360";
import type { ReportTemplateConfig, ReportTemplateDensity } from "@/lib/reportTemplateConfig";
import { DEFAULT_TEMPLATE_CONFIG } from "@/lib/reportTemplateConfig";

interface Props {
  evaluation: Evaluation360;
}

interface EvaluateeOption {
  evaluateeEmail: string;
  evaluateeName: string;
}

const DENSITY_OPTIONS: { value: ReportTemplateDensity; label: string }[] = [
  { value: "compacto", label: "Compacto" },
  { value: "normal", label: "Normal" },
  { value: "amplio", label: "Amplio" },
];

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function EvalReportTemplateEditor({ evaluation }: Props) {
  const [config, setConfig] = useState<ReportTemplateConfig>(DEFAULT_TEMPLATE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const [evaluatees, setEvaluatees] = useState<EvaluateeOption[]>([]);
  const [evaluateeEmail, setEvaluateeEmail] = useState("");

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  // Cargar config guardada
  useEffect(() => {
    fetch("/api/evaluaciones360/report-template")
      .then((r) => r.json())
      .then((d) => setConfig({ ...DEFAULT_TEMPLATE_CONFIG, ...d, colors: { ...DEFAULT_TEMPLATE_CONFIG.colors, ...d.colors }, logo: { ...DEFAULT_TEMPLATE_CONFIG.logo, ...d.logo }, layout: { ...DEFAULT_TEMPLATE_CONFIG.layout, ...d.layout } }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Cargar evaluados elegibles de esta encuesta (para elegir a quién previsualizar)
  useEffect(() => {
    fetch(`/api/evaluaciones360/surveys/${evaluation.id}/results`)
      .then((r) => r.json())
      .then((d) => {
        const results = (d.results ?? []) as { evaluateeEmail: string; evaluateeName: string }[];
        setEvaluatees(results);
        if (results.length > 0) setEvaluateeEmail(results[0].evaluateeEmail);
      })
      .catch(() => {});
  }, [evaluation.id]);

  const runPreview = useCallback(async (cfg: ReportTemplateConfig, email: string) => {
    if (!email) return;
    const myRequestId = ++requestIdRef.current;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/evaluaciones360/report-template/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId: evaluation.id, evaluateeEmail: email, config: cfg }),
      });
      if (myRequestId !== requestIdRef.current) return; // una vista previa más nueva ya está en curso
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPreviewError(err.error ?? "No se pudo generar la vista previa");
        return;
      }
      const blob = await res.blob();
      if (myRequestId !== requestIdRef.current) return;
      const url = URL.createObjectURL(blob);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } catch {
      if (myRequestId === requestIdRef.current) setPreviewError("Error de red generando la vista previa");
    } finally {
      if (myRequestId === requestIdRef.current) setPreviewLoading(false);
    }
  }, [evaluation.id]);

  // Debounce: regenerar la vista previa ~700ms después del último cambio.
  useEffect(() => {
    if (loading || !evaluateeEmail) return;
    const t = setTimeout(() => runPreview(config, evaluateeEmail), 700);
    return () => clearTimeout(t);
  }, [config, evaluateeEmail, loading, runPreview]);

  useEffect(() => () => { if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current); }, []);

  async function handleSave() {
    setSaving(true);
    setSavedMsg(null);
    try {
      const res = await fetch("/api/evaluaciones360/report-template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      setSavedMsg(res.ok ? "Guardado — aplica a todos los reportes 360° desde ahora" : "No se pudo guardar");
    } catch {
      setSavedMsg("Error de red al guardar");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedMsg(null), 5000);
    }
  }

  async function handleImageUpload(kind: "logoDataUri" | "headerBgDataUri", file: File | undefined) {
    if (!file) return;
    const dataUri = await fileToDataUri(file);
    setConfig((prev) => ({ ...prev, logo: { ...prev.logo, [kind]: dataUri } }));
  }

  const setColor = (key: keyof ReportTemplateConfig["colors"], value: string) =>
    setConfig((prev) => ({ ...prev, colors: { ...prev.colors, [key]: value } }));
  const setLayout = <K extends keyof ReportTemplateConfig["layout"]>(key: K, value: ReportTemplateConfig["layout"][K]) =>
    setConfig((prev) => ({ ...prev, layout: { ...prev.layout, [key]: value } }));

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-2xl px-4 py-3 text-xs text-blue-700">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Esta plantilla es <strong>global</strong>: aplica a todos los reportes 360° (de cualquier encuesta), no solo a esta. Estás previsualizando con datos reales de <strong>{evaluation.title}</strong>.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">

        {/* ── Panel de ajustes ─────────────────────────────────────────── */}
        <div className="space-y-5">

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Colores</p>
            {([
              ["primary", "Primario (barras/acentos)"],
              ["primaryDark", "Primario oscuro (wordmark)"],
              ["text", "Texto principal"],
              ["textSecondary", "Texto secundario"],
              ["background", "Fondo de encabezado"],
              ["cardBorder", "Borde de tarjetas"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <label className="text-xs font-semibold text-[#1e293b]">{label}</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={config.colors[key]} onChange={(e) => setColor(key, e.target.value)} className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer" />
                  <span className="text-[10px] font-mono text-[#94a3b8] w-16">{config.colors[key]}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Logo y encabezado</p>
            {([
              ["logoDataUri", "Logo"],
              ["headerBgDataUri", "Fondo decorativo del encabezado"],
            ] as const).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  {config.logo[key]
                    ? <img src={config.logo[key]!} alt="" className="w-10 h-10 object-contain rounded-lg border border-slate-100 bg-slate-50" />
                    : <div className="w-10 h-10 rounded-lg border border-dashed border-slate-200 flex items-center justify-center text-slate-300"><ImageIcon className="w-4 h-4" /></div>}
                  <span className="text-xs font-semibold text-[#1e293b] truncate">{label}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <label className="text-[10px] font-bold text-primary bg-primary/5 hover:bg-primary/10 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors">
                    Subir
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(key, e.target.files?.[0])} />
                  </label>
                  {config.logo[key] && (
                    <button onClick={() => setConfig((prev) => ({ ...prev, logo: { ...prev.logo, [key]: null } }))} className="p-1.5 text-[#94a3b8] hover:text-red-500 rounded-lg" title="Quitar (usar el archivo por defecto)">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-4">
            <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Márgenes y tamaños</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                ["pageMarginX", "Margen horizontal"],
                ["pageMarginY", "Margen vertical"],
                ["cardPadding", "Padding de tarjetas"],
                ["cardRadius", "Radio de tarjetas"],
              ] as const).map(([key, label]) => (
                <div key={key}>
                  <label className="block text-[10px] font-bold text-[#64748b] mb-1">{label} (px)</label>
                  <input
                    type="number" min={0} max={80}
                    value={config.layout[key]}
                    onChange={(e) => setLayout(key, parseInt(e.target.value) || 0)}
                    className="w-full text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-[#64748b] mb-1">Densidad (tamaño de gráficos)</label>
              <select
                value={config.layout.density}
                onChange={(e) => setLayout("density", e.target.value as ReportTemplateDensity)}
                className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-2 outline-none focus:border-primary cursor-pointer"
              >
                {DENSITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#1e293b] text-white rounded-xl text-xs font-bold hover:bg-primary transition-all disabled:opacity-40"
            >
              {saving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Guardar plantilla
            </button>
            {savedMsg && <span className="text-xs font-semibold text-[#64748b]">{savedMsg}</span>}
          </div>
        </div>

        {/* ── Vista previa en vivo ─────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
          <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center gap-3">
            <span className="text-xs font-bold text-[#1e293b]">Vista previa —</span>
            <select
              value={evaluateeEmail}
              onChange={(e) => setEvaluateeEmail(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-[#1e293b] outline-none focus:border-primary cursor-pointer flex-1 min-w-0"
            >
              {evaluatees.map((p) => (
                <option key={p.evaluateeEmail} value={p.evaluateeEmail}>{p.evaluateeName || p.evaluateeEmail}</option>
              ))}
            </select>
            {previewLoading && <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
          </div>
          <div className="flex-1 relative">
            {previewError ? (
              <div className="flex items-center justify-center h-full p-8 text-center">
                <p className="text-sm text-red-500 font-semibold">{previewError}</p>
              </div>
            ) : previewUrl ? (
              <iframe key={previewUrl} src={previewUrl} title="Vista previa del reporte" className="w-full h-full border-none absolute inset-0" style={{ minHeight: "600px" }} />
            ) : (
              <div className="flex items-center justify-center h-full p-8 text-center text-sm text-[#94a3b8]">
                {evaluatees.length === 0 ? "Esta encuesta todavía no tiene evaluaciones enviadas." : "Generando vista previa…"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
