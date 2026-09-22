# Synapse — Plan de seguridad

**Fecha:** 21 de septiembre de 2026
**Alcance:** `apps/api` (NestJS + Prisma) y `apps/web` (Next.js 14) del monorepo `Desktop/Synapse`
**Origen:** auditoría de seguridad de BBSplap (`Desktop/BBSplap-main`) y comparación estructural contra Synapse
**Referencia:** BBSplap es single-tenant (una planta química, VPS propio, facturación ARCA). Synapse es SaaS multitenant para laboratorios (ISO 9001 / 17025). Sirven fines distintos, así que el plan adapta en vez de copiar.

---

## 0. Resumen en una página

Lo urgente ya está cerrado: no queda un camino conocido para cruzar tenants ni para subir un archivo arbitrario. Lo que sigue es estructural.

**Estado del código:** 3 commits en `fix/aislamiento-multitenant-y-hardening`, sin pushear. Typecheck limpio (api y web), `pnpm build` completo en verde, 213 tests (eran 155).

| Commit | Qué |
|---|---|
| `47d18c5` | los arreglos de §1: IDOR, mass assignment, revocación de JWT, guards globales, subidas, storage, headers |
| `25fc23a` | primer tramo de la Fase 1.1: `@ZodBody` + interceptor global, 8 endpoints |
| `364ad6a` | `packages/validators` emite CommonJS — sin esto el dist de la API no arrancaba |
| `229db0e` | este documento |
| `74f605d` | Fase 1.1 en `documents` y `entries`, más el acotado de `Entry.data` |
| `5e05081` | Fase 1.1 en `auth` — la superficie pública |
| (siguiente) | Fase 1.1 en `records` y flujos |

**Las tres cosas que más mueven la aguja, en orden:**

1. **Validación de entrada en runtime** (Fase 1.1) — hoy no existe. Es la causa raíz de tres vulnerabilidades distintas que aparecieron en esta auditoría — y la tercera se encontró **verificando este mismo plan**, después de dar la clase por cerrada.
2. **Aislamiento multitenant en la base con RLS** (Fase 2.4) — hoy el aislamiento es una convención que se olvidó 6 veces.
3. **Token fuera de `localStorage`** (Fase 1.3) — hoy un XSS entrega la sesión, y la CSP no lo frena.

**Lo que NO hay que copiar de BBSplap:** el servicio de autorización separado con aserciones Ed25519, FIDO2 en commits, y todo el hardening de contenedores. Ver §4.

---

## 1. Qué se arregló ya (línea base del plan)

Todo verificado con typecheck + suite completa. Los tests de regresión se validaron por mutación: al quitar un chequeo a propósito, fallan (detalle en el Apéndice A).

### 1.1 IDOR cross-tenant (severidad: **Alta**)

Seis métodos resolvían por id sin cruzar la organización de quien pedía. El `:orgId` de la ruta no ayudaba: `TenantGuard` lee el claim del JWT y nunca mira el path param.

| Ubicación | Qué permitía |
|---|---|
| `areas.service.ts` → `update`, `delete` | renombrar o borrar el área de otra organización. El borrado era el peor caso: `RecordArea.area` es `onDelete: Cascade`, así que se llevaba las asignaciones área↔registro del otro tenant |
| `organizations.service.ts` → `updateUser` | pasar el id de un miembro de otro tenant y ponerle `role: 'ADMIN'` o `isActive: false` — escalada de privilegios y lockout cross-tenant en una request |
| `organizations.service.ts` → `removeFromWhitelist` | borrar invitaciones pendientes de otra organización |
| `entries.service.ts` → `findById` y todo lo que colgaba de él (`findOne`, `update`, `complete`, `getFieldValue`, `setFieldValue`) | leer, editar, cerrar y **borrar adjuntos** de los registros de calidad de otro laboratorio. Una Entry se identifica por `recordId` + `entryId`, y ninguno de los dos dice a qué organización pertenece: eso lo dice el Record, que no se consultaba |

**Arreglo:** helpers de scoping (`findInOrg`, `assertRecordInOrg`) y `organizationId` propagado desde el controller. 404 en vez de 403 para no confirmar la existencia del recurso a quien prueba ids.

