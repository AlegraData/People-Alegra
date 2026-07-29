/**
 * Plantilla HTML del reporte individual de Feedback 360°, pensada para
 * renderizarse a PDF con Chromium headless (ver generatePdf.ts). Replica el
 * diseño de reporte/Plantilla Feedback 360°.pdf: mismos colores de marca,
 * mismas secciones (competencias, comparativos, fortalezas/mejoras, ranking,
 * comentarios). Los gráficos son SVG dibujado a mano (no una librería de
 * charts) — más simple y confiable de imprimir en un PDF sin interacción.
 *
 * El look (colores, logo, márgenes, densidad) es configurable vía
 * `ReportTemplateConfig` (Reportes → Plantilla, gestionado en `reportTemplateConfig.ts`).
 * Si no se pasa ninguno, se usa `DEFAULT_TEMPLATE_CONFIG` — los mismos valores
 * que estaban hardcodeados antes de que existiera el editor de plantilla.
 */
import { DEFAULT_TEMPLATE_CONFIG, densityScale, type ReportTemplateConfig } from "./reportTemplateConfig";

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
  name: string;
  description?: string;
  rows: CategoryComparisonRow[];
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
// ícono correspondiente en Eval360ReportIcons.
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

function categoryDescription(category: string): string | null {
  return KNOWN_CATEGORY_DESCRIPTIONS[stripAccents(category).toLowerCase().trim()] ?? null;
}

function categoryIcon(category: string, icons: Eval360ReportIcons): string | null {
  const key = KNOWN_CATEGORY_ICON_KEYS[stripAccents(category).toLowerCase().trim()];
  return (key && icons[key]) || null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
  };
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
// página (grid 2x2), igual que en la plantilla de referencia. `theme.scale`
// (densidad compacto/normal/amplio) escala el tamaño del gráfico; el texto NO
// se escala, para no arriesgar que algo deje de caber en una sola página.
function groupedBarChart(theme: Theme, rows: CategoryComparisonRow[], max: number, mineLabel: string, benchLabel: string): string {
  if (rows.length === 0) {
    return `<p style="color:${SLATE_LIGHT};font-size:11px;text-align:center;padding:16px 0;">Sin datos suficientes todavía.</p>`;
  }
  const chartH = Math.round(95 * theme.scale);
  const barW = Math.round(20 * theme.scale);
  const groupW = barW * 2 + 5;
  const groupGap = Math.round(24 * theme.scale);
  const width = rows.length * (groupW + groupGap) + groupGap;
  // Se reserva espacio arriba (LABEL_PAD) para que la etiqueta de valor de una
  // barra cercana al máximo no quede con y negativo — el <svg> recorta por
  // defecto todo lo que caiga fuera del viewBox, así que sin este margen el
  // número se corta cuando alguien califica muy alto (9.5+ sobre 10).
  const LABEL_PAD = Math.round(12 * theme.scale);
  const barMaxH = chartH - LABEL_PAD;
  const scale = (v: number) => (max > 0 ? Math.min((v / max) * barMaxH, barMaxH) : 0);

  const bars = rows.map((r, i) => {
    const x0 = groupGap + i * (groupW + groupGap);
    const hMine = scale(r.mine);
    const hBench = scale(r.benchmark);
    return `
      <g>
        <rect x="${x0}" y="${chartH - hMine}" width="${barW}" height="${hMine}" rx="3" fill="${theme.primary}"></rect>
        <text x="${x0 + barW / 2}" y="${chartH - hMine - 5}" font-size="10" font-weight="700" fill="${theme.text}" text-anchor="middle">${fmt(r.mine)}</text>
        <rect x="${x0 + barW + 5}" y="${chartH - hBench}" width="${barW}" height="${hBench}" rx="3" fill="${GRAY}"></rect>
        <text x="${x0 + barW + 5 + barW / 2}" y="${chartH - hBench - 5}" font-size="10" font-weight="700" fill="${theme.textSecondary}" text-anchor="middle">${fmt(r.benchmark)}</text>
        <text x="${x0 + groupW / 2}" y="${chartH + 16}" font-size="9" fill="${theme.textSecondary}" text-anchor="middle">${esc(r.category.length > 14 ? r.category.slice(0, 12) + "…" : r.category)}</text>
      </g>`;
  }).join("");

  return `
    <div style="display:flex;align-items:center;gap:8px;justify-content:center;margin-bottom:4px;">
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:9px;color:${theme.textSecondary};"><span style="width:8px;height:8px;border-radius:2px;background:${theme.primary};display:inline-block;"></span>${esc(mineLabel)}</span>
      <span style="display:inline-flex;align-items:center;gap:4px;font-size:9px;color:${theme.textSecondary};"><span style="width:8px;height:8px;border-radius:2px;background:${GRAY};display:inline-block;"></span>${esc(benchLabel)}</span>
    </div>
    <svg width="100%" height="${chartH + 28}" viewBox="0 0 ${width} ${chartH + 28}" xmlns="http://www.w3.org/2000/svg">${bars}</svg>`;
}

