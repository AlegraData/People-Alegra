"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Check, Image as ImageIcon, Trash2, Info, GripVertical, AlignLeft, AlignCenter, AlignRight, ChevronDown, Eye, FileText, Plus } from "lucide-react";
import type { Evaluation360 } from "@/types/evaluaciones360";
import { normalizeQuestions } from "@/types/evaluaciones360";
import type { ReportTemplateConfig, ReportTemplateDensity, CustomTextBox } from "@/lib/reportTemplateConfig";
import type { ReportBlockId } from "@/lib/reportTemplateConfig";
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

const BLOCK_LABELS: Record<ReportBlockId, string> = {
  competencias: "Competencias analizadas",
  comparativos: "Comparativo de tus resultados",
  comportamientos: "Comportamientos evaluados (Fortalezas / Puntos de mejora)",
  ranking: "Resultados individuales por comportamiento",
  comentarios: "Comentarios",
};

const CATEGORY_ICON_OPTIONS: { value: string; label: string; file: string }[] = [
  { value: "compromiso", label: "Medalla", file: "compromiso.png" },
  { value: "conocimiento", label: "Herramientas", file: "conocimiento.png" },
  { value: "comunicacion", label: "Chat", file: "comunicacion.png" },
  { value: "trabajoEquipo", label: "Personas", file: "trabajo-equipo.png" },
];

function CopyField({ label, value, onChange, hint, multiline }: { label: string; value: string; onChange: (v: string) => void; hint?: string; multiline?: boolean }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-[#64748b] mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value} onChange={(e) => onChange(e.target.value)} rows={2}
          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary resize-none"
        />
      ) : (
        <input
          type="text" value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary"
        />
      )}
      {hint && <p className="text-[9px] text-[#94a3b8] mt-1">{hint}</p>}
    </div>
  );
}

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Edición por arrastre sobre la vista previa en vivo ──────────────────────
// La vista previa en vivo carga el HTML real del reporte (mismo motor que el
// PDF final, ver `format:"html"` en el endpoint de preview) directamente en el
// iframe vía Blob URL — al ser mismo-origen, se puede alcanzar
// `iframe.contentDocument` sin postMessage. Las manijas se dibujan como divs
// superpuestos inyectados en ESE documento (no forman parte de la plantilla
// que se envía/descarga), y durante el arrastre solo se aplica un `transform`
// visual instantáneo; el valor real (que sí re-renderiza con el motor
// verdadero) se confirma al soltar el mouse.
function positionHandleAt(handle: HTMLElement, target: HTMLElement, corner: "top-right" | "bottom-right" | "top-left") {
  const doc = target.ownerDocument;
  const scrollY = doc.documentElement.scrollTop || doc.body.scrollTop;
  const rect = target.getBoundingClientRect();
  const top = (corner === "bottom-right" ? rect.bottom : rect.top) + scrollY - 10;
  const left = (corner === "top-left" ? rect.left : rect.right) - 10;
  handle.style.top = `${top}px`;
  handle.style.left = `${left}px`;
}

function createHandle(doc: Document, symbol: string, cursor: string): HTMLDivElement {
  const handle = doc.createElement("div");
  handle.textContent = symbol;
  handle.style.position = "absolute";
  handle.style.cursor = cursor;
  handle.style.fontSize = "11px";
  handle.style.lineHeight = "1";
  handle.style.width = "20px";
  handle.style.height = "20px";
  handle.style.display = "flex";
  handle.style.alignItems = "center";
  handle.style.justifyContent = "center";
  handle.style.background = "#00D6BC";
  handle.style.color = "#fff";
  handle.style.borderRadius = "9999px";
  handle.style.boxShadow = "0 1px 4px rgba(0,0,0,0.35)";
  handle.style.userSelect = "none";
  handle.style.zIndex = "9999";
  return handle;
}

