"use client";

import { useState, type ReactNode } from "react";

const POSICIONES = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
} as const;

/**
 * Tooltip propio en vez del `title` nativo del navegador: mismo look del
 * resto de la app (fondo `--ink`, texto `--surface`), transición suave.
 *
 * La visibilidad la controla React, no `:hover`/`:focus-within` de CSS: así
 * el click puede apagarla de forma explícita e inmediata (`onClick` pone
 * `visible` en `false`), sin depender de que el mouse se mueva o el foco
 * cambie para que la pseudo-clase deje de aplicar.
 */
export default function Tooltip({
  etiqueta,
  posicion = "bottom",
  className = "",
  children,
}: {
  etiqueta: string;
  posicion?: keyof typeof POSICIONES;
  className?: string;
  children: ReactNode;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <span
      className={`relative inline-flex ${className}`}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
      onClick={() => setVisible(false)}
    >
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] font-medium text-surface shadow-[0_4px_12px_-2px_rgba(36,36,36,0.35)] transition-opacity duration-150 ${
          visible ? "opacity-100" : "opacity-0"
        } ${POSICIONES[posicion]}`}
      >
        {etiqueta}
      </span>
    </span>
  );
}
