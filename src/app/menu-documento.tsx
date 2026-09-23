"use client";

import { useEffect, useRef, useState } from "react";
import CompartirModal from "./compartir-modal";
import ConfirmarModal from "./confirmar-modal";
import {
  IconoAbrirExterno,
  IconoCompartir,
  IconoDescargar,
  IconoLapiz,
  IconoPapelera,
  IconoPuntos,
} from "./iconos";
import { useEscapeKey } from "./use-escape-key";
import type { Doc } from "./uploader";

/**
 * Menú de opciones de una tarjeta del historial, estilo "⋮" de Google Drive.
 * Vive dentro de una tarjeta arrastrable y seleccionable: cada acción para la
 * propagación del click para no disparar el `onClick`/`onDragStart` del
 * contenedor, y `draggable={false}` evita que arrastrar desde el botón mueva
 * la tarjeta entera.
 */
export default function MenuDocumento({
  doc,
  onIniciarRenombrar,
  onEliminar,
}: {
  doc: Doc;
  onIniciarRenombrar: (id: string) => void;
  onEliminar: (id: string) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [compartiendo, setCompartiendo] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);

  useEscapeKey(abierto, () => setAbierto(false));

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  type Opcion = {
    etiqueta: string;
    icono: typeof IconoAbrirExterno;
    peligro?: boolean;
    /** Sólo para el dueño: en un documento compartido (solo lectura) no se muestra. */
    soloDueno?: boolean;
    onClick: () => void;
  };

  const todas: Opcion[] = [
    {
      etiqueta: "Abrir en otra pestaña",
      icono: IconoAbrirExterno,
      onClick: () => window.open(`/api/files/${doc.id}`, "_blank", "noopener"),
    },
    {
      etiqueta: "Descargar",
      icono: IconoDescargar,
      onClick: () => {
        const enlace = document.createElement("a");
        enlace.href = `/api/files/${doc.id}`;
        enlace.download = doc.filename;
        enlace.click();
      },
    },
    {
      etiqueta: "Compartir",
      icono: IconoCompartir,
      soloDueno: true,
      onClick: () => setCompartiendo(true),
    },
    {
      etiqueta: "Renombrar",
      icono: IconoLapiz,
      soloDueno: true,
      onClick: () => onIniciarRenombrar(doc.id),
    },
    {
      etiqueta: "Eliminar",
      icono: IconoPapelera,
      soloDueno: true,
      onClick: () => setConfirmandoEliminar(true),
    },
  ];
  const opciones = doc.compartido_por ? todas.filter((o) => !o.soloDueno) : todas;

  return (
    <div ref={raiz} draggable={false} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-label="Más opciones"
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={`flex h-6 w-6 cursor-pointer items-center justify-center rounded-full transition ${
          abierto ? "bg-sunken text-ink" : "text-label hover:bg-sunken hover:text-ink"
        }`}
      >
        <IconoPuntos className="h-3.5 w-3.5" />
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-[0_8px_24px_-8px_rgba(36,36,36,0.35)]"
        >
          {opciones.map(({ etiqueta, icono: Icono, peligro, onClick }) => (
            <button
              key={etiqueta}
              type="button"
              role="menuitem"
              onClick={() => {
                setAbierto(false);
                onClick();
              }}
              className={`flex w-full cursor-pointer items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-left text-[12px] font-normal leading-none transition ${
                peligro ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-sunken"
              }`}
            >
              <Icono className="h-3 w-3" />
              {etiqueta}
            </button>
          ))}
        </div>
      )}

      {compartiendo && <CompartirModal doc={doc} onCerrar={() => setCompartiendo(false)} />}

      {confirmandoEliminar && (
        <ConfirmarModal
          titulo="Mover a la papelera"
          descripcion={`"${doc.filename}" se moverá a la papelera. Podrás restaurarlo desde ahí cuando quieras.`}
          etiquetaConfirmar="Mover a la papelera"
          onConfirmar={() => {
            setConfirmandoEliminar(false);
            onEliminar(doc.id);
          }}
          onCancelar={() => setConfirmandoEliminar(false)}
        />
      )}
    </div>
  );
}
