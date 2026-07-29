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

export interface ReportTemplateLogo {
  /** Data-URI del logo. `null` = usar `public/report-icons/logo-alegra.png`. */
  logoDataUri: string | null;
  /** Data-URI del fondo decorativo del encabezado. `null` = usar `public/report-icons/header-bg.png`. */
  headerBgDataUri: string | null;
}

export type ReportTemplateDensity = "compacto" | "normal" | "amplio";

export interface ReportTemplateLayout {
  pageMarginX: number;
  pageMarginY: number;
  cardPadding: number;
  cardRadius: number;
  density: ReportTemplateDensity;
}

export interface ReportTemplateConfig {
  colors: ReportTemplateColors;
  logo: ReportTemplateLogo;
  layout: ReportTemplateLayout;
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
  },
  layout: {
    pageMarginX: 32,
    pageMarginY: 22,
    cardPadding: 14,
    cardRadius: 12,
    density: "normal",
  },
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
  };
}

// Factor de escala aplicado a fuentes/gráficos/gaps según la densidad elegida.
export function densityScale(density: ReportTemplateDensity): number {
  if (density === "compacto") return 0.88;
  if (density === "amplio") return 1.18;
  return 1;
}
