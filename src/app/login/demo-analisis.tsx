import { HazEscaneo } from "../analizando";

/** Lo que "sale" de la factura de muestra, en el orden en que aparece. */
const DATOS = [
  { etiqueta: "Emisor", valor: "Tostadores del Sur S.L.", posicion: "top-6" },
  { etiqueta: "Fecha", valor: "4 mar 2026", posicion: "top-28" },
  { etiqueta: "Total", valor: "423,50 €", posicion: "top-52" },
] as const;

const LINEAS = [
  ["Café en grano 1 kg × 12", "174,00"],
  ["Mantenimiento molino", "176,00"],
] as const;

/**
 * Escena del login: una factura de papel (con datos de ejemplo, no reales)
 * recorrida por el mismo haz del panel de análisis, mientras los datos
 * aparecen al lado y el total queda rodeado "a mano". Todo es CSS en bucle
 * (`demo-dato`, `demo-trazo` en globals.css); con movimiento reducido se ve
 * directamente el resultado final.
 */
export default function DemoAnalisis() {
  return (
    <div aria-hidden="true" className="relative h-72 w-full max-w-md select-none">
      {/* La hoja */}
      <div className="absolute left-0 top-2 w-60 -rotate-2 overflow-hidden rounded-md bg-[#fbf7ee] px-5 pb-5 pt-4 text-[#3a2a10] shadow-[0_18px_40px_-18px_rgba(0,0,0,0.6)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold leading-tight">Tostadores del Sur S.L.</p>
            <p className="text-[9px] text-[#3a2a10]/60">Calle Mayor 14 · Madrid</p>
          </div>
          <p className="text-right text-[9px] leading-tight text-[#3a2a10]/70">
            FACTURA
            <br />
            <span className="cifra">F-2026/0418</span>
          </p>
        </div>

        <p className="cifra mt-3 text-[9px] text-[#3a2a10]/70">Fecha: 04/03/2026</p>

        <div className="mt-3 border-t border-[#3a2a10]/15 pt-2">
          {LINEAS.map(([concepto, importe]) => (
            <div key={concepto} className="flex justify-between py-0.5 text-[9px]">
              <span>{concepto}</span>
              <span className="cifra">{importe}</span>
            </div>
          ))}
        </div>

        <div className="mt-2 space-y-0.5 border-t border-[#3a2a10]/15 pt-2 text-[9px]">
          <div className="flex justify-between text-[#3a2a10]/70">
            <span>Base imponible</span>
            <span className="cifra">350,00</span>
          </div>
          <div className="flex justify-between text-[#3a2a10]/70">
            <span>IVA 21 %</span>
            <span className="cifra">73,50</span>
          </div>
          <div className="relative flex justify-between pt-1 text-[11px] font-semibold">
            <span>Total</span>
            <span className="cifra">423,50 €</span>
            {/* Rodeo de rotulador: un óvalo imperfecto, a propósito. */}
            <svg
              viewBox="0 0 90 34"
              className="pointer-events-none absolute -right-3 -top-1.5 h-8.5 w-22.5"
              fill="none"
            >
              <path
                className="demo-trazo"
                d="M12 6 C 30 1, 70 1, 84 10 C 92 17, 80 30, 50 31 C 22 32, 4 27, 5 17 C 6 10, 16 6, 30 5"
                stroke="#d9861c"
                strokeWidth="2"
                strokeLinecap="round"
                pathLength={1}
              />
            </svg>
          </div>
        </div>

        <div className="mt-4 space-y-1.5">
          <span className="block h-1 w-3/4 rounded-full bg-[#3a2a10]/10" />
          <span className="block h-1 w-1/2 rounded-full bg-[#3a2a10]/10" />
        </div>

        <HazEscaneo intenso />
      </div>

      {/* Lo que el análisis va sacando de la hoja */}
      {DATOS.map((dato, i) => (
        <div
          key={dato.etiqueta}
          style={{ animationDelay: `${i * 0.7}s` }}
          className={`demo-dato absolute left-52 ${dato.posicion} flex items-center gap-2`}
        >
          <span className="h-px w-6 bg-white/40" />
          <div className="rounded-lg bg-white px-3 py-1.5 text-ink">
            <p className="text-[10px] uppercase tracking-[0.06em] text-label">{dato.etiqueta}</p>
            <p className="cifra text-[13px] font-medium">{dato.valor}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
