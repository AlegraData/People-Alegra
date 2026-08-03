/**
 * Plantilla HTML del reporte individual de Feedback 360°, pensada para
 * renderizarse a PDF con Chromium headless (ver generatePdf.ts). Replica el
 * diseño de reporte/Plantilla Feedback 360°.pdf: mismos colores de marca,
 * mismas secciones (competencias, comparativos, fortalezas/mejoras, ranking,
 * comentarios). Los gráficos son SVG dibujado a mano (no una librería de
 * charts) — más simple y confiable de imprimir en un PDF sin interacción.
 *
 * El look (colores, logo, márgenes, densidad, orden de bloques, tamaño de
 * letra por bloque) es configurable vía `ReportTemplateConfig` (Reportes →
 * Plantilla, gestionado en `reportTemplateConfig.ts`). Si no se pasa ninguno,
 * se usa `DEFAULT_TEMPLATE_CONFIG` — los mismos valores que estaban
 * hardcodeados antes de que existiera el editor de plantilla.
 */
import { DEFAULT_TEMPLATE_CONFIG, densityScale, type ReportBlockId, type ReportTemplateConfig } from "./reportTemplateConfig";
import type { ReportSectionPosition } from "@/types/evaluaciones360";

// Colores neutrales que no forman parte del set curado de la plantilla visual
// (ver Decisiones de alcance en el plan): el gris de "benchmark" y el gris
// claro del estado vacío no cambian con la marca.
const GRAY = "#CBD5E1";
const SLATE_LIGHT = "#94a3b8";

export interface CategoryComparisonRow {
  category: string;
  mine: number;
  benchmark: number;
}

export interface QuestionRankingRow {
  text: string;
  category?: string;
  mine: number;
  alegra: number;
}

export interface ReportComment {
  questionText: string;
  answers: string[];
}

/** Una sección de análisis personalizada (ej. "Alineación Cultural"), ya calculada, lista para renderizar. */
export interface CustomSectionResult {
  id: string;
  name: string;
  description?: string;
  rows: CategoryComparisonRow[];
  position?: ReportSectionPosition;
}

/** Íconos y logo reales del reporte (data-URI base64), cargados con `loadReportIcons()`
 * en `reportIcons.ts` y resueltos con `resolveReportIcons()` contra la plantilla visual.
 * Cualquier clave ausente cae a su fallback (wordmark de texto o emoji). */
export interface Eval360ReportIcons {
  logo?: string | null;
  headerBg?: string | null;
  compromiso?: string | null;
  conocimiento?: string | null;
  comunicacion?: string | null;
  trabajoEquipo?: string | null;
  fortalezas?: string | null;
  puntosMejora?: string | null;
}

export interface Eval360ReportData {
  evaluateeName: string;
  evaluateeEmail: string;
  team: string | null;
  ratingMax: number;
  vsAlegra: CategoryComparisonRow[];
  vsTeam: CategoryComparisonRow[];
  vsAuto: CategoryComparisonRow[];
  /** Secciones personalizadas definidas en Reportes → Configuración (vacío = ninguna definida o sin datos). */
  vsCustomSections: CustomSectionResult[];
  questionRanking: QuestionRankingRow[];
  strengths: string[];
  improvements: string[];
  comments: ReportComment[];
  totalReceived: number;
  icons?: Eval360ReportIcons;
  templateConfig?: ReportTemplateConfig;
}

// Descripciones conocidas de las 4 competencias del diseño original. Si una
// encuesta futura usa categorías distintas, la tarjeta simplemente no lleva
// descripción (no se inventa un texto genérico).
const KNOWN_CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "conocimientos tecnicos": "Aptitud para desempeñar tus funciones con las habilidades y conocimientos necesarios, mostrando interés por mejorarlos de forma continua para tu crecimiento y el de Alegra.",
  "conocimiento tecnico": "Aptitud para desempeñar tus funciones con las habilidades y conocimientos necesarios, mostrando interés por mejorarlos de forma continua para tu crecimiento y el de Alegra.",
  "comunicacion": "Habilidad para expresar tus ideas con claridad, escuchar y tener en cuenta diferentes perspectivas, brindar comentarios constructivos con empatía y sostener argumentos sólidos.",
  "trabajo en equipo": "Capacidad para fomentar la armonía y colaboración, comunicarse de forma efectiva, compartir conocimientos para el desarrollo del equipo, y adaptarse a los cambios para lograr los objetivos.",
  "compromiso": "Capacidad para mostrar iniciativa y una actitud proactiva frente a los retos de tu rol, cumpliendo con las responsabilidades y plazos definidos.",
};

