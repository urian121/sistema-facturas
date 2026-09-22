"use client";

import { useEffect, useRef, useState } from "react";

/**
 * True en cuanto el elemento entra en pantalla, y se queda en true después
 * (no hace falta volver a cargar la miniatura si el usuario se aleja y
 * vuelve). Para no descargar el PDF/Office completo de cada tarjeta del
 * historial de una sola vez con 20+ documentos visibles a medias.
 */
export function useEnPantalla<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) setVisible(true);
      },
      { rootMargin: "200px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [visible]);

  return { ref, visible };
}