> **Precedente que importa:** `modules/records/record-actions.isolation.spec.ts` documenta **el mismo tipo de agujero ya arreglado antes** en `deleteAction`. Con estos seis, van siete. Es una clase recurrente, y es el argumento central para la Fase 2.4.

### 1.2 Mass assignment (severidad: **Alta**)

`areas.update` y `organizations.update` pasaban el body **entero** a Prisma:

```ts
data: { name?: string; parentId?: string | null }   // el tipo solo existe en compilación
this.prisma.area.update({ where: { id: areaId }, data })   // en runtime, data = el body crudo
```

Prisma acepta cualquier campo real del modelo. Un `PATCH` con `{"organizationId": "<otro tenant>"}` **movía el área a otra organización** y aparecía en el `getTree` de la víctima; `leaderId` permitía apuntar a un miembro ajeno. En `organizations.update`, el body podía cambiar el `slug`, que es único y direcciona la organización.

Un tercer caso apareció al verificar este plan contra el código: `documents.update` tenía el mismo `data` crudo. El impacto era mayor que en los otros dos, porque `Document` tiene un campo que direcciona un archivo:

| Campo del body | Qué permitía |
|---|---|
| `organizationId` | mover el documento al otro tenant — aparecía en el listado de la víctima |
| `fileKey` | **lectura cross-tenant de PDFs.** `withFileUrl` firma una URL a partir de la key sin verificar de quién es, así que escribir la key ajena en un documento propio y volver a leerlo devolvía una URL firmada al PDF del otro laboratorio. De paso puenteaba la guarda de `setFileKey`, que impide reemplazar el archivo sin crear una versión |

Es el caso que más justifica la Fase 1.1: se parchearon dos a mano y el tercero siguió abierto, en el mismo cambio que daba la clase por cerrada.

**El filtro por organización no cubre esto:** el recurso es propio y la operación está autorizada. Lo que sobraba eran los campos tocables.

**Arreglo:** lista blanca explícita de campos en los tres. **Es un parche, no la solución** — ver Fase 1.1.

### 1.3 JWT no revocable (severidad: **Alta**)

`JwtStrategy.validate` devolvía el payload sin tocar la base. Con `JWT_EXPIRES_IN=7d`:

- desactivar a alguien con `isActive: false` **no lo echaba**
- bajarle el rol de ADMIN **no le quitaba** ADMIN
- el logout solo borraba el token del navegador; seguía válido contra la API
- rol y organización viajaban congelados en el token

**Arreglo:** `validate` lee `OrganizationUser` en cada request y devuelve `role` y `areaId` **de la base, no del token**. Costo: una query por request. A cambio, `isActive: false` es una revocación real e inmediata.

### 1.4 Guards opt-in (severidad: **Media-Alta**)

`app.module.ts` solo registraba `APP_INTERCEPTOR`. Los guards se aplicaban controller por controller con `@UseGuards`, y ahí el default es **abierto**: un controller nuevo al que se le olvida el decorador nace sin autenticación. Hoy 21 de 22 lo tenían.

**Arreglo:** `JwtAuthGuard`, `TenantGuard` y `RolesGuard` como `APP_GUARD` global. Se invirtió el default: abrir una ruta ahora exige `@Public()` explícito, que se agregó a las cuatro rutas del flujo de login (`google`, `google/callback`, `exchange`, `exchange/organizations`) porque son justamente las que emiten el token.

`JwtAuthGuard` corta si `request.user` ya está poblado, así que los `@UseGuards` que quedan en los controllers no repiten la verificación del token ni la query de revocación. (`request.user` solo lo escribe passport del lado del servidor; no hay header ni body que lo plante desde afuera.)

### 1.5 Validación de subidas (severidad: **Media**)

- `documents/:id/upload` y `documents/:id/version` **no validaban nada**: ni tipo ni tamaño. Entraba cualquier archivo y `StorageController` lo devolvía declarado como `application/pdf`.
- Los otros cuatro endpoints comparaban `file.mimetype !== 'application/pdf'`, que solo comprueba **lo que el cliente declaró de sí mismo**, no lo que mandó.
- `FileInterceptor` usa memoryStorage sin `limits`: el archivo entero se buffereaba en RAM y **recién después** se medía el tamaño.

