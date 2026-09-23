"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import BotonProveedor from "./boton-proveedor";
import { IconoGoogle } from "./iconos-proveedores";

const ANCHO = 480;
const ALTO = 640;

/**
 * Abre el selector de cuenta de Google en una ventana emergente en vez de
 * navegar la pestaña actual. La ventana se abre en blanco de entrada, de
 * forma síncrona dentro del propio click — si se abriera recién después del
 * `await signIn(...)`, la mayoría de navegadores la tratarían como un popup
 * no solicitado y la bloquearían. Una vez que `signIn(..., { redirect:
 * false })` devuelve la URL real de Google (no redirige solo), se la
 * asignamos a esa misma ventana. Al terminar, Google la manda a
 * `/login/cerrar-popup`, que se cierra sola; este componente solo espera a
 * que se cierre (la cookie de sesión ya quedó puesta, sea cual sea el
 * resultado) y recarga.
 */
export default function BotonGoogle() {
  const [cargando, setCargando] = useState(false);
  const router = useRouter();

  async function iniciarSesion() {
    setCargando(true);

    const left = window.screenX + (window.outerWidth - ANCHO) / 2;
    const top = window.screenY + (window.outerHeight - ALTO) / 2;
    const popup = window.open(
      "about:blank",
      "google-login",
      `width=${ANCHO},height=${ALTO},left=${left},top=${top}`,
    );

    const resultado = await signIn("google", {
      redirect: false,
      callbackUrl: "/login/cerrar-popup",
    });

    if (!resultado?.url) {
      popup?.close();
      setCargando(false);
      return;
    }

    if (!popup || popup.closed) {
      // El navegador bloqueó la ventana emergente: seguimos con la redirección normal.
      window.location.href = resultado.url;
      return;
    }

    popup.location.href = resultado.url;

    const intervalo = setInterval(() => {
      if (popup.closed) {
        clearInterval(intervalo);
        router.push("/");
      }
    }, 400);
  }

  return (
    <BotonProveedor
      type="button"
      icono={<IconoGoogle className="h-4 w-4" />}
      etiqueta={cargando ? "Abriendo…" : "Empezar con Google"}
      disabled={cargando}
      onClick={iniciarSesion}
    />
  );
}