// Arrastre libre (nudge x/y sobre la posición actual) — usado para el logo y,
// con baseX/baseY = x/y guardados, para reposicionar un cuadro de texto.
function makeDraggable(target: HTMLElement, baseX: number, baseY: number, onCommit: (x: number, y: number) => void, corner: "top-right" | "top-left" = "top-right") {
  const doc = target.ownerDocument;
  const handle = createHandle(doc, "✥", "grab");
  positionHandleAt(handle, target, corner);
  doc.body.appendChild(handle);

  let startX = 0, startY = 0, dragging = false;
  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const x = baseX + (e.clientX - startX);
    const y = baseY + (e.clientY - startY);
    target.style.transform = `translate(${x}px, ${y}px)`;
  };
  const onUp = (e: MouseEvent) => {
    if (!dragging) return;
    dragging = false;
    doc.removeEventListener("mousemove", onMove);
    doc.removeEventListener("mouseup", onUp);
    onCommit(Math.round(baseX + (e.clientX - startX)), Math.round(baseY + (e.clientY - startY)));
  };
  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onUp);
    e.preventDefault();
  });
}

// Redimensionar arrastrando (feedback visual con `scale`, valor real confirmado al soltar).
function makeResizable(target: HTMLElement, baseValue: number, min: number, max: number, sensitivity: number, onCommit: (value: number) => void) {
  const doc = target.ownerDocument;
  const handle = createHandle(doc, "⤡", "nwse-resize");
  positionHandleAt(handle, target, "bottom-right");
  doc.body.appendChild(handle);

  let startX = 0, dragging = false;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    const delta = (e.clientX - startX) * sensitivity;
    const factor = clamp(baseValue + delta) / baseValue;
    target.style.transform = `scale(${factor})`;
  };
  const onUp = (e: MouseEvent) => {
    if (!dragging) return;
    dragging = false;
    doc.removeEventListener("mousemove", onMove);
    doc.removeEventListener("mouseup", onUp);
    target.style.transform = "";
    const delta = (e.clientX - startX) * sensitivity;
    onCommit(Math.round(clamp(baseValue + delta)));
  };
  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onUp);
    e.preventDefault();
  });
}

// Redimensionar el ANCHO de un cuadro de texto: a diferencia de makeResizable
// (que aproxima con `scale` porque el valor real recalcula tamaños de fuente),
// el ancho es una propiedad de caja real — se aplica directo durante el
// arrastre (el texto reenvuelve en vivo con el ancho real, sin aproximación).
function makeWidthResizable(target: HTMLElement, baseWidth: number, min: number, max: number, onCommit: (width: number) => void) {
  const doc = target.ownerDocument;
  const handle = createHandle(doc, "↔", "ew-resize");
  positionHandleAt(handle, target, "bottom-right");
  doc.body.appendChild(handle);

  let startX = 0, dragging = false;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const onMove = (e: MouseEvent) => {
    if (!dragging) return;
    target.style.width = `${clamp(baseWidth + (e.clientX - startX))}px`;
  };
  const onUp = (e: MouseEvent) => {
    if (!dragging) return;
    dragging = false;
    doc.removeEventListener("mousemove", onMove);
    doc.removeEventListener("mouseup", onUp);
    onCommit(Math.round(clamp(baseWidth + (e.clientX - startX))));
  };
  handle.addEventListener("mousedown", (e) => {
    dragging = true;
    startX = e.clientX;
    doc.addEventListener("mousemove", onMove);
    doc.addEventListener("mouseup", onUp);
    e.preventDefault();
  });
}

// Manija de borrado (clic simple, no arrastre) para un cuadro de texto.
function makeDeletable(target: HTMLElement, onDelete: () => void) {
  const doc = target.ownerDocument;
  const handle = createHandle(doc, "✕", "pointer");
  handle.style.background = "#ef4444";
  positionHandleAt(handle, target, "top-right");
  doc.body.appendChild(handle);
  handle.addEventListener("mousedown", (e) => e.stopPropagation());
  handle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete();
  });
}

