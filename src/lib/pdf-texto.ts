/** Tope del texto que se manda al modelo junto al PDF (≈ 10 000 tokens). */
const MAX_CARACTERES = 40_000;

export type TextoPdf = {
  paginas: number;
  /** Texto de todas las páginas, cada una con su cabecera "--- Página N de M ---". */
  texto: string;
  /** `true` si hubo que cortar por `MAX_CARACTERES`. */
  recortado: boolean;
};

/**
 * Texto real de cada página de un PDF, leído en el servidor con pdfjs-dist
 * (el mismo que pinta las miniaturas en el navegador).
 *
 * El análisis manda esto junto al propio PDF: el modelo "ve" las páginas,
 * pero con varias hojas llenas tiende a resumir o saltarse alguna; con el
 * texto delante, página por página, puede comprobar que no se deja nada.
 * Devuelve `null` si no se puede leer o el PDF no tiene capa de texto
 * (escaneado): entonces el modelo trabaja sólo con las imágenes, como antes.
 */
export async function extraerTextoPdf(data: Buffer): Promise<TextoPdf | null> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const tarea = pdfjs.getDocument({
      data: new Uint8Array(data),
      useSystemFonts: true,
      verbosity: 0,
    });
    const documento = await tarea.promise;

    const paginas: string[] = [];
    for (let n = 1; n <= documento.numPages; n++) {
      const pagina = await documento.getPage(n);
      const contenido = await pagina.getTextContent();
      // Respeta los saltos de línea del propio PDF (`hasEOL`) para que las
      // listas (habilidades, líneas de factura…) no se fundan en un párrafo.
      const texto = contenido.items
        .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : ""))
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      paginas.push(`--- Página ${n} de ${documento.numPages} ---\n${texto || "(sin texto)"}`);
    }
    // Libera el worker y la memoria del documento: esto corre en el servidor.
    await tarea.destroy();

    const completo = paginas.join("\n\n");
    // Sólo cabeceras y "(sin texto)": es un escaneado, no hay nada que añadir.
    if (!completo.replace(/--- Página \d+ de \d+ ---|\(sin texto\)/g, "").trim()) return null;

    const recortado = completo.length > MAX_CARACTERES;
    return {
      paginas: documento.numPages,
      texto: recortado ? completo.slice(0, MAX_CARACTERES) : completo,
      recortado,
    };
  } catch {
    return null;
  }
}
