import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Reemplaza al `middleware.ts` de versiones anteriores de Next.js (renombrado
 * a `proxy.ts` en la 16). Corre en cada ruta antes de renderizar: sin sesión,
 * redirige a `/login` (o responde 401 si es una llamada a `/api`), dejando
 * pasar únicamente el propio login y el callback de OAuth.
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!req.auth) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
