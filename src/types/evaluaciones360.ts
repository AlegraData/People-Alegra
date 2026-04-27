export type EvalType = "ascendente" | "descendente" | "paralela" | "autoevaluacion";
export type EvalStatus = "active" | "closed";
export type AssignmentStatus = "pending" | "in_progress" | "completed" | "submitted";
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
  questions: Eval360Question[];
  emailSubject?: string | null;
  emailBody?: string | null;
  emailButtonText?: string | null;
  emailFooter?: string | null;
  createdAt: string;
  assignmentsCount: number;
  submittedCount: number;
  myAssignments?: Evaluation360Assignment[];
}

export interface Evaluation360Assignment {
  id: string;
  evaluationId: string;
  evaluatorEmail: string;
  evaluatorName?: string | null;
  evaluateeEmail: string;
  evaluateeName?: string | null;
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
  questions: Eval360Question[];
  participants: ParticipantRow[];
  emailSubject: string;
  emailBody: string;
  emailButtonText: string;
  emailFooter: string;
}
