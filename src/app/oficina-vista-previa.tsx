"use client";

import { useEffect, useState } from "react";
import { IconoDocumento } from "./iconos";

type Previa = { tipo: "texto"; texto: string } | { tipo: "hoja"; filas: string[][] };

/**
 * Vista previa grande de Word/Excel/PowerPoint para el panel de documento:
 * mismo dato real que la miniatura del historial (`/api/preview/{id}`), pero
 * pidiendo más (`?tamano=grande`) porque aquí hay todo el ancho del panel.
 * No es una foto de la página — ver el porqué en `oficina-miniatura.tsx`.
 */
export default function OficinaVistaPrevia({
  docId,
  filename,
}: {
  docId: string;
  filename: string;
}) {
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelado = false;

    fetch(`/api/preview/${docId}?tamano=grande`)
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
  }, [docId]);

  const enlace = (
    <a
      href={`/api/files/${docId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[13px] text-accent-strong underline"
    >
      Abrir {filename}
    </a>
  );

  if (error || !previa) {
    return (
      <div className="flex h-full min-h-[50vh] flex-col items-center justify-center gap-3 rounded-lg bg-white p-8 text-center">
        <IconoDocumento className="h-8 w-8 text-label" />
        <p className="text-[13px] text-ink-soft">
          {error ? "Este tipo de archivo no tiene vista previa." : "Cargando vista previa…"}
        </p>
        {error && enlace}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[50vh] flex-col gap-3 rounded-lg bg-white p-6">
      <div className="min-h-0 flex-1 overflow-auto">
        {previa.tipo === "hoja" ? (
          previa.filas.length === 0 ? (
            <p className="text-[13px] text-label">La hoja no tiene datos.</p>
          ) : (
            <table className="w-full border-collapse text-[12px] text-ink">
              <tbody>
                {previa.filas.map((fila, i) => (
                  <tr key={i}>
                    {fila.map((celda, j) => (
                      <td key={j} className="border-b border-line px-2 py-1">
                        {celda}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-ink">
            {previa.texto || "Documento sin texto legible."}
          </p>
        )}
      </div>
      <div className="shrink-0 border-t border-line pt-3">{enlace}</div>
    </div>
  );
}
