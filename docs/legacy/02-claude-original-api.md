# QualitTab API — apps/api/CLAUDE.md

## Stack
- NestJS con TypeScript strict
- Prisma + PostgreSQL
- BullMQ + Redis (scheduling y notificaciones)
- Passport.js + Google OAuth (sin contraseñas)
- JWT para sesiones
- Zod para validación
- Cloudflare R2 para storage (@aws-sdk/client-s3)
- mathjs para evaluar fórmulas (nunca eval())

## Estructura de módulos

```
apps/api/src/
  main.ts
  app.module.ts
  
  modules/
    auth/             ← Google OAuth, JWT, whitelist check
    organizations/    ← CRUD org, áreas (árbol), whitelist
    users/            ← perfil, membresías
    documents/        ← documentos ISO, versiones, upload R2
    records/          ← templates, RecordField, RecordAction
    entries/          ← instancias, cálculo de fórmulas/comparaciones
    instruments/      ← CRUD instrumental, cambio de estado
    non-conformities/ ← no conformidades, acciones correctivas
    notifications/    ← BullMQ workers, scheduling
    audit/            ← escritura y lectura de AuditLog
    storage/          ← wrapper de R2
    
  common/
    guards/
      jwt-auth.guard.ts
      roles.guard.ts
      tenant.guard.ts       ← inyecta organizationId en el request
      area-access.guard.ts  ← verifica acceso jerárquico al área
    decorators/
      current-user.decorator.ts
      organization.decorator.ts
      roles.decorator.ts
    interceptors/
      audit.interceptor.ts  ← loguea automáticamente cambios
    filters/
      prisma-exception.filter.ts
    pipes/
      zod-validation.pipe.ts
```

## Auth Flow

```
1. Frontend redirige a Google OAuth
2. Google callback → Passport verifica el id_token
3. Extraemos email del perfil Google
4. Buscamos email en EmailWhitelist (cualquier organización)
5. Si no existe → 401 "No autorizado"
6. Si existe → buscamos o creamos User + OrganizationUser
7. Generamos JWT con payload:
   {
     sub: user.id,
     email: user.email,
     organizationId: string,
     role: UserRole,
     areaId: string | null
   }
8. Retornamos JWT al frontend (cookie httpOnly)
```

### Importante
- Un email puede estar en la whitelist de múltiples organizaciones
- En ese caso, el usuario elige con cuál organización loguear (selector en frontend)
- El JWT siempre tiene UN organizationId activo
- Para cambiar de organización, debe re-autenticar o usar endpoint `/auth/switch-org`

## Guards

### TenantGuard
Se aplica a **todos** los endpoints. Lee el `organizationId` del JWT
y lo inyecta en `request.organizationId`. Todas las queries usan este valor.
Nunca tomar `organizationId` del body o params sin validar contra el JWT.

### AreaAccessGuard
Para verificar que el usuario puede ver/editar una entidad de un área específica.
Resuelve el árbol recursivo: un usuario puede acceder a su área y todas las sub-áreas.

```typescript
// Pseudocódigo del algoritmo
async function canAccessArea(userAreaId: string, targetAreaId: string): boolean {
  // Obtener todos los descendientes del área del usuario
  const descendants = await getDescendantAreaIds(userAreaId)
  return descendants.includes(targetAreaId) || userAreaId === targetAreaId
}
```

### RolesGuard
Verifica que el rol del JWT tenga permiso para la acción:
- `AUDITOR`: solo GET
- `TECHNICIAN`: GET + POST entries
- `QUALITY_MANAGER`: GET + POST/PATCH records, documents, entries
- `ADMIN`: todo

## Módulos clave

### Records Module
El más complejo. Al crear/actualizar un Record con campos `COMPARISON` o `FORMULA`,
el backend debe validar que:
- Los campos referenciados en `comparisonConfig.fieldId` existen en el mismo Record
- Los campos en `formulaConfig.expression` existen y son de tipo NUMBER
- Los campos `RELATED_ENTRY` apuntan a un Record de la misma organización
- El campo mapeado en `relatedFieldIds` tiene tipo compatible

### Entries Module

**Al guardar una Entry (POST o PATCH):**

1. Validar que todos los campos requeridos tienen valor
2. Para campos `FORMULA`: evaluar con `mathjs`, guardar en `formulaResults`
3. Para campos `COMPARISON`: evaluar condición, guardar en `comparisonResults`
   - Si alguna comparación FALLA → crear NonConformity automáticamente
4. Para campos `isIdentifier`: si ya existe una Entry con los mismos valores
   de identifier → es una "revisión", no una entrada nueva (según tipo de Record)
