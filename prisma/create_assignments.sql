CREATE TABLE IF NOT EXISTS climate_survey_assignments (
  survey_id    UUID        NOT NULL REFERENCES climate_surveys(id) ON DELETE CASCADE,
  employee_id  UUID        NOT NULL REFERENCES employees(id),
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (survey_id, employee_id)
);

-- Índice para buscar rápidamente las encuestas de un empleado
CREATE INDEX IF NOT EXISTS idx_assignments_employee ON climate_survey_assignments(employee_id);
