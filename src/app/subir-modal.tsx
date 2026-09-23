"use client";

import { useRef, useState } from "react";
import { IconoAviso, IconoQuitar, IconoSubir } from "./iconos";
import Tooltip from "./tooltip";
import { useEscapeKey } from "./use-escape-key";

export default function SubirModal({
  subiendo,
  tiposPermitidos,
  maxMB,
  onCerrar,
  onArchivo,
}: {
  subiendo: boolean;
  tiposPermitidos: string[];
  maxMB: number;
  onCerrar: () => void;
  onArchivo: (file: File) => void;
}) {
  const [dentro, setDentro] = useState(false);
  const [rechazo, setRechazo] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(!subiendo, onCerrar);

  /** El navegador deja soltar cualquier cosa: el filtro vive aquí, no en el accept. */
  const aceptar = (file: File | undefined) => {
    if (!file) return;
    if (!tiposPermitidos.includes(file.type)) {
      setRechazo(
        `${file.name} es un ${file.type || "tipo desconocido"}: sólo entran imágenes, PDF, Word, Excel y PowerPoint.`,
      );
      return;
    }
    if (file.size > maxMB * 1024 * 1024) {
      setRechazo(`${file.name} pesa más de ${maxMB} MB.`);
      return;
    }
    setRechazo(null);
    onArchivo(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        onClick={() => !subiendo && onCerrar()}
        className="absolute inset-0 bg-ink/20 backdrop-blur-[2px]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Subir documento"
        className="entra relative w-full max-w-130 rounded-xl border border-line bg-surface shadow-[0_16px_48px_-16px_rgba(36,36,36,0.35)]"
      >
        <header className="flex h-12 items-center gap-3 border-b border-line px-4">
          <h2 className="text-[13px] font-medium">Subir documento</h2>
          <Tooltip etiqueta="Cerrar" posicion="left" className="ml-auto">
            <button
              type="button"
              onClick={onCerrar}
              disabled={subiendo}
              aria-label="Cerrar"
              className="cursor-pointer rounded-md p-1 text-label transition hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconoQuitar />
            </button>
          </Tooltip>
        </header>

        <div className="p-4">
          <input
            ref={inputRef}
            type="file"
            accept={tiposPermitidos.join(",")}
            className="sr-only"
            onChange={(e) => {
              aceptar(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDentro(true);
            }}
            onDragLeave={() => setDentro(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDentro(false);
              aceptar(e.dataTransfer.files?.[0]);
            }}
            disabled={subiendo}
            className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed px-6 py-10 text-center transition ${
              dentro
                ? "border-accent-strong bg-accent-soft"
                : "border-line bg-sunken hover:border-line-strong"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            <IconoSubir className="h-6 w-6 text-label" />
            <span className="text-[14px] font-medium">
              {subiendo ? "Subiendo…" : "Arrastra el documento aquí o haz clic para elegirlo"}
            </span>
            <span className="text-[12px] text-label">
              Factura, recibo o contrato · imagen, PDF, Word, Excel o PowerPoint · hasta {maxMB} MB
            </span>
          </button>

          {rechazo && (
            <p className="mt-3 flex items-start gap-1.5 text-[12px] text-danger">
              <IconoAviso className="mt-0.5 h-3.5 w-3.5" />
              {rechazo}
            </p>
          )}

          <p className="mt-3 text-[12px] leading-relaxed text-label">
            Los PDF escaneados también se leen: pasan por OCR antes de extraer los campos.
          </p>
        </div>
      </div>
    </div>
  );
}
