import Ilustracion from "./ilustracion";
import { IconoDestello, IconoPregunta, IconoSubir } from "../iconos";
import { MAX_MB } from "@/lib/limites-subida";

/** Panel de marca del login, solo en escritorio — vende el producto mientras el usuario decide entrar. */
export default function PanelMarketing() {
  const caracteristicas = [
    {
      icono: IconoSubir,
      titulo: "Sube cualquier documento",
      descripcion: `Imagen, PDF, Word, Excel o PowerPoint — hasta ${MAX_MB} MB.`,
    },
    {
      icono: IconoDestello,
      titulo: "La IA extrae los datos por ti",
      descripcion: "Importes, fechas y partes, listos para revisar en segundos.",
    },
    {
      icono: IconoPregunta,
      titulo: "Pregúntale a tus documentos",
      descripcion: "Respuestas con cita a la fuente exacta que las respalda.",
    },
  ] as const;

  return (
    <div className="relative hidden overflow-hidden bg-linear-to-br from-accent-strong to-[#2e2008] px-10 py-12 text-white lg:flex lg:w-2/5 lg:flex-col lg:justify-between">
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />

      <span className="relative font-marca text-[17px] font-semibold tracking-[-0.01em]">
        Gestor de Facturas
      </span>

      <div className="relative">
        <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em]">
          Tus facturas, convertidas en datos en segundos
        </h1>
        <p className="mt-3 max-w-sm text-[14px] leading-relaxed text-white/80">
          Sube el archivo, revisa lo que la IA leyó y quedará buscable para siempre.
        </p>

        <ul className="mt-8 flex flex-col gap-5">
          {caracteristicas.map(({ icono: Icono, titulo, descripcion }) => (
            <li key={titulo} className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/20">
                <Icono className="h-4 w-4 text-accent" />
              </span>
              <div>
                <p className="text-[14px] font-medium">{titulo}</p>
                <p className="text-[13px] text-white/70">{descripcion}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex justify-end pr-2">
          <Ilustracion />
        </div>
      </div>

      <p className="relative text-[12px] text-white/60">
        Facturas, recibos y contratos · Imagen, PDF, Word, Excel o PowerPoint
      </p>
    </div>
  );
}
