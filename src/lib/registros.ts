import { pool } from "@/lib/db";

export type Registro = {
  id: string;
  document_id: string;
  filename: string;
  tipo_documento: string;
  /** Qué es exactamente ("Currículum vitae"…); sale del análisis guardado, no de `registros`. */
  categoria: string | null;
  numero_documento: string | null;
  fecha_emision: string | null;
  emisor_nombre: string | null;
  receptor_nombre: string | null;
  total: string | null;
  moneda: string | null;
  confirmado_at: string;
  lineas: number;
  chunks: number;
};

const CONSULTA = `
  SELECT r.id,
         r.document_id,
         d.filename,
         r.tipo_documento,
         COALESCE(r.categoria, d.extraction->>'categoria') AS categoria,
         r.numero_documento,
         to_char(r.fecha_emision, 'YYYY-MM-DD') AS fecha_emision,
         r.emisor_nombre,
         r.receptor_nombre,
         r.total,
         r.moneda,
         r.confirmado_at,
         (SELECT count(*) FROM registro_lineas l WHERE l.registro_id = r.id)::int AS lineas,
         (SELECT count(*) FROM documento_chunks c WHERE c.document_id = r.document_id)::int AS chunks
    FROM registros r
    JOIN documents d ON d.id = r.document_id
   WHERE d.usuario_email = $1
     AND d.eliminado_at IS NULL
   ORDER BY r.confirmado_at DESC
   LIMIT 100`;

/** Documentos ya confirmados del usuario dado, del más reciente al más antiguo. */
export async function listarRegistros(usuarioEmail: string): Promise<Registro[]> {
  const { rows } = await pool.query(CONSULTA, [usuarioEmail]);
  return rows as Registro[];
}
