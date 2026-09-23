import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { pool } from "@/lib/db";

/**
 * Solo login con Google — nada de usuario y contraseña propios. Sesión con
 * JWT, sin adaptador de base de datos: no hace falta una tabla `users` para
 * esto, así que no se toca el esquema.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/login" },
  callbacks: {
    // Solo se inserta la fila de auditoría en el login real (trigger
    // "signIn"), no en cada request que decodifica el JWT ya existente.
    async jwt({ token, user, trigger }) {
      if (trigger === "signIn" && user?.email) {
        const { rows } = await pool.query(
          `INSERT INTO auditoria_login (usuario_email, usuario_nombre)
           VALUES ($1, $2)
           RETURNING id`,
          [user.email, user.name ?? null],
        );
        token.auditoriaId = rows[0].id;
      }
      return token;
    },
  },
  events: {
    async signOut(message) {
      const auditoriaId = "token" in message ? message.token?.auditoriaId : undefined;
      if (typeof auditoriaId === "string") {
        await pool.query(`UPDATE auditoria_login SET finalizado_at = now() WHERE id = $1`, [
          auditoriaId,
        ]);
      }
    },
  },
});
