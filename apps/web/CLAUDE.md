# Synapse Web (apps/web)

Frontend Next.js 14 (App Router) del sistema Synapse. PWA mobile-first orientada a operación industrial (laboratorios y plantas), con formularios dinámicos generados desde el `Record Builder`.

## Stack

- **Next.js 14** App Router con TypeScript strict
- **Tailwind CSS** + **shadcn/ui** (base — no reemplazar)
- **React Hook Form** + **Zod** para formularios (los schemas vienen de `@synapse/validators`)
- **TanStack Query** para fetching, cache e invalidación
- **Zustand** para estado global liviano (`store/organization.store.ts`)
- **next-pwa** para PWA (`public/manifest.json`)
- **next-auth** para Google OAuth (rutas `(auth)/login`, `(auth)/callback`, `(auth)/select-org`)

## Estructura de rutas (App Router)

```
apps/web/src/app/
  layout.tsx                            ← root layout
  globals.css                           ← Tailwind + tokens de tema
  
  (auth)/
    login/page.tsx
    callback/page.tsx
    select-org/page.tsx                 ← cuando email está en múltiples orgs
  
  (app)/
    layout.tsx                          ← shell con sidebar + header + density provider
    dashboard/page.tsx
    records/
      page.tsx                          ← lista
      new/page.tsx                      ← Record Builder
      [id]/page.tsx                     ← detalle + entries (entries inline)
    documents/page.tsx
    recipes/page.tsx
    matrices/page.tsx
    methods/page.tsx
    calibration-templates/page.tsx
    batches/[id]/page.tsx + page.tsx
    samples/[id]/page.tsx + page.tsx
    instruments/[id]/page.tsx + page.tsx
    calibrations/[id]/page.tsx + page.tsx
    stock/page.tsx
    non-conformities/[id]/page.tsx + page.tsx
    approvals/page.tsx
    audit/page.tsx
    settings/page.tsx
    docs/page.tsx
```

**Pendiente**: `samples/[id]/custody/page.tsx` (ver `SAMPLE_CUSTODY_SPEC.md`), subruta dedicada `records/[id]/entries/new` (hoy se maneja inline).

## Estructura de componentes

```
apps/web/src/
  components/
    brand/
      brain-mark.tsx
    layout/
      sidebar.tsx · header.tsx · logo.tsx
    ui/                                 ← shadcn primitives (no modificar)
      avatar · badge · button · card · separator · tooltip
    forms/
      entry-action-bar.tsx
      record-fields-editor.tsx
      dynamic-record-form/
        index.tsx · fields.tsx · helpers.ts · types.ts
    tweaks/
      density-provider.tsx · tweaks-panel.tsx
  
  lib/
    api.ts                              ← API client centralizado (16.7 KB)
  
  store/
    organization.store.ts               ← org activa + usuario
```

**No existe `hooks/` todavía** — la lógica está inline. Si se agrega, ubicarlo en `apps/web/src/hooks/` con prefijo `use-*.ts`.

## Patrones obligatorios

1. **Mantener shadcn/ui como base**. Para componentes nuevos: extender, no reemplazar.
2. **Mobile-first real**: la app se usa con guantes en planta. Inputs grandes, áreas táctiles ≥ 44px, botones de acción fijos en bottom en mobile.
3. **UI siempre en español**, código en inglés.
4. **Validación con Zod compartida**: importar schemas desde `@synapse/validators`. No duplicar reglas en frontend y backend.
5. **Texto se muestra en MAYÚSCULAS**: el backend ya guarda así campos `TEXT` y `DROPDOWN`. El frontend no necesita transformar al renderizar (ya viene upper).
6. **TanStack Query**: usar `queryKey: ['recurso', orgId, ...args]`. Toda mutation invalida los keys correspondientes en `onSuccess`.
7. **Datos cross-tenant**: el JWT del backend ya filtra, pero el frontend no debe asumir — siempre incluir `organizationId` (o el activo del store) en las llamadas que lo requieran.

## Dynamic Record Form

El formulario dinámico es el corazón de la app (`components/forms/dynamic-record-form/`). Renderiza inputs según `fieldType`:

