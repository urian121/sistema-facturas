import { auth } from "@/lib/auth";
import { pool } from "@/lib/db";
import { MAX_MB, TIPOS_PERMITIDOS } from "@/lib/limites-subida";
import { listarRegistros, type Registro } from "@/lib/registros";
import { cerrarSesion } from "./acciones-sesion";
import Uploader, { type Doc } from "./uploader";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  const usuarioEmail = session?.user?.email ?? null;

  let docs: Doc[] = [];
  let registros: Registro[] = [];
  let dbError: string | null = null;

  // El proxy ya exige sesión para llegar aquí; sin email no hay nada propio que listar.
  if (usuarioEmail) {
    try {
      const { rows } = await pool.query(
        `SELECT id, filename, mime_type, size_bytes, created_at, doc_type, extraction
           FROM documents
          WHERE usuario_email = $1
            AND eliminado_at IS NULL
          ORDER BY created_at DESC
          LIMIT 50`,
        [usuarioEmail],
      );
      docs = rows as Doc[];
      registros = await listarRegistros(usuarioEmail);
    } catch {
      dbError =
        "No hay conexión con PostgreSQL. Revisa que esté en marcha y que DATABASE_URL sea correcta.";
    }
  }

  return (
    <Uploader
      initialDocs={docs}
      initialRegistros={registros}
      dbError={dbError}
      usuario={session?.user ?? null}
      onCerrarSesion={cerrarSesion}
      tiposPermitidos={TIPOS_PERMITIDOS}
      maxMB={MAX_MB}
    />
  );
}
