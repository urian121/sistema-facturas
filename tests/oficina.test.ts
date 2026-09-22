import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { esOffice, MIME_OFICINA } from "@/lib/mime-oficina";
import {
  extraerTextoOficina,
  previsualizarDocx,
  previsualizarOficina,
  previsualizarPptx,
  previsualizarXlsx,
} from "@/lib/oficina";

/** Estructura mínima de un docx válido: las tres partes que mammoth necesita para leer el cuerpo. */
async function zipDocx(texto: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body><w:p><w:r><w:t>${texto}</w:t></w:r></w:p></w:body>
</w:document>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

/** Una sola diapositiva con el texto dado, en la forma mínima que lee el parseo propio de pptx. */
async function zipPptx(texto: string): Promise<Buffer> {
  const zip = new JSZip();
  zip.file(
    "ppt/slides/slide1.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
<p:cSld><p:spTree><p:sp><p:txBody>
<a:p><a:r><a:t>${texto}</a:t></a:r></a:p>
</p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`,
  );
  return zip.generateAsync({ type: "nodebuffer" });
}

function xlsxConFilas(filas: (string | number)[][]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Facturas");
  for (const fila of filas) hoja.addRow(fila);
  return libro.xlsx.writeBuffer().then(Buffer.from);
}

describe("esOffice", () => {
  it("reconoce los tres tipos de Office", () => {
    expect(esOffice(MIME_OFICINA.docx)).toBe(true);
    expect(esOffice(MIME_OFICINA.xlsx)).toBe(true);
    expect(esOffice(MIME_OFICINA.pptx)).toBe(true);
  });

  it("no confunde PDF ni imágenes con Office", () => {
    expect(esOffice("application/pdf")).toBe(false);
    expect(esOffice("image/png")).toBe(false);
  });
});

describe("extraerTextoOficina", () => {
  it("lee el texto de un .docx", async () => {
    const buffer = await zipDocx("Contrato de arrendamiento");

    const texto = await extraerTextoOficina(MIME_OFICINA.docx, buffer);

    expect(texto).toContain("Contrato de arrendamiento");
  });

  it("lee las celdas de un .xlsx", async () => {
    const buffer = await xlsxConFilas([
      ["Concepto", "Importe"],
      ["Café en grano 1 kg", 42.5],
    ]);

    const texto = await extraerTextoOficina(MIME_OFICINA.xlsx, buffer);

    expect(texto).toContain("Facturas");
    expect(texto).toContain("Café en grano 1 kg");
    expect(texto).toContain("42.5");
  });

  it("lee el texto de un .pptx", async () => {
    const buffer = await zipPptx("Cláusula de fianza");

    const texto = await extraerTextoOficina(MIME_OFICINA.pptx, buffer);

    expect(texto).toContain("Cláusula de fianza");
  });

  it("avisa con un mensaje claro si el archivo no se puede leer", async () => {
    const basura = Buffer.from("esto no es un docx");

    await expect(extraerTextoOficina(MIME_OFICINA.docx, basura)).rejects.toThrow(
      /No se pudo leer el archivo de Office/,
    );
  });
});

describe("previsualizarDocx / previsualizarPptx / previsualizarXlsx", () => {
  it("recorta el texto de Word a un fragmento corto", async () => {
    const largo = "Palabra ".repeat(50).trim();
    const buffer = await zipDocx(largo);

    const previa = await previsualizarDocx(buffer);

    expect(previa.length).toBeLessThan(largo.length);
    expect(previa.endsWith("…")).toBe(true);
  });

  it("toma solo la primera diapositiva de PowerPoint", async () => {
    const buffer = await zipPptx("Cláusula de fianza");

    const previa = await previsualizarPptx(buffer);

    expect(previa).toBe("Cláusula de fianza");
  });

  it("devuelve las primeras filas y columnas de Excel como datos, no como texto plano", async () => {
    const buffer = await xlsxConFilas([
      ["Concepto", "Importe", "IVA", "Total", "Sobra"],
      ["Café en grano 1 kg", 42.5, 8.93, 51.43, "x"],
    ]);

    const filas = await previsualizarXlsx(buffer);

    expect(filas).toEqual([
      ["Concepto", "Importe", "IVA", "Total"],
      ["Café en grano 1 kg", "42.5", "8.93", "51.43"],
    ]);
  });
});

describe("previsualizarOficina", () => {
  it("devuelve tipo 'hoja' para Excel", async () => {
    const buffer = await xlsxConFilas([["A", "B"]]);

    const previa = await previsualizarOficina(MIME_OFICINA.xlsx, buffer);

    expect(previa.tipo).toBe("hoja");
  });

  it("devuelve tipo 'texto' para Word y PowerPoint", async () => {
    const docx = await previsualizarOficina(MIME_OFICINA.docx, await zipDocx("hola"));
    const pptx = await previsualizarOficina(MIME_OFICINA.pptx, await zipPptx("hola"));

    expect(docx.tipo).toBe("texto");
    expect(pptx.tipo).toBe("texto");
  });

  it("con tamano 'grande' pide más filas/columnas de Excel que el tamaño chico", async () => {
    const filas = Array.from({ length: 10 }, (_, i) => [
      `fila${i}`,
      "b",
      "c",
      "d",
      "e",
      "f",
    ]);
    const buffer = await xlsxConFilas(filas);

    const chico = await previsualizarOficina(MIME_OFICINA.xlsx, buffer);
    const grande = await previsualizarOficina(MIME_OFICINA.xlsx, buffer, "grande");

    if (chico.tipo !== "hoja" || grande.tipo !== "hoja") throw new Error("tipo inesperado");
    expect(grande.filas.length).toBeGreaterThan(chico.filas.length);
    expect(grande.filas[0].length).toBeGreaterThan(chico.filas[0].length);
  });

  it("con tamano 'grande' devuelve más texto de Word que el tamaño chico", async () => {
    const largo = "Palabra ".repeat(400).trim();
    const buffer = await zipDocx(largo);

    const chico = await previsualizarOficina(MIME_OFICINA.docx, buffer);
    const grande = await previsualizarOficina(MIME_OFICINA.docx, buffer, "grande");

    if (chico.tipo !== "texto" || grande.tipo !== "texto") throw new Error("tipo inesperado");
    expect(grande.texto.length).toBeGreaterThan(chico.texto.length);
  });
});
