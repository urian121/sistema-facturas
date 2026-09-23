/**
 * Tipo de dato propio para arrastrar una tarjeta del historial hasta el
 * panel de documento. Deliberadamente no es "Files" ni "text/plain": así no
 * se confunde con arrastrar un archivo real desde el sistema operativo (ese
 * caso ya lo maneja `uploader.tsx` mirando `dataTransfer.types` con "Files").
 */
export const TIPO_ARRASTRE_DOCUMENTO = "application/x-documento-id";