**Arreglo:** `common/storage/uploaded-pdf.ts` con `assertUploadedPdf` (magic bytes `%PDF-` + marca `%%EOF` + tamaño) y `PDF_UPLOAD_OPTIONS` con `limits: { fileSize, files: 1 }`, aplicado a los 6 `FileInterceptor`. Multer ahora corta el stream y Nest lo traduce a 413.

En `entries.uploadFile` se reordenó: el acceso se verifica **antes** de escribir en el storage. Antes, un pedido contra la entry de otro tenant guardaba el archivo y después fallaba, dejando un objeto huérfano por intento.

### 1.6 Reutilización de clave criptográfica (severidad: **Media**)

```ts
const secret = config.get('STORAGE_SIGNING_SECRET') || config.get('JWT_SECRET')
```

Sin `STORAGE_SIGNING_SECRET`, el HMAC de las URLs de archivos se calculaba con **el mismo material que firma los JWT**. Dos propósitos criptográficos sobre una clave: filtrar uno comprometía el otro.

**Arreglo:** HKDF-SHA256 con etiqueta de dominio propia (`synapse-storage-url` / `signed-file-url-v1`). De la clave derivada no se puede volver al secreto ni forjar un token. Se mantiene el fallback para no romper despliegues que no tengan la variable.

Además: el mensaje del HMAC se delimita por longitud (`${len}:${campo}`) en vez de `${scope}:${key}:${exp}` — una key puede contener `:` y dos ternas distintas podían producir el mismo mensaje a firmar.

> **Nota:** esto solo afecta el backend de **desarrollo**. En producción se usa `R2StorageService`, que emite presigned URLs de R2 (bucket privado, 900 s, `Content-Disposition` saneado). Ese camino ya estaba correcto.

### 1.7 Headers de seguridad (severidad: **Media-Baja**)

La API no mandaba ninguno. Se agregaron a mano en `main.ts` (sin sumar dependencia: son los que aplican a una API JSON, que no renderiza HTML propio): `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-site`, CSP restrictiva y HSTS.

`StorageController` sirve los PDFs con `Content-Type` fijo, así que se le agregó `nosniff` — sin él, un archivo que no sea realmente un PDF podía interpretarse como otra cosa — más CSP con `sandbox` como segundo cinturón.

**Excepción, y es necesaria:** el visor de documentos embebe ese endpoint en un `<iframe>` ([documents/page.tsx](apps/web/src/app/(app)/documents/page.tsx)) desde el origen del frontend — por eso `next.config` declara `frame-src 'self' ${apiOrigin}`. Los tres headers globales lo bloquean: `X-Frame-Options: DENY`, `frame-ancestors 'none'` y `Cross-Origin-Resource-Policy: same-site`. El preview queda en blanco, sin error del lado del servidor y sin nada que señale la causa.

Así que en esa respuesta —y solo en esa— se saca `X-Frame-Options`, el CORP pasa a `cross-origin` y `frame-ancestors` se abre a `'self' + FRONTEND_URL`. No afloja el control de acceso: lo que protege el archivo es la firma con vencimiento de la URL, no la imposibilidad de embeberlo, y el `sandbox` sigue impidiendo que el PDF ejecute nada. Hay un spec (`storage.controller.spec.ts`) que lo fija, porque una rotura silenciosa no se detecta por revisión.

Solo aplica al backend de disco. En producción los PDFs salen de R2 y este controller no interviene.

### 1.8 Tests de regresión

47 tests nuevos en cinco specs, en el estilo del que ya existía (`record-actions.isolation.spec.ts`): doble de Prisma afirmando **sobre el `where` real de la consulta**, no sobre lo que devuelve la base. Un test contra una base real pasaría igual si el filtro se cayera, siempre que las organizaciones del test no compartieran ids.

- `modules/areas/areas.isolation.spec.ts` (11)
- `modules/organizations/organizations.isolation.spec.ts` (9)
- `modules/entries/entries.isolation.spec.ts` (8)
- `modules/documents/documents.isolation.spec.ts` (13)
- `common/storage/storage.controller.spec.ts` (6) — headers, no aislamiento

