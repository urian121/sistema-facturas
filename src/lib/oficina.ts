import ExcelJS from "exceljs";
import JSZip from "jszip";
import mammoth from "mammoth";
import { MIME_OFICINA } from "@/lib/mime-oficina";

export { MIME_OFICINA, esOffice } from "@/lib/mime-oficina";

/** Un Excel de miles de filas no debe reventar el contexto del modelo ni el costo. */
const MAX_CARACTERES = 12_000;

function truncar(texto: string): string {
  return texto.length > MAX_CARACTERES
    ? `${texto.slice(0, MAX_CARACTERES)}\n… (texto truncado)`
    : texto;
}

async function textoDocx(data: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: data });
  return value;
}

function celdaComoTexto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text);
  if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result);
  return String(v);
}

async function textoXlsx(data: Buffer): Promise<string> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(data as unknown as ExcelJS.Buffer);

  const hojas: string[] = [];
  libro.eachSheet((hoja) => {
    const filas: string[] = [];
    hoja.eachRow((fila) => {
      const celdas = (fila.values as unknown[]).slice(1).map(celdaComoTexto);
      filas.push(celdas.join("\t"));
    });
    hojas.push(`# ${hoja.name}\n${filas.join("\n")}`);
  });

  return hojas.join("\n\n");
}

const ENTIDADES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodificarXml(texto: string): string {
  return texto.replace(/&(amp|lt|gt|quot|apos);/g, (_, nombre) => ENTIDADES[nombre]);
}

async function textoPptx(data: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(data);

  const diapositivas = Object.keys(zip.files)
    .filter((nombre) => /^ppt\/slides\/slide\d+\.xml$/.test(nombre))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)![1]);
      const nb = Number(b.match(/slide(\d+)\.xml$/)![1]);
      return na - nb;
    });

  const textos: string[] = [];
  for (const [i, nombre] of diapositivas.entries()) {
    const xml = await zip.files[nombre].async("string");
    const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => decodificarXml(m[1]));
    textos.push(`# Diapositiva ${i + 1}\n${runs.join(" ")}`);
  }

  return textos.join("\n\n");
}

/**
 * Extrae el texto legible de un documento de Office. A diferencia de
 * imágenes y PDF, aquí no hace falta IA: el texto ya está embebido en el
 * archivo de forma determinística.
 */
export async function extraerTextoOficina(mimeType: string, data: Buffer): Promise<string> {
  try {
    switch (mimeType) {
      case MIME_OFICINA.docx:
        return truncar(await textoDocx(data));
      case MIME_OFICINA.xlsx:
        return truncar(await textoXlsx(data));
      case MIME_OFICINA.pptx:
        return truncar(await textoPptx(data));
      default:
        throw new Error(`Tipo de Office no soportado: ${mimeType}`);
    }
  } catch (err) {
    throw new Error(
      `No se pudo leer el archivo de Office: ${err instanceof Error ? err.message : "error desconocido"}`,
    );
  }
}

const LARGO_PREVISUALIZACION = 180;
const FILAS_PREVISUALIZACION = 5;
const COLUMNAS_PREVISUALIZACION = 4;

// El panel de documento tiene todo el ancho para sí: mismo dato, más de él.
const LARGO_PREVISUALIZACION_GRANDE = 1500;
const FILAS_PREVISUALIZACION_GRANDE = 25;
const COLUMNAS_PREVISUALIZACION_GRANDE = 10;

/** Fragmento corto para una tarjeta pequeña, no el texto completo que se le manda a la IA. */
export async function previsualizarDocx(
  data: Buffer,
  largo = LARGO_PREVISUALIZACION,
): Promise<string> {
  const texto = (await textoDocx(data)).trim();
  return texto.length > largo ? `${texto.slice(0, largo)}…` : texto;
}

/** Solo el texto de la primera diapositiva, para no cargar todo el .pptx en una tarjeta. */
export async function previsualizarPptx(
  data: Buffer,
  largo = LARGO_PREVISUALIZACION,
): Promise<string> {
  const zip = await JSZip.loadAsync(data);
  const primera = Object.keys(zip.files)
    .filter((nombre) => /^ppt\/slides\/slide\d+\.xml$/.test(nombre))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)![1]);
      const nb = Number(b.match(/slide(\d+)\.xml$/)![1]);
      return na - nb;
    })[0];

  if (!primera) return "";

  const xml = await zip.files[primera].async("string");
  const texto = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)]
    .map((m) => decodificarXml(m[1]))
    .join(" ")
    .trim();

  return texto.length > largo ? `${texto.slice(0, largo)}…` : texto;
}

/** Las primeras filas/columnas de la primera hoja, como datos reales de verdad. */
export async function previsualizarXlsx(
  data: Buffer,
  filasMax = FILAS_PREVISUALIZACION,
  columnasMax = COLUMNAS_PREVISUALIZACION,
): Promise<string[][]> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(data as unknown as ExcelJS.Buffer);

  const hoja = libro.worksheets[0];
  if (!hoja) return [];

  const filas: string[][] = [];
  for (let i = 1; i <= Math.min(filasMax, hoja.rowCount); i++) {
    const valores = (hoja.getRow(i).values as unknown[]).slice(1, columnasMax + 1);
    filas.push(valores.map(celdaComoTexto));
  }

  return filas;
}

/**
 * Envuelve las tres funciones de previsualización en la misma forma que
 * espera `/api/preview/[id]`, para no repetir el switch en la ruta.
 * `tamano: "grande"` es para el panel de documento (más filas/columnas o
 * texto más largo); "chico" (el valor por defecto) es para la tarjeta del
 * historial.
 */
export async function previsualizarOficina(
  mimeType: string,
  data: Buffer,
  tamano: "chico" | "grande" = "chico",
): Promise<{ tipo: "texto"; texto: string } | { tipo: "hoja"; filas: string[][] }> {
  try {
    switch (mimeType) {
      case MIME_OFICINA.docx:
        return {
          tipo: "texto",
          texto: await previsualizarDocx(
            data,
            tamano === "grande" ? LARGO_PREVISUALIZACION_GRANDE : LARGO_PREVISUALIZACION,
          ),
        };
      case MIME_OFICINA.pptx:
        return {
          tipo: "texto",
          texto: await previsualizarPptx(
            data,
            tamano === "grande" ? LARGO_PREVISUALIZACION_GRANDE : LARGO_PREVISUALIZACION,
          ),
        };
      case MIME_OFICINA.xlsx:
        return {
          tipo: "hoja",
          filas: await previsualizarXlsx(
            data,
            tamano === "grande" ? FILAS_PREVISUALIZACION_GRANDE : FILAS_PREVISUALIZACION,
            tamano === "grande" ? COLUMNAS_PREVISUALIZACION_GRANDE : COLUMNAS_PREVISUALIZACION,
          ),
        };
      default:
        throw new Error(`Tipo de Office no soportado: ${mimeType}`);
    }
  } catch (err) {
    throw new Error(
      `No se pudo generar la vista previa: ${err instanceof Error ? err.message : "error desconocido"}`,
    );
  }
}
