-- Agrega updated_at a evaluations_360 para auditoría de cambios
ALTER TABLE evaluations_360
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Trigger para actualizar automáticamente updated_at en cada UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_evaluations_360_updated_at ON evaluations_360;
CREATE TRIGGER set_evaluations_360_updated_at
  BEFORE UPDATE ON evaluations_360
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
