-- Compartir pasa a ser una invitación: el destinatario la acepta o la
-- rechaza. Hasta aceptarla no tiene acceso al archivo (`puedeVer()` en
-- src/lib/compartir.ts exige 'aceptado'). El estado vive aquí y no en la
-- notificación: es lo que decide el acceso, y así hay una sola fuente de
-- verdad. Si el dueño vuelve a compartir algo rechazado, vuelve a 'pendiente'.
ALTER TABLE documento_compartidos
  ADD COLUMN IF NOT EXISTS estado text NOT NULL DEFAULT 'pendiente'
  CHECK (estado IN ('pendiente', 'aceptado', 'rechazado'));
ALTER TABLE documento_compartidos ADD COLUMN IF NOT EXISTS respondido_at timestamptz;

-- Una fila por aviso "X te compartió Y". Solo los campos que no se pueden
-- sacar de otro sitio: el nombre del archivo sale de `documents`, el nombre
-- del remitente de `auditoria_login` y el estado de `documento_compartidos`.
-- Los usuarios son emails de Google (no hay tabla `users` con ids).
CREATE TABLE IF NOT EXISTS notificaciones (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_email   text        NOT NULL,  -- destinatario
  remitente_email text        NOT NULL,  -- quien compartió
  document_id     uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  creada_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notificaciones_usuario_idx
  ON notificaciones (usuario_email, creada_at DESC);
