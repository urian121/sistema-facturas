import { auth } from "@/lib/auth";

/**
 * Email de la sesión activa de esta petición. El proxy (`src/proxy.ts`) ya
 * exige sesión para llegar hasta aquí, así que un `null` sería un fallo
 * inesperado, no el camino normal — cada ruta debe tratarlo como un 401.
 */
export async function emailUsuarioActual(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}
