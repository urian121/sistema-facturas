"use client";

import type { ComponentType } from "react";
import { notificar } from "./notificar";
import ConmutadorTema from "./tema";
import Tooltip from "./tooltip";
import {
  IconoAjustes,
  IconoArchivo,
  IconoInicio,
  IconoPapelera,
  IconoPregunta,
  IconoSubir,
} from "./iconos";

type Item = {
  clave: string;
  etiqueta: string;
  icono: ComponentType<{ className?: string }>;
  activo?: boolean;
  contador?: number;
  onClick: () => void;
};

/**
 * Navegación principal como riel de iconos, al estilo Teams: columna fija a
 * la izquierda en escritorio, barra fija abajo en móvil (un riel vertical no
 * cabe junto al contenido en pantallas angostas).
 */
export default function Riel({
  vista,
  onIrAlInicio,
  onCambiarVista,
  onAbrirChat,
  onAbrirSubir,
  contadorArchivo,
}: {
  vista: "revisar" | "archivo";
  onIrAlInicio: () => void;
  onCambiarVista: () => void;
  onAbrirChat: () => void;
  onAbrirSubir: () => void;
  contadorArchivo: number;
}) {
  const items: Item[] = [
    {
      clave: "inicio",
      etiqueta: "Inicio",
      icono: IconoInicio,
      activo: vista === "revisar",
      onClick: onIrAlInicio,
    },
    { clave: "subir", etiqueta: "Subir documento", icono: IconoSubir, onClick: onAbrirSubir },
    {
      clave: "archivo",
      etiqueta: "Archivo",
      icono: IconoArchivo,
      activo: vista === "archivo",
      contador: contadorArchivo,
      onClick: onCambiarVista,
    },
    { clave: "preguntar", etiqueta: "Preguntar", icono: IconoPregunta, onClick: onAbrirChat },
  ];

  // Sin pantalla de ajustes ni papelera todavía: avisan en vez de quedar mudos al pulsarlos.
  const abrirAjustes = () => notificar.ok("Los ajustes llegan pronto");
  const abrirPapelera = () => notificar.ok("La papelera llega pronto");

  const boton = (item: Item, posicion: "top" | "right") => {
    const Icono = item.icono;
    return (
      <Tooltip key={item.clave} etiqueta={item.etiqueta} posicion={posicion}>
        <button
          type="button"
          onClick={item.onClick}
          aria-label={item.etiqueta}
          aria-pressed={item.activo}
          className={`relative flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg transition ${
            item.activo
              ? "bg-accent-soft text-accent"
              : "text-ink-soft hover:bg-surface hover:text-ink"
          }`}
        >
          <Icono className="h-5 w-5" />
          {!!item.contador && (
            <span className="cifra absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium leading-none text-white">
              {item.contador}
            </span>
          )}
        </button>
      </Tooltip>
    );
  };

  return (
    <>
      {/* Escritorio: riel vertical fijo a la izquierda. */}
      <nav
        aria-label="Navegación principal"
        className="hidden shrink-0 flex-col items-center gap-1.5 border-r border-line bg-sunken px-2 py-3 lg:flex lg:w-16"
      >
        {items.map((item) => boton(item, "right"))}
        <div className="flex-1" />
        <ConmutadorTema posicion="right" />
        {boton(
          { clave: "papelera", etiqueta: "Papelera", icono: IconoPapelera, onClick: abrirPapelera },
          "right",
        )}
        {boton(
          { clave: "ajustes", etiqueta: "Ajustes", icono: IconoAjustes, onClick: abrirAjustes },
          "right",
        )}
      </nav>

      {/* Móvil: barra fija abajo. */}
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 flex h-14 shrink-0 items-center justify-around border-t border-line bg-sunken px-2 lg:hidden"
      >
        {items.map((item) => boton(item, "top"))}
        <ConmutadorTema posicion="top" />
        {boton(
          { clave: "papelera", etiqueta: "Papelera", icono: IconoPapelera, onClick: abrirPapelera },
          "top",
        )}
        {boton(
          { clave: "ajustes", etiqueta: "Ajustes", icono: IconoAjustes, onClick: abrirAjustes },
          "top",
        )}
      </nav>
    </>
  );
}
