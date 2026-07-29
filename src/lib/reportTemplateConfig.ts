/**
 * Configuración visual GLOBAL (un solo registro, compartido por todas las
 * encuestas 360° presentes y futuras) de la plantilla PDF de reportes. Se
 * gestiona desde Reportes → Plantilla y se lee en cada generación de PDF.
 */
import prisma from "@/lib/prisma";

export interface ReportTemplateColors {
  primary: string;
  primaryDark: string;
  text: string;
  textSecondary: string;
  background: string;
  cardBorder: string;
}

export type LogoAlign = "left" | "center" | "right";

export interface ReportTemplateLogo {
  /** Data-URI del logo. `null` = usar `public/report-icons/logo-alegra.png`. */
  logoDataUri: string | null;
  /** Data-URI del fondo decorativo del encabezado. `null` = usar `public/report-icons/header-bg.png`. */
  headerBgDataUri: string | null;
  /** Alineación del logo dentro del encabezado. */
  align: LogoAlign;
  /** Alto en px del logo del encabezado (el del pie se deriva proporcional). */
  size: number;
  /** Nudge en px sobre la posición de `align`, ajustable arrastrando el logo en el editor. Solo aplica al logo del encabezado (el del pie usa `align` sin nudge). */
  headerOffsetX: number;
  headerOffsetY: number;
}

export type ReportTemplateDensity = "compacto" | "normal" | "amplio";

export interface ReportTemplateLayout {
  pageMarginX: number;
  pageMarginY: number;
  cardPadding: number;
  cardRadius: number;
  density: ReportTemplateDensity;
}

/** Los 5 bloques de contenido reordenables del reporte (encabezado/pie no se reordenan). */
export type ReportBlockId = "competencias" | "comparativos" | "comportamientos" | "ranking" | "comentarios";

export interface ReportBlocksConfig {
  order: ReportBlockId[];
  competencias: {
    fontScale: number;
    iconSize: number;
    /** Categoría (texto exacto) → clave de ícono en Eval360ReportIcons, o `null` = sin ícono.
     *  Si una categoría no aparece aquí, se usa el match automático por nombre conocido. */
    categoryIcons: Record<string, string | null>;
  };
  comparativos: {
    fontScale: number;
    fixedOrder: ["alegra", "team", "auto"];
  };
  comportamientos: { fontScale: number };
  ranking: { fontScale: number };
  comentarios: { fontScale: number };
}

/** Todo el texto visible del reporte, editable desde Reportes → Plantilla.
 *  Algunos campos admiten placeholders `{{clave}}` resueltos por `interpolate()`
 *  en `eval360ReportTemplate.ts`: {{nombre}} (saludo), {{equipo}} (Technical
 *  Team), {{total}} (Comportamientos), {{pregunta}} (Comentarios). */
export interface ReportCopyConfig {
  header: { greeting: string; subtitle: string };
  competencias: {
    title: string;
    /** Categoría (texto exacto) → descripción, o `null` = sin descripción explícita.
     *  Si una categoría no aparece aquí, se usa el texto conocido por defecto. */
    categoryDescriptions: Record<string, string | null>;
  };
  comparativos: {
    title: string;
    alegra: { title: string; desc: string; mineLabel: string; benchLabel: string };
    team: { title: string; desc: string; mineLabel: string; benchLabel: string };
    auto: { title: string; desc: string; mineLabel: string; benchLabel: string };
    customDefaultDesc: string;
    customMineLabel: string;
    customBenchLabel: string;
  };
  comportamientos: { title: string; description: string; fortalezasLabel: string; mejorasLabel: string };
  ranking: { title: string; description: string; mineLabel: string; benchLabel: string };
  comentarios: { cardTitle: string; questionIntro: string };
  footer: { line1: string; line2: string };
}

/** Cuadro de texto libre agregado por el admin, encima del documento
 *  estructurado — capa adicional (no reemplaza las secciones normales).
 *  Posicionado por coordenadas absolutas en px relativas a `.page`: como el
 *  contenido de arriba varía en altura según el evaluado, un cuadro colocado
 *  muy abajo puede no alinearse siempre con la misma sección visual entre un
 *  reporte y otro — más estable cerca del encabezado. */