// ── Ranking completo de comportamientos (filas HTML, no SVG) ────────────────
// Un SVG no se puede partir entre páginas al imprimir: si el gráfico completo
// no cabe en lo que queda de la página, salta entero a la siguiente y deja un
// hueco en blanco. Con filas HTML normales, el navegador sí puede cortar entre
// una fila y otra con naturalidad.
function horizontalRankingChart(theme: Theme, rows: QuestionRankingRow[], max: number): string {
  if (rows.length === 0) return "";
  const pct = (v: number) => (max > 0 ? Math.min((v / max) * 100, 100) : 0);

  const barRows = rows.map((r) => `
    <div style="display:flex;align-items:center;gap:10px;padding:4px 0;break-inside:avoid;">
      <span style="flex:0 0 220px;font-size:10px;color:${theme.text};line-height:1.3;">${esc(r.text)}</span>
      <span style="flex:1;position:relative;height:7px;background:${theme.background};border-radius:4px;overflow:hidden;">
        <span style="position:absolute;left:0;top:0;height:100%;width:${pct(r.alegra)}%;background:${GRAY};border-radius:4px;"></span>
        <span style="position:absolute;left:0;top:0;height:100%;width:${pct(r.mine)}%;background:${theme.primary};opacity:0.9;border-radius:4px;"></span>
      </span>
      <span style="flex:0 0 28px;font-size:10px;font-weight:700;color:${theme.text};text-align:right;">${fmt(r.mine)}</span>
    </div>`).join("");

  return `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;color:${theme.textSecondary};"><span style="width:9px;height:9px;border-radius:3px;background:${theme.primary};display:inline-block;"></span>Tu resultado</span>
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;color:${theme.textSecondary};"><span style="width:9px;height:9px;border-radius:3px;background:${GRAY};display:inline-block;"></span>Promedio Alegra</span>
    </div>
    <div>${barRows}</div>`;
}

function competencyCards(theme: Theme, categories: string[], icons: Eval360ReportIcons): string {
  const iconSize = Math.round(22 * theme.scale);
  return categories.map((cat) => {
    const desc = categoryDescription(cat);
    const icon = categoryIcon(cat, icons);
    return `
      <div class="card" style="flex:1;min-width:150px;">
        <div style="display:flex;align-items:center;gap:7px;margin:0 0 5px;">
          ${icon ? `<img src="${icon}" alt="" style="width:${iconSize}px;height:${iconSize}px;flex:none;" />` : ""}
          <p style="font-weight:700;color:${theme.text};font-size:12px;margin:0;">${esc(cat)}</p>
        </div>
        ${desc ? `<p style="font-size:10px;color:${theme.textSecondary};line-height:1.45;margin:0;">${esc(desc)}</p>` : ""}
      </div>`;
  }).join("");
}

