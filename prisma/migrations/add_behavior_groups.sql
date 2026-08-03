-- Reemplaza el intento anterior (group_behaviors_by_category, agrupaba
-- automático por el campo `category` de cada pregunta) por grupos definidos
-- a mano: el admin elige, por cada tipo de evaluación, cuál pregunta rating
-- corresponde a cada grupo (ej. "Compromiso") — misma mecánica que
-- comment_groups. La columna vieja se deja intacta (no se usa más desde el
-- código, pero no hace daño mantenerla) para no forzar otra migración.
ALTER TABLE evaluations_360 ADD COLUMN IF NOT EXISTS behavior_groups JSONB NOT NULL DEFAULT '[]'::jsonb;