export interface CustomTextBox {
  id: string;
  text: string;
  x: number;
  y: number;
  width: number;
  color: string;
  fontSize: number;
}

export interface ReportTemplateConfig {
  colors: ReportTemplateColors;
  logo: ReportTemplateLogo;
  layout: ReportTemplateLayout;
  blocks: ReportBlocksConfig;
  copy: ReportCopyConfig;
  customTextBoxes: CustomTextBox[];
}

// Valores idénticos a las constantes hardcodeadas históricas — nada cambia
// visualmente hasta que un admin guarde un ajuste distinto desde la UI.
export const DEFAULT_TEMPLATE_CONFIG: ReportTemplateConfig = {
  colors: {
    primary: "#00D6BC",
    primaryDark: "#00b8a3",
    text: "#1e293b",
    textSecondary: "#64748b",
    background: "#f1f5f9",
    cardBorder: "#e2e8f0",
  },
  logo: {
    logoDataUri: null,
    headerBgDataUri: null,
    align: "left",
    size: 16,
    headerOffsetX: 0,
    headerOffsetY: 0,
  },
  layout: {
    pageMarginX: 32,
    pageMarginY: 22,
    cardPadding: 14,
    cardRadius: 12,
    density: "normal",
  },
  blocks: {
    order: ["competencias", "comparativos", "comportamientos", "ranking", "comentarios"],
    competencias: { fontScale: 1, iconSize: 22, categoryIcons: {} },
    comparativos: { fontScale: 1, fixedOrder: ["alegra", "team", "auto"] },
    comportamientos: { fontScale: 1 },
    ranking: { fontScale: 1 },
    comentarios: { fontScale: 1 },
  },
  copy: {
    header: {
      greeting: "¡Hola, {{nombre}}!",
      subtitle: "Te compartimos un resumen de los resultados que obtuviste en tu Feedback 360° 🚀",
    },
    competencias: {
      title: "Competencias analizadas",
      categoryDescriptions: {},
    },
    comparativos: {
      title: "Comparativo de tus resultados",
      alegra: {
        title: "Análisis frente a Alegra",
        desc: "Conoce tu posición en cada competencia frente al promedio de toda Alegra.",
        mineLabel: "Tú", benchLabel: "Alegra",
      },
      team: {
        title: "Análisis frente a tu Technical Team",
        desc: "Conoce tus resultados frente al promedio de tu equipo{{equipo}}.",
        mineLabel: "Tú", benchLabel: "Tu equipo",
      },
      auto: {
        title: "Análisis de tu Autoevaluación",
        desc: "Revisa cómo las opiniones recibidas sobre ti coinciden con tu autoevaluación.",
        mineLabel: "Recibido", benchLabel: "Autoevaluación",
      },
      customDefaultDesc: "Revisa cómo las opiniones recibidas sobre ti se comparan con el promedio Alegra, Technical Team y Autoevaluación.",
      customMineLabel: "Alegra",
      customBenchLabel: "Equipo/Auto",
    },
    comportamientos: {
      title: "Comportamientos evaluados",
      description: "Los 5 comportamientos con mejor calificación (Fortalezas, #1 el más valorado) y los 5 con menor calificación (Puntos de mejora, #1 el que más debes mejorar), según las {{total}} evaluaciones que recibiste.",
      fortalezasLabel: "Fortalezas",
      mejorasLabel: "Puntos de mejora",
    },
    ranking: {
      title: "Resultados individuales por comportamiento",
      description: "Tu calificación promedio en cada comportamiento evaluado, frente al promedio de Alegra.",
      mineLabel: "Tu resultado",
      benchLabel: "Promedio Alegra",
    },
    comentarios: {
      cardTitle: "Comentarios",
      questionIntro: "Revisa los mensajes que dejaron sobre ti en la sección “{{pregunta}}”.",
    },
    footer: {
      line1: "El feedback es el combustible que impulsa nuestro crecimiento.",
      line2: "Gracias por participar, ¡nos vemos en la próxima 360°!",
    },
  },
  customTextBoxes: [],
};