function numberedList(theme: Theme, items: string[]): string {
  return `<ol style="margin:0;padding-left:18px;">${items.map((t) => `<li style="font-size:11px;color:${theme.text};margin-bottom:6px;line-height:1.35;">${esc(t)}</li>`).join("")}</ol>`;
}

// Cada comentario individual evita partirse a la mitad (break-inside:avoid en
// el <p>), pero la tarjeta contenedora NO lo lleva: si se fuerza a que la
// tarjeta completa (que puede tener decenas de comentarios) no se parta,
// Chromium la empuja entera a la siguiente página y deja un hueco en blanco
// en la actual — el mismo bug que ya se corrigió en el gráfico de ranking.
function commentSection(theme: Theme, c: ReportComment): string {
  if (c.answers.length === 0) return "";
  return `
    <div class="card" style="margin-bottom:14px;">
      <p style="font-weight:700;color:${theme.text};font-size:12px;margin:0 0 3px;">Comentarios</p>
      <p style="font-size:10px;color:${theme.textSecondary};margin:0 0 10px;">Revisa los mensajes que dejaron sobre ti en la sección <strong>&ldquo;${esc(c.questionText)}&rdquo;</strong>.</p>
      <div style="display:flex;flex-direction:column;gap:7px;">
        ${c.answers.map((a) => `<p style="background:#f8fafc;border-radius:10px;padding:10px 13px;font-size:10.5px;color:${theme.textSecondary};font-style:italic;line-height:1.45;margin:0;break-inside:avoid;">&ldquo;${esc(a)}&rdquo;</p>`).join("")}
      </div>
    </div>`;
}

