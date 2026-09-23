"use client";

import { showToast } from "nextjs-toast-notify";

/** Duración corta y consistente para no obligar a esperar los 8 s por defecto. */
const DURACION = 4000;

/** Texto para el usuario: el de la excepción si la hay, o uno genérico. */
function mensajeDe(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  return "Error inesperado";
}

export const notificar = {
  ok: (mensaje: string) => showToast.success(mensaje, { duration: DURACION }),

  /**
   * Algo salió a medias (se hizo lo principal, falló algo secundario). Dura
   * más que el resto porque suele traer instrucciones, y queda en la consola.
   */
  aviso: (mensaje: string) => {
    console.warn(`[Gestor de Facturas] ${mensaje}`);
    showToast.warning(mensaje, { duration: DURACION * 3 });
  },

  /**
   * Toast de error y, además, la misma línea en la consola del navegador, para
   * poder investigar lo que el toast ya no enseña cuando desaparece. Acepta
   * directamente lo que llega a un `catch` (`notificar.error(err)`) o un texto
   * propio con la causa aparte (`notificar.error("No se pudo…", err)`): en la
   * consola sale el objeto de error completo, con su traza.
   */
  error: (error: unknown, causa?: unknown) => {
    const mensaje = mensajeDe(error);
    if (causa !== undefined) {
      // Texto propio + la causa: son distintos, van los dos.
      console.error(`[Gestor de Facturas] ${mensaje}`, causa);
    } else if (error instanceof Error) {
      // El Error ya lleva el mensaje y la traza: sólo él, para no repetir el texto.
      console.error("[Gestor de Facturas]", error);
    } else {
      console.error(`[Gestor de Facturas] ${mensaje}`);
    }
    showToast.error(mensaje, { duration: DURACION });
  },
};
