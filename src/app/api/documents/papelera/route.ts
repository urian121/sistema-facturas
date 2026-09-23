import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { emailUsuarioActual } from "@/lib/usuario-actual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Documentos en la papelera del usuario, del más recién eliminado al más antiguo. */
export async function GET() {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { rows } = await pool.query(
    `SELECT id, filename, mime_type, size_bytes, eliminado_at
       FROM documents
      WHERE usuario_email = $1
        AND eliminado_at IS NOT NULL
      ORDER BY eliminado_at DESC`,
    [usuarioEmail],
  );

  return NextResponse.json(rows);
}

/**
 * Vacía la papelera: borra para siempre, en una sola sentencia, todos los
 * documentos del usuario que están en ella (nunca los activos ni los de
 * otros). `ON DELETE CASCADE` se lleva registros, chunks, invitaciones y
 * notificaciones asociadas, igual que el borrado de uno en uno.
 */
export async function DELETE() {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { rowCount } = await pool.query(
    `DELETE FROM documents
      WHERE usuario_email = $1
        AND eliminado_at IS NOT NULL`,
    [usuarioEmail],
  );

  return NextResponse.json({ eliminados: rowCount ?? 0 });
}
