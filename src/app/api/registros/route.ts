import { NextResponse } from "next/server";
import { listarRegistros } from "@/lib/registros";
import { emailUsuarioActual } from "@/lib/usuario-actual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  return NextResponse.json(await listarRegistros(usuarioEmail));
}
