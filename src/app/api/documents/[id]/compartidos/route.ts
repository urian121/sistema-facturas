import { NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { esEmailValido, normalizarEmail } from "@/lib/compartir";
import { buscarUsuario } from "@/lib/usuarios";
import { emailUsuarioActual } from "@/lib/usuario-actual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ id: string }> };

/**
 * Sólo el dueño gestiona con quién se comparte: un destinatario recibe un
 * 404 igual que alguien sin acceso, para no confirmar que el documento existe.
 */
async function esDueno(id: string, usuarioEmail: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    `SELECT 1 FROM documents WHERE id = $1 AND usuario_email = $2`,
    [id, usuarioEmail],
  );
  return (rowCount ?? 0) > 0;
}

/** Con quién está compartido el documento, del más reciente al más antiguo. */
export async function GET(_request: Request, { params }: Contexto) {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await esDueno(id, usuarioEmail))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const { rows } = await pool.query(
    `SELECT usuario_email, estado, compartido_at
       FROM documento_compartidos
      WHERE document_id = $1
      ORDER BY compartido_at DESC`,
    [id],
  );
  return NextResponse.json(rows);
}

/**
 * Invita a otro usuario de la app a ver el documento (solo lectura). "Usuario
 * de la app" = ha iniciado sesión al menos una vez (`auditoria_login`); se
 * guarda el email tal como lo registró Google, no como lo tecleó el dueño.
 *
 * Una sola sentencia: crea la invitación en 'pendiente', registra la
 * notificación y hace `pg_notify` para que le llegue en vivo (ver
 * `src/lib/tiempo-real.ts`). Si ya había una invitación pendiente o aceptada
 * no se toca ni se vuelve a notificar; si estaba rechazada, vuelve a
 * 'pendiente' con una notificación nueva.
 */
export async function POST(request: Request, { params }: Contexto) {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const cuerpo = await request.json().catch(() => null);
  const email = typeof cuerpo?.email === "string" ? normalizarEmail(cuerpo.email) : "";

  if (!esEmailValido(email)) {
    return NextResponse.json({ error: "Escribe un email válido" }, { status: 400 });
  }
  if (email === normalizarEmail(usuarioEmail)) {
    return NextResponse.json({ error: "Ya eres el dueño de este documento" }, { status: 400 });
  }
  if (!(await esDueno(id, usuarioEmail))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const destinatario = await buscarUsuario(email);
  if (!destinatario) {
    return NextResponse.json(
      { error: "Ese email no corresponde a ningún usuario de la app" },
      { status: 404 },
    );
  }

  const { rows } = await pool.query(
    `WITH invitacion AS (
       INSERT INTO documento_compartidos (document_id, usuario_email, compartido_por)
       VALUES ($1, $2, $3)
       ON CONFLICT (document_id, usuario_email) DO UPDATE
          SET estado = 'pendiente', compartido_por = EXCLUDED.compartido_por,
              compartido_at = now(), respondido_at = NULL
        WHERE documento_compartidos.estado = 'rechazado'
       RETURNING document_id, usuario_email, estado, compartido_at
     ), notificacion AS (
       INSERT INTO notificaciones (usuario_email, remitente_email, document_id)
       SELECT usuario_email, $3, document_id FROM invitacion
       RETURNING usuario_email
     )
     SELECT i.usuario_email, i.estado, i.compartido_at,
            pg_notify('notificaciones', n.usuario_email) AS aviso
       FROM invitacion i
       JOIN notificacion n ON n.usuario_email = i.usuario_email`,
    [id, destinatario, usuarioEmail],
  );
  if (rows.length > 0) {
    const { usuario_email, estado, compartido_at } = rows[0];
    return NextResponse.json({ usuario_email, estado, compartido_at }, { status: 201 });
  }

  const existente = await pool.query(
    `SELECT usuario_email, estado, compartido_at
       FROM documento_compartidos
      WHERE document_id = $1 AND usuario_email = $2`,
    [id, destinatario],
  );
  return NextResponse.json(existente.rows[0]);
}

/**
 * Deja de compartir con un usuario (`?email=`), esté la invitación como esté.
 * Se llevan también sus notificaciones de este documento (ya no hay nada que
 * aceptar) y se le avisa para que desaparezcan de su campana sin recargar.
 */
export async function DELETE(request: Request, { params }: Contexto) {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const { id } = await params;
  const email = normalizarEmail(new URL(request.url).searchParams.get("email") ?? "");
  if (!email) {
    return NextResponse.json({ error: "Falta el email" }, { status: 400 });
  }
  if (!(await esDueno(id, usuarioEmail))) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const { rows } = await pool.query(
    `WITH quitado AS (
       DELETE FROM documento_compartidos
        WHERE document_id = $1 AND lower(usuario_email) = $2
       RETURNING usuario_email
     ), limpias AS (
       DELETE FROM notificaciones n
        USING quitado q
        WHERE n.document_id = $1 AND n.usuario_email = q.usuario_email
     )
     SELECT usuario_email, pg_notify('notificaciones', usuario_email) AS aviso FROM quitado`,
    [id, email],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "No estaba compartido con ese usuario" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
