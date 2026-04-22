-- Tabla de configuración de módulos de la plataforma
CREATE TABLE IF NOT EXISTS module_config (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Columna de visibilidad mínima por rol
ALTER TABLE module_config ADD COLUMN IF NOT EXISTS min_role TEXT NOT NULL DEFAULT 'viewer';

INSERT INTO module_config (id, label, description, is_active, sort_order, min_role) VALUES
  ('enps',  'eNPS',                  'Net Promoter Score interno — mide la satisfacción y lealtad de los colaboradores.',    true,  1, 'viewer'),
  ('clima', 'Encuestas de Clima',    'Estudios de cultura organizacional para construir el mejor lugar para trabajar.',       true,  2, 'viewer'),
  ('360',   'Evaluaciones 360°',     'Retroalimentación entre compañeros y líderes para el crecimiento profesional.',         false, 3, 'viewer')
ON CONFLICT (id) DO NOTHING;
