import { describe, expect, it } from "vitest";
import { pdfDePrueba } from "./factories";
import { extraerTextoPdf } from "@/lib/pdf-texto";

describe("extraerTextoPdf", () => {
  it("lee el texto de todas las páginas, cada una con su cabecera", async () => {
    const resultado = await extraerTextoPdf(pdfDePrueba(["Experiencia laboral", "Habilidades DevOps"]));

    expect(resultado?.paginas).toBe(2);
    expect(resultado?.texto).toContain("--- Página 1 de 2 ---\nExperiencia laboral");
    expect(resultado?.texto).toContain("--- Página 2 de 2 ---\nHabilidades DevOps");
    expect(resultado?.recortado).toBe(false);
  });

  it("devuelve null si el archivo no es un PDF legible", async () => {
    expect(await extraerTextoPdf(Buffer.from("no es un pdf"))).toBeNull();
  });
});
