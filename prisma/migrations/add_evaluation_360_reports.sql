-- Reportes PDF individuales del Feedback 360°
-- Un registro por (evaluación, evaluado). Trackea el estado de generación y
-- envío del reporte, y la ruta del PDF ya renderizado en Supabase Storage
-- (bucket privado "evaluaciones360-reportes", creado a mano desde el dashboard).
CREATE TABLE IF NOT EXISTS evaluation_360_reports (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id   UUID        NOT NULL REFERENCES evaluations_360(id) ON DELETE CASCADE,
  evaluatee_email TEXT        NOT NULL,
  evaluatee_name  TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generated', 'sent', 'failed')),
  storage_path    TEXT,
  generated_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT evaluation_360_reports_unique UNIQUE (evaluation_id, evaluatee_email)
);

-- Reutiliza set_updated_at() creada en add_updated_at_evaluation360.sql
DROP TRIGGER IF EXISTS set_360_reports_updated_at ON evaluation_360_reports;
CREATE TRIGGER set_360_reports_updated_at
  BEFORE UPDATE ON evaluation_360_reports
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS deny-by-default para anon/authenticated (mismo criterio que supabase/rls_lockdown.sql).
-- La app accede vía Prisma (rol postgres) y supabaseAdmin (service_role), ambos con BYPASSRLS.
ALTER TABLE evaluation_360_reports ENABLE ROW LEVEL SECURITY;
