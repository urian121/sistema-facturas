import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { emailUsuarioActual } from "@/lib/usuario-actual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Notificaciones del usuario, de la más reciente a la más antigua. Nombre del
 * archivo, estado de la invitación y nombre del remitente se sacan en el
 * momento (ver `db/init/07-notificaciones.sql`), así que siempre están al día:
 * si el dueño renombra el archivo, la notificación lo refleja. Las de
 * documentos en la papelera del dueño no salen.
 */
export async function GET() {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { rows } = await pool.query(
    `SELECT n.id, n.document_id, n.remitente_email, n.creada_at,
            r.usuario_nombre AS remitente_nombre,
            d.filename, d.mime_type,
            c.estado
       FROM notificaciones n
       JOIN documents d ON d.id = n.document_id AND d.eliminado_at IS NULL
       JOIN documento_compartidos c
         ON c.document_id = n.document_id AND c.usuario_email = n.usuario_email
       LEFT JOIN LATERAL (
             SELECT usuario_nombre FROM auditoria_login a
              WHERE a.usuario_email = n.remitente_email
              ORDER BY iniciado_at DESC
              LIMIT 1
            ) r ON true
      WHERE n.usuario_email = $1
      ORDER BY n.creada_at DESC
      LIMIT 30`,
    [usuarioEmail],
  );
  return NextResponse.json(rows);
}