---

## 2. Qué queda abierto

Post-arreglos, ordenado por riesgo real:

| # | Gap | Severidad | ¿Por qué no se arregló ya? |
|---|---|---|---|
| A | **Sin validación de entrada en runtime** | Alta | Es trabajo por endpoint, no un fix puntual |
| B | **Aislamiento multitenant solo por convención** | Alta | Requiere decisión de arquitectura (RLS) |
| C | **Token en `localStorage`** | Alta | Refactor de frontend |
| D | **Sin rate limiting ni lockout** | Media-Alta | Requiere dependencia nueva |
| E | **Sin step-up en operaciones sensibles** | Media | Decisión de producto |
| F | **Rol de base con permisos de owner** | Media | Cambio de infraestructura |
| G | **CI sin gates de seguridad** | Media | — |
| H | **`AuditLog` editable/borrable** | Baja-Media | — |
| I | **Restore nunca probado** | Media | Procedimiento, no código |

### Sobre C: la CSP no te salva

El frontend **tiene** una CSP seria y bien razonada en `apps/web/next.config` (con `frame-src` y `img-src` acotados al bucket de R2, `frame-ancestors 'none'`, `object-src 'none'`). Pero incluye:

```
script-src 'self' 'unsafe-inline'
```

Con `'unsafe-inline'`, un script inyectado ejecuta. La CSP **no protege** el camino XSS → robo del token. Por eso C y "quitar `unsafe-inline` con nonces" son el mismo trabajo y hay que hacerlos juntos.

### Lo que NO es un problema (verificado)

- **No hay filtración de secretos.** Solo `.env.example` estuvo en git. El `.gitignore` cubre `.env`, `.env.local` y `.env.production-backup`, y ninguno aparece en el historial completo (`git log --all`).
- **El CI existe y está bien hecho:** typecheck, tests y build, con `concurrency` que cancela en PR pero no en `main` (para no dejar un commit sin verificación). Lo que falta es seguridad, no rigor.
- **El intercambio de código post-OAuth está bien resuelto:** `auth-code.service.ts` emite un código opaco de 32 bytes, de un solo uso, con TTL de 2 minutos, en vez del JWT en la query string. Documenta la vulnerabilidad anterior que arregló y su limitación conocida (store en memoria, no sirve con varias instancias).
- **`pnpm lint` está roto**, pero de antes: no hay `eslint.config.js` en ningún lado del repo y el script invoca ESLint 9. No es un problema de seguridad, pero conviene arreglarlo si se van a agregar gates.

---

## 3. El plan

Los tiempos son estimaciones, no compromisos.

### Fase 1 — Cerrar lo que todavía es explotable · ~1-2 semanas

#### 1.1 Validación de entrada en runtime — **empezar por acá** · ~4-5 días

**El hallazgo:** existe `common/pipes/zod-validation.pipe.ts` y **no se usa en ningún lado**. Existe `packages/validators` con schemas de `area`, `auth`, `organization`, `whitelist` y `record-field`, y **la API no importa ninguno**. Cada `@Body()` es un `any` en runtime; los tipos TS se borran al compilar.

Esto es la causa raíz de §1.2, que se parcheó a mano en tres lugares — y el tercero apareció recién al auditar el plan, que es exactamente el argumento: la lista blanca protege el endpoint que alguien se acordó de mirar. El arreglo correcto no son más listas blancas.

**Corrección sobre el mecanismo:** el paso 1 decía "registrar `ZodValidationPipe` como pipe global" y **no es posible**. Un `PipeTransform` global recibe solo `ArgumentMetadata` —el tipo del parámetro— y nunca el `ExecutionContext`, así que no tiene forma de leer del handler qué schema le toca. Se resolvió con un decorador `@ZodBody(schema)` que deja metadata y un `ZodValidationInterceptor` global que la lee; el interceptor sí recibe el contexto.

Y lo que cierra la clase no es el 400: es que el interceptor **reemplaza `request.body`** por el resultado del parseo. `z.object()` descarta las claves que no declara, así que el handler —y Prisma detrás— dejan de ver campos que nadie declaró. El 400 de `.strict()` es mejor diagnóstico, no mejor defensa.

**Acciones:**