| FieldType | Render |
|---|---|
| `NUMBER` | input numérico |
| `TEXT` | input texto / textarea (uppercase server-side) |
| `DATE` | date picker |
| `DROPDOWN` | select (uppercase) |
| `RELATED_ENTRY` | selector con búsqueda de entries de otro Record |
| `MULTIPLE_RELATED_ENTRY` | selector múltiple |
| `COMPARISON` | input + badge ✓/✗ en tiempo real |
| `FORMULA` | read-only, calcula en cliente con `mathjs` |
| `RECIPE_SELECT` / `MATRIX_METHOD` / `QUANTITY` / `CALIBRATION_TEMPLATE` | tipos especializados — ver `fields.tsx` |

**Reglas**:
- `FORMULA` nunca va en el body del POST (el backend recalcula).
- `COMPARISON` muestra resultado en tiempo real, pero el resultado canónico viene del backend al guardar.
- Campos `isIdentifier` se deshabilitan en edición de Entry `COMPLETED` (mostrar tooltip explicativo).
- Antes de permitir uso de un instrumento en una Entry, mostrar su estado actual (no permitir si `IN_CALIBRATION`/`IN_REPAIR`).

## Record Builder

Ubicado en `records/new/page.tsx` + `components/forms/record-fields-editor.tsx`. Permite definir los campos OWN de un Record con configuración inline para `COMPARISON` y `FORMULA`. Drag & drop para reordenar.

## Auth

Setup de **next-auth** con provider Google. La verificación de whitelist y la asignación de `organizationId/role/areaId` se hace en el callback `signIn`, llamando al backend.

**Por implementar**: `middleware.ts` para proteger rutas `(app)/*` redirigiendo a `/login` si no hay sesión válida.

## PWA

`public/manifest.json` con tema `#0C1324`, `display: standalone`, `start_url: /dashboard`. `next-pwa` se configura en `next.config.js` (hoy mínimo — solo `transpilePackages` para `@synapse/types` y `@synapse/validators`).

**Pendiente**: estrategia de cache para assets estáticos y runtime caching para llamadas a la API; push notifications para vencimientos.

## Paleta y estados de badges

Los tokens de color están en `globals.css`. Estados visuales canónicos:

- **Entry**: DRAFT gris · COMPLETED verde · REQUIRES_REVISION amarillo · APPROVED azul · INACTIVE gris+tachado
- **Instrument**: ACTIVE verde · IN_CALIBRATION azul (icono reloj) · IN_REPAIR naranja (icono herramienta) · DECOMMISSIONED rojo
- **Document**: DRAFT · ACTIVE · SUPERSEDED
- **NonConformity**: OPEN · IN_PROGRESS · RESOLVED · CLOSED
- **Batch**: PLANNED · IN_PROGRESS · COMPLETED · APPROVED · REJECTED · CANCELLED
- **Sample**: RECEIVED · IN_TESTING · COMPLETED · CANCELLED

Paleta base: Primary `blue-600` · Success `green-600` · Warning `amber-500` · Danger `red-600` · Neutral `slate`.

## Manejo de errores HTTP

- `401` → redirect a `/login`
- `403` → toast "No tenés permisos para esta acción"
- `404` → página `not-found`
- `500` → toast genérico + log a consola

Los mensajes de error del backend vienen en español — mostrarlos directamente en el toast.

## Reglas ISO/seguridad específicas

1. Nunca exponer datos de otras organizaciones — el JWT lo garantiza pero verificar visualmente al navegar.
2. Confirmar acción de "Inactivar Entry" con preview de cascada (cuántas entries y entidades companion se afectan) antes de submit.
3. En la vista de detalle de un `Document` con `status = ACTIVE`, no mostrar UI de edición — solo "Crear nueva versión".
4. La vista de `AuditLog` (`audit/page.tsx`) es de solo lectura y no expone JWT, IPs ni payloads sensibles fuera del rol `ADMIN`/`AUDITOR`.

## Headers de seguridad

`next.config.js` está mínimo. **Pendiente** de configurar (ver skill `synapse-security-headers`):
- `Content-Security-Policy` (permitir solo el origen de la API y dominio R2 público)
- `Strict-Transport-Security`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` minimizada
