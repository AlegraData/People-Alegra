/**
 * Arma el `Eval360ReportData` de UN evaluado a partir de los datos ya
 * cargados de una encuesta (todas las asignaciones enviadas + mapa de
 * equipos). Compartido entre la ruta real (`reports/[email]/route.ts`) y la
 * de vista previa de plantilla (`report-template/preview/route.ts`) — ambas
 * necesitan exactamente el mismo cálculo, solo cambia qué `templateConfig`/
 * `icons` se le pasa a `buildReportHtml()` después.
 */
import { normalizeQuestions } from "@/types/evaluaciones360";
import type { EvalType, Eval360Question, CustomReportSection, CommentGroup, BehaviorGroup } from "@/types/evaluaciones360";
import { computeSurveyBenchmarks, computeCustomSectionBenchmarks, computeMyCustomSectionScore } from "./eval360Benchmarks";
import { filterJunkComments } from "./filterJunkComments";
import type {
  Eval360ReportData, CategoryComparisonRow, QuestionRankingRow, ReportComment,
  Eval360ReportIcons, CustomSectionResult,
} from "./eval360ReportTemplate";
import type { ReportTemplateConfig } from "./reportTemplateConfig";

const PEER_TYPES: EvalType[] = ["ascendente", "descendente", "paralela"];

export interface AssignmentLike {
  evaluatorEmail: string;
  evaluateeEmail: string;
  evaluateeName?: string | null;
  team?: string | null;
  evaluationType: string;
  finalAnswers: unknown;
}

function weightedByQuestion(
  assignments: { finalAnswers: unknown }[],
  questions: Eval360Question[]
): { perQuestion: Map<string, number>; perCategory: Map<string, number> } {
  const perQuestion = new Map<string, number>();
  const catAcc = new Map<string, { sum: number; weight: number }>();

  questions.filter((q) => q.type === "rating").forEach((q) => {
    let sum = 0, count = 0;
    assignments.forEach((a) => {
      const val = ((a.finalAnswers ?? {}) as Record<string, unknown>)[q.id];
      if (typeof val === "number") { sum += val; count += 1; }
    });
    if (count > 0) {
      const avg = sum / count;
      perQuestion.set(q.id, avg);
      const cat = q.category || "General";
      const c = catAcc.get(cat) ?? { sum: 0, weight: 0 };
      c.sum += avg * q.weight; c.weight += q.weight;
      catAcc.set(cat, c);
    }
  });

  const perCategory = new Map<string, number>();
  catAcc.forEach((v, cat) => perCategory.set(cat, v.weight > 0 ? v.sum / v.weight : 0));
  return { perQuestion, perCategory };
}

