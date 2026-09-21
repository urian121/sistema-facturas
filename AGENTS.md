<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Gestor de Facturas

App de gestión documental (facturas, recibos, contratos) en Next.js 16 + React 19 +
TypeScript, con PostgreSQL/pgvector como base de datos y OpenAI como proveedor de
modelo de visión y embeddings. La descripción completa del producto y su
arquitectura está en `README.md` — léelo antes de tocar `src/lib/planificador.ts`,
`src/lib/sql-seguro.ts` o los esquemas de `src/lib/schemas/`.

### Comandos

- `npm install`
- `npm run migrate` — aplica `db/init/*.sql` contra `DATABASE_URL` (idempotente, se
  puede repetir sin miedo)
- `npm run dev` — servidor de desarrollo en `http://localhost:3000`
- `npm test` — vitest, una pasada (`npm run test:watch` para modo watch)
- `npm run lint`
- `npm run build`

Antes de dar por terminado un cambio, `npm test` y `npm run build` deben pasar sin
errores. Cada push a `master` despliega a producción (ver "Despliegue" en
`README.md`), así que esa rama tiene que quedar siempre en verde.

### Convenciones

- Identificadores, comentarios y toda la interfaz están en **español**; no lo rompas
  metiendo nombres en inglés salvo términos técnicos sin traducción natural.
- Validación en dos capas: `src/lib/schemas/tipos.ts` (un esquema Zod estricto por
  tipo de documento) y `src/lib/schemas/base.ts` (reglas que cruzan campos —cuadre de
  importes, orden de fechas—, evaluadas aparte porque Zod corta los `refinement` en
  cuanto falla un campo). No dupliques esas reglas en los componentes.
- Todo lo que habla con OpenAI vive en `src/lib/openai.ts` (URLs, cabeceras, clave,
  modelo por defecto). El proyecto usa la API de OpenAI directamente, sin OpenRouter
  ni Docker para la base local — se retiraron a propósito; no los reintroduzcas.
- El SQL que genera el modelo para el chat pasa siempre por
  `src/lib/sql-seguro.ts` antes de ejecutarse (regex de verbos prohibidos +
  transacción `READ ONLY` + `statement_timeout` + `LIMIT`: defensa en profundidad, no
  un único punto de fallo). Cualquier cambio ahí necesita tests nuevos en
  `tests/sql-seguro.test.ts`.
- `.env.local` no está commiteado; usa `.env.local-example` como plantilla y no le
  añadas valores reales.

### Tests

Los tests mockean `pool` (`vi.mock("@/lib/db", ...)`) y `fetch`
(`vi.stubGlobal("fetch", ...)`) — nunca pegan a Postgres ni a OpenAI de verdad. Si
tocas una ruta de `src/app/api/` o `src/lib/openai.ts`, revisa que los mocks en
`tests/` sigan encajando con la forma real de la petición/respuesta.
