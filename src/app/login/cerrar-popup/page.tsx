"use client";

import { useEffect } from "react";

/**
 * Auth.js manda aquí a la ventana emergente cuando el login termina (con o
 * sin éxito — la cookie de sesión ya quedó puesta si funcionó). Su único
 * trabajo es cerrarse sola; `BotonGoogle`, en la ventana principal, detecta
 * el cierre y recarga para reflejar la sesión nueva.
 */
export default function CerrarPopup() {
  useEffect(() => {
    window.close();
  }, []);

  return (
    <div className="flex h-dvh items-center justify-center bg-app px-4 text-center">
      <p className="text-[13px] text-label">Ya puedes cerrar esta ventana.</p>
    </div>
  );
}
