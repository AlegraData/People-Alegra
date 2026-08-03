-- Plantilla de correo editable para el envío de reportes PDF por correo (tab
-- "Envíos" en Reportes 360°) — mismo patrón que email_subject/body/button_text/
-- footer ya usados para invitaciones/recordatorios, pero específico de este flujo.
ALTER TABLE evaluations_360
  ADD COLUMN IF NOT EXISTS report_email_subject TEXT,
  ADD COLUMN IF NOT EXISTS report_email_body TEXT,
  ADD COLUMN IF NOT EXISTS report_email_button_text TEXT,
  ADD COLUMN IF NOT EXISTS report_email_footer TEXT;
