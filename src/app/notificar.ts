"use client";

import { showToast } from "nextjs-toast-notify";

/** Duración corta y consistente para no obligar a esperar los 8 s por defecto. */
const DURACION = 4000;

export const notificar = {
  ok: (mensaje: string) => showToast.success(mensaje, { duration: DURACION }),
  error: (mensaje: string) => showToast.error(mensaje, { duration: DURACION }),
};