1. ~~Registrar `ZodValidationPipe` como pipe global.~~ **Hecho** como `@ZodBody` + `ZodValidationInterceptor` global, registrado antes del `AuditInterceptor` para que el audit log guarde el body ya limpio.
2. Un schema por endpoint de escritura. `.strict()` **al final de la fase**, no al principio: es el equivalente del `extra="forbid"` de BBSplap, pero activarlo antes de saber qué manda realmente el frontend convierte en 400 de producción un campo de más que hoy se descarta sin consecuencia.
3. Empezar por los endpoints que escriben, en este orden: `organizations` ✅, `areas` ✅, `documents` ✅, `entries` ✅, `auth` ✅, `records` ✅.

   El orden del plan no incluía `auth`, y debería haber ido primero: sus tres endpoints con body son `@Public()`, o sea **la superficie entera que se atiende sin token**. Van 19 de los 45 `@Body()` de la API; de los 26 que faltan, 6 son multipart y no llevan schema.

   Las columnas Json de configuración (`comparisonConfig`, `formulaConfig`, `condition`, `actionConfig`) se acotan en forma pero **no en significado**: existen schemas semánticos para las tres y aplicarlos en la entrada rompería el guardado de configuraciones incompletas, que en flujos es un estado de edición normal y deliberado. El motivo largo está en `packages/validators/src/json.ts`.
4. Reutilizar los schemas de `packages/validators` que ya existen; extender donde falten. **Hecho** para los 8 endpoints migrados: se extendió `updateOrgUserSchema`, al que le faltaban `positionId`, `phone` y `signature`, y se agregaron `createPosition`, `setAreaLeader` y `addTraining`.
5. ~~Acotar `Entry.data`~~ **Hecho** (`entryDataSchema`): 300 claves, 10 000 caracteres por texto, 500 items por lista y profundidad declarada explícita en vez de `z.lazy()`. El tamaño total ya estaba acotado aguas arriba —el body parser de Express corta el JSON en 100 kB—; lo que faltaba era la forma. Los números son holgados a propósito: el objetivo de la fase no es afinar cuotas sino que deje de entrar cualquier cosa.

**Criterio de hecho:** un body con un campo que el schema no declara devuelve 400, y los tres parches de lista blanca de §1.2 quedan redundantes (dejarlos igual: defensa en capas).

> **Lo que costó y no estaba previsto:** `packages/validators` declaraba `main: ./src/index.ts`, y Node no puede requerir TypeScript. El primer import de valor entre paquetes del workspace —los schemas son valores en runtime, a diferencia de `@synapse/types`, que se usa solo para tipos y tsc borra— dejó el dist de la API sin arrancar. Typecheck, la suite entera y `nest build` pasaban igual. Se arregló emitiendo CommonJS con `main` a `dist`.
>
> Deja dos lecciones para el resto de la fase: **verificar arrancando el dist**, no compilándolo, y que vitest transpila con esbuild, que no soporta `emitDecoratorMetadata` — cualquier provider que se instancie en un test de integración necesita `@Inject()` explícito.

> **`@ZodBody` no sirve en endpoints multipart, y hay que saberlo.** Los interceptores globales corren **antes** que los de ruta, así que cuando el de Zod llega, el `FileInterceptor` todavía no pasó y multer no parseó nada: valida un `{}` y después multer pisa `request.body` con los campos sin filtrar. Verificado: un campo no declarado llega intacto al handler. O sea que el decorador ahí no falla ni avisa, simplemente no hace nada — la peor forma de una defensa.
>
> El interceptor ahora devuelve 400 ante un body multipart cuando hay schema declarado, para que la primera prueba lo muestre. Los cuatro endpoints de subida (`documents/upload`, `documents/version`, `entries/files`, y los de instruments/recipes/templates) validan su parte en el handler con `assertUploadedPdf`.

#### 1.2 Rate limiting y lockout · ~2 días

Hoy no hay nada. BBSplap escala bloqueos 15/60/360/1440 min con contadores separados por cuenta e IP y memoria de reincidencia de 7 días; no hace falta llegar ahí de entrada.

**Acciones:**

