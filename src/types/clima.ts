export type Role = "admin" | "manager" | "viewer";
export type QuestionType = "text" | "rating" | "boolean" | "choice";

export interface EmailTemplateConfig {
  subject?: string | null;
  body?: string | null;
  buttonText?: string | null;
  footer?: string | null;
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  required?: boolean;
  // rating: rango configurable (default 1-5)
  ratingMin?: number;
  ratingMax?: number;
  // choice: lista de opciones definidas por el admin
  options?: string[];
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  isActive: boolean;
  introEnabled: boolean;
  introMessage?: string | null;
  termsEnabled: boolean;
  termsText?: string | null;
  emailSubject?: string | null;
  emailBody?: string | null;
  emailButtonText?: string | null;
  emailFooter?: string | null;
  createdAt: string;
  responsesCount: number;
  assignmentsCount: number;
  hasResponded?: boolean;
}

export interface SurveyFormData {
  title: string;
  description: string;
  questions: Question[];
  participantIds: string[];
  introEnabled: boolean;
  introMessage: string;
  termsEnabled: boolean;
  termsText: string;
  emailSubject: string;
  emailBody: string;
  emailButtonText: string;
  emailFooter: string;
}

export interface Empleado {
  employee_id: string;
  gid: number;
  correo: string;
  nombre_completo: string;
  equipo: string | null;
  cargo: string | null;
  fecha_original: string | null;
}

export interface PaginatedEmpleados {
  data: Empleado[];
  total: number;
  page: number;
  pageSize: number | "all";
}

export interface SurveyParticipant {
  employee_id: string;
  nombre_completo: string;
  correo: string;
  cargo: string | null;
  equipo: string | null;
  fecha_original: string | null;
  assigned_at: string;
  completed_at: string | null;
  response_id: string | null;
}
