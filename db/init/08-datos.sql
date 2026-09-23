-- Lo que no cabe en las columnas fijas de `registros` —los "datos
-- encontrados" del análisis y los que el usuario añade a mano ("Profesión",
-- "Nº de pasaporte"…)— se archiva aquí, una fila por dato, igual que las
-- líneas en `registro_lineas`. Así el chat lo puede consultar por SQL en vez
-- de quedarse sólo en el JSON del borrador (`documents.extraction`).
CREATE TABLE IF NOT EXISTS registro_datos (
  id          uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  registro_id uuid    NOT NULL REFERENCES registros(id) ON DELETE CASCADE,
  orden       integer NOT NULL,
  etiqueta    text    NOT NULL,
  valor       text    NOT NULL,
  UNIQUE (registro_id, orden)
);

-- Las preguntas buscan por etiqueta sin distinguir mayúsculas ("profesión").
CREATE INDEX IF NOT EXISTS registro_datos_etiqueta_idx
  ON registro_datos (lower(etiqueta));

-- Qué es exactamente el documento ("Currículum vitae", "Factura de luz"…),
-- más fino que `tipo_documento`.
ALTER TABLE registros ADD COLUMN IF NOT EXISTS categoria text;
