import { MIME_OFICINA } from "@/lib/mime-oficina";

const TIPOS_POR_DEFECTO = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  ...Object.values(MIME_OFICINA),
];

const MAX_MB_POR_DEFECTO = 20;

/**
 * Tipos de archivo aceptados y peso máximo por archivo, configurables desde
 * `.env.local` (`UPLOAD_TIPOS_PERMITIDOS`, `UPLOAD_MAX_MB`) en vez de estar
 * fijos en el código. Solo se leen aquí, en un módulo de servidor: la subida
 * ya valida en `/api/upload`, y lo que llega al cliente (`SubirModal`) es el
 * resultado ya resuelto, pasado como prop desde `page.tsx` — así no hace
 * falta exponer estas variables con el prefijo `NEXT_PUBLIC_`.
 */
export const TIPOS_PERMITIDOS = process.env.UPLOAD_TIPOS_PERMITIDOS
  ? process.env.UPLOAD_TIPOS_PERMITIDOS.split(",").map((tipo) => tipo.trim())
  : TIPOS_POR_DEFECTO;

export const MAX_MB = Number(process.env.UPLOAD_MAX_MB) || MAX_MB_POR_DEFECTO;

export const MAX_BYTES = MAX_MB * 1024 * 1024;
