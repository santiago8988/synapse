# Synapse API (apps/api)

Backend NestJS del sistema de gestión de calidad Synapse. Maneja la lógica de negocio, persistencia, auth, storage de archivos y el audit trail.

## Stack

- **NestJS** con TypeScript strict
- **Prisma** + PostgreSQL — ORM y migraciones (`apps/api/prisma/`)
- **Passport.js + Google OAuth** — autenticación (sin contraseñas)
- **JWT** — sesiones post-OAuth
- **Zod** — validación de DTOs
- **Cloudflare R2** vía `@aws-sdk/client-s3` — storage de archivos, detrás de `StorageService`
- **EventEmitter2** (`@nestjs/event-emitter`) — domain events
- **Vitest** — tests unitarios (`pnpm test`)

> `REDIS_URL` está en el `.env` pero BullMQ/Redis **no están cableados**, y
> **mathjs no está instalado**: las fórmulas se evalúan con `Function()` sobre
> una expresión saneada. Ver `TO_DO.md` §2 y §11.

## Estructura

```
apps/api/src/
  main.ts
  app.module.ts                        ← registra los 20 módulos + AuditInterceptor global

  prisma/
    prisma.module.ts
    prisma.service.ts

  common/
    guards/
      jwt-auth.guard.ts                ← verifica JWT y popula request.user
      tenant.guard.ts                  ← inyecta organizationId al request
      roles.guard.ts                   ← verifica @Roles()
      area-access.guard.ts             ← verifica acceso jerárquico al área
    decorators/
      public.decorator.ts              ← @Public() para saltar JwtAuthGuard
      current-user.decorator.ts        ← @CurrentUser() user: JwtPayload
      roles.decorator.ts               ← @Roles('ADMIN', 'QUALITY_MANAGER', ...)
      audit-ignore.decorator.ts        ← @AuditIgnore() saltea AuditInterceptor
    interceptors/
      audit.interceptor.ts             ← global, loguea POST/PATCH/PUT/DELETE
      audit-entities.ts                ← mapa entidad→modelo + redacción de secretos
    storage/
      storage.service.ts               ← interfaz abstracta (put / signedUrl / remove)
      local-storage.service.ts         ← disco, con URLs firmadas HMAC (desarrollo)
      r2-storage.service.ts            ← Cloudflare R2 con presigned URLs (producción)
      storage.controller.ts            ← sirve los archivos del backend local
      storage.module.ts                ← elige backend según env
    flows/
      flow-config.ts                   ← valida config de flujos; decide si se ejecutan
      flow-evaluation.ts               ← resuelve paths y evalúa condiciones
    filters/
      prisma-exception.filter.ts       ← P2002→409, P2025→404, otros→500
    pipes/
      zod-validation.pipe.ts           ← validación con schemas de @synapse/validators
    events/
      events.module.ts
      domain-events.ts                 ← clases de eventos con EVENT_NAME estático

  modules/                             ← 20 módulos (controller + service)
    auth/                              ← Google OAuth + JWT + whitelist
    organizations/
    users/                             (solo service, expuesto vía organizations)
    areas/                             ← árbol recursivo
    documents/                         ← versionado (DRAFT/ACTIVE/SUPERSEDED)
    records/                           ← templates con campos OWN
    entries/                           ← instancias, evalúa fórmulas y comparisons
      services/
        comparison-evaluator.service.ts
        formula-evaluator.service.ts
      listeners/                       ← record-action.listener.ts (cascadas)
    instruments/                       ← + InstrumentStatusLog (append-only)
    non-conformities/                  ← + CorrectiveAction
    audit/                             ← lectura de AuditLog
    dashboard/                         ← KPIs y agregados
    approval/                          ← circuito ISO de aprobación documental
    recipes/                           ← BOM + pasos para BATCH
    batches/                           ← + BatchStatusLog
    samples/                           ← matriz + métodos
    matrices/                          ← versionado
    methods/                           ← OrgMethod
    stock/                             ← StockMovement
    calibration-templates/             ← pruebas + puntos
    calibrations/                      ← ejecución + pattern multipattern
```

## Auth flow

```
1. Frontend redirige a Google OAuth
2. Callback → Passport verifica id_token → extrae email
3. Buscar email en EmailWhitelist (puede estar en múltiples orgs)
4. Si está en una org: emitir JWT
   Si está en varias: redirigir a /select-org y emitir JWT al elegir
5. JWT payload: { sub, email, organizationId, role, areaId }
6. Cookie httpOnly al frontend
```

Para cambiar de organización activa: `POST /auth/switch-org` re-emite JWT con la nueva org.

## Patrones obligatorios para controllers

Todo controller que maneja datos de tenant debe declarar los guards en este orden:

```typescript
@Controller('records/:recordId/entries')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class EntriesController {
  @Post()
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  create(@CurrentUser() user: JwtPayload, @Body() body: ...) {
    return this.service.create(..., user.organizationId, user.sub, ...)
  }
}
```

`AreaAccessGuard` se agrega cuando el endpoint debe filtrar por jerarquía de área (no en todos). `JwtAuthGuard` y `TenantGuard` van **siempre** salvo `@Public()`.

