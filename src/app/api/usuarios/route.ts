import { NextResponse } from "next/server";
import { esEmailValido, normalizarEmail } from "@/lib/compartir";
import { buscarUsuario } from "@/lib/usuarios";
import { emailUsuarioActual } from "@/lib/usuario-actual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * `?email=` → ¿es de un usuario de la app? Lo usa el modal de compartir
 * mientras se escribe, para no dejar enviar una invitación que nunca le
 * llegaría a nadie. Sólo responde sí/no: no lista usuarios ni da sus nombres.
 * (La misma comprobación se repite en el POST de compartir: esta es sólo
 * para la interfaz.)
 */
export async function GET(request: Request) {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const email = normalizarEmail(new URL(request.url).searchParams.get("email") ?? "");
  if (!esEmailValido(email)) {
    return NextResponse.json({ error: "Escribe un email válido" }, { status: 400 });
  }
  if (email === normalizarEmail(usuarioEmail)) {
    return NextResponse.json({ existe: true, propio: true });
  }

  return NextResponse.json({ existe: (await buscarUsuario(email)) !== null, propio: false });
}
