import { NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { ExtraccionBrutaSchema, normalizarFecha, validarExtraccion } from "@/lib/schemas";
import { CHAT_URL, MODELO, cabeceras, claveOpenAI } from "@/lib/openai";
import { esOffice, extraerTextoOficina } from "@/lib/oficina";
import { extraerTextoPdf } from "@/lib/pdf-texto";
import { emailUsuarioActual } from "@/lib/usuario-actual";

export const runtime = "nodejs";
export const maxDuration = 120;

const SYSTEM = `Eres un analista de documentos. Recibes una imagen, un PDF, o el texto
extraído de un Word/Excel/PowerPoint, y devuelves en JSON qué es y los datos que contiene.

1. Clasifica en tipo_documento con criterio estricto:
   - "factura": documento que cobra algo (número de factura, emisor, importes a pagar).
   - "recibo": justificante de un pago ya hecho (ticket, comprobante, recibo).
   - "contrato": acuerdo entre partes con cláusulas u obligaciones.
   - "otro": TODO lo demás — un currículum, un ensayo, un informe, una carta, una
     presentación, una hoja de cálculo cualquiera, o una fotografía (una persona, un
     perro, un coche, una casa, un paisaje…). En la duda, "otro".
2. En "categoria" di qué es exactamente, en pocas palabras y en español ("Factura de
   luz", "Currículum vitae", "Ensayo académico", "Fotografía de un gato",
   "Presupuesto de obra"…). Siempre rellénala.
3. En "resumen", una frase que describa el contenido real (para una foto, qué se ve).
4. Rellena SOLO los campos que el documento contiene de verdad. Emisor, receptor,
   número, fechas, moneda, importes, forma de pago y líneas son de documentos
   comerciales: en un "otro" van a null (o vacíos) salvo que aparezcan de forma
   explícita con ese sentido. No uses el nombre de la persona de un CV como "emisor"
   ni su ciudad como "dirección"; no inventes ni deduzcas.
5. En "datos_clave" recoge TODO lo que el documento contiene y no tiene campo
   propio: no hay un número máximo, no resumas ni agrupes con palabras tuyas, y no
   cambies una lista por una descripción ("Front-end, back-end…" está mal si el
   documento enumera HTML, CSS, React…). Copia cada lista completa, en el orden y con
   los nombres del documento. Un dato por cada elemento con identidad propia: cada
   empleo, cada título, cada certificado, cada perfil o enlace es un dato aparte, con
   una etiqueta que diga de qué sección sale ("Experiencia · EDUMEDIA TECH" →
   "Coordinador de Desarrollo · 2025"). Las listas cortas de una misma sección van en
   un solo dato, con sus elementos separados por comas ("Habilidades back-end" →
   "PHP, Laravel, Python…"). Ejemplos de qué buscar: en un CV, datos de contacto,
   perfil, cada formación, cada experiencia, cada grupo de habilidades, idiomas,
   proyectos o publicaciones; en un documento de identidad (pasaporte, cédula,
   permiso), titular, número, nacionalidad, nacimiento, expedición y vencimiento; en
   una foto, qué se ve y los textos visibles. Etiqueta corta en español. En
   facturas, recibos y contratos, sólo lo que no quepa en los otros campos (puede
   ir vacío).
6. Formato de los valores: importes como números, sin símbolo de moneda ni
   separadores de miles; TODA fecha en AAAA-MM-DD, también dentro de datos_clave
   (un documento que pone "25 JUN/JUN 1986" es "1986-06-25"). El resto, tal como
   aparece.
7. "contrato" sólo se rellena cuando tipo_documento es "contrato"; si no, null.
8. "notas" es sólo para dudas: un dato ilegible, ambiguo o que no se pudo
   interpretar con seguridad. Nunca pongas ahí un dato leído con claridad: eso va en
   su campo o en datos_clave.
9. Audita el documento entero antes de responder: recórrelo página por página y
   sección por sección, de arriba abajo y en todas las columnas, y comprueba que
   cada bloque de información ha quedado recogido en algún campo. No des nada por
   sentado ni completes con lo que "suele" poner: si no está escrito, no existe; si
   está escrito, tiene que aparecer. Si te llega también el texto extraído del
   documento, úsalo para verificar que no te saltas nada y para copiar con
   exactitud, pero manda lo que se ve en el documento.`;

/**
 * OpenAI en modo `strict` no admite la palabra clave `default` (la ponen los
 * `.default()` de los campos nuevos del esquema, para leer análisis antiguos):
 * se quita de la copia que se le manda. Los campos siguen en `required`.
 */
function sinDefaults(nodo: unknown): unknown {
  if (Array.isArray(nodo)) return nodo.map(sinDefaults);
  if (nodo && typeof nodo === "object") {
    return Object.fromEntries(
      Object.entries(nodo)
        .filter(([clave]) => clave !== "default")
        .map(([clave, valor]) => [clave, sinDefaults(valor)]),
    );
  }
  return nodo;
}

const jsonSchema = sinDefaults(z.toJSONSchema(ExtraccionBrutaSchema.omit({ texto: true })));

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
        text: `Analiza este documento (archivo: ${doc.filename}).\n\nContenido:\n${texto}`,
      },
    ];
  } else {
    const dataUrl = `data:${doc.mime_type};base64,${doc.data.toString("base64")}`;
    const isPdf = doc.mime_type === "application/pdf";
    // En un PDF de varias páginas el modelo tiende a quedarse con la primera:
    // se le dice cuántas son y se le da el texto real de cada una para que
    // compruebe que no se deja ninguna (ver `src/lib/pdf-texto.ts`).
    const textoPdf = isPdf ? await extraerTextoPdf(doc.data) : null;
    const instruccion = textoPdf
      ? [
          `Analiza este documento (archivo: ${doc.filename}). Tiene ${textoPdf.paginas} ${
            textoPdf.paginas === 1 ? "página" : "páginas"
          }: revísalas todas.`,
          "",
          `Texto extraído del PDF, página por página${
            textoPdf.recortado ? " (recortado: el documento es más largo, revisa el PDF entero)" : ""
          }:`,
          textoPdf.texto,
        ].join("\n")
      : `Analiza este documento (archivo: ${doc.filename}).`;
    parts = [
      { type: "text", text: instruccion },
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
    // Holgado: sin tope de datos, un documento de varias páginas da mucha salida.
    max_completion_tokens: 16000,
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

  // Las fechas de los datos encontrados, siempre en AAAA-MM-DD (el modelo a
  // veces las copia tal como vienen en el documento).
  const extraccion = {
    ...validado.data,
    datos_clave: validado.data.datos_clave.map((d) => ({ ...d, valor: normalizarFecha(d.valor) })),
  };
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
