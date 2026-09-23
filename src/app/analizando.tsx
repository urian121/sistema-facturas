"use client";

import { useEffect, useState } from "react";
import { IconoConforme } from "./iconos";

/**
 * Pasos que se muestran mientras se analiza. El análisis es una sola
 * petición a `/api/extract` sin progreso real, así que avanzan por tiempo
 * (`desde`, en segundos) a partir de lo que suele tardar cada fase; el
 * último se queda "en curso" hasta que llega la respuesta, nunca se marca
 * como hecho antes de tiempo.
 */
const PASOS = [
  { desde: 0, texto: "Leyendo el documento" },
  { desde: 3, texto: "Identificando el tipo de documento" },
  { desde: 7, texto: "Extrayendo partes, fechas e importes" },
  { desde: 12, texto: "Transcribiendo el texto completo" },
] as const;

/** Ancho de cada línea del documento esquemático; las `true` son "datos" que se resaltan. */
const LINEAS: [string, boolean][] = [
  ["w-1/2", true],
  ["w-1/3", false],
  ["w-full", false],
  ["w-5/6", false],
  ["w-2/3", true],
  ["w-full", false],
  ["w-3/4", false],
  ["w-1/2", true],
];

/**
 * Haz del escáner (línea + resplandor) que barre su contenedor de arriba a
 * abajo; el contenedor tiene que ser `relative` y recortar (`overflow-hidden`).
 * Se usa en la tarjeta de abajo y encima de la vista previa real del documento.
 */
export function HazEscaneo({ intenso = false }: { intenso?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="escaneo pointer-events-none absolute inset-x-0 z-10 -translate-y-1/2"
    >
      <div
        className={`h-16 bg-linear-to-b from-transparent to-transparent ${
          intenso ? "via-accent-strong/20" : "via-accent-strong/10"
        }`}
      />
      <div className="absolute inset-x-0 top-1/2 h-px bg-accent-strong/70 shadow-[0_0_12px_2px_rgba(205,176,106,0.55)]" />
    </div>
  );
}

/** Esquinas en "L" del visor del escáner alrededor de la tarjeta. */
function Esquinas() {
  const base = "absolute h-5 w-5 border-accent-strong/60";
  return (
    <div aria-hidden="true" className="pointer-events-none absolute -inset-3">
      <span className={`${base} left-0 top-0 rounded-tl-lg border-l-2 border-t-2`} />
      <span className={`${base} right-0 top-0 rounded-tr-lg border-r-2 border-t-2`} />
      <span className={`${base} bottom-0 left-0 rounded-bl-lg border-b-2 border-l-2`} />
      <span className={`${base} bottom-0 right-0 rounded-br-lg border-b-2 border-r-2`} />
    </div>
  );
}

/**
 * Panel de "analizando": un documento esquemático recorrido por el haz del
 * escáner, con sus líneas de datos iluminándose, y debajo los pasos del
 * proceso y el tiempo transcurrido. Sustituye al texto plano de antes.
 */
export default function Analizando({ filename }: { filename: string }) {
  const [segundos, setSegundos] = useState(0);

  useEffect(() => {
    const inicio = Date.now();
    const id = setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 250);
    return () => clearInterval(id);
  }, []);

  const actual = PASOS.findLastIndex((p) => segundos >= p.desde);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-1 flex-col items-center justify-center gap-8 bg-[radial-gradient(ellipse_at_center,var(--accent-soft)_0%,transparent_65%)] px-8 py-10"
    >
      <div className="relative">
        <Esquinas />
        <div className="relative h-52 w-40 overflow-hidden rounded-xl bg-surface p-4 shadow-[0_16px_40px_-16px_rgba(36,36,36,0.35)]">
          <div className="mb-4 flex items-center justify-between">
            <span className="h-5 w-5 rounded-md bg-accent" />
            <span className="h-1.5 w-10 rounded-full bg-line-strong" />
          </div>
          <div className="flex flex-col gap-2.5">
            {LINEAS.map(([ancho, esDato], i) => (
              <span
                key={i}
                style={{ animationDelay: `${(i / LINEAS.length) * 2.4}s` }}
                className={`detecta h-1.5 rounded-full ${ancho} ${
                  esDato ? "bg-accent-strong/50" : "bg-line-strong"
                }`}
              />
            ))}
          </div>
          <HazEscaneo intenso />
        </div>
      </div>

      <div className="flex w-full max-w-xs flex-col items-center gap-4">
        <div className="text-center">
          <p className="text-[15px] font-medium text-ink">Analizando documento</p>
          <p className="mt-0.5 max-w-xs truncate text-[12px] text-label" title={filename}>
            {filename}
          </p>
        </div>

        <ol className="flex w-full flex-col gap-2">
          {PASOS.map((paso, i) => {
            const hecho = i < actual;
            const enCurso = i === actual;
            return (
              <li
                key={paso.texto}
                className={`flex items-center gap-2.5 text-[13px] transition-colors duration-300 ${
                  hecho ? "text-ink-soft" : enCurso ? "font-medium text-ink" : "text-label/60"
                }`}
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {hecho ? (
                    <IconoConforme className="h-4 w-4 text-ok" />
                  ) : enCurso ? (
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-strong/50 motion-reduce:animate-none" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-accent-strong" />
                    </span>
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-line-strong" />
                  )}
                </span>
                {paso.texto}
              </li>
            );
          })}
        </ol>

        <p className="cifra text-[11px] text-label">
          {segundos} s · suele tardar entre 10 y 20 segundos
        </p>
      </div>
    </div>
  );
}