// Mismas claves normalizadas que KNOWN_CATEGORY_DESCRIPTIONS, mapeadas al
// ícono correspondiente en Eval360ReportIcons. Usado solo como fallback
// automático cuando la categoría no tiene una entrada explícita en
// `blocks.competencias.categoryIcons` (ver `categoryIcon()`).
const KNOWN_CATEGORY_ICON_KEYS: Record<string, keyof Eval360ReportIcons> = {
  "conocimientos tecnicos": "conocimiento",
  "conocimiento tecnico": "conocimiento",
  "comunicacion": "comunicacion",
  "trabajo en equipo": "trabajoEquipo",
  "compromiso": "compromiso",
};

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Reemplaza `{{clave}}` en una plantilla de `ReportCopyConfig` por el valor
// dado — así el admin puede editar libremente el texto sin perder los datos
// dinámicos (nombre, equipo, total de evaluaciones, texto de la pregunta).
// Todos los campos de copy con placeholders son "ricos" (HTML de Tiptap, ver
// `editAttrs`), así que la plantilla YA viene con su propio marcado y no debe
// escaparse — solo el valor sustituido se escapa cuando no es del propio
// editor de la plantilla (ej. el texto de una pregunta de la encuesta).
function interpolateRaw(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// Igual que `interpolateRaw()`, pero envuelve el valor sustituido en
// <strong> — para textos donde una parte (ej. el texto de la pregunta en
// Comentarios) debe resaltarse en negrita dentro de una oración editable.
function renderWithBoldRaw(template: string, placeholder: string, value: string): string {
  const parts = template.split(`{{${placeholder}}}`);
  return parts.join(`<strong>${esc(value)}</strong>`);
}

// Misma lógica que `categoryIcon()`: primero el override explícito guardado
// en la plantilla (por texto exacto de categoría; `null` = sin descripción
// deliberada), y si no está mapeada, cae al texto conocido por defecto.
function categoryDescription(category: string, overrideMap: Record<string, string | null>): string | null {
  if (category in overrideMap) return overrideMap[category];
  return KNOWN_CATEGORY_DESCRIPTIONS[stripAccents(category).toLowerCase().trim()] ?? null;
}

// Resuelve el ícono de una categoría: primero el mapeo explícito guardado en
// la plantilla (por texto exacto de la categoría; `null` = "sin ícono"
// deliberado), y si la categoría no está mapeada, cae al match automático por
// nombre conocido — así configs guardados antes de que existiera el mapeo
// siguen funcionando igual.
function categoryIcon(category: string, icons: Eval360ReportIcons, overrideMap: Record<string, string | null>): string | null {
  if (category in overrideMap) {
    const key = overrideMap[category];
    return key ? (icons[key as keyof Eval360ReportIcons] ?? null) : null;
  }
  const key = KNOWN_CATEGORY_ICON_KEYS[stripAccents(category).toLowerCase().trim()];
  return (key && icons[key]) || null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Para meter texto arbitrario dentro de un atributo HTML (data-raw="...") —
// esc() no alcanza porque no escapa comillas dobles, que romperían el atributo.
// Los saltos de línea van como referencia numérica (&#10;) y no como el
// caracter literal: por spec HTML, el parser normaliza cualquier salto de
// línea/tab literal DENTRO de un valor de atributo a un solo espacio (a
// diferencia del contenido de texto normal, donde sí se preservan) — con el
// caracter literal, un texto editado con varias líneas se aplanaría a una
// sola apenas se recargara la vista previa. Una referencia numérica sobrevive
// intacta ese parseo y `getAttribute()` la devuelve ya decodificada a "\n".
function escAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\n/g, "&#10;").replace(/\r/g, "&#13;").replace(/\t/g, "&#9;");
}

// Atributos que convierten un elemento en editable desde la vista en vivo del
// editor (ver attachEditHandles en EvalReportTemplateEditor.tsx): `path` es la
// ruta dentro de `ReportTemplateConfig.copy` a la que se escribe el cambio,
// `raw` es el texto SIN interpolar (con sus {{placeholders}} intactos, si
// tiene) y `display` es lo que de verdad se ve ahora (con los placeholders ya
// resueltos para esta persona — igual a `raw` si el texto no tiene ninguno).
// Todo campo de copy (títulos cortos, leyendas de gráficas y párrafos por
// igual) se edita EN LÍNEA con la misma paleta de texto enriquecido — sin
// distinción "rich"/"plano": ver `mountRichEditor` en
// EvalReportTemplateEditor.tsx. Por eso el elemento que lleva estos atributos
// SIEMPRE es un <div> (nunca <p>/<span>/<h1>): Tiptap envuelve su contenido en
// bloques (<p>, listas, etc.), que no son válidos dentro de esas etiquetas.
function editAttrs(path: string, raw: string, display?: string): string {
  return `data-edit-copy="${path}" data-raw="${escAttr(raw)}" data-interpolated="${escAttr(display ?? raw)}"`;
}

function fmt(n: number): string {
  return n.toFixed(1);
}

// Colores/espaciado resueltos de un ReportTemplateConfig, listos para usar en
// los helpers de renderizado — evita pasar el config completo a cada función.
interface Theme {
  primary: string;
  primaryDark: string;
  text: string;
  textSecondary: string;
  background: string;
  cardBorder: string;
  scale: number;
  cardPadding: number;
  cardRadius: number;
  pageMarginX: number;
  pageMarginY: number;
  logoAlign: "left" | "center" | "right";
  logoSize: number;
  logoOffsetX: number;
  logoOffsetY: number;
  headerBgHeight: number;
}

function buildTheme(config: ReportTemplateConfig): Theme {
  return {
    primary: config.colors.primary,
    primaryDark: config.colors.primaryDark,
    text: config.colors.text,
    textSecondary: config.colors.textSecondary,
    background: config.colors.background,
    cardBorder: config.colors.cardBorder,
    scale: densityScale(config.layout.density),
    cardPadding: config.layout.cardPadding,
    cardRadius: config.layout.cardRadius,
    pageMarginX: config.layout.pageMarginX,
    pageMarginY: config.layout.pageMarginY,
    logoAlign: config.logo.align,
    logoSize: config.logo.size,
    logoOffsetX: config.logo.headerOffsetX,
    logoOffsetY: config.logo.headerOffsetY,
    headerBgHeight: config.logo.headerBgHeight,
  };
}

function justifyFor(align: "left" | "center" | "right"): string {
  return align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
}

function wordmark(theme: Theme, size: number): string {
  return `<span style="font-size:${size}px;font-weight:900;color:${theme.text};">People <span style="color:${theme.primaryDark};">Alegra</span></span>`;
}

function logoBlock(theme: Theme, logoDataUri: string | null | undefined, size: number): string {
  if (logoDataUri) return `<img src="${logoDataUri}" alt="Alegra" style="height:${size}px;display:block;" />`;
  return wordmark(theme, size);
}

