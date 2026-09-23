import { z } from "zod";
import {
  datoClave,
  detalleContrato,
  emitir,
  fecha,
  fechaOpcional,
  importe,
  linea,
  moneda,
  parte,
  problemaCuadre,
  problemaOrden,
  problemaSumaLineas,
  textoRequerido,
} from "./base";

/** Campos que comparten todos los tipos, en su forma más laxa. */
const comunes = {
  confianza: z.number().min(0).max(1),
  idioma: z.string().nullable(),
  resumen: textoRequerido("El resumen"),
  // `.default()`: un análisis guardado antes de estos campos se valida igual.
  categoria: z.string().nullable().default(null),
  datos_clave: z.array(datoClave).default([]),
  numero_documento: z.string().nullable(),
  fecha_vencimiento: fechaOpcional,
  metodo_pago: z.string().nullable(),
  notas: z.array(z.string()),
  texto: z.string().nullable(),
};

/** Factura: identifica al emisor, lleva número y líneas, y debe cuadrar. */
export const FacturaSchema = z
  .object({
    ...comunes,
    tipo_documento: z.literal("factura"),
    emisor: parte(true, "del emisor"),
    // Opcional: las facturas simplificadas y las de "consumidor final" no
    // identifican al cliente, y exigirlo obligaba a inventarse un nombre.
    receptor: parte(false, "del receptor"),
    numero_documento: textoRequerido("El número de factura"),
    fecha_emision: fecha,
    moneda,
    subtotal: importe("La base imponible"),
    impuestos: importe("El importe de impuestos"),
    total: importe("El total"),
    lineas: z.array(linea).min(1, { message: "Una factura necesita al menos una línea" }),
    contrato: detalleContrato.nullable(),
  })
  .superRefine((datos, ctx) => {
    emitir(problemaCuadre(datos), ctx);
    emitir(problemaSumaLineas(datos), ctx);
    emitir(
      problemaOrden(
        datos.fecha_emision,
        datos.fecha_vencimiento,
        "fecha_vencimiento",
        "El vencimiento no puede ser anterior a la emisión",
      ),
      ctx,
    );
  });

/** Recibo: comprobante de un pago ya hecho; el receptor suele no constar. */
export const ReciboSchema = z
  .object({
    ...comunes,
    tipo_documento: z.literal("recibo"),
    emisor: parte(true, "del emisor"),
    receptor: parte(false, "del receptor"),
    fecha_emision: fecha,
    moneda,
    subtotal: z.number().finite().nullable(),
    impuestos: z.number().finite().nullable(),
    total: importe("El total"),
    lineas: z.array(linea),
    contrato: detalleContrato.nullable(),
  })
  .superRefine((datos, ctx) => {
    emitir(problemaCuadre(datos), ctx);
    emitir(problemaSumaLineas(datos), ctx);
  });

/** Contrato: dos partes, objeto y vigencia; sin aritmética de importes. */
export const ContratoSchema = z
  .object({
    ...comunes,
    tipo_documento: z.literal("contrato"),
    emisor: parte(true, "de la primera parte"),
    receptor: parte(true, "de la segunda parte"),
    fecha_emision: fechaOpcional,
    moneda: moneda.nullable(),
    subtotal: z.number().finite().nullable(),
    impuestos: z.number().finite().nullable(),
    total: z.number().finite().nullable(),
    lineas: z.array(linea),
    contrato: z.object({
      ...detalleContrato.shape,
      objeto: textoRequerido("El objeto del contrato"),
      fecha_inicio: fecha,
    }),
  })
  .superRefine((datos, ctx) => {
    emitir(
      problemaOrden(
        datos.contrato.fecha_inicio,
        datos.contrato.fecha_fin,
        "contrato.fecha_fin",
        "El fin de vigencia no puede ser anterior al inicio",
      ),
      ctx,
    );
  });

/**
 * Otro: cualquier cosa que no sea factura, recibo ni contrato (un CV, un
 * ensayo, una foto…). Sólo se exige el resumen; lo que tenga de interés va
 * en `categoria` y `datos_clave`, no en los campos de factura.
 */
export const OtroSchema = z.object({
  ...comunes,
  tipo_documento: z.literal("otro"),
  emisor: parte(false, "del emisor"),
  receptor: parte(false, "del receptor"),
  fecha_emision: fechaOpcional,
  moneda: moneda.nullable(),
  subtotal: z.number().finite().nullable(),
  impuestos: z.number().finite().nullable(),
  total: z.number().finite().nullable(),
  lineas: z.array(linea),
  contrato: detalleContrato.nullable(),
});

export const SCHEMAS = {
  factura: FacturaSchema,
  recibo: ReciboSchema,
  contrato: ContratoSchema,
  otro: OtroSchema,
} as const;

export type TipoDocumento = keyof typeof SCHEMAS;

export const TIPOS = Object.keys(SCHEMAS) as TipoDocumento[];

export const ETIQUETA_TIPO: Record<TipoDocumento, string> = {
  factura: "Factura",
  recibo: "Recibo",
  contrato: "Contrato",
  otro: "Otro",
};

/** Igual que `ETIQUETA_TIPO` pero acepta el tipo tal cual llega de la base o de la API. */
export function etiquetaTipo(tipo: string): string {
  return ETIQUETA_TIPO[tipo as TipoDocumento] ?? tipo;
}
