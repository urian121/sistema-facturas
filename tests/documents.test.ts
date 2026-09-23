import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMAIL_PRUEBA, facturaValida } from "./factories";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query } }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { email: EMAIL_PRUEBA } })) }));

const { PATCH, DELETE } = await import("@/app/api/documents/[id]/route");

const ID = "11111111-1111-1111-1111-111111111111";
const params = Promise.resolve({ id: ID });

function peticion(cuerpo: unknown) {
  return new Request(`http://localhost:3000/api/documents/${ID}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue({ rowCount: 1, rows: [] });
});

describe("PATCH /api/documents/[id]", () => {
  it("guarda las correcciones del formulario", async () => {
    const corregida = { ...facturaValida(), numero_documento: "F-2026/0999" };

    const res = await PATCH(peticion({ extraction: corregida }), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.validacion.valido).toBe(true);
    expect(JSON.parse(query.mock.calls[0][1][2]).numero_documento).toBe("F-2026/0999");
  });

  it("guarda también una corrección a medias y devuelve lo que falta", async () => {
    const aMedias = { ...facturaValida(), total: 999, emisor: { nombre: "", identificacion_fiscal: null, direccion: null } };

    const res = await PATCH(peticion({ extraction: aMedias }), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.validacion.valido).toBe(false);
    expect(body.validacion.problemas.map((p: { campo: string }) => p.campo).sort()).toEqual([
      "emisor.nombre",
      "total",
    ]);
    expect(query).toHaveBeenCalled();
  });

  it("cambia el tipo de documento si el usuario lo corrige", async () => {
    const comoRecibo = { ...facturaValida(), tipo_documento: "recibo" as const };

    const res = await PATCH(peticion({ extraction: comoRecibo }), { params });

    expect((await res.json()).extraction.tipo_documento).toBe("recibo");
    expect(query.mock.calls[0][1][1]).toBe("recibo");
  });

  it("rechaza un cuerpo que no tiene la forma de una extracción", async () => {
    const res = await PATCH(peticion({ extraction: { tipo_documento: "factura" } }), { params });

    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/forma esperada/);
    expect(query).not.toHaveBeenCalled();
  });

  it("rechaza un tipo de documento desconocido", async () => {
    const raro = { ...facturaValida(), tipo_documento: "albaran" };

    expect((await PATCH(peticion({ extraction: raro }), { params })).status).toBe(400);
  });

  it("devuelve 404 si el documento ya no existe", async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });

    const res = await PATCH(peticion({ extraction: facturaValida() }), { params });

    expect(res.status).toBe(404);
  });

  it("renombra el documento cuando el cuerpo trae filename", async () => {
    const res = await PATCH(peticion({ filename: "  factura-nueva.pdf  " }), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.filename).toBe("factura-nueva.pdf");
    expect(query.mock.calls[0][1]).toEqual([ID, "factura-nueva.pdf", EMAIL_PRUEBA]);
  });

  it("rechaza renombrar a un nombre vacío", async () => {
    const res = await PATCH(peticion({ filename: "   " }), { params });

    expect(res.status).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });

  it("devuelve 404 al renombrar un documento que ya no existe", async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });

    const res = await PATCH(peticion({ filename: "nuevo.pdf" }), { params });

    expect(res.status).toBe(404);
  });

  it("manda a la papelera cuando el cuerpo trae papelera: true", async () => {
    const res = await PATCH(peticion({ papelera: true }), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.eliminado_at).toBe("string");
    const [sql, valores] = query.mock.calls[0];
    expect(sql).toContain("SET eliminado_at = $2");
    expect(valores[0]).toBe(ID);
    expect(valores[1]).toBeInstanceOf(Date);
    expect(valores[2]).toBe(EMAIL_PRUEBA);
  });

  it("restaura cuando el cuerpo trae papelera: false", async () => {
    const res = await PATCH(peticion({ papelera: false }), { params });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.eliminado_at).toBeNull();
    expect(query.mock.calls[0][1]).toEqual([ID, null, EMAIL_PRUEBA]);
  });

  it("devuelve 404 al mover a la papelera un documento que no es del usuario", async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });

    const res = await PATCH(peticion({ papelera: true }), { params });

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/documents/[id]", () => {
  function peticionDelete() {
    return new Request(`http://localhost:3000/api/documents/${ID}`, { method: "DELETE" });
  }

  it("borra el documento", async () => {
    const res = await DELETE(peticionDelete(), { params });

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM documents"),
      [ID, EMAIL_PRUEBA],
    );
  });

  it("devuelve 404 si el documento ya no existe", async () => {
    query.mockResolvedValue({ rowCount: 0, rows: [] });

    const res = await DELETE(peticionDelete(), { params });

    expect(res.status).toBe(404);
  });
});
