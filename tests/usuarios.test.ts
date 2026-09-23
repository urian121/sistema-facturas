import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_PRUEBA } from "./factories";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query } }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { email: EMAIL_PRUEBA } })) }));

const { GET } = await import("@/app/api/usuarios/route");

const buscar = (email: string) =>
  GET(new Request(`http://localhost/api/usuarios?email=${encodeURIComponent(email)}`));

beforeEach(() => {
  query.mockReset();
});

describe("GET /api/usuarios", () => {
  it("dice que existe si ese email ya inició sesión alguna vez (sin distinguir mayúsculas)", async () => {
    query.mockResolvedValueOnce({ rows: [{ usuario_email: "ana@example.com" }] });

    const res = await buscar(" Ana@Example.com ");

    expect(await res.json()).toEqual({ existe: true, propio: false });
    const [sql, valores] = query.mock.calls[0];
    expect(sql).toContain("auditoria_login");
    expect(valores).toEqual(["ana@example.com"]);
  });

  it("dice que no existe si nadie con ese email usa la app", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    expect(await (await buscar("nadie@example.com")).json()).toEqual({
      existe: false,
      propio: false,
    });
  });

  it("reconoce el propio email sin consultar la base", async () => {
    expect(await (await buscar(EMAIL_PRUEBA.toUpperCase())).json()).toEqual({
      existe: true,
      propio: true,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it("rechaza emails mal formados", async () => {
    expect((await buscar("no-es-email")).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});
