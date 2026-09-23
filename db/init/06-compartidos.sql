-- Compartir documentos entre usuarios de la app. Una fila = "este documento
-- lo puede ver este usuario". El dueño sigue siendo `documents.usuario_email`;
-- compartir sólo da lectura (abrir, descargar, vista previa) — renombrar,
-- editar la extracción, confirmar, mover a la papelera y volver a compartir
-- siguen siendo exclusivos del dueño.
--
-- Los usuarios se identifican por el email de su cuenta de Google, igual que
-- en `documents`: no hay tabla `users`, así que "usuario de la app" = alguien
-- con al menos una fila en `auditoria_login` (eso lo comprueba la API, no una
-- FK, porque no hay tabla a la que apuntar).
CREATE TABLE IF NOT EXISTS documento_compartidos (
  document_id        uuid        NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  usuario_email      text        NOT NULL,
  compartido_por     text        NOT NULL,
  compartido_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (document_id, usuario_email)
);

-- La consulta frecuente del lado del destinatario: "¿qué me han compartido?".
CREATE INDEX IF NOT EXISTS documento_compartidos_usuario_idx
  ON documento_compartidos (usuario_email);
