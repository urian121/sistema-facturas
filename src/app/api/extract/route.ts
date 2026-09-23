import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { ExtraccionBrutaSchema, validarExtraccion } from "@/lib/schemas";
import { CHAT_URL, MODELO, cabeceras, claveOpenAI } from "@/lib/openai";
import { esOffice, extraerTextoOficina } from "@/lib/oficina";
import { emailUsuarioActual } from "@/lib/usuario-actual";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM = `Eres un extractor de datos de documentos. Recibes la imagen, el PDF, o el
texto extraído de un documento Word/Excel/PowerPoint, y devuelves únicamente sus datos
estructurados en JSON.

- Clasifica el documento como factura, recibo, contrato u otro.
- Copia los valores tal como aparecen; no inventes datos que no estén en el documento.
- Usa null en cualquier campo que el documento no contenga o que no puedas leer con certeza.
- Los importes van como números, sin símbolo de moneda ni separadores de miles.
- El campo "contrato" sólo se rellena cuando tipo_documento es "contrato"; si no, va null.
- Anota en "notas" cualquier campo ilegible o ambiguo.`;

const jsonSchema = z.toJSONSchema(ExtraccionBrutaSchema.omit({ texto: true }));

type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

/** El modelo puede envolver el JSON en un bloque de código; lo desenvolvemos. */
function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

export async function POST(request: Request) {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await request.json().catch(() => ({ id: null }));
  if (typeof id !== "string") {
    return NextResponse.json({ error: "Falta el id del documento" }, { status: 400 });
  }

  const apiKey = claveOpenAI();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Falta OPENAI_API_KEY en .env.local" },
      { status: 500 },
    );
  }

  const { rows } = await pool.query(
    `SELECT filename, mime_type, data FROM documents
      WHERE id = $1 AND usuario_email = $2 AND eliminado_at IS NULL`,
    [id, usuarioEmail],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const doc = rows[0] as { filename: string; mime_type: string; data: Buffer };

  let parts: ContentPart[];
  if (esOffice(doc.mime_type)) {
    let texto: string;
    try {
      texto = await extraerTextoOficina(doc.mime_type, doc.data);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "No se pudo leer el archivo" },
        { status: 502 },
      );
    }
    parts = [
      {
        type: "text",
        text: `Extrae los datos de este documento (archivo: ${doc.filename}).\n\nContenido:\n${texto}`,
      },
    ];
  } else {
    const dataUrl = `data:${doc.mime_type};base64,${doc.data.toString("base64")}`;
    const isPdf = doc.mime_type === "application/pdf";
    parts = [
      { type: "text", text: `Extrae los datos de este documento (archivo: ${doc.filename}).` },
      isPdf
        ? { type: "file", file: { filename: doc.filename, file_data: dataUrl } }
        : { type: "image_url", image_url: { url: dataUrl } },
    ];
  }

  const body = {
    model: MODELO,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: parts },
    ],
    max_completion_tokens: 8000,
    // Structured outputs: el modelo está obligado a respetar el esquema.
    response_format: {
      type: "json_schema",
      json_schema: { name: "extraccion", strict: true, schema: jsonSchema },
    },
  };

  // Arrow function: así TypeScript conserva que `apiKey` ya no es null.
  const pedir = async () => {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: cabeceras(apiKey),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(110_000),
    });
    return { res, payload: await res.json().catch(() => null) };
  };

  let { res, payload } = await pedir();

  // Una respuesta vacía es rara pero pasa: se reintenta una vez.
  if (res.ok && !payload?.choices?.[0]?.message?.content) {
    ({ res, payload } = await pedir());
  }

  if (!res.ok) {
    const detalle = payload?.error?.message ?? res.statusText;
    return NextResponse.json(
      { error: `OpenAI respondió ${res.status}: ${detalle}` },
      { status: res.status === 401 ? 401 : 502 },
    );
  }

  const eleccion = payload?.choices?.[0];
  const content: string | undefined = eleccion?.message?.content;
  if (!content) {
    return NextResponse.json(
      {
        error: "El modelo no devolvió contenido",
        finish_reason: eleccion?.finish_reason ?? null,
      },
      { status: 502 },
    );
  }

  if (eleccion.finish_reason === "length") {
    return NextResponse.json(
      { error: "La respuesta del modelo se cortó por longitud; reintenta el análisis" },
      { status: 502 },
    );
  }

  let parsed: unknown;
  try {
    parsed = parseJsonLoose(content);
  } catch {
    return NextResponse.json(
      { error: "El modelo no devolvió un JSON válido", crudo: content.slice(0, 2000) },
      { status: 502 },
    );
  }

  const validado = ExtraccionBrutaSchema.safeParse({
    ...(parsed as object),
    // La transcripción llega al archivar, no aquí.
    texto: null,
  });
  if (!validado.success) {
    return NextResponse.json(
      {
        error: "El JSON del modelo no cumple el esquema",
        problemas: validado.error.issues.slice(0, 10),
        crudo: parsed,
      },
      { status: 502 },
    );
  }

  const extraccion = validado.data;
  // Las reglas por tipo (fechas, obligatorios, cuadre) no bloquean el guardado:
  // se devuelven para que el formulario las marque en rojo y se puedan corregir.
  const validacion = validarExtraccion(extraccion);

  await pool.query(
    `UPDATE documents
        SET doc_type = $2, extraction = $3, extracted_at = now()
      WHERE id = $1 AND usuario_email = $4`,
    [id, extraccion.tipo_documento, JSON.stringify(extraccion), usuarioEmail],
  );

  return NextResponse.json({
    id,
    modelo: payload?.model ?? MODELO,
    doc_type: extraccion.tipo_documento,
    extraction: extraccion,
    validacion,
    usage: payload?.usage ?? null,
  });
}
