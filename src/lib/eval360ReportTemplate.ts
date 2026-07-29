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

// Reemplaza `{{clave}}` en un texto de `ReportCopyConfig` por el valor dado —
// así el admin puede editar libremente el texto sin perder los datos dinámicos
// (nombre, equipo, total de evaluaciones, texto de la pregunta). Los valores
// NO se escapan aquí: se usa solo para texto ya destinado a HTML plano (no
// para casos donde una parte deba ir en <strong>, ver `renderWithBold()`).
function interpolate(template: string, vars: Record<string, string>): string {
  return esc(template).replace(/\{\{(\w+)\}\}/g, (_, key) => esc(vars[key] ?? ""));
}

// Igual, pero sin escapar — para valores que se van a pasar por `esc()` una
// sola vez más adelante en el punto donde se renderizan (evita doble escape).
function interpolateRaw(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

// Igual que `interpolate()`, pero envuelve el valor sustituido en <strong> —
// para textos donde una parte (ej. el texto de la pregunta en Comentarios)
// debe resaltarse en negrita dentro de una oración editable por el admin.
function renderWithBold(template: string, placeholder: string, value: string): string {
  const parts = esc(template).split(`{{${placeholder}}}`);
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
function groupedBarChart(theme: Theme, blockScale: number, rows: CategoryComparisonRow[], max: number, mineLabel: string, benchLabel: string): string {
  if (rows.length === 0) {
    return `<p style="color:${SLATE_LIGHT};font-size:11px;text-align:center;padding:16px 0;">Sin datos suficientes todavía.</p>`;
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

  const bars = rows.map((r, i) => {
    const x0 = groupGap + i * (groupW + groupGap);
    const hMine = scale(r.mine);
    const hBench = scale(r.benchmark);
    return `
      <g>
        <rect x="${x0}" y="${chartH - hMine}" width="${barW}" height="${hMine}" rx="3" fill="${theme.primary}"></rect>
        <text x="${x0 + barW / 2}" y="${chartH - hMine - 5}" font-size="${valueFontSize}" font-weight="700" fill="${theme.text}" text-anchor="middle">${fmt(r.mine)}</text>
        <rect x="${x0 + barW + 5}" y="${chartH - hBench}" width="${barW}" height="${hBench}" rx="3" fill="${GRAY}"></rect>
        <text x="${x0 + barW + 5 + barW / 2}" y="${chartH - hBench - 5}" font-size="${valueFontSize}" font-weight="700" fill="${theme.textSecondary}" text-anchor="middle">${fmt(r.benchmark)}</text>
        <text x="${x0 + groupW / 2}" y="${chartH + 16}" font-size="${labelFontSize}" fill="${theme.textSecondary}" text-anchor="middle">${esc(r.category.length > 14 ? r.category.slice(0, 12) + "…" : r.category)}</text>
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
function horizontalRankingChart(theme: Theme, blockScale: number, rows: QuestionRankingRow[], max: number, mineLabel: string, benchLabel: string): string {
  if (rows.length === 0) return "";
  const pct = (v: number) => (max > 0 ? Math.min((v / max) * 100, 100) : 0);
  const fontSize = Math.round(10 * blockScale);

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
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:${fontSize}px;color:${theme.textSecondary};"><span style="width:9px;height:9px;border-radius:3px;background:${theme.primary};display:inline-block;"></span>${esc(mineLabel)}</span>
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:${fontSize}px;color:${theme.textSecondary};"><span style="width:9px;height:9px;border-radius:3px;background:${GRAY};display:inline-block;"></span>${esc(benchLabel)}</span>
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
    return `
      <div class="card" style="flex:1;min-width:150px;position:relative;background:${theme.background};">
        ${icon ? `<img src="${icon}" alt="" ${isFirstIcon ? 'data-edit="icon"' : ""} style="position:absolute;top:${-iconSize / 2}px;right:14px;width:${iconSize}px;height:${iconSize}px;object-fit:contain;" />` : ""}
        <p style="font-weight:700;color:${theme.text};font-size:${titleSize}px;margin:0 0 5px;padding-right:${icon ? iconSize + 10 : 0}px;">${esc(cat)}</p>
        ${desc ? `<p style="font-size:${descSize}px;color:${theme.textSecondary};line-height:1.45;margin:0;">${esc(desc)}</p>` : ""}
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
function badgedCardTitle(iconUri: string | null | undefined, fallbackEmoji: string, label: string, badgeSize: number): string {
  const badge = iconUri
    ? `<img src="${iconUri}" alt="" style="width:${badgeSize}px;height:${badgeSize}px;object-fit:contain;" />`
    : `<span style="font-size:${Math.round(badgeSize * 0.6)}px;">${fallbackEmoji}</span>`;
  return `
    <div style="position:absolute;top:${-badgeSize / 2}px;left:50%;transform:translateX(-50%);width:${badgeSize}px;height:${badgeSize}px;display:flex;align-items:center;justify-content:center;">${badge}</div>
    <p style="font-weight:700;font-size:12px;margin:${badgeSize / 2 + 6}px 0 8px;">${esc(label)}</p>`;
}

// Cada comentario individual evita partirse a la mitad (break-inside:avoid en
// el <p>), pero la tarjeta contenedora NO lo lleva: si se fuerza a que la
// tarjeta completa (que puede tener decenas de comentarios) no se parta,
// Chromium la empuja entera a la siguiente página y deja un hueco en blanco
// en la actual — el mismo bug que ya se corrigió en el gráfico de ranking.
// Cada tarjeta lleva su propio título "Comentarios" centrado (igual que el
// PDF de referencia) — no hay un título de sección aparte para todo el bloque.
function commentSection(theme: Theme, blockScale: number, cardTitle: string, questionIntroTemplate: string, c: ReportComment): string {
  if (c.answers.length === 0) return "";
  const titleSize = Math.round(13 * blockScale);
  const descSize = Math.round(10 * blockScale);
  const textSize = (10.5 * blockScale).toFixed(1);
  const questionIntro = renderWithBold(questionIntroTemplate, "pregunta", c.questionText);
  return `
    <div class="card" style="margin-bottom:14px;">
      <p style="font-weight:800;font-size:${titleSize}px;color:${theme.text};text-align:center;margin:0 0 6px;">${esc(cardTitle)}</p>
      <p style="font-size:${descSize}px;color:${theme.textSecondary};text-align:center;margin:0 0 10px;">${questionIntro}</p>
      <div style="display:flex;flex-direction:column;gap:7px;">
        ${c.answers.map((a) => `<p style="background:#f8fafc;border-radius:10px;padding:10px 13px;font-size:${textSize}px;color:${theme.textSecondary};font-style:italic;line-height:1.45;margin:0;break-inside:avoid;">&ldquo;${esc(a)}&rdquo;</p>`).join("")}
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

  // Tarjetas del comparativo: las 3 fijas en el orden configurado, más cada
  // sección personalizada insertada justo después de su ancla (o al final).
  const anchorCards: Record<AnchorKey, { title: string; desc: string; chart: string }> = {
    alegra: {
      title: copy.comparativos.alegra.title,
      desc: copy.comparativos.alegra.desc,
      chart: groupedBarChart(theme, comparativosScale, data.vsAlegra, data.ratingMax, copy.comparativos.alegra.mineLabel, copy.comparativos.alegra.benchLabel),
    },
    team: {
      title: copy.comparativos.team.title,
      desc: interpolateRaw(copy.comparativos.team.desc, { equipo: data.team ? ` (${data.team})` : "" }),
      chart: groupedBarChart(theme, comparativosScale, data.vsTeam, data.ratingMax, copy.comparativos.team.mineLabel, copy.comparativos.team.benchLabel),
    },
    auto: {
      title: copy.comparativos.auto.title,
      desc: copy.comparativos.auto.desc,
      chart: groupedBarChart(theme, comparativosScale, data.vsAuto, data.ratingMax, copy.comparativos.auto.mineLabel, copy.comparativos.auto.benchLabel),
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
  const sectionToCard = (section: CustomSectionResult) => ({
    title: `Análisis de ${section.name}`,
    desc: section.description ?? copy.comparativos.customDefaultDesc,
    chart: groupedBarChart(theme, comparativosScale, section.rows, data.ratingMax, copy.comparativos.customMineLabel, copy.comparativos.customBenchLabel),
  });
  const comparisonCards: { title: string; desc: string; chart: string }[] = [];
  config.blocks.comparativos.fixedOrder.forEach((key) => {
    comparisonCards.push(anchorCards[key]);
    afterMap[key].forEach((s) => comparisonCards.push(sectionToCard(s)));
  });
  endList.forEach((s) => comparisonCards.push(sectionToCard(s)));

  // Contenido de cada bloque reordenable, renderizado una vez y ensamblado
  // según `config.blocks.order`.
  const blockHtml: Record<ReportBlockId, string> = {
    competencias: `
      <p class="section-title">${esc(copy.competencias.title)}</p>
      <div class="grid">${competencyCards(theme, competenciasScale, config.blocks.competencias.iconSize, categories, icons, config.blocks.competencias.categoryIcons, copy.competencias.categoryDescriptions)}</div>`,
    comparativos: `
      <p class="section-title">${esc(copy.comparativos.title)}</p>
      <div class="grid">
        ${comparisonCards.map((c) => `
          <div class="card">
            <p style="font-weight:700;font-size:12px;margin:0 0 3px;">${esc(c.title)}</p>
            <p style="font-size:10px;color:${theme.textSecondary};margin:0 0 8px;">${esc(c.desc)}</p>
            ${c.chart}
          </div>`).join("")}
      </div>`,
    comportamientos: `
      <p class="section-title">${esc(copy.comportamientos.title)}</p>
      <p style="font-size:10px;color:${theme.textSecondary};text-align:center;max-width:620px;margin:0 auto 10px;">
        ${interpolate(copy.comportamientos.description, { total: String(data.totalReceived) })}
      </p>
      <div class="grid">
        <div class="card" style="position:relative;">
          ${badgedCardTitle(icons.fortalezas, "🏆", copy.comportamientos.fortalezasLabel, 36)}
          ${numberedList(theme, comportamientosScale, data.strengths)}
        </div>
        <div class="card" style="position:relative;">
          ${badgedCardTitle(icons.puntosMejora, "📝", copy.comportamientos.mejorasLabel, 36)}
          ${numberedList(theme, comportamientosScale, data.improvements)}
        </div>
      </div>`,
    ranking: `
      <p class="section-title">${esc(copy.ranking.title)}</p>
      <div class="card">
        <p style="font-size:10px;color:${theme.textSecondary};margin:0 0 8px;">${esc(copy.ranking.description)}</p>
        ${horizontalRankingChart(theme, rankingScale, data.questionRanking, data.ratingMax, copy.ranking.mineLabel, copy.ranking.benchLabel)}
      </div>`,
    comentarios: data.comments.map((c) => commentSection(theme, comentariosScale, copy.comentarios.cardTitle, copy.comentarios.questionIntro, c)).join(""),
  };
  const orderedBlocks = config.blocks.order.map((id) => `<div data-edit-block="${id}">${blockHtml[id]}</div>`).join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<style>
  * { box-sizing: border-box; overflow-wrap: anywhere; }
  @page { size: A4; margin: 0; }
  body { margin:0; font-family: 'Segoe UI', Arial, sans-serif; background:#fff; color:${theme.text}; }
  .page { position:relative; padding: ${theme.pageMarginY}px ${theme.pageMarginX}px; }
  .card { background:#fff; border:1px solid ${theme.cardBorder}; border-radius:${theme.cardRadius}px; padding:${theme.cardPadding}px ${theme.cardPadding + 2}px; break-inside:avoid; }
  .section-title { font-size:13px; font-weight:800; color:${theme.text}; text-align:center; margin: 18px 0 10px; break-after: avoid-page; break-inside: avoid; }
  .grid { display:flex; gap:10px; flex-wrap:wrap; }
  .grid > .card { flex:1; min-width:220px; }
</style>
</head>
<body>

  <!-- Encabezado: imagen y texto son dos capas de un mismo grid apilado
       (grid-area:1/1), no una imagen "cover" ni un overlay absoluto dentro de
       un contenedor con overflow:hidden — así la fila crece hasta la altura
       que necesite el texto (ahora editable, largo variable) sin recortarlo,
       y la imagen conserva su proporción real sin deformarse ni ser recortada. -->
  <div style="display:grid;background:${theme.background};">
    ${icons.headerBg
      ? `<img src="${icons.headerBg}" alt="" style="grid-area:1/1;align-self:start;width:100%;height:auto;" />`
      : `<div style="grid-area:1/1;height:150px;"></div>`}
    <div style="grid-area:1/1;align-self:start;padding:20px ${theme.pageMarginX}px 26px;">
      <div style="display:flex;justify-content:${justify};margin:0 0 14px;"><div data-edit="logo" style="transform:translate(${theme.logoOffsetX}px,${theme.logoOffsetY}px);">${logoBlock(theme, icons.logo, theme.logoSize)}</div></div>
      <h1 style="font-size:20px;font-weight:900;color:${theme.text};margin:0 0 6px;">${interpolate(copy.header.greeting, { nombre: firstName })}</h1>
      <p style="font-size:12px;color:${theme.textSecondary};margin:0;max-width:480px;">${esc(copy.header.subtitle)}</p>
    </div>
  </div>

  <div class="page">

    ${orderedBlocks}

    <!-- Capa de cuadros de texto libres (branding/notas), adicional al
         contenido estructurado — posicionados por coordenadas absolutas
         relativas a .page. Con customTextBoxes:[] (default) no renderiza nada. -->
    ${config.customTextBoxes.map((box) => `
      <div data-edit-textbox="${box.id}" style="position:absolute;left:${box.x}px;top:${box.y}px;width:${box.width}px;color:${esc(box.color)};font-size:${box.fontSize}px;white-space:pre-wrap;overflow-wrap:anywhere;break-inside:avoid;z-index:50;">${esc(box.text)}</div>`).join("")}

    <div style="text-align:center;margin-top:18px;padding:16px 0;">
      <p style="font-size:11px;font-weight:700;color:${theme.text};margin:0 0 3px;">${esc(copy.footer.line1)}</p>
      <p style="font-size:11px;font-weight:700;color:${theme.text};margin:0 0 12px;">${esc(copy.footer.line2)}</p>
      <div style="display:flex;justify-content:${justify};">${logoBlock(theme, icons.logo, Math.round(theme.logoSize * 0.875))}</div>
    </div>

  </div>
</body>
</html>`;
}
