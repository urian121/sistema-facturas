import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { emailUsuarioActual } from "@/lib/usuario-actual";

export const runtime = "nodejs";

const RESPUESTAS = { aceptar: "aceptado", rechazar: "rechazado" } as const;

/**
 * Acepta o rechaza la invitación de una notificación (`{ "respuesta":
 * "aceptar" | "rechazar" }`). Sólo se puede responder una vez, mientras está
 * pendiente. El `pg_notify` avisa a las demás pestañas del mismo usuario para
 * que su campana se actualice también.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const cuerpo = await request.json().catch(() => null);
  const estado = RESPUESTAS[cuerpo?.respuesta as keyof typeof RESPUESTAS];
  if (!estado) {
    return NextResponse.json(
      { error: 'La respuesta tiene que ser "aceptar" o "rechazar"' },
      { status: 400 },
    );
  }

  const { rows } = await pool.query(
    `WITH respondida AS (
       UPDATE documento_compartidos c
          SET estado = $3, respondido_at = now()
         FROM notificaciones n
        WHERE n.id = $1
          AND n.usuario_email = $2
          AND c.document_id = n.document_id
          AND c.usuario_email = n.usuario_email
          AND c.estado = 'pendiente'
       RETURNING c.document_id, c.estado
     )
     SELECT document_id, estado, pg_notify('notificaciones', $2) AS aviso FROM respondida`,
    [id, usuarioEmail, estado],
  );
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Esta invitación ya no está pendiente" },
      { status: 404 },
    );
  }

  return NextResponse.json({ document_id: rows[0].document_id, estado: rows[0].estado });
}
