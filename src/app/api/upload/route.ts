import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { MAX_BYTES, MAX_MB, TIPOS_PERMITIDOS } from "@/lib/limites-subida";
import { emailUsuarioActual } from "@/lib/usuario-actual";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 });
  }
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    return NextResponse.json(
      { error: `Tipo no permitido: ${file.type || "desconocido"}` },
      { status: 415 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `El archivo supera los ${MAX_MB} MB` }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  const { rows } = await pool.query(
    `INSERT INTO documents (filename, mime_type, size_bytes, data, usuario_email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, filename, mime_type, size_bytes, created_at`,
    [file.name, file.type, file.size, bytes, usuarioEmail],
  );

  return NextResponse.json(rows[0], { status: 201 });
}
