-- ============================================================
-- eNPS — pregunta de seguimiento obligatoria (por campaña)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

ALTER TABLE enps_surveys
  ADD COLUMN IF NOT EXISTS follow_up_required BOOLEAN NOT NULL DEFAULT false;
