"use client";

import { useState } from "react";
import ConfirmarModal from "./confirmar-modal";
import { IconoPapelera, IconoRecargar } from "./iconos";
import Tooltip from "./tooltip";

export type DocPapelera = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: string;
  eliminado_at: string;
};

const formatoFecha = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Fila de un documento en la papelera, con su propia confirmación para el borrado definitivo. */
function FilaPapelera({
  doc,
  onRestaurar,
  onEliminarDefinitivo,
}: {
  doc: DocPapelera;
  onRestaurar: (id: string) => void;
  onEliminarDefinitivo: (id: string) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <div className="flex items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium" title={doc.filename}>
          {doc.filename}
        </p>
        <p className="cifra text-[12px] text-label">
          Eliminado el {formatoFecha.format(new Date(doc.eliminado_at))}
        </p>
      </div>

      <Tooltip etiqueta="Restaurar" posicion="top">
        <button
          type="button"
          onClick={() => onRestaurar(doc.id)}
          aria-label="Restaurar"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-label transition hover:bg-sunken hover:text-ink"
        >
          <IconoRecargar className="h-4 w-4" />
        </button>
      </Tooltip>

      <Tooltip etiqueta="Eliminar para siempre" posicion="top">
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          aria-label="Eliminar para siempre"
          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-label transition hover:bg-danger-soft hover:text-danger"
        >
          <IconoPapelera className="h-4 w-4" />
        </button>
      </Tooltip>

      {confirmando && (
        <ConfirmarModal
          titulo="Eliminar para siempre"
          descripcion={`"${doc.filename}" se borrará para siempre, junto con sus datos archivados. Esta acción no se puede deshacer.`}
          etiquetaConfirmar="Eliminar para siempre"
          peligro
          onConfirmar={() => {
            setConfirmando(false);
            onEliminarDefinitivo(doc.id);
          }}
          onCancelar={() => setConfirmando(false)}
        />
      )}
    </div>
  );
}

export default function Papelera({
  docs,
  cargando,
  onRestaurar,
  onEliminarDefinitivo,
  onVaciar,
}: {
  docs: DocPapelera[];
  cargando: boolean;
  onRestaurar: (id: string) => void;
  onEliminarDefinitivo: (id: string) => void;
  onVaciar: () => void;
}) {
  const [confirmandoVaciar, setConfirmandoVaciar] = useState(false);

  if (cargando) {
    return (
      // `h-full` y no `flex-1`: el padre es un bloque con scroll, no un flex,
      // así que `flex-1` no le daba altura y el texto quedaba arriba.
      <div className="flex h-full items-center justify-center">
        <p className="text-[13px] text-label">Cargando…</p>
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <IconoPapelera className="h-6 w-6 text-label" />
        <p className="text-[15px] font-medium">La papelera está vacía</p>
        <p className="max-w-sm text-[13px] text-label">
          Los documentos que elimines desde el historial aparecen aquí antes de borrarse para
          siempre.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[15px] font-medium">Papelera</h2>
        <span className="cifra text-[13px] text-label">
          {docs.length} {docs.length === 1 ? "documento" : "documentos"}
        </span>
        <button
          type="button"
          onClick={() => setConfirmandoVaciar(true)}
          className="ml-auto flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-danger transition hover:bg-danger-soft"
        >
          <IconoPapelera className="h-3.5 w-3.5" />
          Vaciar papelera
        </button>
      </div>

      {confirmandoVaciar && (
        <ConfirmarModal
          titulo="Vaciar papelera"
          descripcion={
            docs.length === 1
              ? `"${docs[0].filename}" se borrará para siempre, junto con sus datos archivados. Esta acción no se puede deshacer.`
              : `Los ${docs.length} documentos de la papelera se borrarán para siempre, junto con sus datos archivados. Esta acción no se puede deshacer.`
          }
          etiquetaConfirmar="Vaciar papelera"
          peligro
          onConfirmar={() => {
            setConfirmandoVaciar(false);
            onVaciar();
          }}
          onCancelar={() => setConfirmandoVaciar(false)}
        />
      )}

      <div className="flex flex-col gap-1.5">
        {docs.map((doc) => (
          <FilaPapelera
            key={doc.id}
            doc={doc}
            onRestaurar={onRestaurar}
            onEliminarDefinitivo={onEliminarDefinitivo}
          />
        ))}
      </div>
    </div>
  );
}
