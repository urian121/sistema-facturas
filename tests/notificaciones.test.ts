import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_PRUEBA } from "./factories";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query } }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { email: EMAIL_PRUEBA } })) }));

const { GET } = await import("@/app/api/notificaciones/route");
const { PATCH } = await import("@/app/api/notificaciones/[id]/route");
const { GET: GET_DOCUMENTOS } = await import("@/app/api/documents/route");

const ID = "22222222-2222-2222-2222-222222222222";
const DOC = "11111111-1111-1111-1111-111111111111";
const params = { params: Promise.resolve({ id: ID }) };

function responder(respuesta: unknown) {
  return new Request(`http://localhost/api/notificaciones/${ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ respuesta }),
  });
}

beforeEach(() => {
  query.mockReset();
});

describe("GET /api/notificaciones", () => {
  it("lista las del usuario con archivo, estado y remitente, sin las de documentos en la papelera", async () => {
    const fila = {
      id: ID,
      document_id: DOC,
      remitente_email: "ana@example.com",
      remitente_nombre: "Ana",
      creada_at: "2026-09-23T10:00:00.000Z",
      filename: "contrato.pdf",
      mime_type: "application/pdf",
      estado: "pendiente",
    };
    query.mockResolvedValueOnce({ rows: [fila] });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([fila]);
    const [sql, valores] = query.mock.calls[0];
    expect(sql).toContain("n.usuario_email = $1");
    expect(sql).toContain("d.eliminado_at IS NULL");
    expect(valores).toEqual([EMAIL_PRUEBA]);
  });
});

describe("PATCH /api/notificaciones/[id]", () => {
  it("acepta una invitación pendiente propia y avisa a sus demás pestañas", async () => {
    query.mockResolvedValueOnce({ rows: [{ document_id: DOC, estado: "aceptado", aviso: "" }] });

    const res = await PATCH(responder("aceptar"), params);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ document_id: DOC, estado: "aceptado" });
    const [sql, valores] = query.mock.calls[0];
    expect(sql).toContain("n.usuario_email = $2");
    expect(sql).toContain("c.estado = 'pendiente'");
    expect(sql).toContain("pg_notify('notificaciones', $2)");
    expect(valores).toEqual([ID, EMAIL_PRUEBA, "aceptado"]);
  });

  it("rechaza", async () => {
    query.mockResolvedValueOnce({ rows: [{ document_id: DOC, estado: "rechazado" }] });

    const res = await PATCH(responder("rechazar"), params);

    expect(res.status).toBe(200);
    expect(query.mock.calls[0][1][2]).toBe("rechazado");
  });

  it("responde 404 si no es suya o ya se respondió", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    expect((await PATCH(responder("aceptar"), params)).status).toBe(404);
  });

  it("rechaza respuestas desconocidas sin tocar la base", async () => {
    expect((await PATCH(responder("borrar"), params)).status).toBe(400);
    expect((await PATCH(responder(undefined), params)).status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
});

describe("GET /api/documents", () => {
  it("incluye los compartidos aceptados, marcados con su dueño y sin el borrador", async () => {
    query.mockResolvedValueOnce({ rows: [] });

    await GET_DOCUMENTOS();

    const [sql, valores] = query.mock.calls[0];
    expect(sql).toContain("UNION ALL");
    expect(sql).toContain("c.estado = 'aceptado'");
    expect(sql).toContain("NULL::jsonb");
    expect(valores).toEqual([EMAIL_PRUEBA]);
  });
});
