/**
 * Solo las constantes de tipo MIME, sin las librerías de parseo (mammoth,
 * exceljs, jszip): así lo puede importar código de cliente (el modal de
 * subida) sin arrastrar esas dependencias al bundle del navegador.
 */
export const MIME_OFICINA = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
} as const;

export function esOffice(mimeType: string): boolean {
  return (Object.values(MIME_OFICINA) as string[]).includes(mimeType);
}
