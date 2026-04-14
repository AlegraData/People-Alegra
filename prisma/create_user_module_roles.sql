-- Roles específicos por módulo. Sobreescribe el rol global del usuario para ese módulo.
-- Si no existe entrada para un usuario+módulo, se usa el rol global de user_roles.
CREATE TABLE IF NOT EXISTS user_module_roles (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL,
  module     TEXT        NOT NULL,                                           -- 'clima' | 'enps' | '360'
  role       TEXT        NOT NULL CHECK (role IN ('admin', 'manager', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, module)
);

CREATE INDEX IF NOT EXISTS idx_user_module_roles_user_id ON user_module_roles (user_id);
