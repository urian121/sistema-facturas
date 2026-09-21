"use client";

import { useEffect } from "react";

/** Llama a `onEscape` mientras `activo` sea true y se pulse Escape. */
export function useEscapeKey(activo: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!activo) return;
    const escuchar = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", escuchar);
    return () => document.removeEventListener("keydown", escuchar);
  }, [activo, onEscape]);
}
