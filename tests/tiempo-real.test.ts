import { describe, expect, it, vi } from "vitest";

type Manejador = (msg: { channel: string; payload?: string }) => void;

const clientes: { query: ReturnType<typeof vi.fn>; emitir: Manejador }[] = [];

vi.mock("@/lib/db", () => ({ opcionesConexion: {} }));
vi.mock("pg", () => ({
  Client: class {
    manejadores: Record<string, Manejador> = {};
    query = vi.fn(async () => ({}));
    constructor() {
      clientes.push({
        query: this.query,
        emitir: (msg) => this.manejadores.notification?.(msg),
      });
    }
    on(evento: string, fn: Manejador) {
      this.manejadores[evento] = fn;
    }
    async connect() {}
    async end() {}
  },
}));

const { suscribir, CANAL } = await import("@/lib/tiempo-real");

describe("tiempo real (LISTEN/NOTIFY)", () => {
  it("abre una sola conexión en LISTEN y reparte cada aviso sólo al email destinatario", async () => {
    const ana = vi.fn();
    const beto = vi.fn();
    const bajaAna = await suscribir("ana@example.com", ana);
    await suscribir("beto@example.com", beto);

    expect(clientes).toHaveLength(1);
    expect(clientes[0].query).toHaveBeenCalledWith(`LISTEN ${CANAL}`);

    clientes[0].emitir({ channel: CANAL, payload: "ana@example.com" });
    expect(ana).toHaveBeenCalledTimes(1);
    expect(beto).not.toHaveBeenCalled();

    bajaAna();
    clientes[0].emitir({ channel: CANAL, payload: "ana@example.com" });
    expect(ana).toHaveBeenCalledTimes(1);
  });

  it("ignora otros canales", async () => {
    const oyente = vi.fn();
    await suscribir("carla@example.com", oyente);

    clientes[0].emitir({ channel: "otro", payload: "carla@example.com" });

    expect(oyente).not.toHaveBeenCalled();
  });
});
