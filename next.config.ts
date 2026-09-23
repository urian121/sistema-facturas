import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfjs-dist lee el texto de los PDF en el servidor (src/lib/pdf-texto.ts) y
  // carga su worker con un import dinámico que el empaquetado de Next rompería:
  // se deja fuera del bundle y se carga con el `require` normal de Node.
  serverExternalPackages: ["pdfjs-dist"],
};

export default nextConfig;
