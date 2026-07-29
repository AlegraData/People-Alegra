import type { Eval360Question, Eval360Questions, EvalType, CustomReportSection } from "@/types/evaluaciones360";

/** Una fila de asignación enviada, con lo mínimo que necesita este módulo. */
export interface SubmittedAssignmentLike {
  evaluateeEmail: string;
  evaluationType: string;
  finalAnswers: unknown;
}

export interface SurveyBenchmarks {
  /** Promedio "Alegra" por pregunta (todas las respuestas no-autoevaluación). */
  alegraQuestionAvg: Map<string, number>;
  /** Promedio por Technical Team y por pregunta. */
  teamQuestionAvg: Map<string, Map<string, number>>;
  /** Promedio "Alegra" por categoría/competencia (ponderado por el peso de cada pregunta). */
  alegraCategoryAvg: Map<string, number>;
  /** Promedio por Technical Team y por categoría. */
  teamCategoryAvg: Map<string, Map<string, number>>;
}

/**
 * Calcula los promedios de referencia ("Alegra" y por Technical Team) que usa
 * el reporte PDF individual para comparar a cada persona contra el resto.
 * Se excluye autoevaluación a propósito: el benchmark debe reflejar cómo te
 * ven los demás, no cómo te ves a ti mismo — mismo criterio del reporte viejo.
 * Se calcula UNA sola vez por encuesta (no por persona) para poder reutilizarse
 * al generar reportes en lote.
 */
export function computeSurveyBenchmarks(
  submitted: SubmittedAssignmentLike[],
  questionsMap: Eval360Questions,
  teamByEmail: Map<string, string | null>
): SurveyBenchmarks {
  const peerTypes: EvalType[] = ["ascendente", "descendente", "paralela"];
  const peerAssignments = submitted.filter((a) => peerTypes.includes(a.evaluationType as EvalType));

  // Acumuladores: pregunta -> { suma, cuenta }
  const alegraQSum = new Map<string, { sum: number; count: number }>();
  const teamQSum = new Map<string, Map<string, { sum: number; count: number }>>();
  // Acumuladores: categoría -> { sumaPonderada, pesoTotal }
  const alegraCatSum = new Map<string, { sum: number; weight: number }>();
  const teamCatSum = new Map<string, Map<string, { sum: number; weight: number }>>();

  // Mapa questionId -> { category, weight } para todas las preguntas rating de todos los tipos
  const questionMeta = new Map<string, { category?: string; weight: number }>();
  peerTypes.forEach((type) => {
    (questionsMap[type] ?? [])
      .filter((q) => q.type === "rating")
      .forEach((q) => questionMeta.set(q.id, { category: q.category, weight: q.weight }));
  });

  peerAssignments.forEach((a) => {
    const team = teamByEmail.get(a.evaluateeEmail) ?? null;
    const answers = (a.finalAnswers ?? {}) as Record<string, unknown>;

    for (const [qId, meta] of questionMeta.entries()) {
      const val = answers[qId];
      if (typeof val !== "number") continue;

      // Alegra por pregunta
      const aq = alegraQSum.get(qId) ?? { sum: 0, count: 0 };
      aq.sum += val; aq.count += 1;
      alegraQSum.set(qId, aq);

      // Team por pregunta
      if (team) {
        if (!teamQSum.has(team)) teamQSum.set(team, new Map());
        const tMap = teamQSum.get(team)!;
        const tq = tMap.get(qId) ?? { sum: 0, count: 0 };
        tq.sum += val; tq.count += 1;
        tMap.set(qId, tq);
      }

      // Alegra por categoría (ponderado)
      const cat = meta.category || "General";
      const ac = alegraCatSum.get(cat) ?? { sum: 0, weight: 0 };
      ac.sum += val * meta.weight; ac.weight += meta.weight;
      alegraCatSum.set(cat, ac);

      // Team por categoría (ponderado)
      if (team) {
        if (!teamCatSum.has(team)) teamCatSum.set(team, new Map());
        const tcMap = teamCatSum.get(team)!;
        const tc = tcMap.get(cat) ?? { sum: 0, weight: 0 };
        tc.sum += val * meta.weight; tc.weight += meta.weight;
        tcMap.set(cat, tc);
      }
    }
  });

  const alegraQuestionAvg = new Map<string, number>();
  alegraQSum.forEach((v, qId) => alegraQuestionAvg.set(qId, v.count > 0 ? v.sum / v.count : 0));

  const teamQuestionAvg = new Map<string, Map<string, number>>();
  teamQSum.forEach((qMap, team) => {
    const out = new Map<string, number>();
    qMap.forEach((v, qId) => out.set(qId, v.count > 0 ? v.sum / v.count : 0));
    teamQuestionAvg.set(team, out);
  });

  const alegraCategoryAvg = new Map<string, number>();
  alegraCatSum.forEach((v, cat) => alegraCategoryAvg.set(cat, v.weight > 0 ? v.sum / v.weight : 0));

  const teamCategoryAvg = new Map<string, Map<string, number>>();
  teamCatSum.forEach((catMap, team) => {
    const out = new Map<string, number>();
    catMap.forEach((v, cat) => out.set(cat, v.weight > 0 ? v.sum / v.weight : 0));
    teamCategoryAvg.set(team, out);
  });

  return { alegraQuestionAvg, teamQuestionAvg, alegraCategoryAvg, teamCategoryAvg };
}

