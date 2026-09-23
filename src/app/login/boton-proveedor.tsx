import type { ReactNode } from "react";

/** Botón "Continuar con X" — mismo lenguaje visual que el resto de botones secundarios de la app. */
export default function BotonProveedor({
  icono,
  etiqueta,
  type = "submit",
  disabled = false,
  onClick,
}: {
  icono: ReactNode;
  etiqueta: string;
  type?: "submit" | "button";
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-full border border-line bg-surface py-2.5 text-[13px] font-medium text-ink transition hover:border-line-strong hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-60"
    >
      {icono}
      {etiqueta}
    </button>
  );
}
