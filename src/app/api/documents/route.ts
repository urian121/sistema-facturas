import { NextResponse } from "next/server";
import { listarDocumentos } from "@/lib/documentos";
import { emailUsuarioActual } from "@/lib/usuario-actual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Historial activo del usuario (propios + compartidos aceptados); lo usa el
 * cliente para refrescarse tras restaurar de la papelera o aceptar una invitación.
 */
export async function GET() {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  return NextResponse.json(await listarDocumentos(usuarioEmail));
}
