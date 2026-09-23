import BotonGoogle from "./boton-google";
import PanelMarketing from "./panel-marketing";
import { IconoDestello } from "../iconos";

export default async function LoginPage(props: PageProps<"/login">) {
  const { error } = await props.searchParams;

  return (
    <div className="flex h-dvh bg-app">
      <PanelMarketing />

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
        {/* Ecos del dorado del panel izquierdo, para que el lado derecho no se sienta un formulario suelto. */}
        <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />

        <div className="relative w-full max-w-sm">
          <div className="mb-8 text-center lg:hidden">
            <span className="font-marca text-[17px] font-semibold tracking-[-0.01em]">
              Gestor de Facturas
            </span>
            <p className="mt-2 text-[13px] leading-relaxed text-label">
              Sube facturas, recibos o contratos y deja que la IA extraiga los datos por ti.
            </p>
          </div>

          <div className="relative rounded-2xl border border-line bg-surface p-8 pt-11 shadow-[0_24px_64px_-20px_rgba(107,74,18,0.3)]">
            <div className="absolute -top-7 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-2xl bg-accent text-on-accent shadow-[0_8px_20px_-4px_rgba(107,74,18,0.45)]">
              <IconoDestello className="h-6 w-6" />
            </div>

            <div className="text-center">
              <h2 className="text-[18px] font-semibold tracking-[-0.01em]">Bienvenido de vuelta</h2>
              <p className="mt-1.5 text-[13px] text-label">Inicia sesión para continuar</p>
            </div>

            {error && (
              <p className="mt-5 rounded-md bg-danger-soft px-3 py-2 text-center text-[12px] text-danger">
                No se pudo iniciar sesión. Probá de nuevo.
              </p>
            )}

            <div className="mt-6">
              <BotonGoogle />
            </div>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-label">
              Al continuar aceptas que tus documentos se procesen con IA para extraer sus datos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
