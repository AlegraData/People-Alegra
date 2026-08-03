import { getSharedBrowser, resetSharedBrowser } from "./pdfBrowser";

/**
 * Renderiza un HTML a PDF usando Chromium headless.
 * - Producción (Docker/Alpine): usa el Chromium del sistema instalado por apk
 *   (ver Dockerfile), apuntado por PUPPETEER_EXECUTABLE_PATH.
 * - Desarrollo local: si esa variable no está seteada, deja que Puppeteer
 *   busque un Chrome ya instalado en la máquina (channel "chrome").
 *
 * `marginPx`/`backgroundColor` reproducen el mismo margen vertical y color de
 * fondo de página que ya trae el HTML vía `@page`/`body` (ver
 * eval360ReportTemplate.ts) — pero Chromium/Puppeteer NO soporta los
 * margin-boxes de CSS (`@top-center` etc.) que sí usa la vista en vivo con
 * pagedjs para pintar esa franja, así que el margen se ve blanco a menos que
 * se rellene con su propio mecanismo: `headerTemplate`/`footerTemplate`, que
 * si son un simple div de color, quedan pintando exactamente esa franja.
 *
 * El browser en sí se reutiliza entre llamadas (ver pdfBrowser.ts) — lanzar
 * un proceso de Chromium nuevo cada vez costaba cientos de ms a un par de
 * segundos, lo que obligaba a que el PDF real solo se generara bajo demanda
 * (un botón) en vez de poder refrescarse solo mientras se edita la plantilla.
 * Solo la `page` se abre/cierra por render — el browser sigue vivo para el
 * siguiente request.
 */
// Alto de una hoja A4 a 96dpi — solo se usa como cota superior de la búsqueda
// binaria de más abajo (no necesita ser exacto: si se pasa por unos pocos
// px, la búsqueda simplemente gasta una iteración de más).
const A4_HEIGHT_PX = 1123;

type PdfPage = import("puppeteer-core").Page;
type PdfOptions = NonNullable<Parameters<PdfPage["pdf"]>[0]>;

// Cuenta hojas contando objetos `/Type /Page` en el PDF crudo — no requiere
// parsear la estructura completa y es exacto para el output de Chromium.
function countPdfPages(pdfBuffer: Buffer): number {
  const raw = pdfBuffer.toString("latin1");
  return (raw.match(/\/Type\s*\/Page[^s]/g) || []).length;
}

async function setFooterSpacerHeight(page: PdfPage, px: number): Promise<boolean> {
  return page.evaluate((h) => {
    const spacerEl = document.querySelector<HTMLElement>("[data-footer-spacer]");
    if (!spacerEl) return false;
    spacerEl.style.height = `${h}px`;
    return true;
  }, px);
}

/**
 * Si el HTML trae los marcadores `[data-footer-spacer]`/`[data-report-footer]`
 * (ver eval360ReportTemplate.ts), agranda el spacer hasta que el footer quede
 * pegado al margen inferior físico de la hoja donde cae de forma natural —
 * la misma hoja del último comentario si hay espacio, o la siguiente si no
 * alcanza a caber (el footer tiene break-inside:avoid, nunca se parte).
 *
 * Se intentó primero medir la posición del footer en el layout CONTINUO de
 * pantalla (sin cortes) y calcular el relleno por aritmética (offset % alto
 * de hoja) — funcionaba en reportes cortos, pero fallaba en reportes largos
 * (ver testFinal.pdf, 22 hojas: el footer aparecía a la mitad de la última
 * hoja, no al fondo). La causa: cuando la sección de comentarios cruza
 * varios cortes de página, algunas tarjetas de comentario (break-inside:
 * avoid) saltan enteras a una hoja nueva y dejan un hueco en la anterior —
 * espacio "perdido" que el layout continuo de pantalla no tiene (ahí todo
 * fluye sin huecos), así que la aritmética simple se desviaba más cuantas
 * más hojas hubiera de por medio.
 *
 * Este reemplazo no calcula nada: prueba directamente contra el PDF real.
 * 1) Renderiza con el spacer en 0 y cuenta las hojas resultantes — ese
 *    número YA es la hoja correcta donde debe aterrizar el footer (Chromium
 *    decidió su ubicación real, huecos incluidos).
 * 2) Búsqueda binaria del spacer más grande que sigue dando ese mismo total
 *    de hojas (más grande = más pegado al fondo; en cuanto se pasa, salta a
 *    una hoja extra). Cada paso es un page.pdf() real sobre el mismo
 *    documento ya cargado (no relanza Chromium ni recarga el HTML).
 */