// ── Gráfico comparativo por categoría (barras verticales agrupadas) ─────────
// Compacto a propósito: hasta 4 de estas tarjetas deben caber en una sola
// página (grid 2x2), igual que en la plantilla de referencia. `blockScale`
// combina la densidad global con el tamaño de letra propio del bloque
// "Comparativos" — escala tanto el gráfico como sus etiquetas.
// Parte el nombre de una categoría en hasta 2 líneas por palabra completa
// (nunca a mitad de palabra) para que quepa bajo su grupo de barras sin
// recortarse — antes se truncaba con "…" a los 14 caracteres, perdiendo
// nombres completos como "Trabajo en equipo". Si ni siquiera 2 líneas
// alcanzan (una sola palabra larguísima), esa 2da línea sí trunca.
function wrapCategoryLabel(text: string, maxLineLen: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && candidate.length > maxLineLen) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  if (lines.length > 2) {
    const rest = lines.slice(1).join(" ");
    lines.splice(1, lines.length - 1, rest.length > maxLineLen ? `${rest.slice(0, maxLineLen - 1)}…` : rest);
  }
  return lines;
}

function groupedBarChart(theme: Theme, blockScale: number, rows: CategoryComparisonRow[], max: number, mineLabel: string, benchLabel: string, mineLabelPath: string, benchLabelPath: string, noDataMessage: string): string {
  if (rows.length === 0) {
    return `<div ${editAttrs("comparativos.noDataMessage", noDataMessage)} style="color:${SLATE_LIGHT};font-size:11px;text-align:center;padding:16px 0;">${noDataMessage}</div>`;
  }
  const chartH = Math.round(95 * blockScale);
  const barW = Math.round(20 * blockScale);
  const groupW = barW * 2 + 5;
  const groupGap = Math.round(24 * blockScale);
  const width = rows.length * (groupW + groupGap) + groupGap;
  // Se reserva espacio arriba (LABEL_PAD) para que la etiqueta de valor de una
  // barra cercana al máximo no quede con y negativo — el <svg> recorta por
  // defecto todo lo que caiga fuera del viewBox, así que sin este margen el
  // número se corta cuando alguien califica muy alto (9.5+ sobre 10).
  const LABEL_PAD = Math.round(12 * blockScale);
  const barMaxH = chartH - LABEL_PAD;
  const scale = (v: number) => (max > 0 ? Math.min((v / max) * barMaxH, barMaxH) : 0);
  const valueFontSize = Math.round(10 * blockScale);
  const labelFontSize = Math.round(9 * blockScale);
  const labelLineHeight = labelFontSize + 3;
  // Ancho disponible por etiqueta: su propio grupo más buena parte del hueco
  // hacia el siguiente (los nombres se centran, así que invaden ese espacio
  // sin pisar al vecino) — convertido a caracteres con un ancho promedio de
  // fuente típico (~0.55 × tamaño de letra para una sans-serif normal).
  const maxLineLen = Math.max(6, Math.floor((groupW + groupGap * 0.85) / (labelFontSize * 0.55)));
  const labelLines = rows.map((r) => wrapCategoryLabel(r.category, maxLineLen));
  const maxLines = Math.max(1, ...labelLines.map((l) => l.length));
  const chartBottomPad = 28 + (maxLines - 1) * labelLineHeight;

  const bars = rows.map((r, i) => {
    const x0 = groupGap + i * (groupW + groupGap);
    const cx = x0 + groupW / 2;
    const hMine = scale(r.mine);
    const hBench = scale(r.benchmark);
    const lines = labelLines[i];
    const labelTspans = lines.map((line, li) => `<tspan x="${cx}" dy="${li === 0 ? 0 : labelLineHeight}">${esc(line)}</tspan>`).join("");
    return `
      <g>
        <rect x="${x0}" y="${chartH - hMine}" width="${barW}" height="${hMine}" rx="3" fill="${theme.primary}"></rect>
        <text x="${x0 + barW / 2}" y="${chartH - hMine - 5}" font-size="${valueFontSize}" font-weight="700" fill="${theme.text}" text-anchor="middle">${fmt(r.mine)}</text>
        <rect x="${x0 + barW + 5}" y="${chartH - hBench}" width="${barW}" height="${hBench}" rx="3" fill="${GRAY}"></rect>
        <text x="${x0 + barW + 5 + barW / 2}" y="${chartH - hBench - 5}" font-size="${valueFontSize}" font-weight="700" fill="${theme.textSecondary}" text-anchor="middle">${fmt(r.benchmark)}</text>
        <text x="${cx}" y="${chartH + 16}" font-size="${labelFontSize}" fill="${theme.textSecondary}" text-anchor="middle">${labelTspans}</text>
      </g>`;
  }).join("");

  return `
    <div style="display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:4px;">
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:9px;color:${theme.textSecondary};"><span style="width:8px;height:8px;border-radius:2px;background:${theme.primary};display:inline-block;"></span><div ${editAttrs(mineLabelPath, mineLabel)} style="display:inline-block;">${mineLabel}</div></span>
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:9px;color:${theme.textSecondary};"><span style="width:8px;height:8px;border-radius:2px;background:${GRAY};display:inline-block;"></span><div ${editAttrs(benchLabelPath, benchLabel)} style="display:inline-block;">${benchLabel}</div></span>
    </div>
    <svg width="100%" height="${chartH + chartBottomPad}" viewBox="0 0 ${width} ${chartH + chartBottomPad}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

// ── Ranking completo de comportamientos (filas HTML, no SVG) ────────────────
// Un SVG no se puede partir entre páginas al imprimir: si el gráfico completo
// no cabe en lo que queda de la página, salta entero a la siguiente y deja un
// hueco en blanco. Con filas HTML normales, el navegador sí puede cortar entre
// una fila y otra con naturalidad.
function horizontalRankingChart(theme: Theme, blockScale: number, rows: QuestionRankingRow[], max: number, mineLabel: string, benchLabel: string, mineLabelPath: string, benchLabelPath: string): string {
  if (rows.length === 0) return "";
  const pct = (v: number) => (max > 0 ? Math.min((v / max) * 100, 100) : 0);
  // Un poco más grande que el resto de gráficas (10 → 11.5): esta es la
  // única sección donde el "dato" (nombre del comportamiento + puntaje) es
  // en sí mismo el contenido principal a leer, no una etiqueta secundaria
  // junto a una barra corta.
  const fontSize = Math.round(11.5 * blockScale);

  const barRows = rows.map((r) => `
    <div style="display:flex;align-items:center;gap:10px;padding:4px 0;break-inside:avoid;">
      <span style="flex:0 1 220px;min-width:0;font-size:${fontSize}px;color:${theme.text};line-height:1.3;">${esc(r.text)}</span>
      <span style="flex:1;position:relative;height:7px;background:${theme.background};border-radius:4px;overflow:hidden;">
        <span style="position:absolute;left:0;top:0;height:100%;width:${pct(r.alegra)}%;background:${GRAY};border-radius:4px;"></span>
        <span style="position:absolute;left:0;top:0;height:100%;width:${pct(r.mine)}%;background:${theme.primary};opacity:0.9;border-radius:4px;"></span>
      </span>
      <span style="flex:0 0 28px;font-size:${fontSize}px;font-weight:700;color:${theme.text};text-align:right;">${fmt(r.mine)}</span>
    </div>`).join("");

  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:${fontSize}px;color:${theme.textSecondary};"><span style="width:9px;height:9px;border-radius:3px;background:${theme.primary};display:inline-block;"></span><div ${editAttrs(mineLabelPath, mineLabel)} style="display:inline-block;">${mineLabel}</div></span>
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:${fontSize}px;color:${theme.textSecondary};"><span style="width:9px;height:9px;border-radius:3px;background:${GRAY};display:inline-block;"></span><div ${editAttrs(benchLabelPath, benchLabel)} style="display:inline-block;">${benchLabel}</div></span>
    </div>
    <div>${barRows}</div>`;
}

