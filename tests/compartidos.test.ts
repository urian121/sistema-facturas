import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_PRUEBA } from "./factories";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query } }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { email: EMAIL_PRUEBA } })) }));

const { GET, POST, DELETE } = await import("@/app/api/documents/[id]/compartidos/route");
const { GET: GET_ARCHIVO } = await import("@/app/api/files/[id]/route");

const ID = "11111111-1111-1111-1111-111111111111";
const DESTINO = "ana@example.com";
const params = { params: Promise.resolve({ id: ID }) };

function peticion(metodo: string, cuerpo?: unknown, busqueda = "") {
  return new Request(`http://localhost/api/documents/${ID}/compartidos${busqueda}`, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
}

const DUENO = { rowCount: 1, rows: [{}] };
const NO_DUENO = { rowCount: 0, rows: [] };

beforeEach(() => {
  query.mockReset();
});

describe("GET /api/documents/[id]/compartidos", () => {
  it("lista con quién está compartido si eres el dueño", async () => {
    const fila = {
      usuario_email: DESTINO,
      estado: "pendiente",
      compartido_at: "2026-09-23T10:00:00.000Z",
    };
    query.mockResolvedValueOnce(DUENO).mockResolvedValueOnce({ rows: [fila] });

    const res = await GET(peticion("GET"), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([fila]);
    expect(query.mock.calls[0][1]).toEqual([ID, EMAIL_PRUEBA]);
  });

  it("responde 404 a quien no es el dueño, aunque se lo hayan compartido", async () => {
    query.mockResolvedValueOnce(NO_DUENO);

    const res = await GET(peticion("GET"), params);

    expect(res.status).toBe(404);
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/documents/[id]/compartidos", () => {
  it("invita a un usuario de la app: invitación, notificación y aviso en vivo en una sentencia", async () => {
    query
      .mockResolvedValueOnce(DUENO)
      .mockResolvedValueOnce({ rows: [{ usuario_email: DESTINO }] })
      .mockResolvedValueOnce({
        rows: [{ usuario_email: DESTINO, estado: "pendiente", compartido_at: "x", aviso: "" }],
      });

    const res = await POST(peticion("POST", { email: "  Ana@Example.com " }), params);

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      usuario_email: DESTINO,
      estado: "pendiente",
      compartido_at: "x",
    });
    expect(query.mock.calls[1][1]).toEqual([DESTINO]);
    const [sql, valores] = query.mock.calls[2];
    expect(sql).toContain("INSERT INTO documento_compartidos");
    expect(sql).toContain("INSERT INTO notificaciones");
    expect(sql).toContain("pg_notify('notificaciones'");
    // Sólo se reabre (y se vuelve a notificar) una invitación rechazada.
    expect(sql).toContain("WHERE documento_compartidos.estado = 'rechazado'");
    expect(valores).toEqual([ID, DESTINO, EMAIL_PRUEBA]);
  });

  it("no vuelve a notificar si ya estaba pendiente o aceptado", async () => {
    query
      .mockResolvedValueOnce(DUENO)
      .mockResolvedValueOnce({ rows: [{ usuario_email: DESTINO }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [{ usuario_email: DESTINO, estado: "aceptado", compartido_at: "x" }],
      });

    const res = await POST(peticion("POST", { email: DESTINO }), params);

    expect(res.status).toBe(200);
    expect((await res.json()).estado).toBe("aceptado");
    expect(query).toHaveBeenCalledTimes(4);
  });

  it("rechaza un email que no es de ningún usuario de la app", async () => {
    query.mockResolvedValueOnce(DUENO).mockResolvedValueOnce({ rows: [] });

    const res = await POST(peticion("POST", { email: "nadie@example.com" }), params);

    expect(res.status).toBe(404);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("no deja compartir un documento ajeno", async () => {
    query.mockResolvedValueOnce(NO_DUENO);

    const res = await POST(peticion("POST", { email: DESTINO }), params);

    expect(res.status).toBe(404);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("rechaza emails mal formados y compartir contigo mismo sin tocar la base", async () => {
    expect((await POST(peticion("POST", { email: "no-es-email" }), params)).status).toBe(400);
    expect((await POST(peticion("POST", {}), params)).status).toBe(400);
    expect(
      (await POST(peticion("POST", { email: EMAIL_PRUEBA.toUpperCase() }), params)).status,
    ).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/documents/[id]/compartidos", () => {
  it("deja de compartir, borra sus notificaciones de ese documento y le avisa", async () => {
    query
      .mockResolvedValueOnce(DUENO)
      .mockResolvedValueOnce({ rows: [{ usuario_email: DESTINO }] });

    const res = await DELETE(
      peticion("DELETE", undefined, `?email=${encodeURIComponent(DESTINO)}`),
      params,
    );

    expect(res.status).toBe(200);
    const [sql, valores] = query.mock.calls[1];
    expect(sql).toContain("DELETE FROM notificaciones");
    expect(sql).toContain("pg_notify('notificaciones'");
    expect(valores).toEqual([ID, DESTINO]);
  });

  it("responde 404 si no estaba compartido con ese usuario", async () => {
    query.mockResolvedValueOnce(DUENO).mockResolvedValueOnce({ rows: [] });

    const res = await DELETE(peticion("DELETE", undefined, `?email=${DESTINO}`), params);

    expect(res.status).toBe(404);
  });

  it("no deja a un destinatario quitar accesos", async () => {
    query.mockResolvedValueOnce(NO_DUENO);

    const res = await DELETE(peticion("DELETE", undefined, `?email=${DESTINO}`), params);

    expect(res.status).toBe(404);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("pide el email", async () => {
    expect((await DELETE(peticion("DELETE"), params)).status).toBe(400);
  });
});

describe("GET /api/files/[id] con documentos compartidos", () => {
  it("deja leer el archivo al dueño o a quien aceptó la invitación (y no esté en la papelera)", async () => {
    query.mockResolvedValueOnce({
      rows: [{ filename: "a.pdf", mime_type: "application/pdf", data: Buffer.from("x") }],
    });

    const res = await GET_ARCHIVO(new Request(`http://localhost/api/files/${ID}`), params);

    expect(res.status).toBe(200);
    const [sql, valores] = query.mock.calls[0];
    expect(sql).toContain("documento_compartidos");
    expect(sql).toContain("eliminado_at IS NULL");
    expect(sql).toContain("c.estado = 'aceptado'");
    expect(valores).toEqual([ID, EMAIL_PRUEBA]);
  });
});
