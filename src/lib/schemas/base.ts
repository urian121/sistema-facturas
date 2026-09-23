import { z } from "zod";

/** AAAA-MM-DD y además una fecha que exista (rechaza 2026-02-31). */
export function esFechaISO(valor: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return false;
  const [, y, mes, d] = m;
  const fecha = new Date(`${y}-${mes}-${d}T00:00:00Z`);
  return (
    fecha.getUTCFullYear() === Number(y) &&
    fecha.getUTCMonth() + 1 === Number(mes) &&
    fecha.getUTCDate() === Number(d)
  );
}

const MESES: Record<string, number> = {
  ene: 1, jan: 1, feb: 2, mar: 3, abr: 4, apr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, aug: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12, dec: 12,
};

/**
 * Si `valor` es una fecha escrita de otra forma ("20-04-1992", "20/4/1992",
 * "25 JUN 1986", "25 / Jun / Jun / 1986"), la devuelve en AAAA-MM-DD; si no
 * parece una fecha (o no existe en el calendario), la devuelve tal cual. El
 * día va primero, como en los documentos en español. Red de seguridad para
 * los datos encontrados: el prompt pide AAAA-MM-DD, pero no siempre lo cumple.
 */
export function normalizarFecha(valor: string): string {
  const texto = valor.trim();
  if (esFechaISO(texto)) return texto;

  const dos = (n: number) => String(n).padStart(2, "0");
  const armar = (d: number, m: number, y: number) => {
    const iso = `${y}-${dos(m)}-${dos(d)}`;
    return esFechaISO(iso) ? iso : null;
  };

  const numerica = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(texto);
  if (numerica) return armar(+numerica[1], +numerica[2], +numerica[3]) ?? texto;

  // Día, mes con letras (quizá repetido en dos idiomas, como en pasaportes) y año.
  const conLetras = /^(\d{1,2})[\s/.-]+([a-záéíóú]{3,})(?:[\s/.-]+[a-záéíóú]{3,})*[\s/.-]+(\d{4})$/i.exec(
    texto,
  );
  if (conLetras) {
    const mes = MESES[conLetras[2].slice(0, 3).toLowerCase()];
    if (mes) return armar(+conLetras[1], mes, +conLetras[3]) ?? texto;
  }

  return texto;
}

export const fecha = z
  .string({ error: "La fecha es obligatoria" })
  .refine(esFechaISO, { message: "Fecha inválida: usa el formato AAAA-MM-DD" });

export const fechaOpcional = fecha.nullable();

export const textoRequerido = (campo: string) =>
  z
    // El mismo mensaje tanto si viene null como si viene vacío.
    .string({ error: `${campo} es obligatorio` })
    .trim()
    .min(1, { message: `${campo} es obligatorio` });

export const moneda = z
  .string({ error: "La moneda es obligatoria" })
  .trim()
  .regex(/^[A-Z]{3}$/, { message: "Usa el código ISO de 3 letras (EUR, USD, CLP…)" });

export const importe = (campo: string) =>
  z
    .number({ message: `${campo} es obligatorio` })
    .finite({ message: `${campo} debe ser un número` });

/** Emisor / receptor. `nombreRequerido` lo endurece según el tipo de documento. */
export const parte = (nombreRequerido: boolean, etiqueta: string) =>
  z.object({
    nombre: nombreRequerido
      ? textoRequerido(`El nombre ${etiqueta}`)
      : z.string().nullable(),
    identificacion_fiscal: z.string().nullable(),
    direccion: z.string().nullable(),
  });

export const linea = z.object({
  descripcion: textoRequerido("La descripción de la línea"),
  cantidad: z.number().finite().nullable(),
  precio_unitario: z.number().finite().nullable(),
  importe: z.number().finite().nullable(),
});

/** Un dato suelto encontrado por el modelo (o añadido a mano): "Profesión" → "Ingeniero". */
export const datoClave = z.object({
  etiqueta: textoRequerido("El nombre del dato"),
  valor: textoRequerido("El valor"),
});

export const detalleContrato = z.object({
  objeto: z.string().nullable(),
  fecha_inicio: fechaOpcional,
  fecha_fin: fechaOpcional,
  duracion: z.string().nullable(),
  importe: z.string().nullable(),
  ley_aplicable: z.string().nullable(),
  clausulas_destacadas: z.array(z.string()),
});

