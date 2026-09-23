import BotonGoogle from "./boton-google";
import PanelMarketing from "./panel-marketing";

export default async function LoginPage(props: PageProps<"/login">) {
  const { error } = await props.searchParams;

  return (
    <div className="flex h-dvh bg-app">
      <PanelMarketing />

      <div className="flex flex-1 flex-col px-6 py-8">
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <span className="font-marca text-[17px] font-semibold tracking-[-0.01em]">
                Gestor de Facturas
              </span>
              <p className="mt-2 text-[13px] leading-relaxed text-label">
                Sube la factura. Del resto nos encargamos.
              </p>
            </div>

            {/* Sin sombra ni insignia flotante: una tarjeta plana. */}
            <div className="rounded-2xl bg-surface p-8">
              <h2 className="mt-3 text-[28px] font-semibold leading-[1.15] tracking-[-0.02em]">
                Tu próxima factura,{" "}
                <span className="relative inline-block whitespace-nowrap">
                  archivada sola
                  {/* Subrayado de rotulador, el mismo trazo imperfecto del rodeo de la izquierda. */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 200 12"
                    preserveAspectRatio="none"
                    className="absolute -bottom-1.5 left-0 h-2.5 w-full"
                    fill="none"
                  >
                    <path
                      d="M3 8 C 40 3, 90 2, 130 5 S 185 9, 197 4"
                      stroke="#d9861c"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                .
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-label">
                Sube cualquier documento y mira cómo salen solos el emisor, las fechas y los
                importes. Tú solo revisas y confirmas.
              </p>

              <ol className="mt-6 flex flex-col gap-2.5">
                {[
                  "Entra con tu cuenta de Google",
                  "Sube una factura, un recibo o lo que tengas a mano",
                  "Revisa lo que encontramos y archívalo",
                ].map((paso, i) => (
                  <li key={paso} className="flex items-center gap-3 text-[13px] text-ink-soft">
                    <span className="cifra flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[12px] font-medium text-accent-strong">
                      {i + 1}
                    </span>
                    {paso}
                  </li>
                ))}
              </ol>

              {error && (
                <p className="mt-5 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
                  No se pudo iniciar sesión. Inténtalo de nuevo.
                </p>
              )}

              <div className="mt-6">
                <BotonGoogle />
              </div>

              <p className="mt-6 border-t border-line pt-5 text-[12px] leading-relaxed text-label">
                <span className="font-medium text-ink-soft">¿Qué esperas para probarlo?</span>{" "}
                Deja de buscar facturas entre carpetas y correos: tenlas todas en un solo sitio y
                sabe siempre en qué se va tu dinero.
              </p>
            </div>
          </div>
        </div>

        <p className="cifra text-center text-[11px] text-label/70">© 2026 Gestor de Facturas</p>
      </div>
    </div>
  );
}
