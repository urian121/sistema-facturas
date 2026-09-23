import { CHAT_URL, MODELO, cabeceras, claveOpenAI } from "@/lib/openai";
import { esOffice, extraerTextoOficina } from "@/lib/oficina";

const SYSTEM = `Transcribes documentos. Devuelves únicamente el texto visible del
documento, literal y en orden de lectura, sin resumirlo, sin reordenarlo y sin añadir
comentarios ni formato de tu cosecha.`;

/**
 * Transcribe el documento completo.
 *
 * Vive aparte de la extracción a propósito: la transcripción son entre mil y dos mil
 * tokens de salida, y pedirla junto con los campos duplicaba la espera de la pantalla
 * de revisión (22,9 s frente a 10,2 s medidos sobre la misma factura). Aquí se pide
 * al archivar, que es cuando el texto hace falta de verdad para los embeddings.
 */
export async function transcribir(doc: {
  filename: string;
  mime_type: string;
  data: Buffer;
}): Promise<string | null> {
  // El texto de un Word/Excel/PowerPoint ya está en el archivo, exacto: no
  // hace falta pedirle a un modelo que lo "transcriba".
  if (esOffice(doc.mime_type)) {
    try {
      return await extraerTextoOficina(doc.mime_type, doc.data);
    } catch {
      return null;
    }
  }

  const apiKey = claveOpenAI();
  if (!apiKey) return null;

  const dataUrl = `data:${doc.mime_type};base64,${doc.data.toString("base64")}`;
  const esPdf = doc.mime_type === "application/pdf";

  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: cabeceras(apiKey),
      body: JSON.stringify({
        model: MODELO,
        max_completion_tokens: 8000,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcribe este documento." },
              esPdf
                ? { type: "file", file: { filename: doc.filename, file_data: dataUrl } }
                : { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(110_000),
    });

    if (!res.ok) return null;

    const payload = await res.json().catch(() => null);
    const texto: string | undefined = payload?.choices?.[0]?.message?.content;
    return texto?.trim() ? texto : null;
  } catch {
    // Si la transcripción falla, el archivado sigue: se indexa el texto derivado
    // de los campos ya revisados en vez de quedarse sin nada.
    return null;
  }
}
