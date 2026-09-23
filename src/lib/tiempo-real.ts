import { Client } from "pg";
import { opcionesConexion } from "@/lib/db";

/**
 * Avisos en vivo sin librería de sockets: quien comparte (o responde) hace
 * `pg_notify('notificaciones', <email del afectado>)` dentro de la misma
 * sentencia SQL, y cada proceso de Next mantiene UNA conexión aparte en
 * `LISTEN` que reparte el aviso a las pestañas abiertas de ese email (por
 * Server-Sent Events, ver `src/app/api/notificaciones/stream/route.ts`).
 * Postgres hace de bus: funciona igual con una instancia que con varias, y
 * el NOTIFY sale sólo si la transacción se confirma.
 *
 * El aviso no lleva datos, sólo "tienes algo nuevo": el cliente vuelve a pedir
 * `/api/notificaciones`, que es la que filtra por sesión.
 */
export const CANAL = "notificaciones";

type Oyente = () => void;

type Estado = {
  oyentes: Map<string, Set<Oyente>>;
  cliente: Client | null;
  conectando: Promise<void> | null;
};

// En `globalThis` para que el recargado en caliente de `next dev` no abra una
// conexión nueva en cada guardado.
const global = globalThis as unknown as { tiempoReal?: Estado };
const estado: Estado = (global.tiempoReal ??= {
  oyentes: new Map(),
  cliente: null,
  conectando: null,
});

function repartir(email: string) {
  for (const oyente of estado.oyentes.get(email) ?? []) oyente();
}

async function conectar(): Promise<void> {
  if (estado.cliente) return;
  if (estado.conectando) return estado.conectando;

  estado.conectando = (async () => {
    const cliente = new Client(opcionesConexion);
    cliente.on("notification", (msg) => {
      if (msg.channel === CANAL && msg.payload) repartir(msg.payload);
    });
    // Si se cae (reinicio de Postgres, red), se olvida y se reintenta; los
    // navegadores, mientras, reconectan su EventSource solos.
    cliente.on("error", () => {
      if (estado.cliente === cliente) estado.cliente = null;
      cliente.end().catch(() => {});
      setTimeout(() => {
        if (estado.oyentes.size > 0) conectar().catch(() => {});
      }, 3000);
    });
    await cliente.connect();
    await cliente.query(`LISTEN ${CANAL}`);
    estado.cliente = cliente;
  })().finally(() => {
    estado.conectando = null;
  });

  return estado.conectando;
}

/** Llama a `oyente` cada vez que llegue un aviso para `email`. Devuelve cómo darse de baja. */
export async function suscribir(email: string, oyente: Oyente): Promise<() => void> {
  let conjunto = estado.oyentes.get(email);
  if (!conjunto) estado.oyentes.set(email, (conjunto = new Set()));
  conjunto.add(oyente);

  const baja = () => {
    conjunto.delete(oyente);
    if (conjunto.size === 0) estado.oyentes.delete(email);
  };

  try {
    await conectar();
  } catch (err) {
    baja();
    throw err;
  }
  return baja;
}
