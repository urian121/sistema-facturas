# Gestor de Facturas

Sistema de gestión documental: subes una factura, un recibo o un contrato (imagen o
PDF, incluso escaneado) y un modelo de visión lo lee, lo clasifica y extrae sus
datos. Revisas y corriges lo que haga falta en un formulario con validación propia
de cada tipo de documento (Zod), con el documento a la vista a un lado y el
formulario al otro. Al confirmar, los datos pasan a tablas de PostgreSQL y el texto
del documento se indexa como embeddings en **pgvector**. Un chat responde preguntas
sobre lo archivado citando siempre el documento de origen: con SQL cuando la
pregunta es de cálculo, con búsqueda semántica cuando va del contenido.

## Requisitos

- Node.js 20+
- PostgreSQL 16+ con la extensión `pgvector` instalada
- Una clave de OpenAI (`OPENAI_API_KEY`)

## Puesta en marcha

```bash
cp .env.local-example .env.local   # completa DATABASE_URL y OPENAI_API_KEY
npm install
npm run migrate                    # aplica db/init/*.sql contra DATABASE_URL
npm run dev                        # http://localhost:3000
```

El esquema (`db/init/*.sql`) es idempotente, así que `npm run migrate` se puede
volver a ejecutar sin romper nada.

## Estructura

| Ruta | Descripción |
| --- | --- |
| `src/app/page.tsx` | Única página: subida, vista previa y datos |
| `src/app/datos-form.tsx` | Formulario editable con los campos inválidos en rojo |
| `src/app/chat.tsx` | Chat con citas clicables que abren el documento citado |
| `src/app/api/upload` | `POST` recibe el archivo y lo guarda en `documents` |
| `src/lib/limites-subida.ts` | Tipos y peso máximo permitidos al subir, configurables por `.env.local` |
| `src/app/api/extract` | `POST {id}` envía el archivo al modelo de visión y guarda el JSON |
| `src/app/api/documents/[id]` | `PATCH` guarda el borrador con las correcciones |
| `src/app/api/confirm` | `POST {id}` valida, escribe en las tablas e indexa el texto |
| `src/app/api/registros` | `GET` lista de documentos confirmados |
| `src/app/api/chat` | `POST {pregunta, historial}` busca por similitud y responde citando |
| `src/lib/busqueda.ts` | Consulta de vecinos más próximos y armado del contexto |
| `src/lib/planificador.ts` | Decide SQL o embeddings y escribe la consulta |
| `src/lib/sql-seguro.ts` | Revisa y ejecuta el SQL generado en modo sólo lectura |
| `src/lib/embeddings.ts` | Troceado del texto y llamada a la API de embeddings |
| `src/lib/oficina.ts` | Extrae texto de Word/Excel/PowerPoint (sin IA, ya está en el archivo) |
| `src/lib/schemas/` | Esquemas Zod: forma laxa para el modelo y reglas por tipo |
| `src/app/api/documents` | `GET` lista los últimos 50 archivos |
| `src/app/api/files/[id]` | `GET` devuelve el binario para la vista previa |
| `src/app/api/preview/[id]` | `GET` datos reales para la miniatura de Office (tabla o texto) |
| `src/app/pdf-miniatura.tsx` | Miniatura de PDF con `pdfjs-dist`, renderizada en el navegador |
| `src/lib/db.ts` | Pool de `pg` reutilizado entre recargas en desarrollo |
| `src/lib/auth.ts` | Configuración de Auth.js: proveedores, sesión JWT, auditoría de logins |
| `src/app/login/` | Página de login y sus piezas (botones, acciones, iconos de marca) |
| `src/proxy.ts` | Corre antes de cada ruta: sin sesión, redirige a `/login` |

Tipos de archivo y peso máximo al subir, en `.env.local` (opcionales, con
defaults si no se definen):

