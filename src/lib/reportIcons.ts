/**
 * Carga e inlinea (base64) los íconos y el logo real del reporte PDF, desde
 * `public/report-icons/`. Puppeteer con `page.setContent()` no resuelve rutas
 * relativas como `/report-icons/logo.png`, así que hay que leerlos del disco
 * y embeberlos como data-URI directamente en el HTML.
 */
import fs from "fs";
import path from "path";
import type { Eval360ReportIcons } from "./eval360ReportTemplate";
import type { ReportTemplateConfig } from "./reportTemplateConfig";

const ICONS_DIR = path.join(process.cwd(), "public", "report-icons");

const FILES: Record<keyof Eval360ReportIcons, string> = {
  logo: "logo-alegra.png",
  headerBg: "header-bg.png",
  compromiso: "compromiso.png",
  conocimiento: "conocimiento.png",
  comunicacion: "comunicacion.png",
  trabajoEquipo: "trabajo-equipo.png",
  fortalezas: "fortalezas.png",
  puntosMejora: "puntos-mejora.png",
};

function readAsDataUri(fileName: string): string | null {
  try {
    const buf = fs.readFileSync(path.join(ICONS_DIR, fileName));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

let cached: Eval360ReportIcons | null = null;

/** Si falta algún archivo, esa clave queda `null` y la plantilla cae a su
 * fallback (wordmark de texto o emoji) — nunca se inventa un ícono. */
export function loadReportIcons(): Eval360ReportIcons {
  if (cached) return cached;
  cached = Object.fromEntries(
    (Object.entries(FILES) as [keyof Eval360ReportIcons, string][]).map(([key, file]) => [key, readAsDataUri(file)])
  ) as Eval360ReportIcons;
  return cached;
}

/** Sobreescribe `logo`/`headerBg` con lo que el admin haya subido desde Reportes
 * → Plantilla (config global); los demás íconos siempre vienen del archivo. */
export function resolveReportIcons(fileIcons: Eval360ReportIcons, templateConfig: ReportTemplateConfig): Eval360ReportIcons {
  return {
    ...fileIcons,
    logo: templateConfig.logo.logoDataUri ?? fileIcons.logo,
    headerBg: templateConfig.logo.headerBgDataUri ?? fileIcons.headerBg,
  };
}
