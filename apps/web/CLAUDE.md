# Synapse Web (apps/web)

Frontend Next.js 14 (App Router) del sistema Synapse. PWA mobile-first orientada a operación industrial (laboratorios y plantas), con formularios dinámicos generados desde el `Record Builder`.

## Stack

- **Next.js 14** App Router con TypeScript strict
- **Tailwind CSS** + **shadcn/ui** (base — no reemplazar)
- **React Hook Form** + **Zod** para formularios (los schemas vienen de `@synapse/validators`)
- **TanStack Query** para fetching, cache e invalidación
- **Zustand** para estado global liviano (`store/organization.store.ts`)
- **@xyflow/react** para el editor visual de flujos y el mapa global

> `next-pwa` **no está instalado**: hay `manifest.json` pero no service worker,
> así que la app es instalable pero no funciona offline. Ver `TO_DO.md` §13.

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
    flows/page.tsx                      ← mapa global de relaciones entre registros
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

Rutas previstas y no implementadas: `samples/[id]/custody/` y `records/[id]/entries/new`. Ver `TO_DO.md` §9 y §17.

## Estructura de componentes

```
apps/web/src/
  components/
    brand/
      brain-mark.tsx
    layout/
      sidebar.tsx · header.tsx · logo.tsx
      ↳ grupos de la sidebar: Dashboard (suelto) · Estructura · Catálogos ·
        Seguimiento · Calidad · Configuración. Un grupo con label vacío se
        renderiza sin encabezado.
      notifications-panel.tsx          ← campanita: avisos de la acción NOTIFY
    records/
      column-picker.tsx                ← qué columnas ve cada usuario
      use-column-preferences.ts        ← preferencia por usuario y registro
      audit-timeline.tsx               ← historia del registro y sus entradas
    ui/                                 ← shadcn primitives (no modificar)
      avatar · badge · button · card · separator · tooltip
    forms/
      entry-action-bar.tsx
      record-fields-editor.tsx
      dynamic-record-form/
        index.tsx · fields.tsx · helpers.ts · types.ts
    flow-editor/
      FlowEditor.tsx · types.ts · index.ts ← editor visual de flujos (xyflow)
    kanban/
      kanban-board.tsx · types.ts · index.ts ← drag-drop entre columnas
    tweaks/
      density-provider.tsx · tweaks-panel.tsx
  
  lib/
    api.ts                              ← API client centralizado
  
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
| `FORMULA` | read-only; el valor lo calcula el backend |
| `RECIPE_SELECT` / `MATRIX_METHOD` / `QUANTITY` / `CALIBRATION_TEMPLATE` | tipos especializados — ver `fields.tsx` |

**Reglas**:
- `FORMULA` nunca va en el body del POST: lo calcula el backend. `mathjs` no es dependencia del frontend, pese a lo que sugieren algunos textos de la UI.
- `COMPARISON` muestra resultado en tiempo real, pero el resultado canónico viene del backend al guardar.
- Campos `isIdentifier` se deshabilitan en edición de Entry `COMPLETED` (mostrar tooltip explicativo).
- Antes de permitir uso de un instrumento en una Entry, mostrar su estado actual (no permitir si `IN_CALIBRATION`/`IN_REPAIR`).

## Record Builder

Ubicado en `records/new/page.tsx` + `components/forms/record-fields-editor.tsx`. Permite definir los campos OWN de un Record con configuración inline para `COMPARISON` y `FORMULA`. Drag & drop para reordenar.

## Detalle de Record (`/records/[id]/page.tsx`) — tabs

El componente `SynEntriesTabbedCard` (interno al page) renderiza una de estas tabs:

- **Entries** — tabla de entries del Record. Default si el Record NO tiene field `isStatus`.
- **Kanban** — drag-drop entre columnas según el field DROPDOWN con `comparisonConfig.isStatus: true`. Aparece SOLO cuando ese field existe; default cuando aparece. Componente: `components/kanban/`. Las transitions y `requireReason` se respetan vía `KanbanBoard.allowedTransitions` y modal de motivo.
- **Versiones** — historial de versiones del Record (cuando se editan campos vía `editWithVersion`).
- **Auditoría** — timeline del registro y de todas sus entradas, con los campos
  que cambiaron y sus valores anterior y nuevo. Consume `GET /audit/record/:id`,
  que devuelve una vista reducida —sin IP ni payloads crudos— y por eso admite
  también a `QUALITY_MANAGER`, mientras que `/audit` sigue limitado a `ADMIN` y
  `AUDITOR`.
- **Definición** — estructura de campos del Record.
- **Flujos · N** — Visual Flow Editor. Mapa mental horizontal: el registro
  origen a la izquierda y **una rama por flujo** a la derecha, unidas por curvas
  bezier con un color por rama. Cada rama es **un solo nodo compacto** que dice
  a dónde va y cuándo se dispara; el detalle se edita en el panel derecho. Los
  flujos con configuración incompleta se pintan en rojo con `!` y la leyenda
  "no corre", porque efectivamente el backend no los ejecuta. Al estar activo el
  tab, la sidebar izquierda se oculta para que el canvas ocupe todo el ancho.
  Componente: `components/flow-editor/`. Lib: `@xyflow/react`.

El padre `RecordDetailPage` trackea el tab activo (state `recordTab`) vía callback `onTabChange` para condicionar el layout.

## Auth

Flujo propio, **sin next-auth**:

1. `/login` manda a `GET /api/auth/google` en el backend.
2. Google vuelve al backend, que verifica la whitelist y redirige al frontend
   con un **código de un solo uso** — nunca con el JWT, que quedaría escrito en
   los logs del servidor y en el historial.
3. `(auth)/callback` canjea ese código por el JWT vía `POST /api/auth/exchange`
   y lo guarda en `localStorage` como `synapse_token`.
4. Si el email está habilitado en varias organizaciones, el backend redirige a
   `(auth)/select-org`, que usa el mismo código para listar las organizaciones y
   canjear al elegir.

El código vence a los 2 minutos y sirve una sola vez.

`lib/api.ts` agrega el header `Authorization` en cada llamada y redirige a
`/login` ante un 401.

`middleware.ts` corta el acceso a las páginas privadas antes de renderizarlas.
Lee una cookie que **solo contiene el vencimiento** del JWT, nunca el token: es
lo único que necesita para enrutar, y meter el JWT en una cookie legible por
JavaScript no agregaría seguridad sobre `localStorage`.

Es enrutado, **no control de acceso**. La autorización real sigue en la API;
quien fabrique la cookie llega al cascarón de la app y a ningún dato.

`lib/session.ts` centraliza `saveSession` / `clearSession` / `getToken` y
mantiene `localStorage` y cookie en sincronía. Después de guardar la sesión hay
que navegar con `window.location`, no con `router.replace`: una navegación de
cliente no vuelve a pasar por el middleware y no vería la cookie nueva.

## PWA

`public/manifest.json` con tema `#0C1324`, `display: standalone`,
`start_url: /dashboard`, así que la app es instalable.

