import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { ExtraccionBrutaSchema, validarExtraccion } from "@/lib/schemas";
import { emailUsuarioActual } from "@/lib/usuario-actual";

export const runtime = "nodejs";

/**
 * Guarda las correcciones manuales del formulario, o —según qué traiga el
 * cuerpo— renombra el documento (`filename`) o lo mueve a la papelera / lo
 * restaura (`papelera`). Todo junto porque son variantes de "actualizar este
 * documento", no acciones separadas.
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

  if (typeof cuerpo?.papelera === "boolean") {
    const eliminadoAt = cuerpo.papelera ? new Date() : null;

    const { rowCount } = await pool.query(
      `UPDATE documents SET eliminado_at = $2 WHERE id = $1 AND usuario_email = $3`,
      [id, eliminadoAt, usuarioEmail],
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    return NextResponse.json({ id, eliminado_at: eliminadoAt });
  }

  if (typeof cuerpo?.filename === "string") {
    const filename = cuerpo.filename.trim();
    if (!filename) {
      return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
    }

    const { rowCount } = await pool.query(
      `UPDATE documents SET filename = $2 WHERE id = $1 AND usuario_email = $3`,
      [id, filename, usuarioEmail],
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: "No encontrado" }, { status: 404 });
    }

    return NextResponse.json({ id, filename });
  }

  const parsed = ExtraccionBrutaSchema.safeParse(cuerpo?.extraction);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "La extracción enviada no tiene la forma esperada",
        problemas: parsed.error.issues.slice(0, 10),
      },
      { status: 400 },
    );
  }

  const extraccion = parsed.data;
  // Se guardan también las extracciones con problemas: son correcciones en curso.
  const validacion = validarExtraccion(extraccion);

  const { rowCount } = await pool.query(
    `UPDATE documents
        SET doc_type = $2, extraction = $3, extracted_at = now()
      WHERE id = $1 AND usuario_email = $4`,
    [id, extraccion.tipo_documento, JSON.stringify(extraccion), usuarioEmail],
  );

  if (rowCount === 0) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json({ id, extraction: extraccion, validacion });
}

/**
 * Borra el documento para siempre (se usa desde la papelera, no desde el
 * historial normal); `ON DELETE CASCADE` se encarga de registros y chunks
 * asociados.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;

  const { rowCount } = await pool.query(
    `DELETE FROM documents WHERE id = $1 AND usuario_email = $2`,
    [id, usuarioEmail],
  );
  if (rowCount === 0) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
