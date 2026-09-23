import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_PRUEBA } from "./factories";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query } }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { email: EMAIL_PRUEBA } })) }));

const { GET, DELETE } = await import("@/app/api/documents/papelera/route");

const FILA = {
  id: "11111111-1111-1111-1111-111111111111",
  filename: "factura-vieja.pdf",
  mime_type: "application/pdf",
  size_bytes: "1024",
  eliminado_at: "2026-03-04T10:00:00.000Z",
};

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rows: [FILA] });
});

describe("GET /api/documents/papelera", () => {
  it("devuelve los documentos del usuario que están en la papelera", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([FILA]);

    const [sql, valores] = query.mock.calls[0];
    expect(sql).toContain("eliminado_at IS NOT NULL");
    expect(valores).toEqual([EMAIL_PRUEBA]);
  });

  it("devuelve una lista vacía si no hay nada en la papelera", async () => {
    query.mockResolvedValue({ rows: [] });

    expect(await (await GET()).json()).toEqual([]);
  });
});

describe("DELETE /api/documents/papelera", () => {
  it("borra para siempre sólo los documentos del usuario que están en la papelera", async () => {
    query.mockResolvedValue({ rowCount: 3, rows: [] });

    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ eliminados: 3 });
    const [sql, valores] = query.mock.calls[0];
    expect(sql).toContain("DELETE FROM documents");
    expect(sql).toContain("usuario_email = $1");
    expect(sql).toContain("eliminado_at IS NOT NULL");
    expect(valores).toEqual([EMAIL_PRUEBA]);
  });

  it("con la papelera ya vacía responde 0 eliminados", async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });

    expect(await (await DELETE()).json()).toEqual({ eliminados: 0 });
  });
});
