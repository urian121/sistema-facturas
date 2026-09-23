import { pool } from "@/lib/db";
import { normalizarEmail } from "@/lib/compartir";

/**
 * Email de un usuario de la app tal como lo registró Google, o `null` si
 * nadie con ese email ha iniciado sesión nunca. No hay tabla `users`: "usuario
 * de la app" = al menos una fila en `auditoria_login`. Se compara sin
 * mayúsculas, pero se devuelve el original para guardar siempre el mismo.
 */
export async function buscarUsuario(email: string): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT usuario_email FROM auditoria_login WHERE lower(usuario_email) = $1 LIMIT 1`,
    [normalizarEmail(email)],
  );
  return rows[0]?.usuario_email ?? null;
}
