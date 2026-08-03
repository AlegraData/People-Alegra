export type EvalType = "ascendente" | "descendente" | "paralela" | "autoevaluacion";
export type EvalStatus = "active" | "closed";
export type AssignmentStatus = "pending" | "in_progress" | "completed" | "submitted";
export type ChangeRequestStatus = "pending" | "approved" | "rejected";
export type ChangeRequestAction = "add" | "remove";
export type QuestionType = "text" | "rating" | "boolean" | "choice";

export const EVAL_TYPE_LABELS: Record<EvalType, string> = {
  ascendente:     "Ascendente",
  descendente:    "Descendente",
  paralela:       "Paralela",
  autoevaluacion: "Autoevaluación",
};

export const EVAL_TYPE_COLORS: Record<EvalType, string> = {
  ascendente:     "bg-blue-100 text-blue-700",
  descendente:    "bg-violet-100 text-violet-700",
  paralela:       "bg-amber-100 text-amber-700",
  autoevaluacion: "bg-emerald-100 text-emerald-700",
};

export interface Eval360Question {
  id: string;
  text: string;
  type: QuestionType;
  category?: string;
  weight: number;
  required?: boolean;
  ratingMin?: number;
  ratingMax?: number;
  options?: string[];
}

/** Una pregunta (de cualquiera de los 4 tipos) incluida en una sección personalizada, con su peso propio para esa sección. */
export interface ReportSectionEntry {
  questionId: string;
  weight: number;
}

/**
 * Sección de análisis adicional del reporte PDF (ej. "Alineación Cultural"),
 * definida por el admin desde Reportes → Configuración. Toma cualquier
 * subconjunto de preguntas rating ya existentes (de cualquier tipo) y les da
 * un peso independiente del `weight` normal de su categoría, solo para el
 * cálculo de esta sección.
 */
/** Dónde se inserta esta sección dentro de la grilla de "Comparativo de tus resultados". `"end"` (default) = al final. */
export type ReportSectionPosition = "after-alegra" | "after-team" | "after-auto" | "end";

export interface CustomReportSection {
  id: string;
  name: string;
  description?: string;
  entries: ReportSectionEntry[];
  position?: ReportSectionPosition;
}

/** Una pregunta abierta concreta (de un tipo de evaluación) mapeada a un
 *  `CommentGroup` — cada tipo suele redactar la misma pregunta distinto
 *  ("tu líder" / "este colaborador" / "tu compañero/a"), así que el admin
 *  elige a mano cuál de cada tipo corresponde al mismo grupo. */
export interface CommentGroupEntry {
  type: EvalType;
  questionId: string;
}

/** Agrupa preguntas abiertas equivalentes de distintos tipos de evaluación
 *  (ascendente/descendente/paralela — autoevaluación no aplica) bajo un solo
 *  título de "Comentarios" en el reporte PDF, en vez de una tarjeta separada
 *  por cada tipo. Definido por el admin desde Reportes → Configuración. */
export interface CommentGroup {
  id: string;
  title: string;
  entries: CommentGroupEntry[];
}

/** Una pregunta rating concreta (de un tipo de evaluación) mapeada a un
 *  `BehaviorGroup` — mismo criterio que `CommentGroupEntry` pero para
 *  preguntas calificadas en vez de abiertas. */
export interface BehaviorGroupEntry {
  type: EvalType;
  questionId: string;
}

/** Agrupa preguntas rating equivalentes de distintos tipos de evaluación
 *  (ascendente/descendente/paralela) bajo un solo nombre en "Comportamientos
 *  evaluados" y "Resultados individuales por comportamiento" — en vez de una
 *  fila por cada pregunta individual. El score del grupo se calcula igual
 *  que una `CustomReportSection` (promedio ponderado por el `weight` propio
 *  de cada pregunta mapeada). Definido por el admin desde Reportes → Configuración. */
export interface BehaviorGroup {
  id: string;
  title: string;
  entries: BehaviorGroupEntry[];
}

/** Preguntas organizadas por tipo de evaluación */
export type Eval360Questions = Record<EvalType, Eval360Question[]>;