| Variable | Por defecto |
| --- | --- |
| `UPLOAD_MAX_MB` | `20` |
| `UPLOAD_TIPOS_PERMITIDOS` | Imágenes (png/jpeg/webp/gif), PDF, Word, Excel, PowerPoint |

Se leen una sola vez en `src/lib/limites-subida.ts` y de ahí bajan como props
hasta `SubirModal` — nada de `NEXT_PUBLIC_`, porque el navegador nunca lee la
variable de entorno directamente.

## Login

Login solo con Google (por ahora) vía [Auth.js](https://authjs.dev/) — nada de
usuario/contraseña propios ni tabla `users` nueva: la sesión se guarda firmada
en una cookie (JWT), no en la base de datos. Cada documento queda además
asociado al email de quien lo sube (`documents.usuario_email`): un usuario
jamás ve los archivos de otro, ni siquiera a través del chat con SQL libre
(`src/lib/sql-seguro.ts` filtra por dueño con vistas temporales antes de dejar
correr la consulta que arma el modelo).

| Variable | Para qué |
| --- | --- |
| `AUTH_SECRET` | Firma la cookie de sesión |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Credenciales OAuth de la app en Google Cloud |

### Cómo conseguir cada una

**`AUTH_SECRET`** — una cadena aleatoria, no depende de ningún servicio externo.
En una terminal con `openssl` (Linux/Mac/Git Bash en Windows):

```bash
openssl rand -base64 32
```

Sin `openssl` a mano, el mismo resultado con Node (ya viene con el proyecto):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Pegar el resultado tal cual en `AUTH_SECRET=` de `.env.local`.

**`AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET`** — se sacan de una app OAuth propia en
Google Cloud, no de la cuenta de Google Firebase ni de ningún "API key" suelto:

1. Entrar a la [consola de credenciales de Google Cloud](https://console.cloud.google.com/apis/credentials).
2. Si no hay un proyecto todavía: selector de proyecto (arriba a la izquierda) →
   **"Nuevo proyecto"** → ponerle un nombre (p. ej. "Gestor de Facturas") → crear.
3. **"Configurar pantalla de consentimiento"** (OAuth consent screen) — Google lo
   pide antes de dejar crear la credencial:
   - Tipo de usuario: **External** (si es una cuenta de Google personal, no de
     Google Workspace).
   - Nombre de la app, email de soporte, email de contacto del desarrollador:
     con los datos propios alcanza para desarrollo/uso personal.
4. Volver a **Credentials** → **"+ Crear credenciales"** → **"ID de cliente de
   OAuth"**.
5. Tipo de aplicación: **"Aplicación web"**.
6. En **"URI de redirección autorizados"** agregar exactamente:

   ```text
   http://localhost:3000/api/auth/callback/google
   ```

   y, en producción, la misma ruta con el dominio real:
   `https://tu-dominio.com/api/auth/callback/google`.
7. Guardar. Google muestra un **Client ID** y un **Client Secret** — van en
   `AUTH_GOOGLE_ID` y `AUTH_GOOGLE_SECRET` de `.env.local` respectivamente.

Referencia oficial de esta pantalla:
[Google Identity — OAuth 2.0 para aplicaciones web](https://developers.google.com/identity/protocols/oauth2/web-server),
y del lado de Auth.js: [proveedor de Google](https://authjs.dev/getting-started/providers/google).

`src/proxy.ts` (el `middleware.ts` de versiones anteriores de Next.js, renombrado
en la 16) corre antes de cualquier ruta: sin sesión válida redirige a `/login`, o
devuelve 401 si la ruta es de `/api`.

### Auditoría de accesos

Cada login (no cada usuario: cada vez que alguien entra) queda registrado en
`auditoria_login` — email, nombre, cuándo entró y, si cierra sesión con el
botón de la app, cuándo salió. Se llena sola desde los `callbacks`/`events` de
Auth.js en `src/lib/auth.ts`, no hace falta tocar nada para que funcione.

| Columna | Contenido |
| --- | --- |
| `usuario_email` / `usuario_nombre` | Los que trae la cuenta de Google |
| `iniciado_at` | Cuándo se logueó |
| `finalizado_at` | Cuándo cerró sesión — `NULL` si simplemente cerró la pestaña (la cookie expira sola, eso no queda registrado) |

No hay pantalla propia todavía: para ver quién entra y con qué frecuencia, una
consulta directa alcanza, por ejemplo los usuarios más activos del último mes:

```sql
SELECT usuario_email, count(*) AS logins, max(iniciado_at) AS ultimo_login
  FROM auditoria_login
 WHERE iniciado_at > now() - interval '30 days'
 GROUP BY usuario_email
 ORDER BY logins DESC;
```

## Extracción

`POST /api/extract` manda el archivo a **OpenAI** y fuerza la respuesta contra el
esquema de `src/lib/extraction-schema.ts` (structured outputs, `strict: true`); el
resultado se valida otra vez con Zod antes de guardarlo.

| Variable | Por defecto | Para qué |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | Obligatoria |
| `OPENAI_MODEL` | `gpt-5.6-luna` | Modelo de visión |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Debe dar 1536 dimensiones, las de la columna `vector(1536)` |

Las imágenes viajan como `image_url` en base64; los PDFs como parte `file` con el
archivo embebido en base64 (`file_data`), que OpenAI procesa de forma nativa,
incluidos los escaneados.

Word, Excel y PowerPoint (`.docx`, `.xlsx`, `.pptx`) van por un camino distinto:
OpenAI no los lee nativamente, así que `src/lib/oficina.ts` extrae el texto en el
servidor (`mammoth` para Word, `exceljs` para Excel, parseo del XML interno con
`jszip` para PowerPoint) y ese texto —truncado a ~12&nbsp;000 caracteres— se manda
como un mensaje de solo texto. El resto del flujo (esquema, validación, guardado)
no cambia. El panel de documento no tiene forma de mostrarlos (no son ni imagen ni
PDF), así que ofrece un enlace para abrirlos en pestaña nueva.

### Miniaturas del historial

Las tarjetas del historial (`src/app/historial-documentos.tsx`) sí muestran algo
real del contenido, no solo un ícono:

- **PDF**: la página 1 renderizada de verdad, con `pdfjs-dist` corriendo en el
  navegador (`src/app/pdf-miniatura.tsx`) — sin ningún conversor en el servidor.
  Solo se descarga y renderiza cuando la tarjeta entra en pantalla.
- **Excel**: una mini tabla con las primeras filas/columnas reales de la primera
  hoja. **Word y PowerPoint**: un fragmento del texto real. Ambos salen de
  `GET /api/preview/{id}`, que reusa `src/lib/oficina.ts` con versiones más
  cortas de la extracción (`previsualizarXlsx`, `previsualizarDocx`,
  `previsualizarPptx`) — no es una foto de la página, pero es contenido real del
  archivo, no un decorado.

Campos extraídos: tipo de documento y confianza, emisor y receptor (nombre, NIF/CIF,
dirección), número, fechas, moneda, subtotal/impuestos/total, método de pago, líneas
de detalle y, para contratos, objeto, vigencia, importe, ley aplicable y cláusulas
destacadas. Lo que no aparece en el documento vuelve como `null`, y las dudas quedan
listadas en `notas`.

## Validación

`src/lib/schemas/tipos.ts` define un esquema Zod por tipo de documento; cada uno
decide qué es obligatorio:

| | Factura | Recibo | Contrato | Otro |
| --- | --- | --- | --- | --- |
| Emisor (nombre) | ✓ | ✓ | ✓ | — |
| Receptor (nombre) | ✓ | — | ✓ | — |
| Número | ✓ | — | — | — |
| Fecha de emisión | ✓ | ✓ | — | — |
| Moneda y total | ✓ | ✓ | — | — |
| Base y impuestos | ✓ | — | — | — |
| Al menos una línea | ✓ | — | — | — |
| Objeto e inicio de vigencia | — | — | ✓ | — |

Además se comprueban las reglas que cruzan campos:

- **Fechas**: formato `AAAA-MM-DD` y que la fecha exista (`2026-02-31` se rechaza).
- **Orden**: el vencimiento no puede preceder a la emisión, ni el fin de vigencia al inicio.
- **Aritmética**: `subtotal + impuestos = total`, con dos céntimos de tolerancia por
  redondeo; el mensaje dice la cuenta que sí sale.

Estas reglas cruzadas se evalúan aparte del `safeParse` porque Zod se salta sus
refinements en cuanto falla un campo, y en el formulario interesa ver todos los
problemas a la vez.

Nada de esto bloquea el guardado: un documento con problemas se guarda igual, con
los campos marcados en rojo, porque suelen ser correcciones en curso.

## Despliegue

Hace falta un hosting Node.js y un PostgreSQL 16+ con la extensión `pgvector`
(gestionado o propio):

- **Build:** `npm ci --include=dev && npm run build`. El `--include=dev` es
  obligatorio: con `NODE_ENV=production`, `npm ci` se saltaría Tailwind y PostCSS,
  que hacen falta para compilar.
- **Arranque:** `node scripts/migrate.mjs && npx next start`. El script aplica
  `db/init/*.sql` (todo idempotente) y deja escrito en el log qué versión de pgvector
  encontró; en local es el mismo script (`npm run migrate`) el que hace ese trabajo.
- **Variables:** `DATABASE_URL` apunta a la base de datos; `OPENAI_API_KEY` va como
  secreto; si el Postgres gestionado exige TLS, `DATABASE_SSL=on` lo fuerza (ver
  `src/lib/db.ts`).

Sea cual sea el mecanismo de despliegue, conviene que `npm test` y `npm run build`
pasen antes de empujar a la rama que sirve producción.

## Tests

```bash
npm test          # una pasada
npm run test:watch
```

`tests/` cubre los esquemas (cada tipo, fechas, cuadre, mensajes) y las tres rutas de
API con la base de datos y el modelo simulados: subida correcta de PDF, imagen y
Office (Word/Excel/PowerPoint), tipo no permitido, archivo ausente, exceso de 20 MB,
extracción completa, extracción incompleta (se guarda y devuelve los campos que
fallan), respuesta del modelo que no es JSON, que no cumple el esquema, que llega
vacía (se reintenta) o que se corta por longitud, 401 de OpenAI, documento
inexistente, guardado de correcciones, troceado y embeddings, la extracción de texto
de Office (`tests/oficina.test.ts`, con archivos generados en el propio test) y su
error si el archivo no se puede leer, y la confirmación completa: transacción con
cabecera, líneas,
detalle de contrato y chunks, rechazo si hay campos inválidos, y ROLLBACK si algo
falla a mitad. El chat tiene los suyos: respuesta con cita, fragmentos numerados en el
prompt, fuentes filtradas a las citadas, umbral de similitud, base vacía, historial
recortado y saneado, y los errores del proveedor. El enrutado a SQL tiene los suyos:
consulta ejecutada y citada, transacción de sólo lectura con timeout, rechazo de
INSERT/UPDATE/DELETE/DROP/TRUNCATE, de sentencias encadenadas, de comentarios, del
catálogo del sistema y de tablas ajenas, y la caída a búsqueda semántica cuando la
consulta se rechaza o falla.

## Confirmar: de borrador a tablas

Mientras se revisa, la extracción vive como jsonb en `documents.extraction`; es un
borrador y se guarda tenga los problemas que tenga. **Confirmar y guardar** exige que
la validación esté limpia y entonces, en una única transacción:

1. escribe la cabecera en `registros` y el detalle en `registro_lineas` /
   `registro_contratos`;
2. trocea el texto del documento (~800 caracteres con solape) y guarda cada fragmento
   con su vector en `documento_chunks`.

Los embeddings se piden antes de abrir la transacción, para no dejarla esperando por
la red, y confirmar dos veces reemplaza lo anterior en lugar de duplicarlo.

Buscar por significado es entonces una consulta normal:

```sql
SELECT r.tipo_documento, r.numero_documento, c.texto
  FROM documento_chunks c
  JOIN registros r ON r.document_id = c.document_id
 ORDER BY c.embedding <=> $1   -- $1 = embedding de la consulta
 LIMIT 5;
```

## Chat sobre los documentos

Cada pregunta pasa primero por un planificador que elige el camino:

| Pregunta | Camino |
| --- | --- |
| "¿Cuánto suman las facturas?" · "¿Cuántos documentos hay de cada tipo?" · "¿Qué facturó X en 2026?" | **SQL** sobre las tablas |
| "¿Qué dice el contrato sobre la fianza?" · "¿Qué incluye el mantenimiento?" | **Embeddings** sobre el texto |

### Camino SQL

El planificador devuelve la consulta con structured output, y antes de tocar la base
pasa por `revisarConsulta`: una sola sentencia, sin comentarios ni punto y coma, que
empiece por SELECT o WITH, sin verbos de escritura, sin catálogo del sistema ni
funciones peligrosas, y sólo sobre las cuatro tablas del dominio (las CTE declaradas
en la propia consulta también valen).

La ejecución añade la defensa de verdad: `BEGIN READ ONLY`, `statement_timeout` de
5 s y las filas envueltas en un `LIMIT 100`. Aunque el modelo escribiera un `DELETE`,
Postgres lo rechazaría.

Del resultado se extraen los uuid de documento (por eso se pide `document_id` o
`array_agg(document_id)` en el SELECT), se convierten en las fuentes numeradas y el
modelo redacta la respuesta citándolas. En la interfaz, la consulta ejecutada queda
disponible en un desplegable bajo la respuesta.

Si la consulta se rechaza o falla en Postgres, la pregunta cae al camino semántico en
vez de dejar al usuario sin respuesta.

### Camino semántico

`POST /api/chat` embebe la pregunta, recupera los seis fragmentos más parecidos
(descartando los que bajan de 0,18 de similitud coseno) y se los pasa al modelo
numerados, con instrucción de responder sólo con lo que aparezca ahí y citar cada dato
como `[1]`. La respuesta vuelve con la lista de fuentes que realmente cita; en la
interfaz, cada `[n]` es un botón que abre ese documento en la vista previa.

Tres decisiones que importan:

- **Sin fragmentos relevantes no se llama al modelo**: responde que no encuentra nada,
  en vez de improvisar sobre contexto vacío.
- **Sólo documentos confirmados**: la consulta hace `JOIN` con `registros`, así que los
  borradores no contaminan las respuestas.
- **Modelo sin razonamiento** (`gpt-5.6-luna`): para citar datos no hace falta que el
  modelo razone, y uno que sí lo hace se comería el presupuesto de tokens antes de
  llegar a la respuesta.

El historial se reenvía recortado a los seis últimos turnos, y se filtran los mensajes
que no sean `user`/`assistant`.

## Base de datos

| Tabla | Contenido |
| --- | --- |
| `documents` | Archivo original (bytea), su tipo, el borrador `extraction` (jsonb), dueño (`usuario_email`) y papelera (`eliminado_at`) |
| `registros` | Una fila por documento confirmado: partes, fechas, importes |
| `registro_lineas` | Conceptos de facturas y recibos |
| `registro_contratos` | Objeto, vigencia, ley aplicable y cláusulas |
| `documento_chunks` | Fragmentos de texto y su `vector(1536)`, con índice HNSW |
| `auditoria_login` | Una fila por login (ver [Login](#login)) |
| `documento_compartidos` | Invitaciones a ver un documento: destinatario, quién la envió y `estado` (`pendiente`/`aceptado`/`rechazado`) |
| `notificaciones` | Un aviso "X te compartió Y" por invitación: destinatario, remitente, documento y fecha |

`documents.eliminado_at` es la papelera: columna en vez de tabla aparte
(`NULL` = activo, con fecha = en la papelera), por la misma razón que
`usuario_email` — todo lo que cuelga de `documents` (`registros`, chunks) se
filtra siempre con `JOIN`, nunca hace falta tocarlo aparte. `PATCH
/api/documents/[id]` con `{ "papelera": true/false }` mueve o restaura;
`DELETE` sigue siendo el borrado definitivo (se usa sólo desde la papelera).

### Compartir documentos y notificaciones

"Compartir" (menú ⋮ de cada tarjeta del historial) **invita** a otro
usuario de la app, identificado por su email de Google, a ver el documento en
**solo lectura**:

1. **Invitar**: `POST /api/documents/[id]/compartidos` con `{ "email" }`.
   "Usuario de la app" = alguien con al menos un login en `auditoria_login`
   (no hay tabla `users`); si no, 404. El modal lo comprueba antes, mientras
   se escribe (`GET /api/usuarios?email=` → `{ existe, propio }`), y no deja
   enviar hasta que el email es de alguien de la app; el resultado, bien o
   mal, se avisa con un toast. En una sola sentencia SQL se crea la
   fila de `documento_compartidos` en `pendiente`, la de `notificaciones` y
   se hace `pg_notify('notificaciones', <email del destinatario>)`. Volver a
   invitar a alguien pendiente o aceptado no hace nada; a alguien que
   rechazó, reabre la invitación con una notificación nueva.
2. **Aviso en vivo**: la campana del encabezado tiene abierto un
   `EventSource` contra `/api/notificaciones/stream` (Server-Sent Events).
   Cada proceso de Next mantiene una conexión en `LISTEN notificaciones`
   (`src/lib/tiempo-real.ts`) y reenvía el aviso a las pestañas de ese email;
   el aviso no lleva datos, el navegador vuelve a pedir `GET
   /api/notificaciones`. Postgres hace de bus, así que funciona con varias
   instancias y sin librerías de sockets (Socket.IO obligaría a un servidor
   propio en vez de `next start`, y aquí sólo hace falta servidor → navegador).
3. **Responder**: `PATCH /api/notificaciones/[id]` con `{ "respuesta":
   "aceptar" | "rechazar" }`, sólo mientras está `pendiente`. Al aceptar, el
   documento aparece en el historial del destinatario marcado "Compartido por…".
4. **Qué puede hacer el destinatario**: abrir, descargar y ver la vista previa
   (`/api/files/[id]`, `/api/preview/[id]`, vía `puedeVer()` de
   `src/lib/compartir.ts`, que exige `estado = 'aceptado'`). Nada más:
   analizar, renombrar, editar/confirmar la extracción, papelera, borrar y
   volver a compartir siguen filtrando por `usuario_email` a secas.
5. **Qué controla el dueño**: el mismo modal lista a quién invitó y en qué
   estado; `DELETE /api/documents/[id]/compartidos?email=` quita el acceso y
   sus notificaciones (con aviso en vivo). Un documento en la papelera deja de
   verse para los destinatarios; borrarlo para siempre elimina invitaciones y
   notificaciones (`ON DELETE CASCADE`).

Fuera de alcance por ahora: los compartidos no entran en el chat ni en el
archivo de registros de quien los recibe, y el dueño no recibe aviso cuando
aceptan o rechazan (lo ve al abrir el modal).

El esquema se aplica con `npm run migrate` (`db/init/*.sql`, idempotente).

## Límites

PNG, JPG, WebP, GIF, PDF, Word (`.docx`), Excel (`.xlsx`) y PowerPoint (`.pptx`),
hasta 20 MB por archivo.
