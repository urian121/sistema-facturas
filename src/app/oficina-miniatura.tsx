"use client";

import { useEffect, useState } from "react";
import { IconoDocumento } from "./iconos";
import { useEnPantalla } from "./use-en-pantalla";
import type { Doc } from "./uploader";

type Previa = { tipo: "texto"; texto: string } | { tipo: "hoja"; filas: string[][] };

/**
 * Vista previa de datos reales de un Word/Excel/PowerPoint: no es una foto
 * de la página (eso pide un conversor pesado que no cabe en el hosting),
 * pero sí es contenido real del archivo — una mini tabla de celdas para
 * Excel, un fragmento de texto para Word/PowerPoint. Solo la pide cuando la
 * tarjeta entra en pantalla.
 */
export default function OficinaMiniatura({
  doc,
  className,
  iconoClassName,
}: {
  doc: Doc;
  className: string;
  iconoClassName: string;
}) {
  const { ref, visible } = useEnPantalla<HTMLDivElement>();
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let cancelado = false;

    fetch(`/api/preview/${doc.id}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("sin vista previa"))))
      .then((datos: Previa) => {
        if (!cancelado) setPrevia(datos);
      })
      .catch(() => {
        if (!cancelado) setError(true);
      });

    return () => {
      cancelado = true;
    };
  }, [visible, doc.id]);

  return (
    <div ref={ref} className={`overflow-hidden bg-sunken p-1.5 ${className}`}>
      {error || !previa ? (
        <div className="flex h-full w-full items-center justify-center text-label">
          <IconoDocumento className={iconoClassName} />
        </div>
      ) : previa.tipo === "hoja" ? (
        <table className="h-full w-full table-fixed border-collapse overflow-hidden text-[7px] leading-tight text-ink-soft">
          <tbody>
            {previa.filas.map((fila, i) => (
              <tr key={i}>
                {fila.map((celda, j) => (
                  <td
                    key={j}
                    className="truncate border-b border-line/70 bg-surface px-1 py-0.5"
                  >
                    {celda}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="line-clamp-6 rounded bg-surface p-1.5 text-[8px] leading-snug text-ink-soft">
          {previa.texto || "Documento sin texto legible."}
        </p>
      )}
    </div>
  );
}
