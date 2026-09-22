import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { esOffice, previsualizarOficina } from "@/lib/oficina";

export const runtime = "nodejs";

/**
 * Vista previa de datos reales: filas de Excel o fragmento de texto de
 * Word/PowerPoint. `?tamano=grande` pide más datos (para el panel de
 * documento); por defecto es la cantidad chica que cabe en una tarjeta del
 * historial.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const tamano = new URL(request.url).searchParams.get("tamano") === "grande" ? "grande" : "chico";

  const { rows } = await pool.query(
    `SELECT mime_type, data FROM documents WHERE id = $1`,
    [id],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const doc = rows[0] as { mime_type: string; data: Buffer };
  if (!esOffice(doc.mime_type)) {
    return NextResponse.json(
      { error: "Este tipo de archivo no tiene vista previa de datos" },
      { status: 400 },
    );
  }

  try {
    const previa = await previsualizarOficina(doc.mime_type, doc.data, tamano);
    return NextResponse.json(previa);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "No se pudo generar la vista previa" },
      { status: 502 },
    );
  }
}
