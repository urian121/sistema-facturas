"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { IconoAviso, IconoConforme, IconoPerfil, IconoQuitar } from "./iconos";
import { notificar } from "./notificar";
import { useEscapeKey } from "./use-escape-key";
import type { Doc } from "./uploader";
import { esEmailValido, normalizarEmail } from "@/lib/compartir";

/** Pausa tras la última tecla antes de preguntar si el email existe. */
const ESPERA_VERIFICAR_MS = 400;

type Verificacion = "existe" | "no-existe" | "propio" | "error";

const MENSAJE_VERIFICACION: Record<Verificacion | "buscando", string> = {
  buscando: "Comprobando…",
  existe: "Usuario de la app",
  "no-existe": "Nadie con ese email usa la app: la invitación nunca le llegaría",
  propio: "Es tu propio email",
  error: "No se pudo comprobar el email",
};

type Compartido = {
  usuario_email: string;
  estado: "pendiente" | "aceptado" | "rechazado";
  compartido_at: string;
};

const ETIQUETA_ESTADO: Record<Compartido["estado"], string> = {
  pendiente: "Pendiente",
  aceptado: "Lector",
  rechazado: "Rechazó",
};

/**
 * "Compartir" del menú de una tarjeta: el dueño escribe el email de otro
 * usuario de la app y a este le llega una invitación en vivo (campana del
 * encabezado); si la acepta, puede abrir y descargar el documento (solo
 * lectura). Debajo, con quién está compartido ya y en qué estado, con opción
 * de quitar a cada uno. Mismo look y animación de entrada/salida que
 * `ConfirmarModal`.
 *
 * Vive dentro de la tarjeta del historial (a través de `MenuDocumento`), que
 * reacciona a Enter/Espacio: por eso el `onKeyDown` corta la propagación —
 * si no, escribir un espacio en el email abriría el documento.
 */