1. `@nestjs/throttler`.
2. Por IP en `/auth/exchange` y `/auth/exchange/organizations`.
3. Por usuario en endpoints de escritura.
4. **Cablear Redis:** con más de una instancia el throttler necesita store compartido. `REDIS_URL` está en el `.env` desde siempre sin usarse (`TO_DO.md` §11) — este es su uso real. El mismo store resuelve la limitación conocida de `auth-code.service.ts`.
5. Registrar los rechazos en el `AuditLog`.

#### 1.3 Token fuera de `localStorage` + CSP sin `unsafe-inline` · ~4-5 días

El ítem más caro de la fase, y van juntos.

**Acciones:**

1. Emitir la sesión como cookie `httpOnly` + `SameSite=Lax` + `Secure`, en vez de devolver el token en el body de `/auth/exchange`.
2. Reemplazar `ExtractJwt.fromAuthHeaderAsBearerToken()` por extracción desde la cookie.
3. Frontend: sacar `Bearer` de `lib/api.ts` y de los ~8 lugares que hacen `fetch` a mano (`documents/page.tsx`, `recipes/page.tsx`, `instruments/[id]/page.tsx`, `calibration-templates/page.tsx`, `components/forms/dynamic-record-form/fields.tsx`).
4. Con cookies, aparece CSRF: hoy no aplica porque el token va en un header. `SameSite=Lax` cubre el POST cross-site; agregar verificación de `Origin` en escrituras como segundo cinturón.
5. Nonces en Next para quitar `script-src 'unsafe-inline'`.
6. La cookie `synapse_session_exp` que usa el middleware de routing puede quedarse: ya lleva solo el vencimiento, nunca el token, y está documentado que es enrutado y no control de acceso.

**Beneficio:** un XSS deja de entregar la sesión. Es la última vía de takeover que queda abierta.

---

### Fase 2 — Defensa en capas · ~3-5 semanas

#### 2.4 Aislamiento en la base, no solo en el código — **el de mayor impacto** · ~1-2 semanas

Hoy el aislamiento es una convención: acordarse del `organizationId` en el `where` de ~200 queries. Se olvidó **7 veces** (6 en esta auditoría + `deleteAction` antes). Los tests cubren lo que alguien se acordó de testear.

**Acción principal:** RLS de Postgres con `app.current_org` seteado por transacción vía `$extends` de Prisma Client. Convierte "olvidarse del filtro" de vulnerabilidad en "devuelve 0 filas". Es lo único del plan que ataca la causa en vez de los síntomas.

**Alternativa barata** (~1 día) si RLS resulta mucho para ahora: una extensión de Prisma Client que exija `organizationId` en el `where` de los modelos con tenant y tire error si falta. Menos garantía —no cubre `$queryRaw` ni relaciones anidadas— pero atrapa el 90% del patrón.

**Recomendación:** hacer un spike de RLS sobre **un solo modelo** (`Area`, que es chico y ya tiene tests) para medir el costo real antes de comprometerse con los 20 modelos.

#### 2.5 Step-up en operaciones sensibles · ~3-4 días

BBSplap exige un TOTP **nuevo por cada comprobante fiscal**: autorización elevada para el acto, no solo para entrar. El equivalente en ISO 17025 es la firma del ensayo y la aprobación documental, que es lo que tiene valor legal — y hoy las hace quien tenga el token.

**Acciones:** reautenticación (o segundo factor) para aprobar un documento, firmar un ensayo/calibración, y cambiar roles de un miembro. Registrar el step-up en el `AuditLog`.

#### 2.6 Rol de base con menos privilegios · ~1 día, alto retorno

BBSplap separa `bbsplap` (owner, solo llega al contenedor de migraciones) de `bbsplap_runtime` (la app). Synapse usa una sola `DATABASE_URL` con permisos de owner: **la aplicación puede hacer `DROP TABLE`**.

**Acciones:** rol de runtime con `SELECT/INSERT/UPDATE/DELETE` y sin DDL; `prisma migrate deploy` con el rol owner en un paso de despliegue aparte. Es config, no código. Prerrequisito natural de RLS (que además necesita que el rol de runtime no tenga `BYPASSRLS`).

---

### Fase 3 — Operación · continuo

#### 3.7 Gates de seguridad en CI · ~1 día

