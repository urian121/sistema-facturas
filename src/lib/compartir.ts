/**
 * Condición SQL de "este usuario puede ver este documento": es el dueño, o
 * se lo han compartido y aceptó la invitación (ver `db/init/06-compartidos.sql`
 * y `07-notificaciones.sql`). Espera la tabla
 * `documents` sin alias y el email en el parámetro `$n` que se indique. Un
 * documento en la papelera deja de verse para los destinatarios, no para el
 * dueño (que lo sigue necesitando para restaurarlo o borrarlo).
 *
 * Sólo sirve para lecturas del archivo (abrir, descargar, vista previa):
 * cualquier escritura sigue filtrando por `usuario_email = $n` a secas.
 */
export function puedeVer(parametro: number): string {
  return `(documents.usuario_email = $${parametro}
       OR (documents.eliminado_at IS NULL
           AND EXISTS (SELECT 1 FROM documento_compartidos c
                        WHERE c.document_id = documents.id
                          AND c.usuario_email = $${parametro}
                          AND c.estado = 'aceptado')))`;
}

/** Emails de Google se comparan sin mayúsculas ni espacios alrededor. */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Validación de forma, no de existencia: eso lo decide `auditoria_login`. */
export function esEmailValido(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
