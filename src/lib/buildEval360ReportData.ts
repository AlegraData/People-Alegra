/**
 * Arma el `Eval360ReportData` de UN evaluado a partir de los datos ya
 * cargados de una encuesta (todas las asignaciones enviadas + mapa de
 * equipos). Compartido entre la ruta real (`reports/[email]/route.ts`) y la
 * de vista previa de plantilla (`report-template/preview/route.ts`) — ambas
 * necesitan exactamente el mismo cálculo, solo cambia qué `templateConfig`/
 * `icons` se le pasa a `buildReportHtml()` después.
 */
import { normalizeQuestions } from "@/types/evaluaciones360";
import type { EvalType, Eval360Question, CustomReportSection } from "@/types/evaluaciones360";
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
}): Eval360ReportData | null {
  const { submitted, teamByEmail, icons, templateConfig } = params;
  const evaluateeEmail = params.evaluateeEmail.trim().toLowerCase();

  const mine = submitted.filter((a) => a.evaluateeEmail.toLowerCase() === evaluateeEmail);
  if (mine.length === 0) return null;

  const questionsMap = normalizeQuestions(params.questionsRaw);
  const reportSections = (Array.isArray(params.reportSectionsRaw) ? params.reportSectionsRaw : []) as CustomReportSection[];
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

  // Ranking completo de comportamientos (preguntas únicas por texto).
  const seenText = new Set<string>();
  const questionRanking: QuestionRankingRow[] = [];
  peerQuestions.filter((q) => q.type === "rating" && myPeerQ.has(q.id)).forEach((q) => {
    if (seenText.has(q.text)) return;
    seenText.add(q.text);
    questionRanking.push({
      text: q.text,
      category: q.category,
      mine: myPeerQ.get(q.id) ?? 0,
      alegra: benchmarks.alegraQuestionAvg.get(q.id) ?? 0,
    });
  });
  questionRanking.sort((a, b) => b.mine - a.mine);

  const strengths = questionRanking.slice(0, 5).map((r) => r.text);
  const improvements = questionRanking.slice(-5).reverse().map((r) => r.text);

  // Comentarios: uno por (tipo, pregunta abierta) con respuestas, filtrando basura.
  const comments: ReportComment[] = [];
  PEER_TYPES.forEach((type) => {
    const typeAssignments = peerAssignments.filter((a) => a.evaluationType === type);
    if (typeAssignments.length === 0) return;
    (questionsMap[type] ?? []).filter((q) => q.type !== "rating").forEach((q) => {
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
