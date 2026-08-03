import puppeteer, { type Browser } from "puppeteer-core";

/**
 * Instancia de Chromium reutilizada entre requests (en vez de lanzar y cerrar
 * un proceso nuevo en cada PDF, como hacía antes `generatePdf.ts`). Lanzar
 * Chromium cuesta cientos de ms a un par de segundos; reutilizarlo es lo que
 * permite regenerar el PDF real automáticamente en cada pausa de edición
 * (ver el debounce en EvalReportTemplateEditor.tsx) sin que la vista previa
 * se sienta lenta. Cloud Run mantiene el proceso caliente entre requests
 * mientras la instancia siga viva, así que este singleton sobrevive con ella.
 */
let browserPromise: Promise<Browser> | null = null;

async function launchBrowser(): Promise<Browser> {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  return puppeteer.launch({
    ...(executablePath ? { executablePath } : { channel: "chrome" as const }),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
}

/** Devuelve el browser compartido, relanzándolo si el anterior se cayó (crash,
 *  OOM del contenedor, etc.) — `.connected` es síncrono y barato, así que se
 *  puede chequear en cada llamada sin costo real. */
export async function getSharedBrowser(): Promise<Browser> {
  if (browserPromise) {
    const browser = await browserPromise;
    if (browser.connected) return browser;
    browserPromise = null;
  }
  browserPromise = launchBrowser();
  return browserPromise;
}

/** Fuerza que la próxima llamada a `getSharedBrowser()` lance una instancia
 *  nueva — usado como reintento cuando el browser reusado muere a mitad de un
 *  render (entre el chequeo de `isConnected()` y el uso real). */
export function resetSharedBrowser(): void {
  browserPromise = null;
}
