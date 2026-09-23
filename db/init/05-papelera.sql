-- Papelera: en vez de otra tabla, una columna en `documents`. NULL = activo;
-- con fecha = en la papelera (guardar cuándo, no sólo un booleano, deja
-- reusarla después para un purgado automático pasado un tiempo).
ALTER TABLE documents ADD COLUMN IF NOT EXISTS eliminado_at timestamptz;

-- Parcial: sólo indexa las filas que sí están en la papelera, que son pocas.
CREATE INDEX IF NOT EXISTS documents_eliminado_idx
  ON documents (eliminado_at)
  WHERE eliminado_at IS NOT NULL;