Extender `.github/workflows/ci.yml`:

- `pnpm audit --audit-level high`
- secret scanning (gitleaks) — hoy la higiene de `.env` es disciplina; el gate la vuelve garantía
- Dependabot y/o CodeQL
- arreglar la config de ESLint que falta, para que `pnpm lint` vuelva a correr

BBSplap tiene el equivalente: requirements con `--require-hashes`, Trivy, y `ops/check_no_database_dumps.py` en pre-publicación.

#### 3.8 Auditoría append-only · ~2 días

**Acá Synapse ya está mejor que BBSplap:** el `AuditInterceptor` es automático y global con redacción de campos sensibles, mientras BBSplap audita con llamadas explícitas (`sf.auditar(...)`) que se pueden olvidar en un endpoint nuevo.

Lo que falta: que `AuditLog` no se pueda editar ni borrar desde la app (permisos del rol de runtime: `INSERT` y `SELECT`, sin `UPDATE`/`DELETE`), y una política de retención.

#### 3.9 Restore probado · ~1 día + recurrente

Supabase/Railway ya hacen backups. Lo que BBSplap hace y acá falta **no es el backup: es probar el restore**. Un backup sin drill es una suposición. Definir un procedimiento y una cadencia (trimestral alcanza).

---

## 4. Lo que NO copiar de BBSplap

Esto importa tanto como el plan: copiar mal cuesta meses sin reducir riesgo.

| De BBSplap | Por qué no |
|---|---|
| **Servicio de autorización separado con aserciones Ed25519 de un solo uso** (`auth_context.py`, `authorization_context.py`) | Es la joya de BBSplap y en Synapse sería sobreingeniería. Tiene sentido cuando el backend no debe *poder* firmar sesiones: la clave privada vive solo en el rol `authorization`, Caddy transporta el header opaco y el backend verifica y consume. Con cookie `httpOnly` + RLS + revocación en DB, Synapse llega a un nivel comparable por una fracción del costo |
| **FIDO2 en commits con verificación obligatoria del despliegue** | Excelente y caro. Para un equipo chico, branch protection + commits firmados con GPG cubre el 80% del margen |
| **`read_only`, `cap_drop: ALL`, `no-new-privileges`, tmpfs, docker secrets, WireGuard, SSH solo por túnel** | No aplican: Synapse es PaaS. El equivalente real en PaaS es secretos en el gestor de la plataforma (ya está), sin SSH a producción (ya, por construcción) e IP allowlist en la base |
| **El `main.py` de 355 KB** | No es una virtud. Synapse ya está mejor modularizado y conviene no perder esa ventaja |

### Donde Synapse ya está mejor

Para no tocar lo que funciona:

- **Auditoría automática por interceptor** con redacción — BBSplap la hace a mano.
- **URLs firmadas con vencimiento** para archivos: resuelve algo que BBSplap no puede (un `<iframe src>` no manda header `Authorization`), con HMAC, `timingSafeEqual`, chequeo de path traversal y 404 indistinguible entre firma inválida y vencida.
- **Límite de tamaño de cuerpo**: con el default de Express (100 kb para JSON) más los `limits` de multer que se agregaron, Synapse quedó **mejor que BBSplap**, que sigue sin límite fuera de `/auth` y `/usuarios`.
- **Granularidad por área** además de por rol (`area-access.guard.ts`, `area-scope.ts`); BBSplap tiene rol binario ADMIN/USUARIO.
- **Identidad delegada a Google**: no custodia contraseñas. Ni hashes que robar, ni reset que abusar, ni política de contraseñas que mantener.

---

## 5. Orden de ataque sugerido

### Si hay una semana

1. **Pipe global de Zod con `.strict()`** en endpoints de escritura — ataca la clase que apareció tres veces en esta auditoría.
2. **Throttler** con store en memoria; Redis cuando escale.
3. **Spike de RLS** sobre `Area` para medir el costo real.

### Si hay un mes

Fase 1 completa + Fase 2.6 (rol de base, que es barato y habilita RLS) + decisión tomada sobre RLS con datos del spike.

### Si hay un trimestre

Todo el plan, con la Fase 3 convertida en rutina en vez de proyecto.