5. Si el Record tiene `RecordAction` como source → disparar creación de Entry en target
6. Escribir AuditLog
7. Si es Entry de Record PERIODIC → calcular y guardar próxima Entry (dueDate = hoy + periodicity)

**Campos identifier:**
- Una vez que la Entry está en status `COMPLETED`, los campos `isIdentifier` son read-only
- El frontend debe deshabilitar esos inputs

### Notifications Module (BullMQ)

**Jobs:**
- `check-due-entries`: corre diariamente, busca Entries con
  `dueDate <= now() + notifyDaysBefore` y encola notificaciones
- `send-notification`: envía email/push al usuario responsable del área
- `instrument-status-check`: verifica instrumentos en calibración/reparación
  y notifica si superaron tiempo estimado

**Queue names:**
- `notifications`
- `entry-scheduling`

## Endpoints principales

### Auth
```
GET  /auth/google              ← inicia OAuth
GET  /auth/google/callback     ← callback de Google
POST /auth/switch-org          ← cambia org activa en JWT
GET  /auth/me                  ← usuario actual
POST /auth/logout
```

### Organizations
```
GET    /organizations/:id
PATCH  /organizations/:id
GET    /organizations/:id/areas          ← árbol completo
POST   /organizations/:id/areas
PATCH  /organizations/:id/areas/:areaId
DELETE /organizations/:id/areas/:areaId
GET    /organizations/:id/whitelist
POST   /organizations/:id/whitelist
DELETE /organizations/:id/whitelist/:whitelistId
GET    /organizations/:id/users
PATCH  /organizations/:id/users/:userId  ← cambiar rol/área
```

### Documents
```
GET    /documents
POST   /documents
GET    /documents/:id
PATCH  /documents/:id
POST   /documents/:id/upload   ← sube PDF a R2
POST   /documents/:id/version  ← crea nueva versión (supersede la anterior)
```

### Records
```
GET    /records
POST   /records
GET    /records/:id
PATCH  /records/:id
DELETE /records/:id            ← soft delete (isActive = false)
POST   /records/:id/fields     ← agrega campo OWN
PATCH  /records/:id/fields/:fieldId
DELETE /records/:id/fields/:fieldId
POST   /records/:id/actions    ← agrega RecordAction
DELETE /records/:id/actions/:actionId
```

### Entries
```
GET    /records/:recordId/entries
POST   /records/:recordId/entries
GET    /records/:recordId/entries/:id
PATCH  /records/:recordId/entries/:id
POST   /records/:recordId/entries/:id/complete  ← cambia status a COMPLETED
```

### Instruments
```
GET    /instruments
POST   /instruments
GET    /instruments/:id
PATCH  /instruments/:id
POST   /instruments/:id/status  ← cambia estado con motivo
GET    /instruments/:id/history ← InstrumentStatusLog
```

### Non-Conformities
```
GET    /non-conformities
POST   /non-conformities        ← creación manual
GET    /non-conformities/:id
PATCH  /non-conformities/:id
POST   /non-conformities/:id/corrective-actions
PATCH  /non-conformities/:id/corrective-actions/:actionId
POST   /non-conformities/:id/resolve
```

### Audit
```
GET    /audit-logs              ← con filtros por entityType, entityId, userId, fechas
```

## Reglas de negocio críticas

1. **Nunca** retornar datos sin filtrar por `organizationId` del JWT
2. **Nunca** usar `eval()` para fórmulas — solo `mathjs`
3. Los campos `isIdentifier` de una Entry `COMPLETED` son inmutables
4. Un instrumento en `IN_CALIBRATION` o `IN_REPAIR` no puede usarse en entradas nuevas
5. Al crear una NonConformity automáticamente (por comparison fallida),
   asignarla al `OrganizationUser` responsable del área del Record
6. El AuditLog es append-only — nunca UPDATE ni DELETE en esa tabla
7. Las versiones de documentos son inmutables una vez publicadas (`ACTIVE`)
8. Al hacer una nueva versión de Document, el estado anterior pasa a `SUPERSEDED`

## Manejo de errores
Usar filtro global `PrismaExceptionFilter` que convierte errores de Prisma
a respuestas HTTP apropiadas:
- `P2002` (unique constraint) → 409 Conflict
- `P2025` (not found) → 404 Not Found
- Otros → 500 Internal Server Error

## Testing
- Unit tests para: cálculo de fórmulas, evaluación de comparaciones, resolución de árbol de áreas
- Integration tests para: auth flow, creación de entries con RecordActions
