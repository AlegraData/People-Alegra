-- Agrupa preguntas abiertas equivalentes de distintos tipos de evaluación
-- (ascendente/descendente/paralela — autoevaluación no aplica) bajo un solo
-- título de "Comentarios" en el reporte PDF, en vez de una tarjeta separada
-- por cada tipo. Se guarda por encuesta, junto a report_sections.
ALTER TABLE evaluations_360 ADD COLUMN IF NOT EXISTS comment_groups JSONB NOT NULL DEFAULT '[]'::jsonb;
