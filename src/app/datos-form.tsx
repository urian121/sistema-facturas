"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  IconoArchivo,
  IconoAviso,
  IconoConforme,
  IconoDestello,
  IconoDocumento,
  IconoGuardar,
  IconoLapiz,
  IconoLista,
  IconoMas,
  IconoMoneda,
  IconoPerfil,
  IconoQuitar,
  IconoRecargar,
} from "./iconos";
import Tooltip from "./tooltip";
import {
  ETIQUETA_TIPO,
  TIPOS,
  porCampo,
  resumenLineas,
  validarExtraccion,
  type Extraccion,
  type TipoDocumento,
} from "@/lib/schemas";
import {
  MUESTRA_LINEAS,
  SECCIONES,
  SIEMPRE_VISIBLES,
  escribir,
  leer,
  tieneValor,
  type Campo,
} from "@/lib/schemas/campos";
import { aNumero } from "@/lib/numero";

const CONTRATO_VACIO = {
  objeto: null,
  fecha_inicio: null,
  fecha_fin: null,
  duracion: null,
  importe: null,
  ley_aplicable: null,
  clausulas_destacadas: [] as string[],
};

const LINEA_VACIA = { descripcion: "", cantidad: null, precio_unitario: null, importe: null };
const DATO_VACIO = { etiqueta: "", valor: "" };

/** Clave de las líneas de detalle, para saber si se ven (no son un campo suelto). */
const BLOQUE_LINEAS = "lineas";


/** Por debajo de esto la clasificación se marca como dudosa en la cabecera. */
const UMBRAL_DUDA = 0.7;

type Icono = (p: { className?: string }) => ReactNode;

/** Icono de cada sección, por su título (los títulos vienen de `SECCIONES`). */
const ICONO_SECCION: Record<string, Icono> = {
  Resumen: IconoDocumento,
  Documento: IconoArchivo,
  Emisor: IconoPerfil,
  Receptor: IconoPerfil,
  "Receptor (opcional)": IconoPerfil,
  "Primera parte": IconoPerfil,
  "Segunda parte": IconoPerfil,
  Importes: IconoMoneda,
  Contrato: IconoLapiz,
};

/**
 * Cada sección del formulario es una tarjeta sobre el fondo gris del panel:
 * cabecera con icono y título, y el contenido debajo. `destacada` (el
 * resumen) lleva el tono de acento suave; `aviso` (las notas de la IA), el
 * ámbar — son los únicos fondos de color, para que signifiquen algo.
 */
