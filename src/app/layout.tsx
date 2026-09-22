import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gestor de Facturas",
  description:
    "Sube una factura, un recibo o un contrato, corrige lo que el modelo leyó mal y pregúntale a tu archivo.",
};

// Se ejecuta antes de pintar: sin esto, el tema guardado llegaría tarde y la
// pantalla daría un fogonazo claro antes de oscurecerse.
const TEMA_INICIAL = `try{var t=localStorage.getItem("tema");document.documentElement.dataset.theme=t||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className="h-full antialiased"
      // El script de abajo fija data-theme antes de hidratar; el mismatch es
      // esperado y no afecta al resultado, solo hay que decírselo a React.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA_INICIAL }} />
      </head>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