async function renderWithFooterPinnedToLastPage(page: PdfPage, pdfOptions: PdfOptions, marginPx: number, pinFooter: boolean): Promise<Buffer> {
  const hasFooter = await setFooterSpacerHeight(page, 0);
  const basePdf = Buffer.from(await page.pdf(pdfOptions));
  if (!hasFooter || marginPx <= 0 || !pinFooter) return basePdf;

  const targetPages = countPdfPages(basePdf);
  let lo = 0;
  let hi = A4_HEIGHT_PX - 2 * marginPx;
  let best = basePdf;

  // 6 iteraciones ≈ precisión de ~17px sobre una hoja completa de rango —
  // de sobra para verse "pegado al fondo"; más allá de eso es gasto de
  // renders extra sin ganancia visual perceptible.
  for (let i = 0; i < 6; i++) {
    const mid = Math.round((lo + hi) / 2);
    await setFooterSpacerHeight(page, mid);
    const candidate = Buffer.from(await page.pdf(pdfOptions));
    if (countPdfPages(candidate) === targetPages) {
      lo = mid;
      best = candidate;
    } else {
      hi = mid;
    }
  }
  return best;
}

export async function generatePdfFromHtml(
  html: string,
  options?: { marginPx?: number; backgroundColor?: string; pinFooterToLastPage?: boolean }
): Promise<Buffer> {
  const marginPx = options?.marginPx ?? 0;
  const backgroundColor = options?.backgroundColor ?? "#ffffff";
  // La búsqueda binaria de renderWithFooterPinnedToLastPage cuesta hasta 7
  // renders de Puppeteer por PDF (1 base + 6 de búsqueda) — imperceptible en
  // desarrollo (Chrome nativo, varios núcleos), pero en Cloud Run (1 vCPU) esa
  // multiplicación convirtió cada refresco automático de la vista previa
  // (dispara sola con cada edición) en una petición de 5-18s y el servicio
  // entró en autoscaling por CPU — el panel "PDF real" quedaba en blanco
  // porque, para cuando una respuesta lenta llegaba, ya había una petición
  // más nueva en curso y esa vieja se descartaba (mismo patrón para todas).
  // Por defecto sigue activo (true) para el PDF final que se descarga o se
  // envía por correo, donde sí importa que quede exacto y que solo se
  // genere una vez por acción del usuario, no en un loop de auto-refresco.
  const pinFooterToLastPage = options?.pinFooterToLastPage ?? true;
  const fillerTemplate = `<div style="width:100%;height:100%;margin:0;padding:0;background:${backgroundColor};"></div>`;
  const pdfOptions: PdfOptions = {
    format: "A4",
    printBackground: true,
    margin: { top: `${marginPx}px`, bottom: `${marginPx}px`, left: "0px", right: "0px" },
    displayHeaderFooter: marginPx > 0,
    headerTemplate: fillerTemplate,
    footerTemplate: fillerTemplate,
  };

  const render = async () => {
    const browser = await getSharedBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "load" });
      return await renderWithFooterPinnedToLastPage(page, pdfOptions, marginPx, pinFooterToLastPage);
    } finally {
      await page.close();
    }
  };

  try {
    return await render();
  } catch {
    // El browser compartido pudo haberse caído entre el chequeo de
    // `.connected` y este render (crash a mitad de vuelo) — se relanza y se
    // reintenta una sola vez antes de propagar el error.
    resetSharedBrowser();
    return await render();
  }
}
