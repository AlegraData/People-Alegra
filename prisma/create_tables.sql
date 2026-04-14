-- Crear enum Role si no existe
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('admin', 'manager', 'viewer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Tabla de empleados
CREATE TABLE IF NOT EXISTS employees (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  gid         BIGINT      NOT NULL UNIQUE,
  email       TEXT        NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de información personal de empleados
CREATE TABLE IF NOT EXISTS employee_personal_info (
  id               UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id      UUID        NOT NULL REFERENCES employees(id),
  nombres          TEXT,
  primer_apellido  TEXT,
  segundo_apellido TEXT,
  valido_desde     TIMESTAMPTZ NOT NULL DEFAULT now(),
  es_actual        BOOLEAN     DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de encuestas de clima
CREATE TABLE IF NOT EXISTS climate_surveys (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title       TEXT        NOT NULL,
  description TEXT,
  questions   JSONB       NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabla de respuestas a encuestas
CREATE TABLE IF NOT EXISTS climate_survey_responses (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id    UUID        NOT NULL REFERENCES climate_surveys(id),
  employee_id  UUID        NOT NULL REFERENCES employees(id),
  answers      JSONB       NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