// El ícono va como una insignia circular que sobresale del borde superior de
// la tarjeta (mismo tratamiento que reporte/Plantilla Feedback 360°.pdf), no
// en línea junto al título — cada PNG de ícono ya trae su propio fondo de
// color, así que basta con posicionarlo, sin dibujar un círculo adicional.
function competencyCards(theme: Theme, blockScale: number, iconSize: number, categories: string[], icons: Eval360ReportIcons, categoryIconsOverride: Record<string, string | null>, categoryDescOverride: Record<string, string | null>): string {
  const titleSize = Math.round(12 * blockScale);
  const descSize = Math.round(10 * blockScale);
  let firstIconTagged = false;
  return categories.map((cat) => {
    const desc = categoryDescription(cat, categoryDescOverride);
    const icon = categoryIcon(cat, icons, categoryIconsOverride);
    const isFirstIcon = icon && !firstIconTagged;
    if (isFirstIcon) firstIconTagged = true;
    // El título de cada tarjeta es el nombre literal de la categoría (viene
    // de las preguntas de la encuesta, no de config.copy) — no es editable
    // aquí, solo la descripción (que sí vive en copy.competencias.categoryDescriptions).
    const descPath = `competencias.categoryDescriptions::${cat}`;
    return `
      <div class="card" style="flex:1;min-width:150px;position:relative;">
        ${icon ? `<img src="${icon}" alt="" ${isFirstIcon ? 'data-edit="icon"' : ""} style="position:absolute;top:${-iconSize / 2}px;right:14px;width:${iconSize}px;height:${iconSize}px;object-fit:contain;" />` : ""}
        <p style="font-weight:700;color:${theme.text};font-size:${titleSize}px;margin:0 0 5px;padding-right:${icon ? iconSize + 10 : 0}px;">${esc(cat)}</p>
        ${desc ? `<div ${editAttrs(descPath, desc)} style="font-size:${descSize}px;color:${theme.textSecondary};line-height:1.45;margin:0;">${desc}</div>` : ""}
      </div>`;
  }).join("");
}

function numberedList(theme: Theme, blockScale: number, items: string[]): string {
  const fontSize = Math.round(11 * blockScale);
  return `<ol style="margin:0;padding-left:18px;">${items.map((t) => `<li style="font-size:${fontSize}px;color:${theme.text};margin-bottom:6px;line-height:1.35;">${esc(t)}</li>`).join("")}</ol>`;
}

// Insignia circular centrada en el borde superior de la tarjeta (Fortalezas /
// Puntos de mejora), con la etiqueta debajo — mismo tratamiento que el PDF de
// referencia, en vez del ícono en línea junto al texto.
function badgedCardTitle(iconUri: string | null | undefined, fallbackEmoji: string, label: string, badgeSize: number, labelPath: string): string {
  const badge = iconUri
    ? `<img src="${iconUri}" alt="" style="width:${badgeSize}px;height:${badgeSize}px;object-fit:contain;" />`
    : `<span style="font-size:${Math.round(badgeSize * 0.6)}px;">${fallbackEmoji}</span>`;
  return `
    <div style="position:absolute;top:${-badgeSize / 2}px;left:50%;transform:translateX(-50%);width:${badgeSize}px;height:${badgeSize}px;display:flex;align-items:center;justify-content:center;">${badge}</div>
    <div ${editAttrs(labelPath, label)} style="font-weight:700;font-size:12px;margin:${badgeSize / 2 + 6}px 0 8px;">${label}</div>`;
}

