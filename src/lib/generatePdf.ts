import puppeteer from "puppeteer-core";

/**
 * Renderiza un HTML a PDF usando Chromium headless.
 * - Producción (Docker/Alpine): usa el Chromium del sistema instalado por apk
 *   (ver Dockerfile), apuntado por PUPPETEER_EXECUTABLE_PATH.
 * - Desarrollo local: si esa variable no está seteada, deja que Puppeteer
 *   busque un Chrome ya instalado en la máquina (channel "chrome").
 */
export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

  const browser = await puppeteer.launch({
    ...(executablePath ? { executablePath } : { channel: "chrome" as const }),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
