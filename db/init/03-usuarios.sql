-- Cada documento pertenece a quien lo subió (el email de su cuenta de
-- Google): así un usuario nunca ve los archivos de otro. Los documentos que
-- ya existían de antes de tener login quedan con '' como dueño, que no
-- coincide con el email de nadie — no se filtran a quien inicie sesión primero.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS usuario_email text NOT NULL DEFAULT '';
ALTER TABLE documents ALTER COLUMN usuario_email DROP DEFAULT;

CREATE INDEX IF NOT EXISTS documents_usuario_idx ON documents (usuario_email);
