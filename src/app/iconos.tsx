/**
 * Sistema de iconos propio: un solo trazo (1.5), un solo tamaño base, sin relleno.
 * Todos comparten viewBox y extremos redondeados para que lean como una familia.
 */
type Props = { className?: string };

const base = "h-4 w-4 shrink-0";

function Svg({ className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`${base} ${className ?? ""}`}
    >
      {children}
    </svg>
  );
}

export const IconoDocumento = (p: Props) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
);

export const IconoArchivo = (p: Props) => (
  <Svg {...p}>
    <path d="M3 7h18v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M3 7l1.5-3h15L21 7" />
    <path d="M10 12h4" />
  </Svg>
);

export const IconoSubir = (p: Props) => (
  <Svg {...p}>
    <path d="M12 16V4" />
    <path d="m7 9 5-5 5 5" />
    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
  </Svg>
);

export const IconoAviso = (p: Props) => (
  <Svg {...p}>
    <path d="M12 8v5" />
    <path d="M12 16.5h.01" />
    <path d="M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </Svg>
);

export const IconoConforme = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.2 2.4 2.4 4.6-5" />
  </Svg>
);

export const IconoPregunta = (p: Props) => (
  <Svg {...p}>
    <path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-7.5A8 8 0 0 1 11 4h2a8 8 0 0 1 8 8z" />
  </Svg>
);

export const IconoEnviar = (p: Props) => (
  <Svg {...p}>
    <path d="M5 12h13" />
    <path d="m12 5 7 7-7 7" />
  </Svg>
);

export const IconoQuitar = (p: Props) => (
  <Svg {...p}>
    <path d="M6 6l12 12" />
    <path d="M18 6 6 18" />
  </Svg>
);

export const IconoMas = (p: Props) => (
  <Svg {...p}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </Svg>
);

export const IconoRecargar = (p: Props) => (
  <Svg {...p}>
    <path d="M20 11a8 8 0 1 0-2.3 6.3" />
    <path d="M20 5v6h-6" />
  </Svg>
);

export const IconoChevron = (p: Props) => (
  <Svg {...p}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconoSol = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);

export const IconoLuna = (p: Props) => (
  <Svg {...p}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </Svg>
);

export const IconoPerfil = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
  </Svg>
);

export const IconoLista = (p: Props) => (
  <Svg {...p}>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3 6h.01M3 12h.01M3 18h.01" />
  </Svg>
);

export const IconoCuadricula = (p: Props) => (
  <Svg {...p}>
    <rect x="3" y="3" width="8" height="8" rx="1.5" />
    <rect x="13" y="3" width="8" height="8" rx="1.5" />
    <rect x="3" y="13" width="8" height="8" rx="1.5" />
    <rect x="13" y="13" width="8" height="8" rx="1.5" />
  </Svg>
);

/** Destello: analizar / lectura automática. */
export const IconoDestello = (p: Props) => (
  <Svg {...p}>
    <path d="M12 2 13.5 9.5 21 11 13.5 12.5 12 20 10.5 12.5 3 11 10.5 9.5Z" />
  </Svg>
);

export const IconoAjustes = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </Svg>
);

export const IconoBuscar = (p: Props) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="m20 20-4.35-4.35" />
  </Svg>
);

/** Columnas: cuadrícula más densa (4 por fila) que IconoCuadricula. */
export const IconoColumnas = (p: Props) => (
  <Svg {...p}>
    <rect x="2" y="4" width="3.2" height="16" rx="1" />
    <rect x="7.6" y="4" width="3.2" height="16" rx="1" />
    <rect x="13.2" y="4" width="3.2" height="16" rx="1" />
    <rect x="18.8" y="4" width="3.2" height="16" rx="1" />
  </Svg>
);

export const IconoInicio = (p: Props) => (
  <Svg {...p}>
    <path d="M4 11.5 12 4l8 7.5" />
    <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
    <path d="M10 20v-5h4v5" />
  </Svg>
);

export const IconoPapelera = (p: Props) => (
  <Svg {...p}>
    <path d="M4 7h16" />
    <path d="M9 7V4.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V7" />
    <path d="M6 7l1 12.5a1.5 1.5 0 0 0 1.5 1.5h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
    <path d="M10 11v6M14 11v6" />
  </Svg>
);
