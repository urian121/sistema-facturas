"use client";

import { useCallback, useEffect, useState } from "react";
import Chat from "./chat";
import DatosForm from "./datos-form";
import HistorialDocumentos from "./historial-documentos";
import ListaRegistros from "./lista-registros";
import { notificar } from "./notificar";
import OficinaVistaPrevia from "./oficina-vista-previa";
import Riel from "./riel";
import SubirModal from "./subir-modal";
import Tooltip from "./tooltip";
import {
  IconoAviso,
  IconoConforme,
  IconoDestello,
  IconoDocumento,
  IconoPerfil,
  IconoRecargar,
  IconoSubir,
} from "./iconos";
import { esOffice } from "@/lib/mime-oficina";
import type { Extraccion } from "@/lib/schemas";
import type { Registro } from "@/lib/registros";

export type Doc = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: string;
  created_at: string;
  doc_type: string | null;
  extraction: Extraccion | null;
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Zona vacía del panel de documento: mismo lenguaje visual que la zona de
 * arrastrar-y-soltar del modal de subida (borde punteado, ícono, formatos
 * aceptados), para que se reconozca de un vistazo como el mismo gesto. El
 * fondo `bg-app` alrededor la separa del recuadro `bg-surface`, que si no
 * quedaba fundido con el panel.
 */
function ZonaVacia({
  titulo,
  descripcion,
  onClick,
}: {
  titulo: string;
  descripcion: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-app p-6">
      <button
        onClick={onClick}
        className="flex w-full max-w-sm cursor-pointer flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed border-line bg-surface px-6 py-10 text-center transition hover:border-line-strong hover:bg-sunken"
      >
        <IconoSubir className="h-6 w-6 text-label" />
        <span className="text-[14px] font-medium">{titulo}</span>
        <span className="text-[12px] text-label">{descripcion}</span>
      </button>
    </div>
  );
}

