"use client";

import { useSyncExternalStore } from "react";
import { IconoLuna, IconoSol } from "./iconos";
import Tooltip from "./tooltip";

const EVENTO = "tema";

/** El tema vive en el documento, no en React: el script del layout lo fija antes del primer pintado. */
function suscribir(alCambiar: () => void) {
  window.addEventListener(EVENTO, alCambiar);
  return () => window.removeEventListener(EVENTO, alCambiar);
}

const leer = () => document.documentElement.dataset.theme ?? "light";
const leerEnServidor = () => "light";

export default function ConmutadorTema({
  posicion = "top",
}: {
  posicion?: "top" | "right";
}) {
  const tema = useSyncExternalStore(suscribir, leer, leerEnServidor);
  const oscuro = tema === "dark";

  const cambiar = () => {
    const siguiente = oscuro ? "light" : "dark";
    document.documentElement.dataset.theme = siguiente;
    try {
      localStorage.setItem("tema", siguiente);
    } catch {
      // Modo privado o almacenamiento bloqueado: el tema dura la sesión.
    }
    window.dispatchEvent(new Event(EVENTO));
  };

  return (
    <Tooltip etiqueta={oscuro ? "Tema claro" : "Tema oscuro"} posicion={posicion}>
      <button
        type="button"
        onClick={cambiar}
        aria-label={oscuro ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-ink-soft transition hover:bg-surface hover:text-ink"
      >
        {oscuro ? <IconoSol className="h-5 w-5" /> : <IconoLuna className="h-5 w-5" />}
      </button>
    </Tooltip>
  );
}
