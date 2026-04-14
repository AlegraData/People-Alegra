-- Eliminar respuestas duplicadas (conservar la más antigua por empleado+encuesta)
DELETE FROM climate_survey_responses
WHERE id NOT IN (
  SELECT DISTINCT ON (survey_id, employee_id) id
  FROM climate_survey_responses
  ORDER BY survey_id, employee_id, submitted_at ASC
);

-- Añadir restricción única: un empleado no puede responder la misma encuesta dos veces
ALTER TABLE climate_survey_responses
ADD CONSTRAINT uq_survey_response_per_employee
UNIQUE (survey_id, employee_id);