export function buildReportHtml(data: Eval360ReportData): string {
  const config = data.templateConfig ?? DEFAULT_TEMPLATE_CONFIG;
  const theme = buildTheme(config);
  const icons = data.icons ?? {};
  const categories = [...new Set(data.vsAlegra.map((r) => r.category))];
  const firstName = data.evaluateeName.split(" ")[0];

  // Las 3 tarjetas fijas + N secciones personalizadas van en una sola grilla:
  // con min-width:220px caben 2-3 por fila en A4, dando el mismo compacto de
  // la plantilla de referencia sin importar cuántas secciones extra haya.
  const comparisonCards = [
    { title: "Análisis frente a Alegra", desc: "Conoce tu posición en cada competencia frente al promedio de toda Alegra.", chart: groupedBarChart(theme, data.vsAlegra, data.ratingMax, "Tú", "Alegra") },
    { title: "Análisis frente a tu Technical Team", desc: `Conoce tus resultados frente al promedio de tu equipo${data.team ? ` (${esc(data.team)})` : ""}.`, chart: groupedBarChart(theme, data.vsTeam, data.ratingMax, "Tú", "Tu equipo") },
    { title: "Análisis de tu Autoevaluación", desc: "Revisa cómo las opiniones recibidas sobre ti coinciden con tu autoevaluación.", chart: groupedBarChart(theme, data.vsAuto, data.ratingMax, "Recibido", "Autoevaluación") },
    ...data.vsCustomSections.map((section) => ({
      title: `Análisis de ${section.name}`,
      desc: section.description ?? "Revisa cómo las opiniones recibidas sobre ti se comparan con el promedio Alegra, Technical Team y Autoevaluación.",
      chart: groupedBarChart(theme, section.rows, data.ratingMax, "Alegra", "Equipo/Auto"),
    })),
  ];

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; }
  @page { size: A4; margin: 0; }
  body { margin:0; font-family: 'Segoe UI', Arial, sans-serif; background:#fff; color:${theme.text}; }
  .page { padding: ${theme.pageMarginY}px ${theme.pageMarginX}px; }
  .card { background:#fff; border:1px solid ${theme.cardBorder}; border-radius:${theme.cardRadius}px; padding:${theme.cardPadding}px ${theme.cardPadding + 2}px; break-inside:avoid; }
  .section-title { font-size:13px; font-weight:800; color:${theme.text}; text-align:center; margin: 18px 0 10px; }
  .grid { display:flex; gap:10px; flex-wrap:wrap; }
  .grid > .card { flex:1; min-width:220px; }
</style>
</head>
<body>

  <!-- Encabezado -->
  <div style="background:${theme.background}${icons.headerBg ? ` url('${icons.headerBg}') no-repeat right top / cover` : ""};padding:20px ${theme.pageMarginX}px 26px;">
    <div style="margin:0 0 14px;">${logoBlock(theme, icons.logo, 16)}</div>
    <h1 style="font-size:20px;font-weight:900;color:${theme.text};margin:0 0 6px;">¡Hola, ${esc(firstName)}!</h1>
    <p style="font-size:12px;color:${theme.textSecondary};margin:0;max-width:480px;">Te compartimos un resumen de los resultados que obtuviste en tu Feedback 360° 🚀</p>
  </div>

  <div class="page">

    <p class="section-title">Competencias analizadas</p>
    <div class="grid">${competencyCards(theme, categories, icons)}</div>

    <p class="section-title">Comparativo de tus resultados</p>
    <div class="grid">
      ${comparisonCards.map((c) => `
        <div class="card">
          <p style="font-weight:700;font-size:12px;margin:0 0 3px;">${c.title}</p>
          <p style="font-size:10px;color:${theme.textSecondary};margin:0 0 8px;">${c.desc}</p>
          ${c.chart}
        </div>`).join("")}
    </div>

    <p class="section-title">Comportamientos evaluados</p>
    <p style="font-size:10px;color:${theme.textSecondary};text-align:center;max-width:620px;margin:0 auto 10px;">
      Los 5 comportamientos con mejor calificación (Fortalezas, #1 el más valorado) y los 5 con menor calificación
      (Puntos de mejora, #1 el que más debes mejorar), según las ${data.totalReceived} evaluaciones que recibiste.
    </p>
    <div class="grid">
      <div class="card">
        <p style="font-weight:700;font-size:12px;margin:0 0 8px;display:flex;align-items:center;gap:6px;">${icons.fortalezas ? `<img src="${icons.fortalezas}" alt="" style="width:18px;height:18px;" />` : "🏆"} Fortalezas</p>
        ${numberedList(theme, data.strengths)}
      </div>
      <div class="card">
        <p style="font-weight:700;font-size:12px;margin:0 0 8px;display:flex;align-items:center;gap:6px;">${icons.puntosMejora ? `<img src="${icons.puntosMejora}" alt="" style="width:18px;height:18px;" />` : "📝"} Puntos de mejora</p>
        ${numberedList(theme, data.improvements)}
      </div>
    </div>

    <p class="section-title">Resultados individuales por comportamiento</p>
    <div class="card">
      <p style="font-size:10px;color:${theme.textSecondary};margin:0 0 8px;">Tu calificación promedio en cada comportamiento evaluado, frente al promedio de Alegra.</p>
      ${horizontalRankingChart(theme, data.questionRanking, data.ratingMax)}
    </div>

    <p class="section-title">Comentarios</p>
    ${data.comments.map((c) => commentSection(theme, c)).join("")}

    <div style="text-align:center;margin-top:18px;padding:16px 0;">
      <p style="font-size:11px;font-weight:700;color:${theme.text};margin:0 0 3px;">El feedback es el combustible que impulsa nuestro crecimiento.</p>
      <p style="font-size:11px;font-weight:700;color:${theme.text};margin:0 0 12px;">Gracias por participar, ¡nos vemos en la próxima 360°!</p>
      <div style="display:flex;justify-content:center;">${logoBlock(theme, icons.logo, 14)}</div>
    </div>

  </div>
</body>
</html>`;
}
