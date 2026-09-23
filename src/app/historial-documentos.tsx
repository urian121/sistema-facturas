"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { TIPO_ARRASTRE_DOCUMENTO } from "./arrastrar-documento";
import {
  IconoBuscar,
  IconoColumnas,
  IconoConforme,
  IconoCuadricula,
  IconoLista,
} from "./iconos";
import MenuDocumento from "./menu-documento";
import OficinaMiniatura from "./oficina-miniatura";
import PdfMiniatura from "./pdf-miniatura";
import Tooltip from "./tooltip";
import { esOffice } from "@/lib/mime-oficina";
import { etiquetaTipo } from "@/lib/schemas";
import type { Doc } from "./uploader";

/**
 * Miniatura real para imágenes y PDF (página 1 renderizada); vista de datos
 * reales (tabla o fragmento de texto) para Office. Nada de eso existe para
 * cualquier otro tipo, así que no hay rama de "ícono genérico" aquí — cada
 * subcomponente ya trae el suyo si falla la carga.
 */
function Miniatura({
  doc,
  className,
  iconoClassName,
}: {
  doc: Doc;
  className: string;
  iconoClassName: string;
}) {
  if (doc.mime_type === "application/pdf") {
    return <PdfMiniatura docId={doc.id} className={className} iconoClassName={iconoClassName} />;
  }

  if (esOffice(doc.mime_type)) {
    return <OficinaMiniatura doc={doc} className={className} iconoClassName={iconoClassName} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/files/${doc.id}`} alt="" className={`bg-sunken object-cover ${className}`} />
  );
}

const formatoFecha = new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short" });

/** Deja soltar la tarjeta sobre el panel de documento para abrirla ahí. */
function alArrastrar(e: DragEvent, docId: string) {
  e.dataTransfer.setData(TIPO_ARRASTRE_DOCUMENTO, docId);
  e.dataTransfer.effectAllowed = "copy";
}

/**
 * Equivalente a `onClick` por teclado: la tarjeta/fila es un `div` con
 * `role="button"` (no un `<button>`, porque adentro va el menú de opciones y
 * un botón no puede anidar otro), así que el Enter/Espacio no llegan solos.
 */
function alTeclear(e: KeyboardEvent, onElegir: () => void) {
  if (e.key !== "Enter" && e.key !== " ") return;
  e.preventDefault();
  onElegir();
}

function estado(doc: Doc): string {
  return `${doc.doc_type ? etiquetaTipo(doc.doc_type) : "Sin analizar"} · ${formatoFecha.format(new Date(doc.created_at))}`;
}

/**
 * Nombre de archivo editable in situ (estilo Drive/Explorer): en vez del
 * `window.prompt` de antes, "Renombrar" convierte este mismo texto en un
 * input. `resuelto` evita que Enter y el blur que sigue guarden el cambio
 * dos veces (Enter dispara el commit y a la vez deja de enfocar el input).
 */
function NombreEditable({
  doc,
  className,
  onConfirmar,
  onCancelar,
}: {
  doc: Doc;
  className: string;
  onConfirmar: (filename: string) => void;
  onCancelar: () => void;
}) {
  const resuelto = useRef(false);

  const confirmar = (valor: string) => {
    if (resuelto.current) return;
    resuelto.current = true;
    const nombre = valor.trim();
    if (nombre && nombre !== doc.filename) onConfirmar(nombre);
    else onCancelar();
  };

  return (
    <input
      defaultValue={doc.filename}
      autoFocus
      onFocus={(e) => e.target.select()}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          confirmar(e.currentTarget.value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          resuelto.current = true;
          onCancelar();
        }
      }}
      onBlur={(e) => confirmar(e.target.value)}
      className={`${className} rounded border border-accent-strong bg-surface px-1 outline-none`}
    />
  );
}

type Vista = "cuadricula" | "cuadricula4" | "lista";

/** Cuadrícula de tarjetas (estilo Google Drive); mismo diseño para 3 y para 4 columnas. */
function Cuadricula({
  docs,
  columnasClase,
  selectedId,
  archivados,
  renombrandoId,
  onElegir,
  onIniciarRenombrar,
  onConfirmarRenombrar,
  onCancelarRenombrar,
  onEliminar,
}: {
  docs: Doc[];
  columnasClase: string;
  selectedId: string | null;
  archivados: Set<string>;
  renombrandoId: string | null;
  onElegir: (id: string) => void;
  onIniciarRenombrar: (id: string) => void;
  onConfirmarRenombrar: (id: string, filename: string) => void;
  onCancelarRenombrar: () => void;
  onEliminar: (id: string) => void;
}) {
  return (
    <div className={`grid gap-3 ${columnasClase}`}>
      {docs.map((doc) => {
        const activo = doc.id === selectedId;
        const renombrando = doc.id === renombrandoId;
        return (
          <div
            key={doc.id}
            role="button"
            tabIndex={0}
            draggable={!renombrando}
            onDragStart={(e) => alArrastrar(e, doc.id)}
            onClick={() => onElegir(doc.id)}
            onKeyDown={(e) => alTeclear(e, () => onElegir(doc.id))}
            aria-current={activo}
            className={`flex cursor-pointer flex-col rounded-lg border text-left transition ${
              activo
                ? "border-accent-strong ring-1 ring-accent-strong"
                : "border-line hover:border-line-strong hover:bg-sunken"
            }`}
          >
            <div className="relative overflow-hidden rounded-t-lg">
              <Miniatura
                doc={doc}
                className="h-24 w-full border-b border-line"
                iconoClassName="h-7 w-7"
              />
              {archivados.has(doc.id) && (
                <IconoConforme className="absolute right-1.5 top-1.5 h-4 w-4 rounded-full bg-surface text-ok" />
              )}
            </div>
            <div className="flex items-center gap-1 px-2 py-2">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                {renombrando ? (
                  <NombreEditable
                    doc={doc}
                    className="truncate text-[12px] font-medium text-ink"
                    onConfirmar={(filename) => onConfirmarRenombrar(doc.id, filename)}
                    onCancelar={onCancelarRenombrar}
                  />
                ) : (
                  <span className="truncate text-[12px] font-medium text-ink" title={doc.filename}>
                    {doc.filename}
                  </span>
                )}
                <span className="cifra truncate text-[11px] text-label">{estado(doc)}</span>
              </div>
              <MenuDocumento
                doc={doc}
                onIniciarRenombrar={onIniciarRenombrar}
                onEliminar={onEliminar}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Historial de subidas, en cuadrícula (3 o 4 columnas, estilo Google Drive) o
 * en lista, a elección. Vive en el hueco que deja el panel de datos mientras
 * el documento seleccionado todavía no se ha analizado — ahí no hay
 * formulario que mostrar, así que en vez de dejarlo vacío se usa para elegir
 * otro documento.
 */
export default function HistorialDocumentos({
  docs,
  selectedId,
  archivados,
  onElegir,
  onRenombrar,
  onEliminar,
}: {
  docs: Doc[];
  selectedId: string | null;
  archivados: Set<string>;
  onElegir: (id: string) => void;
  onRenombrar: (id: string, filename: string) => void;
  onEliminar: (id: string) => void;
}) {
  const [vista, setVista] = useState<Vista>("cuadricula");
  const [busqueda, setBusqueda] = useState("");
  const [renombrando, setRenombrando] = useState<string | null>(null);

  if (docs.length === 0) return null;

  const confirmarRenombrar = (id: string, filename: string) => {
    onRenombrar(id, filename);
    setRenombrando(null);
  };

  const filtrados = docs.filter((doc) =>
    doc.filename.toLowerCase().includes(busqueda.trim().toLowerCase()),
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Fijo: no se desplaza con la lista de abajo. */}
      <div className="shrink-0 border-b border-line p-4 pb-3">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-label">Historial</p>

          <div className="flex items-center gap-0.5 rounded-full border border-line p-0.5">
            {(
              [
                ["lista", "Vista de lista", IconoLista, "left"],
                ["cuadricula", "Vista de cuadrícula", IconoCuadricula, "left"],
                ["cuadricula4", "Cuadrícula de 4 columnas", IconoColumnas, "left"],
              ] as const
            ).map(([clave, etiqueta, Icono, posicion]) => (
              <Tooltip key={clave} etiqueta={etiqueta} posicion={posicion}>
                <button
                  type="button"
                  onClick={() => setVista(clave)}
                  aria-label={etiqueta}
                  aria-pressed={vista === clave}
                  className={`flex h-6 w-7 cursor-pointer items-center justify-center rounded-full transition ${
                    vista === clave
                      ? "bg-accent-soft text-accent-strong"
                      : "text-label hover:bg-sunken hover:text-ink"
                  }`}
                >
                  <Icono className="h-3.5 w-3.5" />
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        <div className="relative">
          <IconoBuscar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-label" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre de archivo…"
            aria-label="Buscar en el historial"
            className="w-full rounded-md border border-line bg-surface py-1.5 pl-8 pr-2.5 text-[13px] outline-none transition placeholder:text-label hover:border-line-strong focus:border-line-strong focus-visible:outline-none"
          />
        </div>
      </div>

      {/* Desplazable: solo esta parte hace scroll. */}
      <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-4">
        {filtrados.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-label">
            Ningún archivo coincide con &quot;{busqueda}&quot;.
          </p>
        ) : vista === "lista" ? (
          <div className="flex flex-col gap-0.5">
            {filtrados.map((doc) => {
              const activo = doc.id === selectedId;
              const editando = doc.id === renombrando;
              return (
                <div
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  draggable={!editando}
                  onDragStart={(e) => alArrastrar(e, doc.id)}
                  onClick={() => onElegir(doc.id)}
                  onKeyDown={(e) => alTeclear(e, () => onElegir(doc.id))}
                  aria-current={activo}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 text-left transition ${
                    activo ? "bg-accent-soft" : "hover:bg-sunken"
                  }`}
                >
                  <div className="relative shrink-0">
                    <Miniatura
                      doc={doc}
                      className="h-9 w-9 rounded-md border border-line"
                      iconoClassName="h-4 w-4"
                    />
                    {archivados.has(doc.id) && (
                      <IconoConforme className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full bg-surface text-ok" />
                    )}
                  </div>
                  {editando ? (
                    <NombreEditable
                      doc={doc}
                      className="min-w-0 flex-1 truncate text-[13px] text-ink"
                      onConfirmar={(filename) => confirmarRenombrar(doc.id, filename)}
                      onCancelar={() => setRenombrando(null)}
                    />
                  ) : (
                    <span
                      className="min-w-0 flex-1 truncate text-[13px] text-ink"
                      title={doc.filename}
                    >
                      {doc.filename}
                    </span>
                  )}
                  <span className="cifra shrink-0 text-[12px] text-label">{estado(doc)}</span>
                  <MenuDocumento
                    doc={doc}
                    onIniciarRenombrar={setRenombrando}
                    onEliminar={onEliminar}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <Cuadricula
            docs={filtrados}
            columnasClase={
              vista === "cuadricula4" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"
            }
            selectedId={selectedId}
            archivados={archivados}
            renombrandoId={renombrando}
            onElegir={onElegir}
            onIniciarRenombrar={setRenombrando}
            onConfirmarRenombrar={confirmarRenombrar}
            onCancelarRenombrar={() => setRenombrando(null)}
            onEliminar={onEliminar}
          />
        )}
      </div>
    </div>
  );
}
