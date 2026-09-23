"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconoCampana, IconoCompartir } from "./iconos";
import { notificar } from "./notificar";
import Tooltip from "./tooltip";
import { useEscapeKey } from "./use-escape-key";

export type Notificacion = {
  id: string;
  document_id: string;
  remitente_email: string;
  remitente_nombre: string | null;
  creada_at: string;
  filename: string;
  mime_type: string;
  estado: "pendiente" | "aceptado" | "rechazado";
};

const relativo = new Intl.RelativeTimeFormat("es-ES", { numeric: "auto" });

function hace(fecha: string): string {
  const segundos = Math.round((new Date(fecha).getTime() - Date.now()) / 1000);
  const tramos: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unidad, tamano] of tramos) {
    if (Math.abs(segundos) >= tamano) return relativo.format(Math.round(segundos / tamano), unidad);
  }
  return "ahora mismo";
}

const remitente = (n: Notificacion) => n.remitente_nombre ?? n.remitente_email;

/**
 * Campana del encabezado, al lado del perfil. Se entera en vivo de las
 * invitaciones nuevas por Server-Sent Events (`/api/notificaciones/stream`,
 * ver `src/lib/tiempo-real.ts`): el evento no trae datos, sólo "hay
 * novedades", y aquí se vuelve a pedir la lista. Las que llegan en vivo y
 * siguen pendientes se anuncian además con un toast.
 *
 * El número rojo cuenta las invitaciones pendientes (no hay "leídas": una
 * invitación deja de contar al aceptarla o rechazarla).
 */
export default function Notificaciones({
  onAceptada,
  onAbrir,
}: {
  onAceptada: (documentId: string) => void;
  onAbrir: (documentId: string) => void;
}) {
  const [lista, setLista] = useState<Notificacion[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [respondiendo, setRespondiendo] = useState<string | null>(null);
  const conocidas = useRef<Set<string> | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    const res = await fetch("/api/notificaciones").catch(() => null);
    if (!res?.ok) return;
    const filas: Notificacion[] = await res.json();

    // En la primera carga no se anuncia nada: sólo lo que llega después.
    if (conocidas.current) {
      for (const n of filas) {
        if (n.estado === "pendiente" && !conocidas.current.has(n.id)) {
          notificar.ok(`${remitente(n)} te compartió "${n.filename}"`);
        }
      }
    }
    conocidas.current = new Set(filas.map((n) => n.id));
    setLista(filas);
  }, []);

  useEffect(() => {
    const fuente = new EventSource("/api/notificaciones/stream");
    fuente.addEventListener("notificacion", () => cargar());
    // `open` hace de carga inicial y, al reconectar tras un corte, recupera
    // lo que se haya perdido; `error` cubre el caso de que el canal en vivo
    // no llegue a abrirse (la lista se ve igual, sólo que sin avisos en vivo).
    fuente.addEventListener("open", () => cargar());
    fuente.addEventListener("error", () => cargar());
    return () => fuente.close();
  }, [cargar]);

  useEscapeKey(abierto, () => setAbierto(false));

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  async function responder(n: Notificacion, respuesta: "aceptar" | "rechazar") {
    setRespondiendo(n.id);
    try {
      const res = await fetch(`/api/notificaciones/${n.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ respuesta }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error ?? "No se pudo responder la invitación");

      setLista((prev) => prev.map((x) => (x.id === n.id ? { ...x, estado: data.estado } : x)));
      if (respuesta === "aceptar") {
        onAceptada(n.document_id);
        notificar.ok(`"${n.filename}" ya está en tu historial`);
      } else {
        notificar.ok("Invitación rechazada");
      }
    } catch (err) {
      notificar.error(err instanceof Error ? err.message : "Error inesperado");
      cargar();
    } finally {
      setRespondiendo(null);
    }
  }

  const pendientes = lista.filter((n) => n.estado === "pendiente").length;
  const etiqueta = pendientes > 0 ? `Notificaciones (${pendientes} pendientes)` : "Notificaciones";

  return (
    <div ref={raiz} className="relative">
      <Tooltip etiqueta={etiqueta} posicion="left">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-label={etiqueta}
          aria-haspopup="dialog"
          aria-expanded={abierto}
          className={`relative flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition ${
            abierto ? "bg-surface text-ink" : "text-ink-soft hover:bg-surface hover:text-ink"
          }`}
        >
          <IconoCampana className="h-4 w-4" />
          {pendientes > 0 && (
            <span className="cifra absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium leading-none text-white">
              {pendientes > 9 ? "9+" : pendientes}
            </span>
          )}
        </button>
      </Tooltip>

      {abierto && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-line bg-surface shadow-[0_16px_48px_-16px_rgba(36,36,36,0.35)]"
        >
          <p className="border-b border-line px-4 py-2.5 text-[13px] font-medium text-ink">
            Notificaciones
          </p>

          {lista.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-label">No tienes notificaciones.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto py-1">
              {lista.map((n) => (
                <li key={n.id} className="flex gap-2.5 px-4 py-2.5 hover:bg-sunken">
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
                    <IconoCompartir className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-ink-soft">
                      <span className="font-medium text-ink" title={n.remitente_email}>
                        {remitente(n)}
                      </span>{" "}
                      te compartió{" "}
                      <span className="break-all font-medium text-ink">{n.filename}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-label">{hace(n.creada_at)}</p>

                    {n.estado === "pendiente" ? (
                      <div className="mt-2 flex gap-1.5">
                        <button
                          type="button"
                          disabled={respondiendo === n.id}
                          onClick={() => responder(n, "aceptar")}
                          className="cursor-pointer rounded-full bg-accent px-3 py-1 text-[12px] font-medium text-on-accent transition hover:bg-accent-strong hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Aceptar
                        </button>
                        <button
                          type="button"
                          disabled={respondiendo === n.id}
                          onClick={() => responder(n, "rechazar")}
                          className="cursor-pointer rounded-full px-3 py-1 text-[12px] font-medium text-ink-soft transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      </div>
                    ) : n.estado === "aceptado" ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAbierto(false);
                          onAbrir(n.document_id);
                        }}
                        className="mt-1 cursor-pointer text-[12px] text-accent-strong underline-offset-2 hover:underline"
                      >
                        Aceptado · Abrir
                      </button>
                    ) : (
                      <p className="mt-1 text-[12px] text-label">Rechazado</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
