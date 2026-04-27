-- Evaluaciones 360° — Crear tablas en Supabase
-- Ejecutar en el SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS evaluations_360 (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 TEXT NOT NULL,
  description           TEXT,
  instructions          TEXT,
  status                TEXT NOT NULL DEFAULT 'active',
  has_ascendente        BOOLEAN NOT NULL DEFAULT true,
  has_descendente       BOOLEAN NOT NULL DEFAULT true,
  has_paralela          BOOLEAN NOT NULL DEFAULT true,
  has_autoevaluacion    BOOLEAN NOT NULL DEFAULT true,
  weight_ascendente     FLOAT NOT NULL DEFAULT 25,
  weight_descendente    FLOAT NOT NULL DEFAULT 25,
  weight_paralela       FLOAT NOT NULL DEFAULT 25,
  weight_autoevaluacion FLOAT NOT NULL DEFAULT 25,
  questions             JSONB NOT NULL DEFAULT '[]',
  email_subject         TEXT,
  email_body            TEXT,
  email_button_text     TEXT,
  email_footer          TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluation_360_assignments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id    UUID NOT NULL REFERENCES evaluations_360(id) ON DELETE CASCADE,
  evaluator_email  TEXT NOT NULL,
  evaluator_name   TEXT,
  evaluatee_email  TEXT NOT NULL,
  evaluatee_name   TEXT,
  team             TEXT,
  evaluation_type  TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  draft_answers    JSONB,
  final_answers    JSONB,
  saved_at         TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  submitted_at     TIMESTAMPTZ,
  CONSTRAINT evaluation_360_assignments_unique
    UNIQUE (evaluation_id, evaluator_email, evaluatee_email, evaluation_type)
);

-- Registrar módulo 360 en module_config (si no existe)
INSERT INTO module_config (id, label, description, is_active, sort_order, min_role)
VALUES ('360', 'Evaluaciones 360°', 'Evaluaciones de retroalimentación 360° entre compañeros, líderes y colaboradores.', true, 3, 'viewer')
ON CONFLICT (id) DO NOTHING;