function Tarjeta({
  titulo,
  icono: Icono,
  destacada = false,
  tono,
  extra,
  children,
}: {
  titulo: string;
  icono: Icono;
  destacada?: boolean;
  tono?: "aviso";
  extra?: ReactNode;
  children: ReactNode;
}) {
  const fondo =
    tono === "aviso"
      ? "bg-warn-soft/60"
      : destacada
        ? // Sobre el dorado, el relleno gris de los campos se vería sucio: van en blanco.
          "bg-accent-soft [&_:is(input,textarea)]:bg-surface"
        : "bg-surface";
  const insignia =
    tono === "aviso"
      ? "bg-warn/10 text-warn"
      : destacada
        ? "bg-accent text-on-accent"
        : "bg-sunken text-ink-soft";

  return (
    <section className={`rounded-xl ${fondo}`}>
      <h3 className="flex items-center gap-2 px-4 pb-2.5 pt-3.5 text-[13px] font-medium text-ink">
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${insignia}`}>
          <Icono className="h-3.5 w-3.5" />
        </span>
        {titulo}
        {extra && <span className="ml-auto">{extra}</span>}
      </h3>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

/**
 * Celda editable "en el sitio" de la ficha de datos encontrados: sin borde
 * hasta que se pasa por encima o se enfoca, para que se lea como texto.
 */
function entradaEnLinea(conError: boolean) {
  return [
    "w-full rounded-md border bg-transparent px-2 py-1.5 text-[13px] outline-none transition",
    "placeholder:text-label/60 hover:bg-sunken focus:border-accent-strong/35 focus:bg-surface",
    conError ? "border-warn/60 bg-warn-soft" : "border-transparent",
  ].join(" ");
}

/** Campo de entrada: plano hasta que lo tocas, con filete ámbar cuando reclama atención. */
function entrada(conError: boolean, cifra = false) {
  return [
    "w-full rounded-md border px-2.5 py-1.5 text-[13px] text-ink outline-none transition",
    "placeholder:text-label/70 focus:border-accent-strong/35 focus:bg-surface",
    cifra ? "cifra text-right" : "",
    conError ? "border-warn/60 bg-warn-soft" : "border-transparent bg-sunken hover:bg-line/60",
  ].join(" ");
}

export default function DatosForm({
  extraccion,
  confirmado,
  onChange,
  onGuardar,
  onConfirmar,
  guardando,
  confirmando,
}: {
  extraccion: Extraccion;
  confirmado: boolean;
  onChange: (siguiente: Extraccion) => void;
  onGuardar: () => void;
  onConfirmar: () => void;
  guardando: boolean;
  confirmando: boolean;
}) {
  // Texto tal cual lo escribe el usuario en los campos numéricos, para no perder
  // lo tecleado mientras el valor todavía no es un número válido.
  const [borradores, setBorradores] = useState<Record<string, string>>({});

  const tipo = extraccion.tipo_documento as TipoDocumento;
  // Un análisis guardado antes de que existieran estos campos no los trae.
  const datosClave = extraccion.datos_clave ?? [];

  // Campos que se quedan a la vista aunque se vacíen: los que traían valor al
  // abrir el documento. Sin esto, borrar el texto de un campo lo haría
  // desaparecer mientras se escribe. El componente se monta
  // con `key={documento}`, así que esto se recalcula para cada documento.
  const [fijados] = useState<Set<string>>(() => {
    const inicial = new Set<string>();
    for (const seccion of Object.values(SECCIONES)) {
      for (const campo of seccion.flatMap((s) => s.campos)) {
        if (tieneValor(leer(extraccion, campo.path))) inicial.add(campo.path);
      }
    }
    if (extraccion.lineas.length > 0) inicial.add(BLOQUE_LINEAS);
    return inicial;
  });

  // El tipo que eligió la IA, tal como llegó del análisis. El formulario se
  // vuelve a montar con cada análisis (ver `versionAnalisis` en uploader), así
  // que esto no se queda con el de un análisis anterior.
  const [tipoDetectado] = useState(tipo);
  const cambiadoAMano = tipo !== tipoDetectado;
  const dudosa = !cambiadoAMano && extraccion.confianza < UMBRAL_DUDA;

  const problemas = useMemo(() => {
    const delSchema = validarExtraccion(extraccion).problemas;
    const deFormato = Object.entries(borradores)
      .filter(([, texto]) => Number.isNaN(aNumero(texto)))
      .map(([campo]) => ({ campo, mensaje: "No es un número válido" }));
    return [...delSchema, ...deFormato];
  }, [extraccion, borradores]);

  const errores = useMemo(() => porCampo(problemas), [problemas]);

  const set = (path: string, valor: unknown) => onChange(escribir(extraccion, path, valor));

  const olvidarBorrador = (path: string) =>
    setBorradores((b) => {
      const resto = { ...b };
      delete resto[path];
      return resto;
    });

  const cambiarTipo = (nuevo: TipoDocumento) => {
    let siguiente = escribir(extraccion, "tipo_documento", nuevo);
    if (nuevo === "contrato" && !siguiente.contrato) {
      siguiente = escribir(siguiente, "contrato", { ...CONTRATO_VACIO });
    }
    onChange(siguiente);
  };

  const actualizarLinea = (indice: number, clave: string, valor: unknown) =>
    set(
      "lineas",
      extraccion.lineas.map((l, j) => (j === indice ? { ...l, [clave]: valor } : l)),
    );

  const campoEntrada = (campo: Campo) => {
    const valor = leer(extraccion, campo.path);
    const malos = errores[campo.path];

    if (campo.tipo === "parrafo") {
      return (
        <textarea
          rows={2}
          placeholder="—"
          aria-invalid={malos ? true : undefined}
          value={valor === null || valor === undefined ? "" : String(valor)}
          onChange={(e) => set(campo.path, e.target.value === "" ? null : e.target.value)}
          className={`${entrada(!!malos)} resize-y leading-relaxed`}
        />
      );
    }

    const esNumero = campo.tipo === "numero";
    const borrador = borradores[campo.path];
    const mostrado = esNumero
      ? (borrador ?? (valor === null || valor === undefined ? "" : String(valor)))
      : valor === null || valor === undefined
        ? ""
        : String(valor);

    return (
      <input
        inputMode={esNumero ? "decimal" : undefined}
        placeholder={campo.tipo === "fecha" ? "AAAA-MM-DD" : "—"}
        aria-invalid={malos ? true : undefined}
        value={mostrado}
        onChange={(e) => {
          const texto = e.target.value;
          if (esNumero) {
            setBorradores((b) => ({ ...b, [campo.path]: texto }));
            const n = aNumero(texto);
            set(campo.path, Number.isNaN(n) ? null : n);
          } else {
            set(campo.path, texto === "" ? null : texto);
          }
        }}
        onBlur={() => esNumero && olvidarBorrador(campo.path)}
        className={entrada(!!malos, esNumero)}
      />
    );
  };

  const secciones = SECCIONES[tipo] ?? SECCIONES.otro;
  const erroresDeLineas = errores["lineas"] ?? [];
  const valido = problemas.length === 0;

  /** Visible si trae valor, si es obligatorio y falta (tiene error) o si se fijó. */
  const visible = (path: string) =>
    SIEMPRE_VISIBLES.has(path) ||
    fijados.has(path) ||
    tieneValor(leer(extraccion, path)) ||
    Object.keys(errores).some((c) => c === path || c.startsWith(`${path}.`));

  const seccionesVisibles = secciones
    .map((s) => ({ ...s, campos: s.campos.filter((c) => visible(c.path)) }))
    .filter((s) => s.campos.length > 0);

  // Sin "Añadir campo", estos bloques se ven siempre donde tienen sentido,
  // para poder rellenarlos a mano: líneas en facturas y recibos (en "otro"
  // sólo si la IA encontró alguna), cláusulas en contratos, y los datos
  // encontrados en todos — es la única vía para añadir algo que no tiene campo.
  const verLineas = MUESTRA_LINEAS[tipo] && (tipo !== "otro" || visible(BLOQUE_LINEAS));
  const verClausulas = tipo === "contrato";

  const actualizarDato = (indice: number, clave: "etiqueta" | "valor", valor: string) =>
    set(
      "datos_clave",
      datosClave.map((d, j) => (j === indice ? { ...d, [clave]: valor } : d)),
    );

  /** Una sección de campos como tarjeta (se reusa para colocar "Importes" tras las líneas). */
  const pintarSeccion = (seccion: (typeof seccionesVisibles)[number]) => (
    <Tarjeta
      key={seccion.titulo}
      titulo={seccion.titulo}
      icono={ICONO_SECCION[seccion.titulo] ?? IconoArchivo}
      destacada={seccion.titulo === "Resumen"}
    >
      <div className="grid grid-cols-2 gap-x-3 gap-y-3">
        {seccion.campos.map((campo) => {
          const malos = errores[campo.path];
          return (
            <div
              key={campo.path}
              className={campo.ancho === "completo" ? "col-span-2" : "col-span-2 sm:col-span-1"}
            >
              <label className="mb-1 block text-[12px] text-label">{campo.label}</label>
              {campoEntrada(campo)}
              {malos?.map((m) => (
                <p key={m} className="mt-1 flex items-start gap-1 text-[12px] text-warn">
                  <IconoAviso className="mt-0.75 h-3 w-3" />
                  <span>{m}</span>
                </p>
              ))}
            </div>
          );
        })}
      </div>
    </Tarjeta>
  );

  // Los importes van después de las líneas, en el orden en que se lee un
  // ticket o una factura: primero los conceptos, luego los totales.
  const importes = seccionesVisibles.find((s) => s.titulo === "Importes");
  const { articulos, suma: sumaLineas } = resumenLineas(extraccion.lineas);

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <label htmlFor="tipo-doc" className="text-[12px] text-label">
          Tipo
        </label>
        <select
          id="tipo-doc"
          value={tipo}
          onChange={(e) => cambiarTipo(e.target.value as TipoDocumento)}
          className="cursor-pointer rounded-full border border-transparent bg-sunken py-1 pl-3 pr-2 text-[13px] font-medium outline-none transition hover:bg-line focus:border-accent-strong/35"
        >
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO[t]}
            </option>
          ))}
        </select>

        {/* La confianza es del tipo que eligió la IA: sólo se enseña cuando dice
            algo (no está segura) y se sustituye por "cambiado a mano" si el
            usuario elige otro, en vez de un porcentaje que no se mueve. */}
        {cambiadoAMano ? (
          <span className="rounded-full bg-sunken px-2.5 py-0.5 text-[12px] text-label">
            Cambiado a mano · la IA dijo {ETIQUETA_TIPO[tipoDetectado]}
          </span>
        ) : dudosa ? (
          <span className="flex items-center gap-1 rounded-full bg-warn-soft px-2.5 py-0.5 text-[12px] text-warn">
            <IconoAviso className="h-3 w-3" />
            La IA no está segura del tipo ({Math.round(extraccion.confianza * 100)} %)
          </span>
        ) : null}

        <span
          className={`ml-auto flex items-center gap-1.5 text-[13px] ${valido ? "text-ok" : "text-warn"}`}
        >
          {valido ? (
            <>
              <IconoConforme className="h-3.5 w-3.5" />
              Sin problemas
            </>
          ) : (
            <>
              <IconoAviso className="h-3.5 w-3.5" />
              {problemas.length} {problemas.length === 1 ? "campo por revisar" : "campos por revisar"}
            </>
          )}
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-app p-4">
        {seccionesVisibles.filter((s) => s.titulo !== "Importes").map(pintarSeccion)}

        {verLineas && (
          <Tarjeta titulo="Líneas" icono={IconoLista}>
            {erroresDeLineas.map((m) => (
              <p key={m} className="mb-2 flex items-center gap-1 text-[12px] text-warn">
                <IconoAviso className="h-3 w-3" />
                {m}
              </p>
            ))}

            {extraccion.lineas.length > 0 && (
              <div className="mb-1 grid grid-cols-[1fr_56px_72px_80px_24px] gap-2 px-0.5 text-[11px] uppercase tracking-[0.06em] text-label">
                <span>Descripción</span>
                <span className="text-right">Cant.</span>
                <span className="text-right">Precio</span>
                <span className="text-right">Importe</span>
                <span />
              </div>
            )}

            <div className="space-y-1.5">
              {extraccion.lineas.map((linea, i) => (
                <div key={i} className="grid grid-cols-[1fr_56px_72px_80px_24px] items-start gap-2">
                  {(
                    [
                      ["descripcion", "Descripción"],
                      ["cantidad", "Cantidad"],
                      ["precio_unitario", "Precio unitario"],
                      ["importe", "Importe"],
                    ] as const
                  ).map(([clave, etiqueta]) => {
                    const path = `lineas.${i}.${clave}`;
                    const malos = errores[path];
                    const esNumero = clave !== "descripcion";
                    const valor = linea[clave];
                    const mostrado =
                      borradores[path] ?? (valor === null || valor === undefined ? "" : String(valor));
                    return (
                      <div key={clave}>
                        <input
                          aria-label={`${etiqueta}, línea ${i + 1}`}
                          placeholder="—"
                          inputMode={esNumero ? "decimal" : undefined}
                          value={mostrado}
                          onChange={(e) => {
                            const texto = e.target.value;
                            if (esNumero) {
                              setBorradores((b) => ({ ...b, [path]: texto }));
                              const n = aNumero(texto);
                              actualizarLinea(i, clave, Number.isNaN(n) ? null : n);
                            } else {
                              actualizarLinea(i, clave, texto);
                            }
                          }}
                          onBlur={() => esNumero && olvidarBorrador(path)}
                          className={entrada(!!malos, esNumero)}
                        />
                        {malos?.map((m) => (
                          <p key={m} className="mt-1 text-[12px] text-warn">
                            {m}
                          </p>
                        ))}
                      </div>
                    );
                  })}
                  <Tooltip etiqueta={`Quitar línea ${i + 1}`} posicion="top" className="mt-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          "lineas",
                          extraccion.lineas.filter((_, j) => j !== i),
                        )
                      }
                      aria-label={`Quitar línea ${i + 1}`}
                      className="cursor-pointer text-label transition hover:text-danger"
                    >
                      <IconoQuitar className="h-3.5 w-3.5" />
                    </button>
                  </Tooltip>
                </div>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <button
                type="button"
                onClick={() => set("lineas", [...extraccion.lineas, { ...LINEA_VACIA }])}
                className="flex cursor-pointer items-center gap-1 text-[13px] text-accent-strong transition hover:underline"
              >
                <IconoMas className="h-3.5 w-3.5" />
                Añadir línea
              </button>

              {/* Lo que dicen las líneas, para compararlo de un vistazo con los importes
                  de abajo. Si no cuadra, el aviso de arriba de la tarjeta dice por qué. */}
              {extraccion.lineas.length > 0 && (
                <span
                  className={`cifra ml-auto flex items-center gap-1.5 text-[12px] ${
                    erroresDeLineas.length > 0 ? "text-warn" : "text-label"
                  }`}
                >
                  {articulos} {articulos === 1 ? "artículo" : "artículos"}
                  {sumaLineas !== null && (
                    <>
                      {" · suman "}
                      <span className="font-medium text-ink">
                        {sumaLineas.toLocaleString("es-ES", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                        {extraccion.moneda ? ` ${extraccion.moneda}` : ""}
                      </span>
                      {erroresDeLineas.length === 0 && typeof extraccion.total === "number" && (
                        <IconoConforme className="h-3.5 w-3.5 text-ok" />
                      )}
                    </>
                  )}
                </span>
              )}
            </div>
          </Tarjeta>
        )}

        {importes && pintarSeccion(importes)}

        {verClausulas && (
          <Tarjeta titulo="Cláusulas destacadas" icono={IconoLista}>
            <textarea
              rows={4}
              value={(extraccion.contrato?.clausulas_destacadas ?? []).join("\n")}
              onChange={(e) =>
                set(
                  "contrato.clausulas_destacadas",
                  e.target.value.split("\n").filter((l) => l.trim() !== ""),
                )
              }
              placeholder="Una cláusula por línea"
              className={entrada(false)}
            />
          </Tarjeta>
        )}

        {(
          <Tarjeta
            titulo={tipo === "otro" ? "Datos encontrados" : "Otros datos"}
            icono={IconoDestello}
            extra={
              datosClave.length > 0 && (
                <span className="cifra text-[12px] text-label">{datosClave.length}</span>
              )
            }
          >
            {datosClave.length === 0 ? (
              <p className="text-[13px] text-label">
                No se encontró ningún dato destacable. Puedes añadirlos a mano.
              </p>
            ) : (
              // Lista de definiciones "dato → valor": se lee como una ficha, y
              // cada celda se edita en el sitio (el borde aparece al pasar o enfocar).
              <div className="-mx-2 divide-y divide-line">
                {datosClave.map((dato, i) => (
                  <div
                    key={i}
                    className="group grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)_24px] items-start gap-2 px-2 py-1"
                  >
                    {(
                      [
                        ["etiqueta", "Dato"],
                        ["valor", "Valor"],
                      ] as const
                    ).map(([clave, etiqueta]) => {
                      const path = `datos_clave.${i}.${clave}`;
                      const malos = errores[path];
                      return (
                        <div key={clave}>
                          {/* textarea que crece con el contenido (`field-sizing-content`):
                              una lista larga de habilidades se lee entera, sin cortarse. */}
                          <textarea
                            rows={1}
                            aria-label={`${etiqueta} ${i + 1}`}
                            placeholder={etiqueta}
                            aria-invalid={malos ? true : undefined}
                            value={dato[clave]}
                            onChange={(e) => actualizarDato(i, clave, e.target.value)}
                            className={`${entradaEnLinea(!!malos)} field-sizing-content resize-none leading-relaxed ${
                              clave === "etiqueta" ? "text-[12px] text-label" : "font-medium text-ink"
                            }`}
                          />
                          {malos?.map((m) => (
                            <p key={m} className="px-2 text-[12px] text-warn">
                              {m}
                            </p>
                          ))}
                        </div>
                      );
                    })}
                    <Tooltip etiqueta={`Quitar dato ${i + 1}`} posicion="top" className="mt-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          set(
                            "datos_clave",
                            datosClave.filter((_, j) => j !== i),
                          )
                        }
                        aria-label={`Quitar dato ${i + 1}`}
                        className="cursor-pointer text-label opacity-0 transition group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
                      >
                        <IconoQuitar className="h-3.5 w-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={() => set("datos_clave", [...datosClave, { ...DATO_VACIO }])}
              className="mt-2 flex cursor-pointer items-center gap-1 text-[13px] text-accent-strong transition hover:underline"
            >
              <IconoMas className="h-3.5 w-3.5" />
              Añadir dato
            </button>
          </Tarjeta>
        )}

        {extraccion.notas.length > 0 && (
          <Tarjeta titulo="Notas de la IA" icono={IconoAviso} tono="aviso">
            <ul className="space-y-1.5 text-[13px] leading-relaxed text-ink-soft">
              {extraccion.notas.map((n, i) => (
                <li key={i} className="flex gap-2">
                  <span aria-hidden className="text-warn">
                    •
                  </span>
                  <span>{n}</span>
                </li>
              ))}
            </ul>
          </Tarjeta>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-surface px-4 py-3">
        {!valido && (
          <span className="text-[13px] text-label">
            Corrige los campos marcados para poder archivar.
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onGuardar}
            disabled={guardando || confirmando}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-sunken px-4 py-1.5 text-[13px] text-ink-soft transition hover:bg-line hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? (
              <IconoRecargar className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <IconoGuardar className="h-3.5 w-3.5" />
            )}
            {guardando ? "Guardando…" : "Guardar borrador"}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={confirmando || guardando || !valido}
            title={valido ? undefined : "Corrige los campos marcados"}
            className="flex cursor-pointer items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-on-accent transition hover:bg-accent-strong hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {confirmando ? (
              <IconoRecargar className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <IconoArchivo className="h-3.5 w-3.5" />
            )}
            {confirmando ? "Archivando…" : confirmado ? "Volver a archivar" : "Confirmar y archivar"}
          </button>
        </div>
      </div>
    </>
  );
}
