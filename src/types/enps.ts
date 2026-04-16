export interface ScoreLabel {
  from:  number;
  to:    number;
  label: string;
  color: string; // hex color
}

export interface EnpsSurvey {
  id:               string;
  title:            string;
  description:      string | null;
  followUpQuestion: string | null;
  isActive:         boolean;
  createdAt:        string;
  responsesCount:   number;
  assignmentsCount: number;
  enpsScore:        number | null; // null = sin respuestas aún
  scoreMin:         number;        // default 0
  scoreMax:         number;        // default 10
  scoreLabels:      ScoreLabel[] | null;
  hasResponded?:    boolean;       // solo para viewers
}

export interface EnpsSurveyFormData {
  title:            string;
  description:      string;
  followUpQuestion: string;
  participantIds:   string[];
  scoreMin:         number;
  scoreMax:         number;
  scoreLabels:      ScoreLabel[];
}

export type EnpsCategory = "promoter" | "passive" | "detractor";

export interface EnpsResponseDetail {
  id:             string;
  employeeId:     string;
  employeeName:   string;
  employeeEmail:  string;
  score:          number;
  category:       EnpsCategory;
  followUpAnswer: string | null;
  submittedAt:    string;
}

export interface EnpsResults {
  survey:     EnpsSurvey;
  total:      number;
  promoters:  number;
  passives:   number;
  detractors: number;
  score:      number | null;
  responses:  EnpsResponseDetail[];
  // Computed thresholds for display
  promoterMin:  number;
  passiveMin:   number;
  passiveMax:   number;
  detractorMax: number;
}
