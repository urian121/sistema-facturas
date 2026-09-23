import { pool } from "@/lib/db";

/**
 * Historial activo del usuario: los suyos más los que le compartieron y
 * aceptó. Los compartidos llevan `compartido_por` (email del dueño) y
 * `extraction` a NULL — el borrador es del dueño, el destinatario sólo ve el
 * archivo. Mismo orden y tope que antes para los propios.
 */
export async function listarDocumentos(usuarioEmail: string) {
  const { rows } = await pool.query(
    `SELECT id, filename, mime_type, size_bytes, created_at, doc_type, extraction,
            NULL::text AS compartido_por
       FROM documents
      WHERE usuario_email = $1
        AND eliminado_at IS NULL
     UNION ALL
     SELECT d.id, d.filename, d.mime_type, d.size_bytes, d.created_at, d.doc_type,
            NULL::jsonb, d.usuario_email
       FROM documents d
       JOIN documento_compartidos c ON c.document_id = d.id
      WHERE c.usuario_email = $1
        AND c.estado = 'aceptado'
        AND d.eliminado_at IS NULL
      ORDER BY created_at DESC
      LIMIT 50`,
    [usuarioEmail],
  );
  return rows;
}
