/**
 * Ilustración propia (dos documentos superpuestos + insignia de "listo") en
 * vez de una foto de stock: no hay ningún activo de imagen en el proyecto, y
 * esto sigue el mismo lenguaje de trazo blanco translúcido que los blobs de
 * `panel-marketing.tsx`.
 */
export default function Ilustracion() {
  return (
    <svg
      viewBox="0 0 220 170"
      className="h-auto w-full max-w-[15rem]"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="18"
        y="20"
        width="112"
        height="140"
        rx="12"
        transform="rotate(-7 74 90)"
        fill="white"
        fillOpacity="0.08"
        stroke="white"
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />

      <rect
        x="58"
        y="8"
        width="116"
        height="144"
        rx="12"
        fill="white"
        fillOpacity="0.14"
        stroke="white"
        strokeOpacity="0.4"
        strokeWidth="1.5"
      />

      <line x1="78" y1="38" x2="150" y2="38" stroke="white" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" />
      <line x1="78" y1="54" x2="130" y2="54" stroke="white" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />
      <line x1="78" y1="66" x2="140" y2="66" stroke="white" strokeOpacity="0.3" strokeWidth="2" strokeLinecap="round" />
      <line x1="78" y1="94" x2="118" y2="94" stroke="white" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
      <line x1="78" y1="106" x2="134" y2="106" stroke="white" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />
      <line x1="78" y1="118" x2="112" y2="118" stroke="white" strokeOpacity="0.25" strokeWidth="2" strokeLinecap="round" />

      <circle cx="178" cy="134" r="26" fill="white" fillOpacity="0.95" />
      <path
        d="M167 134l7.5 7.5L191 124"
        stroke="var(--accent-strong)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
