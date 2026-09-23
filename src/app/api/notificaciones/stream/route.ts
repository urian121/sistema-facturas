import { NextResponse } from "next/server";
import { suscribir } from "@/lib/tiempo-real";
import { emailUsuarioActual } from "@/lib/usuario-actual";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Por debajo de los ~60 s tras los que muchos proxies cortan una conexión callada. */
const LATIDO_MS = 25_000;

/**
 * Canal en vivo de notificaciones (Server-Sent Events): el navegador abre un
 * `EventSource` y aquí se queda la respuesta abierta. Cada aviso de
 * `src/lib/tiempo-real.ts` para este usuario manda un evento `notificacion`
 * sin datos; el cliente reacciona pidiendo `/api/notificaciones`. Si la
 * conexión se corta, `EventSource` reconecta solo.
 */
export async function GET(request: Request) {
  const usuarioEmail = await emailUsuarioActual();
  if (!usuarioEmail) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const codificador = new TextEncoder();
  let limpiar = () => {};

  const flujo = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enviar = (texto: string) => {
        try {
          controller.enqueue(codificador.encode(texto));
        } catch {
          // Ya cerrado: el `abort` de abajo termina de limpiar.
        }
      };

      let baja = () => {};
      try {
        baja = await suscribir(usuarioEmail, () => enviar("event: notificacion\ndata: {}\n\n"));
      } catch {
        // Sin conexión a Postgres: se cierra y el navegador reintentará.
        controller.close();
        return;
      }

      const latido = setInterval(() => enviar(": latido\n\n"), LATIDO_MS);
      limpiar = () => {
        clearInterval(latido);
        baja();
      };

      // `retry` le dice al EventSource cuánto esperar antes de reconectar.
      enviar("retry: 5000\n\n");

      request.signal.addEventListener("abort", () => {
        limpiar();
        try {
          controller.close();
        } catch {}
      });
    },
    cancel() {
      limpiar();
    },
  });

  return new Response(flujo, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Evita que nginx (y proxies parecidos) acumulen los eventos en búfer.
      "X-Accel-Buffering": "no",
    },
  });
}
