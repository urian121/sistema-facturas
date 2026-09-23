import { pool } from "@/lib/db";

export const TABLAS_PERMITIDAS = [
  "registros",
  "registro_lineas",
  "registro_contratos",
  "documents",
] as const;

const PROHIBIDO =
  /\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|copy|vacuum|call|do|merge|set|reset|listen|notify|lock|refresh|reindex|comment|security|begin|commit|rollback)\b/i;

const FUNCIONES_PROHIBIDAS = /\b(pg_sleep|pg_read_file|pg_ls_dir|lo_import|lo_export|dblink|pg_terminate_backend)\b/i;

export type Veredicto = { ok: true; sql: string } | { ok: false; motivo: string };

/**
 * Acepta una única sentencia SELECT sobre las tablas del dominio. La comprobación
 * es de cinturón y tirantes: la ejecución va además en una transacción de sólo
 * lectura, que es lo que realmente impide escribir.
 */
export function revisarConsulta(sqlCrudo: string): Veredicto {
  const sql = sqlCrudo.trim().replace(/;\s*$/, "").trim();

  if (sql === "") return { ok: false, motivo: "La consulta está vacía" };

  // Los comentarios se miran antes: pueden esconder cualquier otra cosa.
  if (sql.includes("--") || sql.includes("/*")) {
    return { ok: false, motivo: "La consulta no puede llevar comentarios" };
  }

  if (sql.includes(";")) {
    return { ok: false, motivo: "Sólo se permite una sentencia" };
  }

  if (!/^(select|with)\b/i.test(sql)) {
    return { ok: false, motivo: "Sólo se permiten consultas SELECT" };
  }

  if (PROHIBIDO.test(sql)) {
    return { ok: false, motivo: "La consulta intenta modificar datos" };
  }

  if (FUNCIONES_PROHIBIDAS.test(sql) || /\bpg_catalog\b|\binformation_schema\b/i.test(sql)) {
    return { ok: false, motivo: "La consulta accede a objetos del sistema" };
  }

  // Las CTE declaradas en la propia consulta cuentan como nombres válidos.
  const cte = [...sql.matchAll(/(?:with|,)\s+([a-z_][a-z0-9_]*)\s+as\s*\(/gi)].map((m) =>
    m[1].toLowerCase(),
  );
  const permitidas = [...(TABLAS_PERMITIDAS as readonly string[]), ...cte];

  // Toda tabla mencionada tras FROM/JOIN debe ser del dominio.
  const referencias = [...sql.matchAll(/\b(?:from|join)\s+([a-z_][a-z0-9_."]*)/gi)].map((m) =>
    m[1].replace(/"/g, "").split(".").pop()!.toLowerCase(),
  );
  const fuera = referencias.filter((t) => !permitidas.includes(t));
  if (fuera.length > 0) {
    return { ok: false, motivo: `Tabla no permitida: ${fuera[0]}` };
  }

  return { ok: true, sql };
}

export type Resultado = {
  columnas: string[];
  filas: Record<string, unknown>[];
};

const MAX_FILAS = 100;

/**
 * Vistas temporales que tapan las tablas reales con la versión ya filtrada
 * por dueño: el SQL que arma el modelo las referencia por su nombre normal
 * (`documents`, `registros`, ...) sin saber que existen, así que no hace
 * falta confiar en que él mismo acuerde filtrar por usuario — ni siquiera
 * puede evitarlo. `current_setting` (no un literal) porque el valor no se
 * puede parametrizar dentro de un `CREATE VIEW`; son vistas de sesión
 * (`pg_temp`), y la transacción siempre se deshace, así que no sobreviven
 * para la siguiente vez que el pool reutilice esta conexión.
 */
const PROPIO_Y_ACTIVO = `d.usuario_email = current_setting('app.usuario_email', true)
      AND d.eliminado_at IS NULL`;

const VISTAS_POR_USUARIO = [
  `CREATE TEMP VIEW documents AS
     SELECT d.* FROM public.documents d
      WHERE ${PROPIO_Y_ACTIVO}`,
  `CREATE TEMP VIEW registros AS
     SELECT r.* FROM public.registros r
     JOIN public.documents d ON d.id = r.document_id
    WHERE ${PROPIO_Y_ACTIVO}`,
  `CREATE TEMP VIEW registro_lineas AS
     SELECT rl.* FROM public.registro_lineas rl
     JOIN public.registros r ON r.id = rl.registro_id
     JOIN public.documents d ON d.id = r.document_id
    WHERE ${PROPIO_Y_ACTIVO}`,
  `CREATE TEMP VIEW registro_contratos AS
     SELECT rc.* FROM public.registro_contratos rc
     JOIN public.registros r ON r.id = rc.registro_id
     JOIN public.documents d ON d.id = r.document_id
    WHERE ${PROPIO_Y_ACTIVO}`,
];

/**
 * Ejecuta la consulta en una transacción de sólo lectura y con tiempo límite,
 * de modo que ni un SELECT malicioso pueda escribir ni bloquear la base; las
 * vistas temporales de arriba hacen que, además, sólo vea lo del usuario dado.
 */
export async function ejecutarConsulta(sql: string, usuarioEmail: string): Promise<Resultado> {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN READ ONLY");
    await cliente.query("SET LOCAL statement_timeout = '5s'");
    await cliente.query("SELECT set_config('app.usuario_email', $1, true)", [usuarioEmail]);
    for (const vista of VISTAS_POR_USUARIO) await cliente.query(vista);

    const { rows, fields } = await cliente.query(`SELECT * FROM (${sql}) AS consulta LIMIT ${MAX_FILAS}`);

    return {
      columnas: fields.map((f) => f.name),
      filas: rows as Record<string, unknown>[],
    };
  } finally {
    // Siempre se deshace: la transacción es de lectura, no hay nada que conservar.
    await cliente.query("ROLLBACK").catch(() => {});
    cliente.release();
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Recoge los ids de documento que aparezcan en el resultado, para poder citarlos. */
export function documentosCitados(filas: Record<string, unknown>[]): string[] {
  const ids = new Set<string>();

  for (const fila of filas) {
    for (const valor of Object.values(fila)) {
      if (typeof valor === "string" && UUID.test(valor)) ids.add(valor);
      if (Array.isArray(valor)) {
        for (const item of valor) {
          if (typeof item === "string" && UUID.test(item)) ids.add(item);
        }
      }
    }
  }

  return [...ids];
}
