import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { emailUsuarioActual } from "@/lib/usuario-actual";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const { rows } = await pool.query(
    `SELECT filename, mime_type, data FROM documents WHERE id = $1 AND usuario_email = $2`,
    [id, usuarioEmail],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const doc = rows[0];
  return new NextResponse(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.mime_type,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.filename)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