/**
 * Normaliza el campo `questions` del modelo DB.
 * - Formato legacy (array plano): se replica en todos los tipos.
 * - Formato nuevo (objeto por tipo): se devuelve normalizado.
 */
export function normalizeQuestions(raw: unknown): Eval360Questions {
  if (Array.isArray(raw)) {
    const arr = raw as Eval360Question[];
    return { ascendente: arr, descendente: arr, paralela: arr, autoevaluacion: arr };
  }
  const q = (raw ?? {}) as Record<string, unknown>;
  return {
    ascendente:     Array.isArray(q.ascendente)     ? (q.ascendente     as Eval360Question[]) : [],
    descendente:    Array.isArray(q.descendente)    ? (q.descendente    as Eval360Question[]) : [],
    paralela:       Array.isArray(q.paralela)       ? (q.paralela       as Eval360Question[]) : [],
    autoevaluacion: Array.isArray(q.autoevaluacion) ? (q.autoevaluacion as Eval360Question[]) : [],
  };
}

export interface Evaluation360 {
  id: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  status: EvalStatus;
  hasAscendente: boolean;
  hasDescendente: boolean;
  hasParalela: boolean;
  hasAutoevaluacion: boolean;
  weightAscendente: number;
  weightDescendente: number;
  weightParalela: number;
  weightAutoevaluacion: number;
  questions: Eval360Questions;
  reportSections: CustomReportSection[];
  /** Agrupa preguntas rating equivalentes de "Comportamientos evaluados" y
   *  "Resultados individuales por comportamiento" bajo un nombre propio (ej.
   *  "Compromiso"), elegidas a mano por tipo de evaluación — igual mecánica
   *  que `commentGroups`. Si está vacío, esos bloques muestran una fila por
   *  cada pregunta individual (comportamiento por defecto). */
  behaviorGroups: BehaviorGroup[];
  commentGroups: CommentGroup[];
  emailSubject?: string | null;
  emailBody?: string | null;
  emailButtonText?: string | null;
  emailFooter?: string | null;
  createdAt: string;
  updatedAt: string;
  assignmentsCount: number;
  submittedCount: number;
  pendingChangeRequestsCount?: number;
  myAssignments?: Evaluation360Assignment[];
}

export interface EvaluationChangeRequest {
  id:             string;
  evaluationId:   string;
  requestorEmail: string;
  requestorName?: string | null;
  action:         ChangeRequestAction;
  targetEmail:    string;
  targetName?:    string | null;
  targetType:     EvalType;
  reason?:        string | null;
  status:         ChangeRequestStatus;
  adminNote?:     string | null;
  reviewedBy?:    string | null;
  reviewedAt?:    string | null;
  createdAt:      string;
  updatedAt:      string;
}

export interface Evaluation360Assignment {
  id: string;
  evaluationId: string;
  evaluatorEmail: string;
  evaluatorName?: string | null;
  evaluatorAvatarUrl?: string | null;
  evaluateeEmail: string;
  evaluateeName?: string | null;
  evaluateeAvatarUrl?: string | null;
  team?: string | null;
  evaluationType: EvalType;
  status: AssignmentStatus;
  draftAnswers?: Record<string, string | number> | null;
  finalAnswers?: Record<string, string | number> | null;
  savedAt?: string | null;
  completedAt?: string | null;
  submittedAt?: string | null;
}

export interface ParticipantRow {
  evaluatorEmail: string;
  evaluatorName: string;
  evaluateeEmail: string;
  evaluateeName: string;
  team: string;
  evaluationType: EvalType;
}

export interface EvalFormData {
  title: string;
  description: string;
  instructions: string;
  hasAscendente: boolean;
  hasDescendente: boolean;
  hasParalela: boolean;
  hasAutoevaluacion: boolean;
  weightAscendente: number;
  weightDescendente: number;
  weightParalela: number;
  weightAutoevaluacion: number;
  questions: Eval360Questions;
  participants: ParticipantRow[];
  emailSubject: string;
  emailBody: string;
  emailButtonText: string;
  emailFooter: string;
  skipInvitations?: boolean;
}
