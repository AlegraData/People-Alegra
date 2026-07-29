/**
 * Filtro heurístico de comentarios "basura" (no aplica, n/a, ".", etc.) para
 * que no aparezcan en el reporte PDF. No borra nada de la base de datos ni del
 * Excel exportado — solo decide qué entra al PDF; el admin sigue viendo todo
 * en Resultados/Excel.
 */

// Frases completas (ya normalizadas: sin tildes, minúsculas, sin puntuación final)
// que casi siempre significan "no tengo comentario", no una respuesta real.
const JUNK_PHRASES = new Set([
  "no aplica", "no aplica por el momento", "n/a", "na", "ninguno", "ninguna",
  "ninguno por el momento", "ninguna por el momento", "ninguna por ahora",
  "ninguno por ahora", "nada", "nada por el momento", "nada por ahora",
  "de momento ninguno", "de momento nada", "de momento ninguna",
  "no tengo", "no tengo comentarios", "no tengo comentario",
  "no tengo nada que agregar", "no tengo sugerencias", "sin comentarios",
  "sin comentario", "sin sugerencias", "no hay comentarios", "no hay",
  "no se me ocurre nada", "no se", "no sabria decir", "no lo se",
  "ninguna sugerencia", "ninguna observacion", "no tengo observaciones",
  "ok", "ninguno de momento", "no tiene", "no cuento con informacion",
]);

function normalize(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // quitar tildes
    .toLowerCase()
    .trim()
    .replace(/[.,!¡¿?;:]+$/g, "") // puntuación final
    .replace(/\s+/g, " ");
}

/** Igual que el filtro interno de `filterJunkComments`, pero para un solo comentario a la vez. */
export function isJunkComment(raw: string): boolean {
  const norm = normalize(raw);
  if (!norm) return true;
  if (JUNK_PHRASES.has(norm)) return true;
  // Solo símbolos/puntuación (p. ej. "-", ".", "x", "...")
  if (/^[.\-_*xX\s]{1,4}$/.test(norm)) return true;
  // Ruido extremadamente corto que no calzó ninguna frase conocida
  const alnum = norm.replace(/[^a-z0-9]/g, "");
  if (alnum.length <= 2) return true;
  return false;
}

/** Filtra respuestas basura de una lista de comentarios de una pregunta abierta. */
export function filterJunkComments(answers: (string | number)[]): (string | number)[] {
  return answers.filter((a) => (typeof a === "string" ? !isJunkComment(a) : true));
}