**No hay service worker**: `next-pwa` no está instalado. Sin cache offline ni
push notifications. Ver `TO_DO.md` §13.

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

Configurados en `next.config.js`: CSP, `X-Frame-Options: DENY`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y HSTS.

Cuatro decisiones que conviene no romper sin entenderlas:

- **`frame-src` incluye el origen de R2.** El visor de documentos embebe el PDF
  en un `<iframe>` contra la URL firmada; sin esa directiva el preview queda en
  blanco, sin error visible.
- **`unsafe-eval` solo en desarrollo.** Lo necesitan el refresh de React y los
  source maps de webpack; en producción no hace falta.
- **`connect-src` incluye `ws://localhost` en desarrollo**, si no la CSP corta
  el websocket del HMR.
- **HSTS solo en producción**, para no fijarlo desde localhost y afectar otros
  proyectos locales servidos por http en el mismo host.

`camera=(self)` está permitido porque el alta de registros usa
`capture="environment"`.

El origen de R2 sale de `NEXT_PUBLIC_R2_URL`, que fija el bucket exacto. Sin esa
variable se cae a un comodín de subdominio, que funciona pero acepta cualquier
cuenta de Cloudflare.

`distDir` se lee de `NEXT_DIST_DIR`, así que se puede construir en un directorio
aparte sin editar el archivo — editarlo con el dev server corriendo lo hace
recargar y apuntar al directorio temporal.

## Testing

**Vitest** con `jsdom`, config en `vitest.config.mts`. Los tests van al lado del
código como `*.spec.ts` / `*.spec.tsx`.

```bash
pnpm --filter @synapse/web test
pnpm test                          # todo el monorepo, vía turbo
```

34 tests: los helpers de fórmulas y comparaciones (varios casos existen para
fijar que el preview coincida con el evaluador del backend, que son
implementaciones separadas), el manejo de sesión —incluido uno que verifica que
la cookie **no** contenga el token— y el `DynamicRecordForm`, sobre todo la
regla de que un campo identificador queda bloqueado cuando la entrada está
`COMPLETED`.

Dos detalles del entorno: `jsdom` está fijado en la 25 porque la 30 arrastra una
dependencia ESM que Node 20 no puede requerir, y el config declara
`esbuild.jsx: 'automatic'` porque Vitest no hereda la transformación de JSX de
Next.

El backend tiene 116. Lo que falta cubrir está en `TO_DO.md` §15.
