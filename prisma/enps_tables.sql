-- ============================================================
-- Módulo eNPS — Tablas en Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Campañas eNPS
CREATE TABLE IF NOT EXISTS enps_surveys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  follow_up_question TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Asignaciones (quién debe responder cada campaña)
CREATE TABLE IF NOT EXISTS enps_survey_assignments (
  survey_id    UUID NOT NULL REFERENCES enps_surveys(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id),
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (survey_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_enps_assignments_employee
  ON enps_survey_assignments (employee_id);

-- 3. Respuestas
CREATE TABLE IF NOT EXISTS enps_survey_responses (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id        UUID NOT NULL REFERENCES enps_surveys(id) ON DELETE CASCADE,
  employee_id      UUID NOT NULL REFERENCES employees(id),
  score            SMALLINT NOT NULL CHECK (score >= 0 AND score <= 10),
  follow_up_answer TEXT,
  submitted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (survey_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_enps_responses_survey
  ON enps_survey_responses (survey_id);