// Cada comentario individual evita partirse a la mitad (break-inside:avoid en
// el <p>), y la tarjeta contenedora explícitamente NO lo lleva (se anula el
// break-inside:avoid que trae por defecto la clase compartida ".card" — sin
// este override, una tarjeta con decenas de comentarios queda igual de
// "atómica" y Chromium la empuja ENTERA a la siguiente página, dejando un
// hueco en blanco en la actual, el mismo bug que ya se corrigió en el
// gráfico de ranking). `orphans`/`widows` en cada cita evita que, en el caso
// límite de una respuesta tan larga que ni siquiera cabe entera en una hoja
// nueva (rompe su propio break-inside:avoid), quede una sola línea suelta
// pegada arriba o abajo del corte — se ve como un párrafo que sigue,
// no como un corte a mitad de frase.
// Cada tarjeta lleva su propio título "Comentarios" centrado (igual que el
// PDF de referencia) — no hay un título de sección aparte para todo el bloque.
function commentSection(theme: Theme, blockScale: number, cardTitle: string, questionIntroTemplate: string, c: ReportComment): string {
  if (c.answers.length === 0) return "";
  const titleSize = Math.round(13 * blockScale);
  const descSize = Math.round(10 * blockScale);
  const textSize = (10.5 * blockScale).toFixed(1);
  const questionIntro = renderWithBoldRaw(questionIntroTemplate, "pregunta", c.questionText);
  return `
    <div class="card" style="margin-bottom:14px;break-inside:auto;">
      <div ${editAttrs("comentarios.cardTitle", cardTitle)} style="font-weight:800;font-size:${titleSize}px;color:${theme.text};text-align:center;margin:0 0 6px;">${cardTitle}</div>
      <div ${editAttrs("comentarios.questionIntro", questionIntroTemplate, renderWithBoldRaw(questionIntroTemplate, "pregunta", c.questionText))} style="font-size:${descSize}px;color:${theme.textSecondary};text-align:center;margin:0 0 10px;">${questionIntro}</div>
      <div style="display:flex;flex-direction:column;gap:7px;">
        ${c.answers.map((a) => `<p style="background:#f8fafc;border-radius:10px;padding:10px 13px;font-size:${textSize}px;color:${theme.textSecondary};font-style:italic;line-height:1.45;margin:0;break-inside:avoid;orphans:3;widows:3;">&ldquo;${esc(a)}&rdquo;</p>`).join("")}
      </div>
    </div>`;
}

type AnchorKey = "alegra" | "team" | "auto";