const SINGLETON_ID = "singleton";

/** Devuelve el config guardado, o el default si todavía no se ha guardado nada. */
export async function getReportTemplateConfig(): Promise<ReportTemplateConfig> {
  const row = await prisma.evaluation360ReportTemplate.findUnique({ where: { id: SINGLETON_ID } });
  if (!row) return DEFAULT_TEMPLATE_CONFIG;
  return mergeWithDefaults(row.config as Partial<ReportTemplateConfig>);
}

export async function saveReportTemplateConfig(config: ReportTemplateConfig, updatedBy?: string | null): Promise<void> {
  await prisma.evaluation360ReportTemplate.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, config: config as object, updatedBy: updatedBy ?? null },
    update: { config: config as object, updatedBy: updatedBy ?? null },
  });
}

// Rellena con defaults cualquier clave faltante — protege contra configs
// guardados con una versión anterior del formulario que no tenía todos los campos.
function mergeWithDefaults(partial: Partial<ReportTemplateConfig>): ReportTemplateConfig {
  return {
    colors: { ...DEFAULT_TEMPLATE_CONFIG.colors, ...partial.colors },
    logo: { ...DEFAULT_TEMPLATE_CONFIG.logo, ...partial.logo },
    layout: { ...DEFAULT_TEMPLATE_CONFIG.layout, ...partial.layout },
    blocks: {
      order: partial.blocks?.order?.length ? partial.blocks.order : DEFAULT_TEMPLATE_CONFIG.blocks.order,
      competencias: { ...DEFAULT_TEMPLATE_CONFIG.blocks.competencias, ...partial.blocks?.competencias, categoryIcons: { ...partial.blocks?.competencias?.categoryIcons } },
      comparativos: { ...DEFAULT_TEMPLATE_CONFIG.blocks.comparativos, ...partial.blocks?.comparativos },
      comportamientos: { ...DEFAULT_TEMPLATE_CONFIG.blocks.comportamientos, ...partial.blocks?.comportamientos },
      ranking: { ...DEFAULT_TEMPLATE_CONFIG.blocks.ranking, ...partial.blocks?.ranking },
      comentarios: { ...DEFAULT_TEMPLATE_CONFIG.blocks.comentarios, ...partial.blocks?.comentarios },
    },
    copy: {
      header: { ...DEFAULT_TEMPLATE_CONFIG.copy.header, ...partial.copy?.header },
      competencias: {
        ...DEFAULT_TEMPLATE_CONFIG.copy.competencias, ...partial.copy?.competencias,
        categoryDescriptions: { ...partial.copy?.competencias?.categoryDescriptions },
      },
      comparativos: {
        ...DEFAULT_TEMPLATE_CONFIG.copy.comparativos, ...partial.copy?.comparativos,
        alegra: { ...DEFAULT_TEMPLATE_CONFIG.copy.comparativos.alegra, ...partial.copy?.comparativos?.alegra },
        team: { ...DEFAULT_TEMPLATE_CONFIG.copy.comparativos.team, ...partial.copy?.comparativos?.team },
        auto: { ...DEFAULT_TEMPLATE_CONFIG.copy.comparativos.auto, ...partial.copy?.comparativos?.auto },
      },
      comportamientos: { ...DEFAULT_TEMPLATE_CONFIG.copy.comportamientos, ...partial.copy?.comportamientos },
      ranking: { ...DEFAULT_TEMPLATE_CONFIG.copy.ranking, ...partial.copy?.ranking },
      comentarios: { ...DEFAULT_TEMPLATE_CONFIG.copy.comentarios, ...partial.copy?.comentarios },
      footer: { ...DEFAULT_TEMPLATE_CONFIG.copy.footer, ...partial.copy?.footer },
    },
    customTextBoxes: partial.customTextBoxes ?? [],
  };
}

// Factor de escala aplicado a fuentes/gráficos/gaps según la densidad elegida.
export function densityScale(density: ReportTemplateDensity): number {
  if (density === "compacto") return 0.88;
  if (density === "amplio") return 1.18;
  return 1;
}
