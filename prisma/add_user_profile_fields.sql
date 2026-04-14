-- Añade campos de perfil a user_roles para mostrar en el panel de administración
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS full_name  TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