export function buildReportHtml(data: Eval360ReportData): string {
  const config = data.templateConfig ?? DEFAULT_TEMPLATE_CONFIG;
  const theme = buildTheme(config);
  const copy = config.copy;
  const icons = data.icons ?? {};
  const categories = [...new Set(data.vsAlegra.map((r) => r.category))];
  const firstName = data.evaluateeName.split(" ")[0];
  const justify = justifyFor(theme.logoAlign);

  const comparativosScale = theme.scale * config.blocks.comparativos.fontScale;
  const comportamientosScale = theme.scale * config.blocks.comportamientos.fontScale;
  const rankingScale = theme.scale * config.blocks.ranking.fontScale;
  const comentariosScale = theme.scale * config.blocks.comentarios.fontScale;
  const competenciasScale = theme.scale * config.blocks.competencias.fontScale;

  // El espacio ANTES de un título (margin-top) es 0 en dos casos — en ambos,
  // el bloque va a arrancar siempre pegado al borde físico de una hoja, así
  // que sumarle además su propio "espacio sobre el título" configurado
  // termina apilando ESE valor sobre el margen de página (pageMarginY, ~22px
  // en cada hoja) y se ve desproporcionado frente a un bloque que no arranca
  // hoja nueva (confirmado midiendo un PDF real: con el mismo "30" en dos
  // bloques, uno cae a 52px del borde físico —22 de margen + 30 propios— y
  // el otro a exactamente 30, porque no hay ninguna hoja empezando ahí):
  // 1. Es el primer bloque del documento (pegado al encabezado).
  // 2. Es el bloque que queda justo después de uno con `break-after:page`
  //    (ver FORCED_BREAK_AFTER más abajo) — SIEMPRE arranca una hoja nueva,
  //    sea cual sea el orden actual.
  const firstBlockId = config.blocks.order[0];
  // Bloques que fuerzan salto de hoja después de sí mismos (ver las reglas
  // CSS [data-edit-block="..."] { break-after: page; } más abajo) — hoy
  // "comparativos" (para no mezclar el comparativo con Comportamientos) y
  // "ranking" (para que Comentarios siempre arranque en una hoja propia, sin
  // quedar apretado contra "Resultados individuales por comportamiento").
  const FORCED_BREAK_AFTER: ReportBlockId[] = ["comparativos", "ranking"];
  const blocksAfterForcedBreak = new Set(
    FORCED_BREAK_AFTER.map((id) => {
      const idx = config.blocks.order.indexOf(id);
      return idx !== -1 ? config.blocks.order[idx + 1] : undefined;
    }).filter((id): id is ReportBlockId => id !== undefined)
  );
  const titleMarginTop = (blockId: ReportBlockId, gapBefore: number) =>
    blockId === firstBlockId || blocksAfterForcedBreak.has(blockId) ? 0 : gapBefore;

  // Tarjetas del comparativo: las 3 fijas en el orden configurado, más cada
  // sección personalizada insertada justo después de su ancla (o al final).
  // `titlePath`/`descPath` quedan `null` para lo que NO viene de config.copy
  // (el nombre/descripción de una sección personalizada es dato de la
  // encuesta, no de la plantilla global) — esas tarjetas muestran texto fijo,
  // no editable en línea.
  const anchorCards: Record<AnchorKey, { title: string; titlePath: string; desc: string; descRaw: string; descPath: string; chart: string }> = {
    alegra: {
      title: copy.comparativos.alegra.title, titlePath: "comparativos.alegra.title",
      desc: copy.comparativos.alegra.desc, descRaw: copy.comparativos.alegra.desc, descPath: "comparativos.alegra.desc",
      chart: groupedBarChart(theme, comparativosScale, data.vsAlegra, data.ratingMax, copy.comparativos.alegra.mineLabel, copy.comparativos.alegra.benchLabel, "comparativos.alegra.mineLabel", "comparativos.alegra.benchLabel", copy.comparativos.noDataMessage),
    },
    team: {
      title: copy.comparativos.team.title, titlePath: "comparativos.team.title",
      desc: interpolateRaw(copy.comparativos.team.desc, { equipo: data.team ? ` (${data.team})` : "" }), descRaw: copy.comparativos.team.desc, descPath: "comparativos.team.desc",
      chart: groupedBarChart(theme, comparativosScale, data.vsTeam, data.ratingMax, copy.comparativos.team.mineLabel, copy.comparativos.team.benchLabel, "comparativos.team.mineLabel", "comparativos.team.benchLabel", copy.comparativos.noDataMessage),
    },
    auto: {
      title: copy.comparativos.auto.title, titlePath: "comparativos.auto.title",
      desc: copy.comparativos.auto.desc, descRaw: copy.comparativos.auto.desc, descPath: "comparativos.auto.desc",
      chart: groupedBarChart(theme, comparativosScale, data.vsAuto, data.ratingMax, copy.comparativos.auto.mineLabel, copy.comparativos.auto.benchLabel, "comparativos.auto.mineLabel", "comparativos.auto.benchLabel", copy.comparativos.noDataMessage),
    },
  };
  const afterMap: Record<AnchorKey, CustomSectionResult[]> = { alegra: [], team: [], auto: [] };
  const endList: CustomSectionResult[] = [];
  data.vsCustomSections.forEach((section) => {
    const pos = section.position ?? "end";
    if (pos === "after-alegra") afterMap.alegra.push(section);
    else if (pos === "after-team") afterMap.team.push(section);
    else if (pos === "after-auto") afterMap.auto.push(section);
    else endList.push(section);
  });
  const sectionToCard = (section: CustomSectionResult) => {
    const usingDefaultDesc = section.description === undefined;
    const desc = section.description ?? copy.comparativos.customDefaultDesc;
    return {
      // El título sigue fijo/no editable en línea (nunca HTML): es el mismo
      // dato crudo de la encuesta (`section.name`) que ya se corrigió tras el
      // bug de "Análisis de Análisis de..." — mezclarle formato enriquecido
      // reabriría ese riesgo. La descripción, en cambio, sí es editable con
      // color por palabra desde "Editar en vivo" cuando la sección tiene su
      // propio texto (no el default compartido): se guarda aparte de
      // `config.copy`, en `evaluation.reportSections` (ver
      // `section.<id>.description` en EvalReportTemplateEditor.tsx), porque
      // es dato por encuesta, no de la plantilla global.
      title: `Análisis de ${section.name}`, titlePath: "",
      desc, descRaw: desc, descPath: usingDefaultDesc ? "comparativos.customDefaultDesc" : `section.${section.id}.description`,
      chart: groupedBarChart(theme, comparativosScale, section.rows, data.ratingMax, copy.comparativos.customMineLabel, copy.comparativos.customBenchLabel, "comparativos.customMineLabel", "comparativos.customBenchLabel", copy.comparativos.noDataMessage),
    };
  };
  const comparisonCards: { title: string; titlePath: string; desc: string; descRaw: string; descPath: string; chart: string }[] = [];
  config.blocks.comparativos.fixedOrder.forEach((key) => {
    comparisonCards.push(anchorCards[key]);
    afterMap[key].forEach((s) => comparisonCards.push(sectionToCard(s)));
  });
  endList.forEach((s) => comparisonCards.push(sectionToCard(s)));

  // Contenido de cada bloque reordenable, renderizado una vez y ensamblado
  // según `config.blocks.order`.
  const blockHtml: Record<ReportBlockId, string> = {
    competencias: `
      <div class="section-title" style="margin-top:${titleMarginTop("competencias", config.blocks.competencias.titleGapBefore)}px;margin-bottom:${config.blocks.competencias.titleGap}px" ${editAttrs("competencias.title", copy.competencias.title)}>${copy.competencias.title}</div>
      <div class="grid">${competencyCards(theme, competenciasScale, config.blocks.competencias.iconSize, categories, icons, config.blocks.competencias.categoryIcons, copy.competencias.categoryDescriptions)}</div>`,
    comparativos: `
      <div class="section-title" style="margin-top:${titleMarginTop("comparativos", config.blocks.comparativos.titleGapBefore)}px;margin-bottom:${config.blocks.comparativos.titleGap}px" ${editAttrs("comparativos.title", copy.comparativos.title)}>${copy.comparativos.title}</div>
      <div class="grid-2">
        ${comparisonCards.map((c) => `
          <div class="card">
            <div ${c.titlePath ? editAttrs(c.titlePath, c.title) : ""} style="font-weight:700;font-size:12px;margin:0 0 6px;">${c.titlePath ? c.title : esc(c.title)}</div>
            <div ${c.descPath ? editAttrs(c.descPath, c.descRaw, c.desc) : ""} style="font-size:10px;color:${theme.textSecondary};margin:5px 0 12px;">${c.descPath ? c.desc : esc(c.desc)}</div>
            ${c.chart}
          </div>`).join("")}
      </div>`,
    comportamientos: `
      <div class="section-title" style="margin-top:${titleMarginTop("comportamientos", config.blocks.comportamientos.titleGapBefore)}px;margin-bottom:8px" ${editAttrs("comportamientos.title", copy.comportamientos.title)}>${copy.comportamientos.title}</div>
      <div ${editAttrs("comportamientos.description", copy.comportamientos.description, interpolateRaw(copy.comportamientos.description, { total: String(data.totalReceived) }))} style="font-size:10px;color:${theme.textSecondary};text-align:center;margin:0 0 ${config.blocks.comportamientos.titleGap}px;">
        ${interpolateRaw(copy.comportamientos.description, { total: String(data.totalReceived) })}
      </div>
      <div class="grid">
        <div class="card" style="position:relative;">
          ${badgedCardTitle(icons.fortalezas, "🏆", copy.comportamientos.fortalezasLabel, 36, "comportamientos.fortalezasLabel")}
          ${numberedList(theme, comportamientosScale, data.strengths)}
        </div>
        <div class="card" style="position:relative;">
          ${badgedCardTitle(icons.puntosMejora, "📝", copy.comportamientos.mejorasLabel, 36, "comportamientos.mejorasLabel")}
          ${numberedList(theme, comportamientosScale, data.improvements)}
        </div>
      </div>`,
    ranking: `
      <div class="section-title" style="margin-top:${titleMarginTop("ranking", config.blocks.ranking.titleGapBefore)}px;margin-bottom:${config.blocks.ranking.titleGap}px" ${editAttrs("ranking.title", copy.ranking.title)}>${copy.ranking.title}</div>
      <div class="card">
        <div ${editAttrs("ranking.description", copy.ranking.description)} style="font-size:10px;color:${theme.textSecondary};margin:0 0 8px;">${copy.ranking.description}</div>
        ${horizontalRankingChart(theme, rankingScale, data.questionRanking, data.ratingMax, copy.ranking.mineLabel, copy.ranking.benchLabel, "ranking.mineLabel", "ranking.benchLabel")}
      </div>`,
    comentarios: data.comments.map((c) => commentSection(theme, comentariosScale, copy.comentarios.cardTitle, copy.comentarios.questionIntro, c)).join(""),
  };
  // La página 1 debe quedar solo con "Competencias analizadas" y
  // "Comparativo de tus resultados" — el corte forzado vive en la regla CSS
  // [data-edit-block="comparativos"] de arriba (ver por qué no es style="" inline).
  const orderedBlocks = config.blocks.order.map((id) => `<div data-edit-block="${id}">${blockHtml[id]}</div>`).join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; overflow-wrap: anywhere; }
  /* El margen vertical vive en @page (se repite en CADA hoja al paginar el
     PDF real con Puppeteer) — antes vivía como padding de .page, un único
     div que abarca todo el documento, así que ese padding solo se aplicaba
     al principio/final de TODO el flujo, no en cada corte de página
     intermedio (quedaban pegados al borde). El horizontal se deja en .page
     porque ese sí se repite bien por página (no depende de fragmentación
     vertical). En la vista en vivo (documento continuo, sin paginar) estas
     reglas de @page no aplican — un navegador normal solo las honra al
     imprimir/generar PDF. */
  /* @top-center/@bottom-center: Chromium (Puppeteer) ignora esta sintaxis de
     margin-boxes de CSS Paged Media al generar el PDF real, por eso ese
     margen necesita su propio mecanismo aparte: headerTemplate/footerTemplate
     en generatePdf.ts, con el mismo color. Estas reglas quedan aquí sin
     efecto práctico (ni en el PDF real ni en la vista en vivo) — se
     mantienen documentadas por si algún renderer futuro sí las soporta. */
  @page {
    size: A4; margin: ${theme.pageMarginY}px 0;
    @top-center { content: ""; background: ${theme.background}; }
    @bottom-center { content: ""; background: ${theme.background}; }
  }
  body { margin:0; font-family: 'Segoe UI', Arial, sans-serif; background:${theme.background}; color:${theme.text}; }
  .page { position:relative; padding: 0 ${theme.pageMarginX}px; }
  .card { background:#fff; border:1px solid ${theme.cardBorder}; border-radius:${theme.cardRadius}px; padding:${theme.cardPadding}px ${theme.cardPadding + 2}px; break-inside:avoid; }
  .section-title { font-size:13px; font-weight:800; color:${theme.text}; text-align:center; margin: 30px 0 12px; break-after: avoid-page; break-inside: avoid; }
  /* El primer bloque de la página (justo debajo del encabezado) no necesita
     el mismo margen superior que separa un bloque del siguiente — ese
     espacio ya lo da el propio encabezado, y sumar los dos dejaba un hueco
     vacío entre el fondo decorativo y "Competencias analizadas". */
  .page > div:first-child .section-title { margin-top: 0; }
  /* Todo texto editable en línea (ver editAttrs) admite saltos de línea
     manuales — sin esto, un "\n" en el texto se colapsa a un espacio como
     cualquier otro whitespace normal de HTML. */
  [data-edit-copy] { white-space: pre-wrap; }
  /* Tiptap envuelve el texto en un <p> apenas el admin edita un campo (antes
     era texto plano, sin ninguna etiqueta) — y ese <p> trae su propio margen
     por defecto del navegador (~1em), invisible y completamente aparte del
     margen que se configura en el DIV que lo contiene (ej. "Espacio bajo el
     título"). Sin este reset, cualquier campo editado quedaba con espacio
     extra que ningún control del panel podía tocar ni explicar. */
  [data-edit-copy] p, [data-edit-textbox] p,
  [data-edit-copy] ul, [data-edit-textbox] ul,
  [data-edit-copy] ol, [data-edit-textbox] ol,
  [data-edit-copy] blockquote, [data-edit-textbox] blockquote { margin: 0; }
  .grid { display:flex; gap:10px; flex-wrap:wrap; }
  .grid > .card { flex:1; min-width:220px; }
  /* Comparativo de tus resultados: siempre 2 columnas (2x2 con las 4
     tarjetas típicas: Alegra/Team/Auto + Alineación Cultural), sin importar
     cuántas tarjetas haya ni el ancho disponible — a diferencia de .grid
     (flex-wrap), que acomoda 3 en la primera fila y deja 1 sola en la
     segunda cuando caben 3 de 220px de ancho. */
  .grid-2 { display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; }
  /* break-after: page solo tiene efecto en el PDF real (Puppeteer) — en la
     vista en vivo (documento continuo) un navegador normal lo ignora fuera
     de impresión, así que este bloque simplemente sigue en el mismo flujo.
     "ranking" también lo lleva para que "Comentarios" siempre arranque en su
     propia hoja, en vez de quedar apretado justo debajo de "Resultados
     individuales por comportamiento" (ver FORCED_BREAK_AFTER arriba). */
  [data-edit-block="comparativos"], [data-edit-block="ranking"] { break-after: page; }
</style>
</head>
<body>

  <!-- Encabezado: imagen y texto son dos capas de un mismo grid apilado
       (grid-area:1/1), no una imagen "cover" ni un overlay absoluto dentro de
       un contenedor con overflow:hidden — así la fila crece hasta la altura
       que necesite el texto (ahora editable, largo variable) sin recortarlo,
       y la imagen conserva su proporción real sin deformarse ni ser recortada. -->
  <!-- margin-top negativo: compensa exactamente el margin-top de @page para
       que el fondo decorativo del encabezado siga llegando al borde físico
       de la hoja 1, ahora que ese margen ya no es 0 (ver @page arriba). -->
  <div style="display:grid;background:${theme.background};margin-top:-${theme.pageMarginY}px;">
    <!-- object-fit:cover + un alto fijo (en vez de height:auto con la
         proporción natural completa) recorta la franja plana que trae el
         fondo decorativo por defecto antes de fundirse con el color de
         página — mostrarlo entero dejaba un hueco vacío entre la ola y el
         primer título. object-position:top conserva la parte con dibujo. -->
    ${icons.headerBg
      ? `<img src="${icons.headerBg}" alt="" style="grid-area:1/1;align-self:start;width:100%;height:${theme.headerBgHeight}px;object-fit:cover;object-position:top;" />`
      : `<div style="grid-area:1/1;height:${theme.headerBgHeight}px;"></div>`}
    <div style="grid-area:1/1;align-self:start;padding:20px ${theme.pageMarginX}px 12px;">
      <div style="display:flex;justify-content:${justify};margin:0 0 14px;"><div data-edit="logo" style="transform:translate(${theme.logoOffsetX}px,${theme.logoOffsetY}px);">${logoBlock(theme, icons.logo, theme.logoSize)}</div></div>
      <div ${editAttrs("header.greeting", copy.header.greeting, interpolateRaw(copy.header.greeting, { nombre: firstName }))} style="font-size:20px;font-weight:900;color:${theme.text};margin:0 0 6px;">${interpolateRaw(copy.header.greeting, { nombre: firstName })}</div>
      <div ${editAttrs("header.subtitle", copy.header.subtitle)} style="font-size:12px;color:${theme.textSecondary};margin:0;max-width:480px;">${copy.header.subtitle}</div>
    </div>
  </div>

  <div class="page">

    ${orderedBlocks}

    <!-- Capa de cuadros de texto libres (branding/notas), adicional al
         contenido estructurado — posicionados por coordenadas absolutas
         relativas a .page. Con customTextBoxes:[] (default) no renderiza nada. -->
    ${config.customTextBoxes.map((box) => `
      <div data-edit-textbox="${box.id}" style="position:absolute;left:${box.x}px;top:${box.y}px;width:${box.width}px;color:${esc(box.color)};font-size:${box.fontSize}px;overflow-wrap:anywhere;break-inside:avoid;z-index:50;">${box.text}</div>`).join("")}

    <!-- Espaciador invisible: generatePdf.ts mide, ANTES de exportar el PDF
         real, cuánto queda de la última hoja hasta ahora y le fija a este div
         el alto exacto para que el footer quede pegado al margen inferior
         físico de esa hoja — sea cual sea el largo de los comentarios que
         terminen justo antes. En la vista en vivo (sin ese paso de medición)
         simplemente no ocupa espacio, el footer sigue quedando justo debajo. -->
    <div data-footer-spacer style="height:0px;"></div>
    <!-- break-inside:avoid: el footer completo (texto + logo) salta entero a
         una hoja nueva si no alcanza a caber en lo que quede de la actual —
         nunca se parte a la mitad dejando el logo o una línea cortada. -->
    <div data-report-footer style="text-align:center;margin-top:18px;padding:16px 0;break-inside:avoid;">
      <div ${editAttrs("footer.line1", copy.footer.line1)} style="font-size:11px;font-weight:700;color:${theme.text};margin:0 0 3px;">${copy.footer.line1}</div>
      <div ${editAttrs("footer.line2", copy.footer.line2)} style="font-size:11px;font-weight:700;color:${theme.text};margin:0 0 12px;">${copy.footer.line2}</div>
      <!-- Siempre centrado, sin importar cómo esté alineado el logo del
           encabezado (config.logo.align) — es un cierre del reporte, no una
           repetición del branding superior, así que no debería depender de
           esa configuración. -->
      <div style="display:flex;justify-content:center;">${logoBlock(theme, icons.logo, Math.round(theme.logoSize * 0.875))}</div>
    </div>

  </div>
</body>
</html>`;
}