/** Tolerancia al comparar importes: dos céntimos absorben el redondeo del IVA. */
export const TOLERANCIA = 0.02;

export type Problema = { campo: string; mensaje: string };

/**
 * subtotal + impuestos = total. Sólo se comprueba si los tres son números.
 * Devuelve el problema en vez de emitirlo para poder aplicarlo también cuando
 * el resto del schema ya ha fallado (Zod no ejecuta los refinements entonces).
 */
export function problemaCuadre(datos: {
  subtotal: number | null;
  impuestos: number | null;
  total: number | null;
}): Problema | null {
  const { subtotal, impuestos, total } = datos;
  if (
    typeof subtotal !== "number" ||
    typeof impuestos !== "number" ||
    typeof total !== "number"
  ) {
    return null;
  }

  const esperado = subtotal + impuestos;
  if (Math.abs(esperado - total) <= TOLERANCIA) return null;

  return {
    campo: "total",
    mensaje: `No cuadra: ${subtotal} + ${impuestos} = ${Number(esperado.toFixed(2))}, no ${total}`,
  };
}

/** Lo que dicen las líneas: cuántos artículos son y cuánto suman. */
export function resumenLineas(lineas: { cantidad: number | null; importe: number | null }[]) {
  const conImporte = lineas.filter((l) => typeof l.importe === "number");
  return {
    // Una línea sin cantidad cuenta como un artículo.
    articulos: lineas.reduce((n, l) => n + (typeof l.cantidad === "number" ? l.cantidad : 1), 0),
    // `null` si alguna línea no tiene importe: entonces no hay suma que comparar.
    suma:
      lineas.length > 0 && conImporte.length === lineas.length
        ? Number(conImporte.reduce((s, l) => s + (l.importe as number), 0).toFixed(2))
        : null,
  };
}

/**
 * La suma de las líneas tiene que coincidir con algún importe del documento:
 * el total (tickets, que ya llevan el impuesto en cada línea), la base
 * imponible (facturas con líneas sin impuesto) o, si no hay base, el total
 * menos impuestos. Sólo se comprueba si todas las líneas tienen importe y hay
 * un total; el margen crece un céntimo por línea por el redondeo de cada una.
 * Pilla la línea que el análisis se saltó o leyó mal.
 */
export function problemaSumaLineas(datos: {
  lineas: { cantidad: number | null; importe: number | null }[];
  subtotal: number | null;
  impuestos: number | null;
  total: number | null;
}): Problema | null {
  const { suma } = resumenLineas(datos.lineas);
  const { subtotal, impuestos, total } = datos;
  if (suma === null || typeof total !== "number") return null;

  const margen = Math.max(TOLERANCIA, 0.01 * datos.lineas.length);
  const candidatos = [
    total,
    typeof subtotal === "number" ? subtotal : null,
    typeof subtotal !== "number" && typeof impuestos === "number" ? total - impuestos : null,
  ].filter((c): c is number => c !== null);
  if (candidatos.some((c) => Math.abs(c - suma) <= margen)) return null;

  const contra =
    typeof subtotal === "number"
      ? `ni con la base imponible (${subtotal}) ni con el total (${total})`
      : `con el total (${total})`;
  return {
    campo: "lineas",
    mensaje: `Las líneas suman ${suma}, que no cuadra ${contra}: revisa si falta o sobra alguna`,
  };
}

/** La fecha `hasta` no puede ser anterior a `desde`. */
export function problemaOrden(
  desde: string | null | undefined,
  hasta: string | null | undefined,
  campo: string,
  mensaje: string,
): Problema | null {
  if (!desde || !hasta || !esFechaISO(desde) || !esFechaISO(hasta)) return null;
  return hasta < desde ? { campo, mensaje } : null;
}

/** Traslada un problema al canal de issues de Zod. */
export function emitir(problema: Problema | null, ctx: z.RefinementCtx) {
  if (!problema) return;
  ctx.addIssue({
    code: "custom",
    path: problema.campo.split("."),
    message: problema.mensaje,
  });
}
