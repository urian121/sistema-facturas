"use client";

import { useEffect, useState } from "react";
import { IconoDocumento } from "./iconos";
import { useEnPantalla } from "./use-en-pantalla";

let workerConfigurado = false;

async function cargarPdfjs() {
  const pdfjsLib = await import("pdfjs-dist");
  if (!workerConfigurado) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
    workerConfigurado = true;
  }
  return pdfjsLib;
}

const ANCHO_RENDER = 240;

/**
 * Miniatura real de un PDF: renderiza la página 1 en un `<canvas>` con
 * pdf.js, en el navegador (sin nada nuevo que instalar en el servidor), y la
 * vuelca como imagen. Solo empieza a cargar cuando la tarjeta entra en
 * pantalla — bajarse el PDF completo de cada tarjeta del historial de una
 * sola vez sería un desperdicio de ancho de banda.
 */
export default function PdfMiniatura({
  docId,
  className,
  iconoClassName,
}: {
  docId: string;
  className: string;
  iconoClassName: string;
}) {
  const { ref, visible } = useEnPantalla<HTMLDivElement>();
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!visible) return;

    let cancelado = false;
    let destruir: (() => void) | null = null;

    (async () => {
      try {
        const pdfjsLib = await cargarPdfjs();
        const tarea = pdfjsLib.getDocument({ url: `/api/files/${docId}` });
        destruir = () => void tarea.destroy();
        const documento = await tarea.promise;
        if (cancelado) return;

        const pagina = await documento.getPage(1);
        const viewportBase = pagina.getViewport({ scale: 1 });
        const escala = ANCHO_RENDER / viewportBase.width;
        const viewport = pagina.getViewport({ scale: escala });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const contexto = canvas.getContext("2d");
        if (!contexto) throw new Error("Sin contexto 2D disponible");

        await pagina.render({ canvas, canvasContext: contexto, viewport }).promise;
        if (!cancelado) setDataUrl(canvas.toDataURL());
      } catch {
        if (!cancelado) setError(true);
      }
    })();

    return () => {
      cancelado = true;
      destruir?.();
    };
  }, [visible, docId]);

  return (
    <div ref={ref} className={`relative overflow-hidden bg-sunken ${className}`}>
      {dataUrl && !error ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={dataUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-label">
          <IconoDocumento className={iconoClassName} />
        </div>
      )}
    </div>
  );
}