---

## 6. Expectativa realista

Con el plan completo, Synapse queda sólida **en su propia categoría**. No va a ser BBSplap, y no debería:

- BBSplap protege **una** planta y su facturación fiscal, con un cliente, un VPS propio y una superficie que puede cerrar casi por completo. Su robustez es en buena parte un programa operativo de años.
- Synapse protege los datos de **N** laboratorios en infraestructura compartida. Su riesgo dominante es el cruce entre tenants — que es justo el que BBSplap nunca tuvo que resolver, y el que esta auditoría encontró abierto siete veces.

El objetivo no es igualar una lista de controles. Es que el riesgo dominante de cada sistema esté cubierto con el mecanismo adecuado para su forma.

---

## Apéndice A — Verificación

```bash
# Desde Desktop/Synapse
npx tsc --noEmit -p apps/api/tsconfig.json     # typecheck API
cd apps/web && npx tsc --noEmit                # typecheck web
cd apps/api && npx vitest run                  # 202 tests
```

Los tests de aislamiento se validaron por mutación, dos veces:

- quitando `assertRecordInOrg` de `entries.service.findById` → **5 de 8** fallan;
- devolviendo `documents.service.update` al `data` crudo → **2 de 13** fallan (los otros 11 cubren scoping, que esa mutación no toca).

Si se agrega un método nuevo con scoping o una lista blanca nueva, conviene repetir el ejercicio — un test de aislamiento que no falla al quitar el chequeo no está protegiendo nada.

## Apéndice B — Archivos tocados

**Modificados (18):**

```
apps/api/src/app.module.ts                                   guards globales
apps/api/src/main.ts                                         headers de seguridad
apps/api/src/common/guards/jwt-auth.guard.ts                 deny-by-default + corte si ya hay user
apps/api/src/common/storage/local-storage.service.ts         HKDF + HMAC delimitado
apps/api/src/common/storage/storage.controller.ts            nosniff + CSP + framing del visor
apps/api/src/modules/auth/jwt.strategy.ts                    revocación contra la base
apps/api/src/modules/auth/auth.controller.ts                 @Public() en el flujo de login
apps/api/src/modules/areas/areas.service.ts                  scoping + lista blanca
apps/api/src/modules/areas/areas.controller.ts               propaga organizationId
apps/api/src/modules/organizations/organizations.service.ts  scoping + lista blanca
apps/api/src/modules/organizations/organizations.controller.ts
apps/api/src/modules/entries/entries.service.ts              assertRecordInOrg
apps/api/src/modules/entries/entries.controller.ts           propaga organizationId + orden de escritura
apps/api/src/modules/documents/documents.controller.ts       validación que faltaba
apps/api/src/modules/documents/documents.service.ts          lista blanca (organizationId + fileKey)
apps/api/src/modules/instruments/instruments.controller.ts
apps/api/src/modules/recipes/recipes.controller.ts
apps/api/src/modules/calibration-templates/calibration-templates.controller.ts
```

**Nuevos (6):**

```
apps/api/src/common/storage/uploaded-pdf.ts                          validación de PDF + limits de multer
apps/api/src/modules/areas/areas.isolation.spec.ts                   11 tests
apps/api/src/modules/organizations/organizations.isolation.spec.ts    9 tests
apps/api/src/modules/entries/entries.isolation.spec.ts                8 tests
apps/api/src/modules/documents/documents.isolation.spec.ts           13 tests
apps/api/src/common/storage/storage.controller.spec.ts                6 tests (headers)
```

**Efectos al desplegar:**

- Las signed URLs ya emitidas dejan de validar (viven 15 min) — solo afecta al backend de disco, no a R2.
- Quien tenga `isActive: false` con token vigente pasa a recibir 401 en la request siguiente. Es el arreglo, no un efecto secundario.
- Una query más por request (la de revocación).
- `StorageController` necesita `FRONTEND_URL` bien puesta: de ahí sale el `frame-ancestors` que deja embeber el PDF en el visor. Si falta, cae en `http://localhost:3000` y en un deploy con backend de disco el preview queda en blanco. Es la quinta cosa que depende de esa variable — ver la tabla de `apps/api/CLAUDE.md`.
