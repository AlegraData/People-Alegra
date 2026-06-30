-- Tabla para solicitudes de cambio en evaluaciones 360
-- Un evaluador puede pedir agregar o quitar evaluados; el admin aprueba o rechaza.
CREATE TABLE IF NOT EXISTS evaluation_360_change_requests (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  evaluation_id   UUID        NOT NULL REFERENCES evaluations_360(id) ON DELETE CASCADE,
  requestor_email TEXT        NOT NULL,
  requestor_name  TEXT,
  action          TEXT        NOT NULL CHECK (action IN ('add', 'remove')),
  target_email    TEXT        NOT NULL,
  target_name     TEXT,
  target_type     TEXT        NOT NULL,
  reason          TEXT,
  status          TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note      TEXT,
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Solo un request pendiente por evaluador + evaluado + tipo por evaluación
CREATE UNIQUE INDEX IF NOT EXISTS uq_360_change_request_pending
  ON evaluation_360_change_requests (evaluation_id, requestor_email, target_email, target_type)
  WHERE status = 'pending';

-- Auto-actualizar updated_at (reutiliza set_updated_at de la migración anterior)
DROP TRIGGER IF EXISTS set_360_change_requests_updated_at ON evaluation_360_change_requests;
CREATE TRIGGER set_360_change_requests_updated_at
  BEFORE UPDATE ON evaluation_360_change_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