function attachEditHandles(
  doc: Document,
  config: ReportTemplateConfig,
  setLogoOffset: (x: number, y: number) => void,
  setCompetenciasIconSize: (px: number) => void,
  setBlockFontScalePct: (block: ReportBlockId, pct: number) => void,
  updateTextBox: (id: string, patch: Partial<CustomTextBox>) => void,
  removeTextBox: (id: string) => void
) {
  const logoEl = doc.querySelector<HTMLElement>('[data-edit="logo"]');
  if (logoEl) makeDraggable(logoEl, config.logo.headerOffsetX, config.logo.headerOffsetY, setLogoOffset);

  const iconEl = doc.querySelector<HTMLElement>('[data-edit="icon"]');
  if (iconEl) makeResizable(iconEl, config.blocks.competencias.iconSize, 12, 40, 0.15, setCompetenciasIconSize);

  doc.querySelectorAll<HTMLElement>("[data-edit-block]").forEach((blockEl) => {
    const blockId = blockEl.getAttribute("data-edit-block") as ReportBlockId;
    const currentPct = Math.round(config.blocks[blockId].fontScale * 100);
    makeResizable(blockEl, currentPct, 70, 150, 0.3, (pct) => setBlockFontScalePct(blockId, pct));
  });

  doc.querySelectorAll<HTMLElement>("[data-edit-textbox]").forEach((boxEl) => {
    const id = boxEl.getAttribute("data-edit-textbox")!;
    const box = config.customTextBoxes.find((b) => b.id === id);
    if (!box) return;

    makeDraggable(boxEl, box.x, box.y, (x, y) => updateTextBox(id, { x, y }), "top-left");
    makeWidthResizable(boxEl, box.width, 60, 700, (width) => updateTextBox(id, { width }));
    makeDeletable(boxEl, () => removeTextBox(id));

    // Editar el texto directamente en la vista previa (solo en el editor —
    // no forma parte del HTML real que se envía/descarga).
    boxEl.contentEditable = "true";
    boxEl.style.outline = "none";
    boxEl.addEventListener("blur", () => {
      const text = boxEl.textContent ?? "";
      if (text !== box.text) updateTextBox(id, { text });
    });
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
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // "live": HTML en vivo (arrastrable). "pdf": el PDF real (paginación exacta),
  // generado bajo demanda ya que pasa por Puppeteer.
  const [viewMode, setViewMode] = useState<"live" | "pdf">("live");
  const [realPdfUrl, setRealPdfUrl] = useState<string | null>(null);
  const [realPdfLoading, setRealPdfLoading] = useState(false);
  const realPdfUrlRef = useRef<string | null>(null);

  const [openBlock, setOpenBlock] = useState<ReportBlockId | null>(null);
  const dragIdRef = useRef<ReportBlockId | null>(null);

  // Categorías reales de esta encuesta (para el mapeo de íconos del bloque "Competencias")
  const categories = useMemo(() => {
    const questionsMap = normalizeQuestions(evaluation.questions as unknown);
    const set = new Set<string>();
    (["ascendente", "descendente", "paralela"] as const).forEach((type) =>
      (questionsMap[type] ?? []).filter((q) => q.type === "rating").forEach((q) => { if (q.category) set.add(q.category); })
    );
    return [...set];
  }, [evaluation.questions]);

  // Cargar config guardada
  useEffect(() => {
    fetch("/api/evaluaciones360/report-template")
      .then((r) => r.json())
      .then((d) => setConfig({
        ...DEFAULT_TEMPLATE_CONFIG, ...d,
        colors: { ...DEFAULT_TEMPLATE_CONFIG.colors, ...d.colors },
        logo: { ...DEFAULT_TEMPLATE_CONFIG.logo, ...d.logo },
        layout: { ...DEFAULT_TEMPLATE_CONFIG.layout, ...d.layout },
        blocks: {
          order: d.blocks?.order?.length ? d.blocks.order : DEFAULT_TEMPLATE_CONFIG.blocks.order,
          competencias: { ...DEFAULT_TEMPLATE_CONFIG.blocks.competencias, ...d.blocks?.competencias, categoryIcons: { ...d.blocks?.competencias?.categoryIcons } },
          comparativos: { ...DEFAULT_TEMPLATE_CONFIG.blocks.comparativos, ...d.blocks?.comparativos },
          comportamientos: { ...DEFAULT_TEMPLATE_CONFIG.blocks.comportamientos, ...d.blocks?.comportamientos },
          ranking: { ...DEFAULT_TEMPLATE_CONFIG.blocks.ranking, ...d.blocks?.ranking },
          comentarios: { ...DEFAULT_TEMPLATE_CONFIG.blocks.comentarios, ...d.blocks?.comentarios },
        },
        copy: {
          header: { ...DEFAULT_TEMPLATE_CONFIG.copy.header, ...d.copy?.header },
          competencias: { ...DEFAULT_TEMPLATE_CONFIG.copy.competencias, ...d.copy?.competencias, categoryDescriptions: { ...d.copy?.competencias?.categoryDescriptions } },
          comparativos: {
            ...DEFAULT_TEMPLATE_CONFIG.copy.comparativos, ...d.copy?.comparativos,
            alegra: { ...DEFAULT_TEMPLATE_CONFIG.copy.comparativos.alegra, ...d.copy?.comparativos?.alegra },
            team: { ...DEFAULT_TEMPLATE_CONFIG.copy.comparativos.team, ...d.copy?.comparativos?.team },
            auto: { ...DEFAULT_TEMPLATE_CONFIG.copy.comparativos.auto, ...d.copy?.comparativos?.auto },
          },
          comportamientos: { ...DEFAULT_TEMPLATE_CONFIG.copy.comportamientos, ...d.copy?.comportamientos },
          ranking: { ...DEFAULT_TEMPLATE_CONFIG.copy.ranking, ...d.copy?.ranking },
          comentarios: { ...DEFAULT_TEMPLATE_CONFIG.copy.comentarios, ...d.copy?.comentarios },
          footer: { ...DEFAULT_TEMPLATE_CONFIG.copy.footer, ...d.copy?.footer },
        },
      }))
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
        body: JSON.stringify({ surveyId: evaluation.id, evaluateeEmail: email, config: cfg, format: "html" }),
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
  useEffect(() => () => { if (realPdfUrlRef.current) URL.revokeObjectURL(realPdfUrlRef.current); }, []);

  async function loadRealPdf() {
    if (!evaluateeEmail) return;
    setRealPdfLoading(true);
    try {
      const res = await fetch("/api/evaluaciones360/report-template/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surveyId: evaluation.id, evaluateeEmail, config, format: "pdf" }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (realPdfUrlRef.current) URL.revokeObjectURL(realPdfUrlRef.current);
      realPdfUrlRef.current = url;
      setRealPdfUrl(url);
    } finally {
      setRealPdfLoading(false);
    }
  }

  function handleViewModeChange(mode: "live" | "pdf") {
    setViewMode(mode);
    if (mode === "pdf") loadRealPdf();
  }

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
  const setLogoAlign = (align: ReportTemplateConfig["logo"]["align"]) =>
    setConfig((prev) => ({ ...prev, logo: { ...prev.logo, align } }));
  const setLogoSize = (size: number) =>
    setConfig((prev) => ({ ...prev, logo: { ...prev.logo, size } }));
  const setLogoOffset = useCallback((headerOffsetX: number, headerOffsetY: number) =>
    setConfig((prev) => ({ ...prev, logo: { ...prev.logo, headerOffsetX, headerOffsetY } })), []);
  const setBlockFontScalePct = useCallback((block: ReportBlockId, pct: number) =>
    setConfig((prev) => ({
      ...prev,
      blocks: { ...prev.blocks, [block]: { ...prev.blocks[block], fontScale: pct / 100 } } as ReportTemplateConfig["blocks"],
    })), []);
  const setCompetenciasIconSize = useCallback((px: number) =>
    setConfig((prev) => ({ ...prev, blocks: { ...prev.blocks, competencias: { ...prev.blocks.competencias, iconSize: px } } })), []);
  const setCategoryIcon = (category: string, iconKey: string) =>
    setConfig((prev) => {
      const next = { ...prev.blocks.competencias.categoryIcons };
      if (iconKey === "auto") delete next[category];
      else if (iconKey === "none") next[category] = null;
      else next[category] = iconKey;
      return { ...prev, blocks: { ...prev.blocks, competencias: { ...prev.blocks.competencias, categoryIcons: next } } };
    });

  const addTextBox = useCallback(() =>
    setConfig((prev) => ({
      ...prev,
      customTextBoxes: [
        ...prev.customTextBoxes,
        { id: crypto.randomUUID(), text: "Nuevo texto", x: 40, y: 40, width: 200, color: prev.colors.text, fontSize: 12 },
      ],
    })), []);
  const updateTextBox = useCallback((id: string, patch: Partial<CustomTextBox>) =>
    setConfig((prev) => ({
      ...prev,
      customTextBoxes: prev.customTextBoxes.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    })), []);
  const removeTextBox = useCallback((id: string) =>
    setConfig((prev) => ({ ...prev, customTextBoxes: prev.customTextBoxes.filter((b) => b.id !== id) })), []);

  const handleIframeLoad = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    attachEditHandles(doc, config, setLogoOffset, setCompetenciasIconSize, setBlockFontScalePct, updateTextBox, removeTextBox);
  }, [config, setLogoOffset, setCompetenciasIconSize, setBlockFontScalePct, updateTextBox, removeTextBox]);

  const setHeaderCopy = (key: keyof ReportTemplateConfig["copy"]["header"], value: string) =>
    setConfig((prev) => ({ ...prev, copy: { ...prev.copy, header: { ...prev.copy.header, [key]: value } } }));
  const setFooterCopy = (key: keyof ReportTemplateConfig["copy"]["footer"], value: string) =>
    setConfig((prev) => ({ ...prev, copy: { ...prev.copy, footer: { ...prev.copy.footer, [key]: value } } }));
  const setCompetenciasTitle = (value: string) =>
    setConfig((prev) => ({ ...prev, copy: { ...prev.copy, competencias: { ...prev.copy.competencias, title: value } } }));
  const setCategoryDescription = (category: string, value: string) =>
    setConfig((prev) => ({
      ...prev,
      copy: { ...prev.copy, competencias: { ...prev.copy.competencias, categoryDescriptions: { ...prev.copy.competencias.categoryDescriptions, [category]: value || null } } },
    }));
  const setComparativosTitle = (value: string) =>
    setConfig((prev) => ({ ...prev, copy: { ...prev.copy, comparativos: { ...prev.copy.comparativos, title: value } } }));
  const setComparativosGroup = (
    group: "alegra" | "team" | "auto",
    key: keyof ReportTemplateConfig["copy"]["comparativos"]["alegra"],
    value: string
  ) =>
    setConfig((prev) => ({
      ...prev,
      copy: { ...prev.copy, comparativos: { ...prev.copy.comparativos, [group]: { ...prev.copy.comparativos[group], [key]: value } } },
    }));
  const setComparativosCustom = (
    key: "customDefaultDesc" | "customMineLabel" | "customBenchLabel",
    value: string
  ) =>
    setConfig((prev) => ({ ...prev, copy: { ...prev.copy, comparativos: { ...prev.copy.comparativos, [key]: value } } }));
  const setComportamientosCopy = (key: keyof ReportTemplateConfig["copy"]["comportamientos"], value: string) =>
    setConfig((prev) => ({ ...prev, copy: { ...prev.copy, comportamientos: { ...prev.copy.comportamientos, [key]: value } } }));
  const setRankingCopy = (key: keyof ReportTemplateConfig["copy"]["ranking"], value: string) =>
    setConfig((prev) => ({ ...prev, copy: { ...prev.copy, ranking: { ...prev.copy.ranking, [key]: value } } }));
  const setComentariosCopy = (key: keyof ReportTemplateConfig["copy"]["comentarios"], value: string) =>
    setConfig((prev) => ({ ...prev, copy: { ...prev.copy, comentarios: { ...prev.copy.comentarios, [key]: value } } }));

  function handleDragStart(id: ReportBlockId) { dragIdRef.current = id; }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(targetId: ReportBlockId) {
    const draggedId = dragIdRef.current;
    dragIdRef.current = null;
    if (!draggedId || draggedId === targetId) return;
    setConfig((prev) => {
      const order = [...prev.blocks.order];
      const from = order.indexOf(draggedId);
      const to = order.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      order.splice(from, 1);
      order.splice(to, 0, draggedId);
      return { ...prev, blocks: { ...prev.blocks, order } };
    });
  }

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

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Textos del encabezado</p>
            <CopyField label="Saludo" value={config.copy.header.greeting} onChange={(v) => setHeaderCopy("greeting", v)} hint="Admite {{nombre}}" />
            <CopyField label="Subtítulo" value={config.copy.header.subtitle} onChange={(v) => setHeaderCopy("subtitle", v)} multiline />
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
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <label className="text-xs font-semibold text-[#1e293b]">Alineación del logo</label>
              <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([align, Icon]) => (
                  <button
                    key={align}
                    onClick={() => setLogoAlign(align)}
                    className={`p-1.5 rounded-md transition-colors ${config.logo.align === align ? "bg-white shadow-sm text-primary" : "text-[#94a3b8] hover:text-[#64748b]"}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-xs font-semibold text-[#1e293b]">Tamaño del logo</label>
              <input
                type="number" min={8} max={48}
                value={config.logo.size}
                onChange={(e) => setLogoSize(parseInt(e.target.value) || 16)}
                className="w-20 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <label className="text-xs font-semibold text-[#1e293b]">Posición del logo (arrástralo en la vista previa)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number" value={config.logo.headerOffsetX}
                  onChange={(e) => setLogoOffset(parseInt(e.target.value) || 0, config.logo.headerOffsetY)}
                  className="w-14 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-primary"
                  title="Desplazamiento X (px)"
                />
                <input
                  type="number" value={config.logo.headerOffsetY}
                  onChange={(e) => setLogoOffset(config.logo.headerOffsetX, parseInt(e.target.value) || 0)}
                  className="w-14 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-primary"
                  title="Desplazamiento Y (px)"
                />
                {(config.logo.headerOffsetX !== 0 || config.logo.headerOffsetY !== 0) && (
                  <button onClick={() => setLogoOffset(0, 0)} className="text-[10px] font-bold text-primary hover:underline px-1" title="Restablecer posición">
                    reset
                  </button>
                )}
              </div>
            </div>
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

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Textos del pie de página</p>
            <CopyField label="Línea 1" value={config.copy.footer.line1} onChange={(v) => setFooterCopy("line1", v)} />
            <CopyField label="Línea 2" value={config.copy.footer.line2} onChange={(v) => setFooterCopy("line2", v)} />
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8]">Texto libre</p>
              <button onClick={addTextBox} className="flex items-center gap-1 text-[10px] font-bold text-primary hover:underline">
                <Plus className="w-3 h-3" /> Agregar texto
              </button>
            </div>
            <p className="text-[10px] text-[#94a3b8]">
              Cuadros de texto adicionales que puedes mover/redimensionar/editar directamente en la vista previa en vivo. Mejor cerca del encabezado — más abajo el contenido varía de altura según el evaluado y podría no alinearse siempre igual.
            </p>
            {config.customTextBoxes.length === 0 ? (
              <p className="text-[10px] text-[#94a3b8] italic">Sin cuadros de texto todavía.</p>
            ) : (
              config.customTextBoxes.map((box) => (
                <div key={box.id} className="space-y-1.5 bg-slate-50 rounded-lg p-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="color" value={box.color}
                      onChange={(e) => updateTextBox(box.id, { color: e.target.value })}
                      className="w-8 h-8 rounded-lg border border-slate-200 cursor-pointer shrink-0"
                    />
                    <input
                      type="number" min={8} max={40} value={box.fontSize}
                      onChange={(e) => updateTextBox(box.id, { fontSize: parseInt(e.target.value) || 12 })}
                      className="w-16 text-center text-xs font-bold bg-white border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-primary"
                      title="Tamaño de letra (px)"
                    />
                    <button onClick={() => removeTextBox(box.id)} className="ml-auto p-1.5 text-[#94a3b8] hover:text-red-500 rounded-lg" title="Borrar">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <textarea
                    value={box.text} onChange={(e) => updateTextBox(box.id, { text: e.target.value })} rows={2}
                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 outline-none focus:border-primary resize-none"
                  />
                </div>
              ))
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 space-y-2">
            <p className="text-xs font-black uppercase tracking-widest text-[#94a3b8] mb-1">Bloques y orden</p>
            <p className="text-[10px] text-[#94a3b8] mb-2">Arrastra para reordenar. Haz clic para ajustar el tamaño de letra de cada bloque.</p>
            {config.blocks.order.map((blockId) => (
              <div
                key={blockId}
                draggable
                onDragStart={() => handleDragStart(blockId)}
                onDragOver={handleDragOver}
                onDrop={() => handleDrop(blockId)}
                className="border border-slate-100 rounded-xl overflow-hidden"
              >
                <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-3.5 h-3.5 text-[#94a3b8] shrink-0" />
                  <span className="text-xs font-bold text-[#1e293b] flex-1 min-w-0 truncate">{BLOCK_LABELS[blockId]}</span>
                  <button onClick={() => setOpenBlock(openBlock === blockId ? null : blockId)} className="p-1 text-[#94a3b8] hover:text-[#64748b] shrink-0">
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openBlock === blockId ? "rotate-180" : ""}`} />
                  </button>
                </div>
                {openBlock === blockId && (
                  <div className="p-3 space-y-3 bg-white">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-xs font-semibold text-[#1e293b]">Tamaño de letra</label>
                      <div className="flex items-center gap-1">
                        <input
                          type="number" min={70} max={150} step={5}
                          value={Math.round(config.blocks[blockId].fontScale * 100)}
                          onChange={(e) => setBlockFontScalePct(blockId, parseInt(e.target.value) || 100)}
                          className="w-16 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-primary"
                        />
                        <span className="text-[10px] font-bold text-[#64748b]">%</span>
                      </div>
                    </div>

                    {blockId === "competencias" && (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-xs font-semibold text-[#1e293b]">Tamaño de ícono</label>
                          <input
                            type="number" min={12} max={40}
                            value={config.blocks.competencias.iconSize}
                            onChange={(e) => setCompetenciasIconSize(parseInt(e.target.value) || 22)}
                            className="w-16 text-center text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1 outline-none focus:border-primary"
                          />
                        </div>
                        <CopyField label="Título de la sección" value={config.copy.competencias.title} onChange={setCompetenciasTitle} />
                        {categories.length > 0 && (
                          <div className="space-y-2.5 pt-2 border-t border-slate-100">
                            <p className="text-[10px] font-bold uppercase text-[#94a3b8]">Ícono y descripción por categoría</p>
                            {categories.map((cat) => {
                              const currentIcon = cat in config.blocks.competencias.categoryIcons
                                ? (config.blocks.competencias.categoryIcons[cat] ?? "none")
                                : "auto";
                              const currentDesc = config.copy.competencias.categoryDescriptions[cat] ?? "";
                              return (
                                <div key={cat} className="space-y-1 bg-slate-50 rounded-lg p-2">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold text-[#1e293b] truncate">{cat}</span>
                                    <select
                                      value={currentIcon}
                                      onChange={(e) => setCategoryIcon(cat, e.target.value)}
                                      className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white outline-none focus:border-primary cursor-pointer shrink-0"
                                    >
                                      <option value="auto">Automático</option>
                                      <option value="none">Ninguno</option>
                                      {CATEGORY_ICON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                    </select>
                                  </div>
                                  <textarea
                                    value={currentDesc}
                                    onChange={(e) => setCategoryDescription(cat, e.target.value)}
                                    placeholder="Descripción (opcional)"
                                    rows={2}
                                    className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-primary resize-none"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </>
                    )}

                    {blockId === "comparativos" && (
                      <>
                        <CopyField label="Título de la sección" value={config.copy.comparativos.title} onChange={setComparativosTitle} />
                        {([["alegra", "Alegra"], ["team", "Technical Team"], ["auto", "Autoevaluación"]] as const).map(([group, label]) => (
                          <div key={group} className="space-y-1.5 pt-2 border-t border-slate-100">
                            <p className="text-[10px] font-bold uppercase text-[#94a3b8]">Tarjeta: {label}</p>
                            <CopyField label="Título" value={config.copy.comparativos[group].title} onChange={(v) => setComparativosGroup(group, "title", v)} />
                            <CopyField label="Descripción" value={config.copy.comparativos[group].desc} onChange={(v) => setComparativosGroup(group, "desc", v)} multiline hint={group === "team" ? "Admite {{equipo}}" : undefined} />
                            <div className="grid grid-cols-2 gap-2">
                              <CopyField label={'Etiqueta "tú"'} value={config.copy.comparativos[group].mineLabel} onChange={(v) => setComparativosGroup(group, "mineLabel", v)} />
                              <CopyField label="Etiqueta benchmark" value={config.copy.comparativos[group].benchLabel} onChange={(v) => setComparativosGroup(group, "benchLabel", v)} />
                            </div>
                          </div>
                        ))}
                        <div className="space-y-1.5 pt-2 border-t border-slate-100">
                          <p className="text-[10px] font-bold uppercase text-[#94a3b8]">Secciones personalizadas (valores por defecto)</p>
                          <CopyField label="Descripción por defecto" value={config.copy.comparativos.customDefaultDesc} onChange={(v) => setComparativosCustom("customDefaultDesc", v)} multiline />
                          <div className="grid grid-cols-2 gap-2">
                            <CopyField label={'Etiqueta "tú"'} value={config.copy.comparativos.customMineLabel} onChange={(v) => setComparativosCustom("customMineLabel", v)} />
                            <CopyField label="Etiqueta benchmark" value={config.copy.comparativos.customBenchLabel} onChange={(v) => setComparativosCustom("customBenchLabel", v)} />
                          </div>
                        </div>
                      </>
                    )}

                    {blockId === "comportamientos" && (
                      <>
                        <CopyField label="Título de la sección" value={config.copy.comportamientos.title} onChange={(v) => setComportamientosCopy("title", v)} />
                        <CopyField label="Descripción" value={config.copy.comportamientos.description} onChange={(v) => setComportamientosCopy("description", v)} multiline hint="Admite {{total}}" />
                        <div className="grid grid-cols-2 gap-2">
                          <CopyField label="Etiqueta Fortalezas" value={config.copy.comportamientos.fortalezasLabel} onChange={(v) => setComportamientosCopy("fortalezasLabel", v)} />
                          <CopyField label="Etiqueta Puntos de mejora" value={config.copy.comportamientos.mejorasLabel} onChange={(v) => setComportamientosCopy("mejorasLabel", v)} />
                        </div>
                      </>
                    )}

                    {blockId === "ranking" && (
                      <>
                        <CopyField label="Título de la sección" value={config.copy.ranking.title} onChange={(v) => setRankingCopy("title", v)} />
                        <CopyField label="Descripción" value={config.copy.ranking.description} onChange={(v) => setRankingCopy("description", v)} multiline />
                        <div className="grid grid-cols-2 gap-2">
                          <CopyField label={'Etiqueta "tú"'} value={config.copy.ranking.mineLabel} onChange={(v) => setRankingCopy("mineLabel", v)} />
                          <CopyField label="Etiqueta benchmark" value={config.copy.ranking.benchLabel} onChange={(v) => setRankingCopy("benchLabel", v)} />
                        </div>
                      </>
                    )}

                    {blockId === "comentarios" && (
                      <>
                        <CopyField label="Título de cada tarjeta" value={config.copy.comentarios.cardTitle} onChange={(v) => setComentariosCopy("cardTitle", v)} />
                        <CopyField label="Texto introductorio" value={config.copy.comentarios.questionIntro} onChange={(v) => setComentariosCopy("questionIntro", v)} multiline hint="Admite {{pregunta}} (se resalta en negrita)" />
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
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
            {(previewLoading || realPdfLoading) && <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1 shrink-0">
              <button
                onClick={() => handleViewModeChange("live")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${viewMode === "live" ? "bg-white shadow-sm text-primary" : "text-[#94a3b8] hover:text-[#64748b]"}`}
              >
                <Eye className="w-3 h-3" /> Vista en vivo
              </button>
              <button
                onClick={() => handleViewModeChange("pdf")}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-colors ${viewMode === "pdf" ? "bg-white shadow-sm text-primary" : "text-[#94a3b8] hover:text-[#64748b]"}`}
              >
                <FileText className="w-3 h-3" /> Ver PDF real
              </button>
            </div>
          </div>
          {viewMode === "live" && (
            <p className="text-[10px] text-[#94a3b8] px-4 py-1.5 bg-amber-50 border-b border-amber-100">
              Arrastra el logo y las esquinas de los bloques para ajustar posición/tamaño. Esta vista no pagina como el PDF final — usa &ldquo;Ver PDF real&rdquo; para revisar saltos de página.
            </p>
          )}
          <div className="flex-1 relative">
            {viewMode === "pdf" ? (
              realPdfUrl ? (
                <iframe key={realPdfUrl} src={realPdfUrl} title="PDF real del reporte" className="w-full h-full border-none absolute inset-0" style={{ minHeight: "600px" }} />
              ) : (
                <div className="flex items-center justify-center h-full p-8 text-center text-sm text-[#94a3b8]">Generando PDF…</div>
              )
            ) : previewError ? (
              <div className="flex items-center justify-center h-full p-8 text-center">
                <p className="text-sm text-red-500 font-semibold">{previewError}</p>
              </div>
            ) : previewUrl ? (
              <iframe
                key={previewUrl} ref={iframeRef} src={previewUrl} onLoad={handleIframeLoad}
                title="Vista previa del reporte" className="w-full h-full border-none absolute inset-0" style={{ minHeight: "600px" }}
              />
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
