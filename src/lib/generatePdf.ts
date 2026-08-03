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
export async function generatePdfFromHtml(html: string, options?: { marginPx?: number; backgroundColor?: string }): Promise<Buffer> {
  const marginPx = options?.marginPx ?? 0;
  const backgroundColor = options?.backgroundColor ?? "#ffffff";
  const fillerTemplate = `<div style="width:100%;height:100%;margin:0;padding:0;background:${backgroundColor};"></div>`;

  const render = async () => {
    const browser = await getSharedBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: "load" });
      const pdf = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: `${marginPx}px`, bottom: `${marginPx}px`, left: "0px", right: "0px" },
        displayHeaderFooter: marginPx > 0,
        headerTemplate: fillerTemplate,
        footerTemplate: fillerTemplate,
      });
      return Buffer.from(pdf);
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
