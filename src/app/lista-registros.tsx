"use client";

import { IconoArchivo } from "./iconos";
import { etiquetaTipo } from "@/lib/schemas";
import type { Registro } from "@/lib/registros";

function importe(total: string | null, moneda: string | null) {
  if (total === null) return "—";
  const n = Number(total);
  const formateado = Number.isFinite(n)
    ? n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : total;
  return `${formateado}${moneda ? ` ${moneda}` : ""}`;
}

export default function ListaRegistros({
  registros,
  seleccionado,
  onAbrir,
}: {
  registros: Registro[];
  seleccionado: string | null;
  onAbrir: (documentId: string) => void;
}) {
  if (registros.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
        <IconoArchivo className="h-6 w-6 text-label" />
        <p className="text-[15px] font-medium">Todavía no has archivado nada</p>
        <p className="max-w-sm text-[13px] text-label">
          Cuando confirmes un documento, sus datos pasan a tablas consultables y su texto
          queda indexado para poder preguntarle.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      {/* Mismo card que las secciones del formulario de datos: blanco, redondeado,
          cabecera con icono. */}
      <section className="rounded-xl bg-surface">
        <h2 className="flex items-center gap-2 px-4 pb-2.5 pt-3.5 text-[13px] font-medium text-ink">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sunken text-ink-soft">
            <IconoArchivo className="h-3.5 w-3.5" />
          </span>
          Archivo
          <span className="cifra font-normal text-label">
            {registros.length} {registros.length === 1 ? "documento" : "documentos"}
          </span>
        </h2>

        <div className="overflow-x-auto px-2 pb-2">
          <table className="w-full min-w-180 text-left text-[13px]">
            <thead>
              <tr className="border-b border-line text-[11px] uppercase tracking-[0.06em] text-label">
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Número</th>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Emisor</th>
                <th className="px-3 py-2 text-right font-medium">Total</th>
                <th className="px-3 py-2 text-right font-medium">Líneas</th>
                <th className="px-3 py-2 text-right font-medium">Fragmentos</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onAbrir(r.document_id)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onAbrir(r.document_id);
                    }
                  }}
                  title={r.filename}
                  className={`cursor-pointer border-b border-line/70 transition last:border-0 hover:bg-sunken ${
                    seleccionado === r.document_id ? "bg-accent-soft" : ""
                  }`}
                >
                  <td className="px-3 py-2.5">{r.categoria?.trim() || etiquetaTipo(r.tipo_documento)}</td>
                  <td className="cifra px-3 py-2.5 text-ink-soft">{r.numero_documento ?? "—"}</td>
                  <td className="cifra px-3 py-2.5 text-ink-soft">{r.fecha_emision ?? "—"}</td>
                  <td className="max-w-55 truncate px-3 py-2.5">{r.emisor_nombre ?? "—"}</td>
                  <td className="cifra px-3 py-2.5 text-right font-medium">
                    {importe(r.total, r.moneda)}
                  </td>
                  <td className="cifra px-3 py-2.5 text-right text-label">{r.lineas}</td>
                  <td className="cifra px-3 py-2.5 text-right text-label">{r.chunks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
