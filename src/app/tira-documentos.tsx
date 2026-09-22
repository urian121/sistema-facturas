"use client";

import { IconoConforme, IconoDocumento } from "./iconos";
import type { Doc } from "./uploader";

/** Miniatura real para imágenes; icono genérico para PDF (no hay forma barata de generar su portada). */
function Miniatura({ doc }: { doc: Doc }) {
  if (doc.mime_type === "application/pdf") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-sunken text-label">
        <IconoDocumento className="h-4 w-4" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/api/files/${doc.id}`}
      alt=""
      className="h-10 w-10 rounded-md border border-line object-cover"
    />
  );
}

/**
 * Historial de subidas como tira de miniaturas, siempre visible sobre el
 * documento. Sustituye al desplegable anterior: aquí se ve de un vistazo
 * cuánto se ha subido y cuál está archivado, sin tener que abrir nada.
 */
export default function TiraDocumentos({
  docs,
  selectedId,
  archivados,
  onElegir,
}: {
  docs: Doc[];
  selectedId: string | null;
  archivados: Set<string>;
  onElegir: (id: string) => void;
}) {
  if (docs.length === 0) return null;

  return (
    <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-line bg-surface px-4 py-2.5">
      {docs.map((doc) => {
        const activo = doc.id === selectedId;
        return (
          <button
            key={doc.id}
            type="button"
            onClick={() => onElegir(doc.id)}
            title={doc.filename}
            aria-current={activo}
            className={`flex w-16 shrink-0 cursor-pointer flex-col items-center gap-1 rounded-lg border px-1.5 py-1.5 transition ${
              activo
                ? "border-accent bg-accent-soft"
                : "border-transparent hover:border-line hover:bg-sunken"
            }`}
          >
            <div className="relative">
              <Miniatura doc={doc} />
              {archivados.has(doc.id) && (
                <IconoConforme className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-surface text-ok" />
              )}
            </div>
            <span
              className={`w-full truncate text-center text-[11px] ${
                activo ? "text-accent" : "text-label"
              }`}
            >
              {doc.filename}
            </span>
          </button>
        );
      })}
    </div>
  );
}
