import DemoAnalisis from "./demo-analisis";

/**
 * Panel de marca del login, solo en escritorio. En vez de una lista de
 * ventajas con iconos, enseña el producto funcionando: una factura de
 * muestra que se analiza en bucle (`DemoAnalisis`). Fondo liso, sin manchas
 * difuminadas: el protagonismo es de la hoja.
 */
export default function PanelMarketing() {
  return (
    <div className="relative hidden overflow-hidden bg-[#2e2008] px-12 py-12 text-white lg:flex lg:w-[46%] lg:flex-col lg:justify-between">
      <span className="font-marca text-[15px] font-semibold tracking-[-0.01em] text-white/90">
        Gestor de Facturas
      </span>

      <div>
        <h1 className="max-w-md text-[30px] font-semibold leading-[1.15] tracking-[-0.02em]">
          Sube la factura.
          <br />
          <span className="text-accent">Del resto nos encargamos.</span>
        </h1>
        <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-white/70">
          Leemos el documento, sacamos los datos que importan y te los dejamos listos para
          revisar. Tú solo confirmas.
        </p>

        <div className="mt-10">
          <DemoAnalisis />
        </div>
        <p className="mt-2 text-[12px] text-white/45">
          Así se ve un análisis. Suele tardar unos 10 segundos.
        </p>
      </div>

      <p className="text-[12px] text-white/45">
        Facturas, recibos, contratos y cualquier otro documento · PDF, imagen, Word, Excel o
        PowerPoint
      </p>
    </div>
  );
}
