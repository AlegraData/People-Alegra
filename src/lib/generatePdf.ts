import puppeteer from "puppeteer-core";

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
 */
export async function generatePdfFromHtml(html: string, options?: { marginPx?: number; backgroundColor?: string }): Promise<Buffer> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  const marginPx = options?.marginPx ?? 0;
  const backgroundColor = options?.backgroundColor ?? "#ffffff";

  const browser = await puppeteer.launch({
    ...(executablePath ? { executablePath } : { channel: "chrome" as const }),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const fillerTemplate = `<div style="width:100%;height:100%;margin:0;padding:0;background:${backgroundColor};"></div>`;
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
    await browser.close();
  }
}