export default function CompartirModal({ doc, onCerrar }: { doc: Doc; onCerrar: () => void }) {
  const [visible, setVisible] = useState(false);
  const [compartidos, setCompartidos] = useState<Compartido[] | null>(null);
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guarda para qué email es el resultado: si el texto cambió desde entonces,
  // ese resultado ya no vale y se muestra "Comprobando…" (sin tener que
  // resetear estado a mano en cada tecla).
  const [verificado, setVerificado] = useState<{ email: string; resultado: Verificacion } | null>(
    null,
  );
  const cerrando = useRef(false);

  const normalizado = normalizarEmail(email);
  const formaValida = esEmailValido(normalizado);
  const estadoEmail = !formaValida
    ? null
    : verificado?.email === normalizado
      ? verificado.resultado
      : "buscando";
  const puedeCompartir = estadoEmail === "existe" && !enviando;
  const emailInvalido =
    error !== null ||
    estadoEmail === "no-existe" ||
    estadoEmail === "propio" ||
    estadoEmail === "error";

  useEffect(() => {
    if (!formaValida) return;
    let vigente = true;
    const temporizador = setTimeout(async () => {
      let resultado: Verificacion = "error";
      try {
        const res = await fetch(`/api/usuarios?email=${encodeURIComponent(normalizado)}`);
        if (res.ok) {
          const data: { existe: boolean; propio: boolean } = await res.json();
          resultado = data.propio ? "propio" : data.existe ? "existe" : "no-existe";
        }
      } catch {}
      if (vigente) setVerificado({ email: normalizado, resultado });
    }, ESPERA_VERIFICAR_MS);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [normalizado, formaValida]);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    let vigente = true;
    fetch(`/api/documents/${doc.id}/compartidos`)
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudo cargar con quién está compartido");
        const filas: Compartido[] = await res.json();
        if (vigente) setCompartidos(filas);
      })
      .catch((err) => {
        if (vigente) {
          setCompartidos([]);
          notificar.error(err);
        }
      });
    return () => {
      vigente = false;
    };
  }, [doc.id]);

  const cerrar = useCallback(() => {
    if (cerrando.current) return;
    cerrando.current = true;
    setVisible(false);
  }, []);

  useEscapeKey(true, cerrar);

  async function compartir(e: FormEvent) {
    e.preventDefault();
    if (!puedeCompartir) return;
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/documents/${doc.id}/compartidos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizado }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "Error inesperado");
      setCompartidos((prev) => [
        data as Compartido,
        ...(prev ?? []).filter((c) => c.usuario_email !== data.usuario_email),
      ]);
      setEmail("");
      // 201 = invitación nueva (y notificación enviada); 200 = ya tenía una
      // pendiente o aceptada, así que no se le volvió a notificar.
      notificar.ok(
        res.status === 201
          ? `"${doc.filename}" compartido con ${data.usuario_email}. Ya le llegó la invitación.`
          : `"${doc.filename}" ya estaba compartido con ${data.usuario_email} (${ETIQUETA_ESTADO[
              data.estado as Compartido["estado"]
            ].toLowerCase()})`,
      );
    } catch (err) {
      const motivo = err instanceof Error ? err.message : "Error inesperado";
      // Toast para enterarse aunque no se mire el campo, y en línea para
      // corregir el email ahí mismo.
      notificar.error(`No se pudo compartir "${doc.filename}": ${motivo}`, err);
      setError(motivo);
    } finally {
      setEnviando(false);
    }
  }

  async function quitar(usuarioEmail: string) {
    try {
      const res = await fetch(
        `/api/documents/${doc.id}/compartidos?email=${encodeURIComponent(usuarioEmail)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo dejar de compartir");
      }
      setCompartidos((prev) => (prev ?? []).filter((c) => c.usuario_email !== usuarioEmail));
      notificar.ok(`Ya no está compartido con ${usuarioEmail}`);
    } catch (err) {
      notificar.error(err);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={(e) => e.stopPropagation()}
    >
      <div
        onClick={cerrar}
        className={`absolute inset-0 bg-ink/20 backdrop-blur-[2px] transition-opacity duration-150 ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Compartir ${doc.filename}`}
        onTransitionEnd={(e) => {
          // Sólo el de la opacidad: `transition-all` dispara uno por propiedad (ver ConfirmarModal).
          if (e.target === e.currentTarget && !visible && e.propertyName === "opacity") onCerrar();
        }}
        className={`relative w-full max-w-md rounded-xl bg-surface p-5 shadow-[0_16px_48px_-16px_rgba(36,36,36,0.35)] transition-all duration-150 ease-out ${
          visible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
      >
        <h2 className="truncate text-[15px] font-medium text-ink" title={doc.filename}>
          Compartir &quot;{doc.filename}&quot;
        </h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-label">
          Le llegará una invitación. Si la acepta, podrá abrirlo y descargarlo, pero no
          renombrarlo, editarlo ni eliminarlo.
        </p>

        <form onSubmit={compartir} className="mt-4 flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            autoFocus
            placeholder="Email de un usuario de la app"
            aria-label="Email del usuario"
            aria-invalid={emailInvalido}
            aria-describedby="compartir-estado-email"
            className={`min-w-0 flex-1 rounded-md border px-2.5 py-1.5 text-[13px] outline-none transition placeholder:text-label focus-visible:outline-none ${
              emailInvalido
                ? "border-danger bg-surface"
                : estadoEmail === "existe"
                  ? "border-ok bg-surface"
                  : "border-transparent bg-sunken focus:border-accent-strong/35 focus:bg-surface"
            }`}
          />
          <button
            type="submit"
            disabled={!puedeCompartir}
            className="cursor-pointer rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-on-accent transition hover:bg-accent-strong hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-accent disabled:hover:text-on-accent"
          >
            {enviando ? "Compartiendo…" : "Compartir"}
          </button>
        </form>
        <p
          id="compartir-estado-email"
          aria-live="polite"
          className={`mt-1.5 flex min-h-4 items-center gap-1 text-[12px] ${
            emailInvalido ? "text-danger" : estadoEmail === "existe" ? "text-ok" : "text-label"
          }`}
        >
          {error ? (
            <>
              <IconoAviso className="h-3 w-3" />
              {error}
            </>
          ) : estadoEmail ? (
            <>
              {estadoEmail === "existe" ? (
                <IconoConforme className="h-3 w-3" />
              ) : estadoEmail !== "buscando" ? (
                <IconoAviso className="h-3 w-3" />
              ) : null}
              {MENSAJE_VERIFICACION[estadoEmail]}
            </>
          ) : null}
        </p>

        <p className="mt-5 text-[11px] font-medium uppercase tracking-[0.06em] text-label">
          Personas con acceso
        </p>
        <ul className="mt-2 flex max-h-48 flex-col gap-0.5 overflow-y-auto">
          {compartidos === null ? (
            <li className="py-2 text-[13px] text-label">Cargando…</li>
          ) : compartidos.length === 0 ? (
            <li className="py-2 text-[13px] text-label">Todavía no lo has compartido con nadie.</li>
          ) : (
            compartidos.map((c) => (
              <li
                key={c.usuario_email}
                className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-sunken"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                  <IconoPerfil className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink" title={c.usuario_email}>
                  {c.usuario_email}
                </span>
                <span
                  className={`shrink-0 text-[12px] ${c.estado === "rechazado" ? "text-danger" : "text-label"}`}
                >
                  {ETIQUETA_ESTADO[c.estado]}
                </span>
                <button
                  type="button"
                  onClick={() => quitar(c.usuario_email)}
                  aria-label={`Dejar de compartir con ${c.usuario_email}`}
                  className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-label transition hover:bg-danger-soft hover:text-danger"
                >
                  <IconoQuitar className="h-3.5 w-3.5" />
                </button>
              </li>
            ))
          )}
        </ul>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={cerrar}
            className="cursor-pointer rounded-full px-4 py-1.5 text-[13px] font-medium text-ink-soft transition hover:bg-sunken"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
