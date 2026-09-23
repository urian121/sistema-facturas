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