export interface CustomSectionBenchmarks {
  /** Promedio "Alegra" de las preguntas incluidas en la sección (ponderado por el peso propio de cada entrada). */
  alegraAvg: number;
  /** Promedio por Technical Team de esas mismas preguntas. */
  teamAvg: Map<string, number>;
}

/**
 * Benchmarks para una sección de análisis personalizada (ej. "Alineación
 * Cultural"): solo cuenta las preguntas incluidas en `section.entries`,
 * ponderadas por el peso propio de cada entrada (no el `weight` normal de su
 * categoría). Devuelve `null` si ninguna de esas preguntas tiene respuestas
 * numéricas — el reporte omite la sección entera en ese caso, sin inventar datos.
 */
export function computeCustomSectionBenchmarks(
  section: CustomReportSection,
  submitted: SubmittedAssignmentLike[],
  questionsMap: Eval360Questions,
  teamByEmail: Map<string, string | null>
): CustomSectionBenchmarks | null {
  const peerTypes: EvalType[] = ["ascendente", "descendente", "paralela"];
  const peerAssignments = submitted.filter((a) => peerTypes.includes(a.evaluationType as EvalType));

  const weightById = new Map<string, number>(
    section.entries.filter((e) => e.weight > 0).map((e) => [e.questionId, e.weight])
  );
  if (weightById.size === 0) return null;

  let alegraSum = 0, alegraWeight = 0;
  const teamSum = new Map<string, { sum: number; weight: number }>();

  peerAssignments.forEach((a) => {
    const team = teamByEmail.get(a.evaluateeEmail) ?? null;
    const answers = (a.finalAnswers ?? {}) as Record<string, unknown>;
    for (const [qId, w] of weightById.entries()) {
      const val = answers[qId];
      if (typeof val !== "number") continue;
      alegraSum += val * w; alegraWeight += w;
      if (team) {
        const t = teamSum.get(team) ?? { sum: 0, weight: 0 };
        t.sum += val * w; t.weight += w;
        teamSum.set(team, t);
      }
    }
  });

  if (alegraWeight === 0) return null;

  const teamAvg = new Map<string, number>();
  teamSum.forEach((v, team) => teamAvg.set(team, v.weight > 0 ? v.sum / v.weight : 0));

  return { alegraAvg: alegraSum / alegraWeight, teamAvg };
}

/**
 * Score de UNA persona (recibido de sus pares, o su propia autoevaluación)
 * restringido a las preguntas de `section.entries` presentes en `questions`,
 * ponderado por el peso propio de cada entrada. Devuelve `null` si ninguna de
 * las preguntas dadas pertenece a la sección.
 */
export function computeMyCustomSectionScore(
  section: CustomReportSection,
  assignments: SubmittedAssignmentLike[],
  questions: Eval360Question[]
): number | null {
  const weightById = new Map(section.entries.filter((e) => e.weight > 0).map((e) => [e.questionId, e.weight]));
  const sectionQs = questions.filter((q) => q.type === "rating" && weightById.has(q.id));
  if (sectionQs.length === 0) return null;

  let sum = 0, weight = 0;
  sectionQs.forEach((q) => {
    const w = weightById.get(q.id)!;
    let qSum = 0, qCount = 0;
    assignments.forEach((a) => {
      const val = ((a.finalAnswers ?? {}) as Record<string, unknown>)[q.id];
      if (typeof val === "number") { qSum += val; qCount += 1; }
    });
    if (qCount > 0) { sum += (qSum / qCount) * w; weight += w; }
  });
  return weight > 0 ? sum / weight : null;
}
