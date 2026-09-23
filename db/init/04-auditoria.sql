-- Registro de accesos: una fila por login (no por usuario), para poder ver
-- quién entra y con qué frecuencia. `finalizado_at` sólo queda puesto si el
-- usuario cierra sesión desde la app con el botón — si simplemente cierra la
-- pestaña, la fila se queda sin cerrar (la cookie expira sola más adelante).
CREATE TABLE IF NOT EXISTS auditoria_login (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_email  text NOT NULL,
  usuario_nombre text,
  proveedor      text NOT NULL DEFAULT 'google',
  iniciado_at    timestamptz NOT NULL DEFAULT now(),
  finalizado_at  timestamptz
);

CREATE INDEX IF NOT EXISTS auditoria_login_email_idx ON auditoria_login (usuario_email);
CREATE INDEX IF NOT EXISTS auditoria_login_iniciado_idx ON auditoria_login (iniciado_at DESC);