export default function Uploader({
  initialDocs,
  initialRegistros,
  dbError,
}: {
  initialDocs: Doc[];
  initialRegistros: Registro[];
  dbError: string | null;
}) {
  const [docs, setDocs] = useState<Doc[]>(initialDocs);
  const [registros, setRegistros] = useState<Registro[]>(initialRegistros);
  // Sin selección por defecto: el usuario elige del historial o sube algo nuevo.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vista, setVista] = useState<"revisar" | "archivo">("revisar");
  // En móvil no caben documento e inspector a la vez: se conmuta entre ellos.
  const [panelMovil, setPanelMovil] = useState<"documento" | "datos">("documento");
  const [subirAbierto, setSubirAbierto] = useState(false);
  const [chatAbierto, setChatAbierto] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  // El resto de avisos son toasts; este es persistente porque explica por qué
  // nada en la app funciona, así que no debe desaparecer solo.
  const [dbErrorVisible, setDbErrorVisible] = useState(dbError !== null);

  const selected = docs.find((d) => d.id === selectedId) ?? null;
  const archivados = new Set(registros.map((r) => r.document_id));
  const confirmado = selectedId !== null && archivados.has(selectedId);

  const actualizar = useCallback((id: string, cambios: Partial<Doc>) => {
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...cambios } : d)));
  }, []);

  const refrescarRegistros = useCallback(async () => {
    const res = await fetch("/api/registros");
    if (res.ok) setRegistros(await res.json());
  }, []);

  const upload = useCallback(async (file: File) => {
    setUploading(true);
    setVista("revisar");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo subir el archivo");
      const doc: Doc = { ...data, doc_type: null, extraction: null };
      setDocs((prev) => [doc, ...prev]);
      setSelectedId(doc.id);
      setPanelMovil("documento");
      setSubirAbierto(false);
    } catch (err) {
      notificar.error(err instanceof Error ? err.message : "Error inesperado");
      setSubirAbierto(false);
    } finally {
      setUploading(false);
    }
  }, []);

  const analyze = useCallback(
    async (id: string) => {
      setAnalyzing(true);
      try {
        const res = await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo analizar el documento");
        actualizar(id, { doc_type: data.doc_type, extraction: data.extraction });
        setPanelMovil("datos");
      } catch (err) {
        notificar.error(err instanceof Error ? err.message : "Error inesperado");
      } finally {
        setAnalyzing(false);
      }
    },
    [actualizar],
  );

  const guardarBorrador = useCallback(async (doc: Doc) => {
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extraction: doc.extraction }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "No se pudo guardar");
    return data;
  }, []);

  const guardar = useCallback(async () => {
    if (!selected?.extraction) return;
    setGuardando(true);
    try {
      const data = await guardarBorrador(selected);
      actualizar(selected.id, { doc_type: data.extraction.tipo_documento });
      notificar.ok("Borrador guardado");
    } catch (err) {
      notificar.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setGuardando(false);
    }
  }, [selected, actualizar, guardarBorrador]);

  const confirmar = useCallback(async () => {
    if (!selected?.extraction) return;
    setConfirmando(true);
    try {
      await guardarBorrador(selected);
      const res = await fetch("/api/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo confirmar");

      actualizar(selected.id, { doc_type: selected.extraction.tipo_documento });
      await refrescarRegistros();
      notificar.ok(
        `Archivado · ${data.lineas} ${data.lineas === 1 ? "línea" : "líneas"} y ${data.chunks} ${
          data.chunks === 1 ? "fragmento indexado" : "fragmentos indexados"
        }`,
      );
    } catch (err) {
      notificar.error(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setConfirmando(false);
    }
  }, [selected, actualizar, guardarBorrador, refrescarRegistros]);

  const abrirDocumento = useCallback((documentId: string) => {
    setSelectedId(documentId);
    setVista("revisar");
    setPanelMovil("documento");
  }, []);

  const irAlInicio = useCallback(() => {
    setSelectedId(null);
    setVista("revisar");
    setPanelMovil("documento");
  }, []);

  // Arrastrar sobre cualquier punto de la ventana: el objetivo es la aplicación entera.
  useEffect(() => {
    const sobre = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.preventDefault();
      setDragging(true);
    };
    const fuera = (e: DragEvent) => {
      if (e.relatedTarget === null) setDragging(false);
    };
    const soltar = (e: DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer?.files?.[0];
      if (file) upload(file);
    };
    window.addEventListener("dragover", sobre);
    window.addEventListener("dragleave", fuera);
    window.addEventListener("drop", soltar);
    return () => {
      window.removeEventListener("dragover", sobre);
      window.removeEventListener("dragleave", fuera);
      window.removeEventListener("drop", soltar);
    };
  }, [upload]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      <Riel
        vista={vista}
        onIrAlInicio={irAlInicio}
        onCambiarVista={() => setVista(vista === "archivo" ? "revisar" : "archivo")}
        onAbrirChat={() => setChatAbierto(true)}
        onAbrirSubir={() => setSubirAbierto(true)}
        contadorArchivo={registros.length}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden pb-14 lg:pb-0">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-sunken px-4">
        <span className="font-marca text-[17px] font-semibold tracking-[-0.01em]">
          Gestor de Facturas
        </span>

        <Tooltip etiqueta="Perfil" posicion="left" className="ml-auto">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent transition hover:bg-surface"
            aria-label="Perfil"
          >
            <IconoPerfil className="h-4 w-4" />
          </div>
        </Tooltip>
      </header>

      {dbError && dbErrorVisible && (
        <div className="flex shrink-0 items-start gap-2 border-b border-danger/25 bg-danger-soft px-4 py-2.5 text-[13px] text-danger">
          <IconoAviso className="mt-0.5 h-3.5 w-3.5" />
          <p className="flex-1">{dbError}</p>
          <button
            onClick={() => setDbErrorVisible(false)}
            className="cursor-pointer underline-offset-2 hover:underline"
          >
            Descartar
          </button>
        </div>
      )}

      {vista === "archivo" ? (
        <div className="flex-1 overflow-y-auto">
          <ListaRegistros
            registros={registros}
            seleccionado={selectedId}
            onAbrir={abrirDocumento}
          />
        </div>
      ) : (
        <>
          {selected && (
            <div className="flex shrink-0 border-b border-line bg-surface lg:hidden">
              {(
                [
                  ["documento", "Documento"],
                  ["datos", "Historial de Archivos"],
                ] as const
              ).map(([clave, etiqueta]) => (
                <button
                  key={clave}
                  onClick={() => setPanelMovil(clave)}
                  aria-current={panelMovil === clave}
                  className={`flex-1 cursor-pointer border-b-2 px-3 py-2 text-[13px] transition ${
                    panelMovil === clave
                      ? "border-accent bg-[#e5e6ff] text-accent"
                      : "border-transparent text-label hover:text-ink"
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>
          )}

          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[2fr_3fr]">
            {/* Documento */}
            <section
              className={`relative min-h-0 min-w-0 flex-col border-b border-line lg:flex lg:border-b-0 lg:border-r ${
                panelMovil === "documento" || !selected ? "flex" : "hidden"
              }`}
            >
              {selected ? (
                <>
                  <div className="flex h-11 shrink-0 items-center gap-2 border-b border-line bg-surface px-2.5 text-[13px]">
                    <IconoDocumento className="h-3.5 w-3.5 shrink-0 text-label" />
                    <span className="min-w-0 flex-1 truncate">{selected.filename}</span>
                    <span className="cifra shrink-0 text-label">
                      {formatSize(Number(selected.size_bytes))}
                    </span>
                    {confirmado && (
                      <span className="ml-auto flex shrink-0 items-center gap-1 text-ok">
                        <IconoConforme className="h-3.5 w-3.5" />
                        Archivado
                      </span>
                    )}
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto bg-sunken p-4">
                    {selected.mime_type === "application/pdf" ? (
                      <object
                        data={`/api/files/${selected.id}`}
                        type="application/pdf"
                        className="h-full min-h-[70vh] w-full rounded-lg border border-line bg-white"
                      >
                        <p className="p-6 text-[13px] text-ink-soft">
                          Tu navegador no puede mostrar el PDF.{" "}
                          <a className="text-accent underline" href={`/api/files/${selected.id}`}>
                            Ábrelo en una pestaña
                          </a>
                        </p>
                      </object>
                    ) : esOffice(selected.mime_type) ? (
                      <OficinaVistaPrevia
                        key={selected.id}
                        docId={selected.id}
                        filename={selected.filename}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/files/${selected.id}`}
                        alt={selected.filename}
                        className="mx-auto w-auto max-w-full rounded-lg"
                      />
                    )}
                  </div>

                  {!selected.extraction && (
                    <div className="absolute bottom-4 right-4 z-10">
                      <button
                        onClick={() => analyze(selected.id)}
                        disabled={analyzing}
                        className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[13px] font-normal text-white shadow-[0_8px_24px_-8px_rgba(36,36,36,0.45)] transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <IconoDestello className="h-3.5 w-3.5" />
                        {analyzing ? "Analizando…" : "Analizar documento"}
                      </button>
                    </div>
                  )}
                </>
              ) : docs.length === 0 ? (
                <ZonaVacia
                  titulo="Arrastra el documento aquí o haz clic para elegirlo"
                  descripcion="Factura, recibo o contrato · imagen, PDF, Word, Excel o PowerPoint · hasta 20 MB"
                  onClick={() => setSubirAbierto(true)}
                />
              ) : (
                <ZonaVacia
                  titulo="Elige un documento del historial o sube uno nuevo"
                  descripcion="Arrastra el documento aquí o haz clic para subirlo"
                  onClick={() => setSubirAbierto(true)}
                />
              )}
            </section>

            {/* Datos */}
            <section
              className={`min-h-0 min-w-0 flex-col bg-surface lg:flex ${
                panelMovil === "datos" && selected ? "flex" : "hidden lg:flex"
              }`}
            >
              {!selected ? (
                docs.length === 0 ? (
                  <p className="flex flex-1 items-center justify-center px-8 text-center text-[13px] text-label">
                    Los datos del documento aparecerán aquí para que los revises.
                  </p>
                ) : (
                  <HistorialDocumentos
                    docs={docs}
                    selectedId={selectedId}
                    archivados={archivados}
                    onElegir={abrirDocumento}
                  />
                )
              ) : !selected.extraction ? (
                analyzing ? (
                  <div className="flex flex-1 items-center justify-center px-8 text-center">
                    <p className="max-w-xs text-[13px] leading-relaxed text-ink-soft">
                      Leyendo el documento, clasificándolo y transcribiendo su texto. Tarda
                      entre 10 y 20 segundos.
                    </p>
                  </div>
                ) : (
                  <HistorialDocumentos
                    docs={docs}
                    selectedId={selectedId}
                    archivados={archivados}
                    onElegir={abrirDocumento}
                  />
                )
              ) : (
                <div className="entra flex min-h-0 flex-1 flex-col">
                  <div className="flex h-11 shrink-0 items-center gap-3 border-b border-line px-4">
                    <h2 className="text-[13px] font-medium">Datos extraídos</h2>
                    <button
                      onClick={() => analyze(selected.id)}
                      disabled={analyzing}
                      className="ml-auto flex cursor-pointer items-center gap-1.5 text-[13px] text-label transition hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <IconoRecargar className="h-3.5 w-3.5" />
                      {analyzing ? "Analizando…" : "Volver a analizar"}
                    </button>
                  </div>

                  <DatosForm
                    key={selected.id}
                    extraccion={selected.extraction}
                    confirmado={confirmado}
                    onChange={(siguiente) => actualizar(selected.id, { extraction: siguiente })}
                    onGuardar={guardar}
                    onConfirmar={confirmar}
                    guardando={guardando}
                    confirmando={confirmando}
                  />
                </div>
              )}
            </section>
          </div>
        </>
      )}
      </div>

      <Chat
        abierto={chatAbierto}
        onCerrar={() => setChatAbierto(false)}
        hayDocumentos={registros.length > 0}
        onAbrirDocumento={(id) => {
          abrirDocumento(id);
          setChatAbierto(false);
        }}
      />

      {subirAbierto && (
        <SubirModal
          subiendo={uploading}
          onCerrar={() => setSubirAbierto(false)}
          onArchivo={upload}
        />
      )}

      {dragging && !subirAbierto && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-accent/5 backdrop-blur-[1px]">
          <div className="rounded-xl border-2 border-dashed border-accent bg-surface px-6 py-4 text-[13px] font-medium text-accent">
            Suelta el documento para subirlo
          </div>
        </div>
      )}
    </div>
  );
}
