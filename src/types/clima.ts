export type Role = "admin" | "manager" | "viewer";
export type QuestionType = "text" | "rating" | "boolean";

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  questions: Question[];
  isActive: boolean;
  responsesCount: number;
  assignmentsCount: number;
  hasResponded?: boolean; // solo para viewers
}

export interface SurveyFormData {
  title: string;
  description: string;
  questions: Question[];
  participantIds: string[];
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
  assigned_at: string;
  completed_at: string | null;
  response_id: string | null;
}
