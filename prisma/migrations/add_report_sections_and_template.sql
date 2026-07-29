-- Secciones personalizadas de análisis del reporte PDF (ej. "Alineación
-- Cultural"), definidas por el admin desde Reportes → Configuración.
-- Reemplaza el mecanismo isCultural/culturalWeight por pregunta (nunca se
-- persistió en producción, solo se probó en memoria) por un arreglo de
-- secciones con nombre propio y su propio subconjunto de preguntas + peso.
ALTER TABLE evaluations_360 ADD COLUMN IF NOT EXISTS report_sections JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Configuración visual global (singleton) de la plantilla PDF: colores, logo,
-- fondo de encabezado, márgenes/padding y densidad. Un solo registro
-- ('singleton'), compartido por todas las encuestas 360° presentes y futuras.
CREATE TABLE IF NOT EXISTS evaluation_360_report_template (
  id         TEXT        NOT NULL DEFAULT 'singleton' PRIMARY KEY,
  config     JSONB       NOT NULL,
  updated_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reutiliza set_updated_at() creada en add_updated_at_evaluation360.sql
DROP TRIGGER IF EXISTS set_360_report_template_updated_at ON evaluation_360_report_template;
CREATE TRIGGER set_360_report_template_updated_at
  BEFORE UPDATE ON evaluation_360_report_template
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS deny-by-default para anon/authenticated (mismo criterio que supabase/rls_lockdown.sql).
-- La app accede vía Prisma (rol postgres) y supabaseAdmin (service_role), ambos con BYPASSRLS.
ALTER TABLE evaluation_360_report_template ENABLE ROW LEVEL SECURITY;
