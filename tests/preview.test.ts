import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";
import { EMAIL_PRUEBA } from "./factories";
import { MIME_OFICINA } from "@/lib/mime-oficina";

const query = vi.fn();
vi.mock("@/lib/db", () => ({ pool: { query } }));
vi.mock("@/lib/auth", () => ({ auth: vi.fn(async () => ({ user: { email: EMAIL_PRUEBA } })) }));

const { GET } = await import("@/app/api/preview/[id]/route");

const ID = "11111111-1111-1111-1111-111111111111";

function peticion() {
  return GET(new Request(`http://localhost:3000/api/preview/${ID}`), {
    params: Promise.resolve({ id: ID }),
  });
}

beforeEach(() => {
  query.mockReset();
});

describe("GET /api/preview/[id]", () => {
  it("devuelve una tabla de datos para un Excel", async () => {
    const libro = new ExcelJS.Workbook();
    libro.addWorksheet("Facturas").addRow(["Concepto", "Importe"]);
    const data = Buffer.from(await libro.xlsx.writeBuffer());

    query.mockResolvedValue({ rows: [{ mime_type: MIME_OFICINA.xlsx, data }] });

    const res = await peticion();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tipo).toBe("hoja");
    expect(body.filas[0]).toEqual(["Concepto", "Importe"]);
  });

  it("devuelve 404 si el documento no existe", async () => {
    query.mockResolvedValue({ rows: [] });

    const res = await peticion();

    expect(res.status).toBe(404);
  });

  it("devuelve 400 si el archivo no es de Office", async () => {
    query.mockResolvedValue({
      rows: [{ mime_type: "application/pdf", data: Buffer.from("%PDF-1.4") }],
    });

    const res = await peticion();

    expect(res.status).toBe(400);
  });

  it("devuelve 502 con un mensaje claro si el archivo está corrupto", async () => {
    query.mockResolvedValue({
      rows: [{ mime_type: MIME_OFICINA.docx, data: Buffer.from("no es un docx") }],
    });

    const res = await peticion();
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toMatch(/No se pudo/);
  });
});