## Patrones obligatorios para services

1. **Filtrar por `organizationId` en TODA query**:
   ```typescript
   await this.prisma.record.findFirst({ where: { id, organizationId } })
   ```
2. **Tirar `NotFoundException` si la entidad no pertenece al tenant** — nunca dejar que Prisma devuelva `null` para evitar leaks por timing.
3. **Texto en MAYÚSCULAS**: campos `TEXT` y `DROPDOWN` se uppercasean al recibir (ver `entries.service.ts` create/update).
4. **Emitir domain events** para side-effects: cascadas, notificaciones, NCs automáticas, próximas dueDate.

## Domain events

Definidos en `common/events/domain-events.ts`. Cada uno tiene `EVENT_NAME` estático.

| Evento | Nombre | Disparado por |
|---|---|---|
| `EntryCreatedEvent` | `entry.created` | `entries.service.create` |
| `EntryCompletedEvent` | `entry.completed` | `entries.service.complete` |
| `InstrumentStatusChangedEvent` | `instrument.statusChanged` | `instruments.service.changeStatus` |
| `NonConformityCreatedEvent` | `nonConformity.created` | NC manual o automática por comparison fallida |
| `DocumentVersionCreatedEvent` | `document.versionCreated` | `documents.service` al supersede |

**Listener pattern**: usar `@OnEvent(EventName.EVENT_NAME)`. Los listeners no deben re-throwear excepciones — loggear y continuar para no abortar la transacción que disparó el evento.

## AuditInterceptor

Registrado **global** en `app.module.ts`. Loguea automáticamente todo `POST`/`PATCH`/`PUT`/`DELETE` a la tabla `AuditLog`:
- `entityType` se deriva del nombre del controller (`EntriesController` → `ENTRIES`).
- `action` se deriva del método HTTP y path (`POST .../complete` → `entries.completed`).
- `entityId` viene de `request.params.id` o de la respuesta.
- `before` se lee **antes** de que el handler mute la fila, con la query siempre acotada por organización. El mapa entidad→modelo y la forma de acotar viven en `audit-entities.ts`; los controllers que no figuran ahí no capturan `before`.
- `before` y `after` pasan por `redactSensitive()`, que reemplaza los valores de claves que parezcan credenciales (regla 8).
- La acción se arma como `<entityType en minúsculas>.<verbo>`. Las filas anteriores a 2026-09-04 dicen `api.*` por un bug ya corregido; como la tabla es append-only, no se corrigen.

Para saltear el log en un endpoint específico: `@AuditIgnore()` (justificar el motivo en comentario).

## Reglas ISO específicas del workspace

1. **Append-only**: los siguientes modelos no se pueden `UPDATE` ni `DELETE` desde código — solo `INSERT`. La migración tampoco puede dropear estas tablas sin un plan documentado de rollback y backfill.
   - `AuditLog` — log global de POST/PATCH/PUT/DELETE escrito por `AuditInterceptor`.
   - `EntryStatusLog` — paper trail del workflow engine v2: cada cambio de un field `comparisonConfig.isStatus === true` se loguea acá. Aplica a Records de tipo `PERIODIC / NOT_PERIODIC / NOT_PERIODIC_WITH_REVISION` (los que admiten DROPDOWN-as-status).
   - `InstrumentStatusLog` — paper trail específico de `Instrument.status`. Convive con `EntryStatusLog`: aplica a la columna del companion `Instrument`, no a fields de Entry.
   - `InstrumentCertificate` — historial de PDFs de calibración externa por instrumento. Cada certificado emitido por un técnico externo se guarda como nuevo row; nunca se borra ni se sobrescribe (cuenta la historia del equipo).
   - `BatchStatusLog` — idem para `Batch.status`.
   - `SampleCustodyEvent` — sin implementar, ver `SAMPLE_CUSTODY_SPEC.md` y `TO_DO.md` §9.

   El `EntryStatusLogListener` (en `entries/listeners/`) es el único writer legítimo de `EntryStatusLog`; cualquier nuevo path que toque la tabla debe pasar por el evento `EntryFieldValueChangedEvent`.

2. **Versionado inmutable de documentos**: `Document` con `status = ACTIVE` no se edita. Para cambios → crear nueva versión, la anterior pasa a `SUPERSEDED`. La acción la maneja `documents.service` y emite `DocumentVersionCreatedEvent`.

3. **Identifiers de Entry COMPLETED**: los campos con `isIdentifier = true` son inmutables una vez que la Entry está en `COMPLETED`. Validar en backend incluso si el frontend deshabilita el input.

4. **`isStatus` solo para tipos sin companion**: `records.service.create` rechaza con `BadRequestException` si un Record tipo `INSTRUMENTAL / BATCH / SAMPLE / STOCK` declara un field DROPDOWN con `isStatus: true`. Esos tipos manejan su lifecycle vía la entidad companion correspondiente y su enum legacy. El motor genérico DROPDOWN-as-status queda para `PERIODIC / NOT_PERIODIC / NOT_PERIODIC_WITH_REVISION`.