export function buildEval360ReportData(params: {
  questionsRaw: unknown;
  reportSectionsRaw: unknown;
  submitted: AssignmentLike[];
  evaluateeEmail: string;
  teamByEmail: Map<string, string | null>;
  icons?: Eval360ReportIcons;
  templateConfig?: ReportTemplateConfig;
  /** Agrupa preguntas rating equivalentes de distintos tipos (ej. "Compromiso"
   *  = una pregunta de ascendente + una de descendente + una de paralela)
   *  bajo un solo nombre en "Comportamientos evaluados" y "Resultados
   *  individuales por comportamiento", en vez de una fila por pregunta. */
  behaviorGroupsRaw?: unknown;
  /** Agrupa preguntas abiertas equivalentes de distintos tipos (ej. "mayor
   *  fortaleza" preguntada distinto en ascendente/descendente/paralela) bajo
   *  un solo título de Comentarios, en vez de una tarjeta por tipo. */
  commentGroupsRaw?: unknown;
}): Eval360ReportData | null {
  const { submitted, teamByEmail, icons, templateConfig } = params;
  const evaluateeEmail = params.evaluateeEmail.trim().toLowerCase();

  const mine = submitted.filter((a) => a.evaluateeEmail.toLowerCase() === evaluateeEmail);
  if (mine.length === 0) return null;

  const questionsMap = normalizeQuestions(params.questionsRaw);
  const reportSections = (Array.isArray(params.reportSectionsRaw) ? params.reportSectionsRaw : []) as CustomReportSection[];
  const behaviorGroups = (Array.isArray(params.behaviorGroupsRaw) ? params.behaviorGroupsRaw : []) as BehaviorGroup[];
  const commentGroups = (Array.isArray(params.commentGroupsRaw) ? params.commentGroupsRaw : []) as CommentGroup[];
  const myTeam = teamByEmail.get(evaluateeEmail) ?? null;

  const benchmarks = computeSurveyBenchmarks(submitted, questionsMap, teamByEmail);

  const peerAssignments = mine.filter((a) => PEER_TYPES.includes(a.evaluationType as EvalType));
  const autoAssignments = mine.filter((a) => a.evaluationType === "autoevaluacion");

  const peerQuestions = PEER_TYPES.flatMap((t) => questionsMap[t] ?? []);
  const autoQuestions = questionsMap.autoevaluacion ?? [];

  const { perQuestion: myPeerQ, perCategory: myPeerCat } = weightedByQuestion(peerAssignments, peerQuestions);
  const { perCategory: myAutoCat } = weightedByQuestion(autoAssignments, autoQuestions);

  const ratingMax = (() => {
    const all = peerQuestions.filter((q) => q.type === "rating");
    if (all.length === 0) return 10;
    const tw = all.reduce((s, q) => s + q.weight, 0) || 1;
    return all.reduce((s, q) => s + (q.ratingMax ?? 10) * q.weight, 0) / tw;
  })();

  const categories = [...new Set(peerQuestions.filter((q) => q.type === "rating").map((q) => q.category || "General"))];

  const vsAlegra: CategoryComparisonRow[] = categories.map((category) => ({
    category, mine: myPeerCat.get(category) ?? 0, benchmark: benchmarks.alegraCategoryAvg.get(category) ?? 0,
  }));
  const vsTeam: CategoryComparisonRow[] = categories.map((category) => ({
    category,
    mine: myPeerCat.get(category) ?? 0,
    benchmark: myTeam ? (benchmarks.teamCategoryAvg.get(myTeam)?.get(category) ?? 0) : 0,
  }));
  const vsAuto: CategoryComparisonRow[] = categories.map((category) => ({
    category, mine: myPeerCat.get(category) ?? 0, benchmark: myAutoCat.get(category) ?? 0,
  }));

  // Secciones personalizadas (Alineación Cultural y cualquier otra que el
  // admin haya definido) — se omite cada una si no hay datos, sin inventar.
  const vsCustomSections: CustomSectionResult[] = [];
  reportSections.forEach((section) => {
    const bench = computeCustomSectionBenchmarks(section, submitted, questionsMap, teamByEmail);
    if (!bench) return;
    const myPeerScore = computeMyCustomSectionScore(section, peerAssignments, peerQuestions);
    if (myPeerScore === null) return;
    const myAutoScore = computeMyCustomSectionScore(section, autoAssignments, autoQuestions);
    vsCustomSections.push({
      id: section.id,
      name: section.name,
      description: section.description,
      position: section.position,
      rows: [
        { category: "Alegra", mine: myPeerScore, benchmark: bench.alegraAvg },
        { category: "Technical Team", mine: myPeerScore, benchmark: myTeam ? (bench.teamAvg.get(myTeam) ?? bench.alegraAvg) : bench.alegraAvg },
        { category: "Autoevaluación", mine: myPeerScore, benchmark: myAutoScore ?? 0 },
      ],
    });
  });

  // "Comportamientos evaluados" y "Resultados individuales por
  // comportamiento": por pregunta individual (default, sin grupos definidos),
  // o agrupados según los `behaviorGroups` que el admin arme a mano en
  // Reportes → Configuración (ej. "Compromiso" = una pregunta de ascendente +
  // una de descendente + una de paralela, elegidas explícitamente — no el
  // campo `category` de la pregunta). El score de cada grupo se calcula
  // exactamente igual que una sección personalizada (peso propio de cada
  // pregunta mapeada, ver computeCustomSectionBenchmarks/
  // computeMyCustomSectionScore) — un `BehaviorGroup` no es más que una
  // `CustomReportSection` armada con el picker "una pregunta por tipo".
  let questionRanking: QuestionRankingRow[];
  let strengths: string[];
  let improvements: string[];

  if (behaviorGroups.length > 0) {
    const grouped: QuestionRankingRow[] = [];
    behaviorGroups.forEach((group) => {
      const entries = group.entries
        .map(({ type, questionId }) => {
          const q = (questionsMap[type] ?? []).find((q) => q.id === questionId && q.type === "rating");
          return q ? { questionId, weight: q.weight } : null;
        })
        .filter((e): e is { questionId: string; weight: number } => e !== null);
      if (entries.length === 0) return;
      const pseudoSection: CustomReportSection = { id: group.id, name: group.title, entries };
      const bench = computeCustomSectionBenchmarks(pseudoSection, submitted, questionsMap, teamByEmail);
      if (!bench) return;
      const myScore = computeMyCustomSectionScore(pseudoSection, peerAssignments, peerQuestions);
      if (myScore === null) return;
      grouped.push({ text: group.title, category: group.title, mine: myScore, alegra: bench.alegraAvg });
    });
    // Resultados individuales por comportamiento: TODOS los grupos, siempre descendente.
    questionRanking = [...grouped].sort((a, b) => b.mine - a.mine);
    // Fortalezas y Puntos de mejora: solo los 5 más relevantes de cada lado
    // (igual que sin grupos) — de mayor a menor para fortalezas, de menor a
    // mayor para puntos de mejora (#1 = el grupo que más hay que mejorar).
    strengths = questionRanking.slice(0, 5).map((r) => r.text);
    improvements = [...questionRanking].reverse().slice(0, 5).map((r) => r.text);
  } else {
    const seenText = new Set<string>();
    const ranking: QuestionRankingRow[] = [];
    peerQuestions.filter((q) => q.type === "rating" && myPeerQ.has(q.id)).forEach((q) => {
      if (seenText.has(q.text)) return;
      seenText.add(q.text);
      ranking.push({
        text: q.text,
        category: q.category,
        mine: myPeerQ.get(q.id) ?? 0,
        alegra: benchmarks.alegraQuestionAvg.get(q.id) ?? 0,
      });
    });
    ranking.sort((a, b) => b.mine - a.mine);
    questionRanking = ranking;
    strengths = ranking.slice(0, 5).map((r) => r.text);
    improvements = ranking.slice(-5).reverse().map((r) => r.text);
  }

  // Comentarios. Primero los grupos definidos por el admin (ej. "¿Cuál es su
  // mayor fortaleza actualmente?" combinando la pregunta equivalente de
  // ascendente+descendente+paralela en una sola tarjeta, con el título del
  // grupo en vez del texto literal de cada tipo). Autoevaluación queda
  // excluida siempre — un grupo nunca puede apuntar a esa asignación.
  // Cualquier pregunta abierta que NO quede dentro de ningún grupo sigue el
  // comportamiento de siempre: una tarjeta por (tipo, pregunta).
  const comments: ReportComment[] = [];
  const groupedQuestionIds = new Set<string>();

  commentGroups.forEach((group) => {
    const answers: string[] = [];
    group.entries.forEach(({ type, questionId }) => {
      if (!PEER_TYPES.includes(type)) return;
      groupedQuestionIds.add(questionId);
      peerAssignments.filter((a) => a.evaluationType === type).forEach((a) => {
        const val = ((a.finalAnswers ?? {}) as Record<string, unknown>)[questionId];
        if (typeof val === "string" && val.trim()) answers.push(val.trim());
      });
    });
    const kept = filterJunkComments(answers) as string[];
    if (kept.length > 0) comments.push({ questionText: group.title, answers: kept });
  });

  PEER_TYPES.forEach((type) => {
    const typeAssignments = peerAssignments.filter((a) => a.evaluationType === type);
    if (typeAssignments.length === 0) return;
    (questionsMap[type] ?? []).filter((q) => q.type !== "rating" && !groupedQuestionIds.has(q.id)).forEach((q) => {
      const answers: string[] = [];
      typeAssignments.forEach((a) => {
        const val = ((a.finalAnswers ?? {}) as Record<string, unknown>)[q.id];
        if (typeof val === "string" && val.trim()) answers.push(val.trim());
      });
      const kept = filterJunkComments(answers) as string[];
      if (kept.length > 0) comments.push({ questionText: q.text, answers: kept });
    });
  });

  return {
    evaluateeName: mine[0]?.evaluateeName || evaluateeEmail,
    evaluateeEmail,
    team: myTeam,
    ratingMax,
    vsAlegra, vsTeam, vsAuto, vsCustomSections,
    questionRanking,
    strengths, improvements,
    comments,
    totalReceived: mine.length,
    icons,
    templateConfig,
  };
}
