"use client";

import { useEffect, useRef, useState } from "react";
import { useEscapeKey } from "./use-escape-key";

/**
 * Confirmación propia en vez del `window.confirm()` nativo del navegador
 * (feo, no se puede estilar, corta el flujo de forma brusca): mismo look de
 * `SubirModal` — fondo difuminado, tarjeta redondeada — pero con entrada Y
 * salida animadas. `visible` arranca en `false` a propósito: el efecto lo
 * pone en `true` un instante después de montar, para que el navegador tenga
 * un primer frame en el estado "oculto" del que animar hacia "mostrado"; al
 * cerrar se hace lo mismo al revés y la acción real (`onCancelar`/
 * `onConfirmar`) se dispara recién cuando la transición CSS termina, no al
 * hacer click.
 */
export default function ConfirmarModal({
  titulo,
  descripcion,
  etiquetaConfirmar = "Aceptar",
  peligro = false,
  onConfirmar,
  onCancelar,
}: {
  titulo: string;
  descripcion: string;
  etiquetaConfirmar?: string;
  peligro?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const cerrando = useRef(false);
  const pendiente = useRef<(() => void) | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function cerrar(accion: () => void) {
    if (cerrando.current) return;
    cerrando.current = true;
    pendiente.current = accion;
    setVisible(false);
  }

  useEscapeKey(true, () => cerrar(onCancelar));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={() => cerrar(onCancelar)}
        className={`absolute inset-0 bg-ink/20 backdrop-blur-[2px] transition-opacity duration-150 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={titulo}
        onTransitionEnd={(e) => {
          if (e.target === e.currentTarget && !visible) pendiente.current?.();
        }}
        className={`relative w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-[0_16px_48px_-16px_rgba(36,36,36,0.35)] transition-all duration-150 ease-out ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <h2 className="text-[15px] font-medium text-ink">{titulo}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-label">{descripcion}</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => cerrar(onCancelar)}
            className="cursor-pointer rounded-full px-4 py-1.5 text-[13px] font-medium text-ink-soft transition hover:bg-sunken"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => cerrar(onConfirmar)}
            autoFocus
            className={`cursor-pointer rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
              peligro
                ? "bg-danger text-white hover:bg-danger/90"
                : "bg-accent text-on-accent hover:bg-accent-strong hover:text-white"
            }`}
          >
            {etiquetaConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