5. **Cascadas (`RecordAction`)**: el motor está generalizado tipo Power Automate. Cada flow es 1 row de la tabla `RecordAction` con:
   - `trigger` (`ENTRY_CREATED | ENTRY_COMPLETED | FIELD_VALUE_CHANGED | COMPARISON_FAILED`).
   - `condition` JSONB recursivo (primitivas + `AND/OR`, operadores `EQUALS / NOT_EQUALS / IN / NOT_IN / LT / LTE / GT / GTE / BETWEEN`).
   - `actionType` (`CREATE_ENTRY` y `UPDATE_FIELD` funcionales; `NOTIFY / EMAIL / WEBHOOK` stubs).
   - `actionConfig` JSONB.
   - `fieldMapping` con soporte de `$entry.id` y `$entry.<fieldId>` para referenciar el padre.
   - `allowCascade` (anti-loop con `triggeredByCascade` propagado).

   El dispatcher vive en `RecordActionListener.dispatchAction`. Si una action falla, **no** rollbackear el cambio que la disparó — loggear y permitir retry manual.

   El editor visual del usuario está en el frontend (tab "Flujos" de `/records/[id]`, ver `apps/web/CLAUDE.md` y `VISUAL_FLOW_EDITOR_SPEC.md`).

6. **Estado de instrumental**: un `Instrument` en `IN_CALIBRATION` o `IN_REPAIR` no puede ser referenciado por una nueva Entry. Validar en `entries.service.create` cuando un campo `RELATED_ENTRY` apunta a un registro `INSTRUMENTAL`.

7. **NC automática**: si una `Entry` tiene un campo `COMPARISON` que falla, crear automáticamente una `NonConformity` asignada al área del Record.

8. **Approval workflow**: las plantillas (Records, Documents, Recipes, Matrices, CalibrationTemplates) tienen `RecordStatus = DRAFT/ACTIVE/SUPERSEDED` y atraviesan `ApprovalRequest` + `ApprovalDecision` antes de pasar a `ACTIVE`.

## Validaciones críticas

- **Fórmulas (`FORMULA`)**: `formula-evaluator.service.ts` usa `mathjs` con scope explícito. Solo permite operadores aritméticos básicos. Validar que las variables referenciadas existan y sean `NUMBER`.
- **Comparisons (`COMPARISON`)**: `comparison-evaluator.service.ts` evalúa contra constante o contra otro campo del mismo Record. Resultado se guarda en `Entry.comparisonResults`.
- **Related entries**: validar que el `relatedRecordId` pertenezca a la misma organización y que los `relatedFieldIds` sean tipos compatibles.
- **Identifiers únicos**: si un Record tiene tipo con identifier (`PERIODIC`, `INSTRUMENTAL`, `BATCH`, `SAMPLE`, etc.), la combinación de valores `isIdentifier` debe ser única dentro del Record.

## Manejo de errores

`PrismaExceptionFilter` global mapea:
- `P2002` (unique violation) → 409 Conflict
- `P2025` (record not found) → 404 Not Found
- Otros → 500 Internal Server Error

En services usar `NotFoundException` y `BadRequestException` con mensajes en **español** (los muestra el frontend).

## Migraciones Prisma

Ubicación: `apps/api/prisma/migrations/<YYYYMMDD>_<descriptive_name>/migration.sql`. Hay 36 migraciones; ver carpetas para evolución cronológica.

> **No usar `pnpm db:migrate`** (es `prisma migrate dev`): el historial tiene drift y ofrecería resetear la base. Usar `npx prisma migrate deploy`. Ver `TO_DO.md` §5.

**Workflow**: editar `schema.prisma` → crear la carpeta y el `migration.sql` a mano → revisar el SQL → `npx prisma migrate deploy` → `npx prisma generate`. Si toca una tabla append-only o borra datos, frenar y revisar el plan de rollback.

## Testing

**Vitest**, config en `vitest.config.mts`. Los tests van al lado del código como
`*.spec.ts` y quedan fuera del build gracias a `tsconfig.build.json`.

```bash
pnpm --filter @synapse/api test         # una corrida
pnpm --filter @synapse/api test:watch   # modo watch
pnpm test                               # todo el monorepo, vía turbo
```

Hay 70 tests, todos de lógica pura (sin base de datos):

- `common/flows/flow-config.spec.ts` — qué configuración de flujo se puede
  guardar y cuál se ejecuta.
- `common/flows/flow-evaluation.spec.ts` — resolución de paths (`$entry`,
  `$batch`, `$sample`, `$instrument`, `$event`) y evaluación de condiciones.
- `common/interceptors/audit-entities.spec.ts` — incluye un test que recorre
  **todas** las entidades del mapa y falla si alguna produce un `where` sin
  filtro de organización; agregar una entidad mal acotada rompe el build.
- `common/storage/local-storage.service.spec.ts` — firma HMAC, vencimiento y
  escape de directorio.
- `modules/auth/auth-code.service.spec.ts` — un solo uso y vencimiento.

Se elige Vitest sobre Jest porque entiende TypeScript sin `ts-jest`.

Lo que falta cubrir está en `TO_DO.md` §15.
