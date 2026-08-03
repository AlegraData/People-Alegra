-- Permite que una encuesta 360° muestre "Comportamientos evaluados" y
-- "Resultados individuales por comportamiento" agrupados por categoría
-- (Compromiso, Comunicación, etc.) en vez de una fila por cada pregunta
-- individual. Se guarda por encuesta (no global) porque las preguntas y
-- categorías cambian de una encuesta a otra — se configura junto a las
-- secciones personalizadas en Reportes → Configuración.
ALTER TABLE evaluations_360 ADD COLUMN IF NOT EXISTS group_behaviors_by_category BOOLEAN NOT NULL DEFAULT false;
