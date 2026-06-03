-- ============================================================
-- Encuestas People — ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Tabla principal de encuestas
CREATE TABLE IF NOT EXISTS people_surveys (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT NOT NULL,
  description      TEXT,
  questions        JSONB NOT NULL DEFAULT '[]',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  intro_enabled    BOOLEAN NOT NULL DEFAULT true,
  intro_message    TEXT,
  terms_enabled    BOOLEAN NOT NULL DEFAULT false,
  terms_text       TEXT,
  email_subject    TEXT,
  email_body       TEXT,
  email_button_text TEXT,
  email_footer     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Tabla de asignaciones (participantes por encuesta)
CREATE TABLE IF NOT EXISTS people_survey_assignments (
  survey_id    UUID NOT NULL REFERENCES people_surveys(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (survey_id, employee_id)
);

-- 3. Tabla de respuestas
CREATE TABLE IF NOT EXISTS people_survey_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id    UUID NOT NULL REFERENCES people_surveys(id) ON DELETE CASCADE,
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  answers      JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (survey_id, employee_id)
);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_people_assignments_employee ON people_survey_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_people_assignments_survey   ON people_survey_assignments(survey_id);
CREATE INDEX IF NOT EXISTS idx_people_responses_survey     ON people_survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_people_responses_employee   ON people_survey_responses(employee_id);

-- 5. Agregar módulo a module_config
INSERT INTO module_config (id, label, description, is_active, sort_order, min_role)
VALUES (
  'people',
  'Encuestas People',
  'Encuestas gestionadas por el equipo de People para medir la experiencia de los colaboradores.',
  true,
  4,
  'viewer'
)
ON CONFLICT (id) DO NOTHING;
