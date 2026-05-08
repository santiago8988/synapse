# QualitTab Web — apps/web/CLAUDE.md

## Stack
- Next.js 14+ con App Router
- TypeScript strict
- Tailwind CSS + shadcn/ui
- React Hook Form + Zod
- next-auth (Google OAuth)
- next-pwa (PWA)
- Zustand (estado global liviano)
- TanStack Query (fetching, cache, mutations)

## PWA Config
El archivo `public/manifest.json` debe tener:
```json
{
  "name": "QualitTab",
  "short_name": "QualitTab",
  "theme_color": "#2563eb",
  "background_color": "#ffffff",
  "display": "standalone",
  "orientation": "portrait",
  "start_url": "/dashboard",
  "icons": [...]
}
```
Configurar `next-pwa` en `next.config.js` con estrategia de cache
para assets estáticos y runtime para llamadas a la API.

## Estructura de carpetas

```
apps/web/src/
  app/
    (auth)/
      login/
        page.tsx              ← pantalla de login con botón Google
    (app)/
      layout.tsx              ← layout con sidebar + header
      dashboard/
        page.tsx
      organizations/
        settings/
          page.tsx            ← config org, áreas, whitelist, usuarios
      documents/
        page.tsx
        [id]/
          page.tsx
      records/
        page.tsx
        new/
          page.tsx
        [id]/
          page.tsx            ← detalle + lista de entries
          entries/
            new/
              page.tsx        ← formulario dinámico de entrada
            [entryId]/
              page.tsx
      instruments/
        page.tsx
        [id]/
          page.tsx
      non-conformities/
        page.tsx
        [id]/
          page.tsx
      audit/
        page.tsx
  
  components/
    ui/                       ← shadcn/ui components (no modificar)
    layout/
      sidebar.tsx
      header.tsx
      breadcrumb.tsx
    forms/
      dynamic-record-form/    ← el componente más complejo
        index.tsx
        field-types/
          number-field.tsx
          text-field.tsx
          date-field.tsx
          related-entry-field.tsx
          comparison-field.tsx
          formula-field.tsx   ← solo lectura, muestra resultado
      record-builder/         ← builder de campos OWN al crear Record
        index.tsx
        field-config-panel.tsx
    records/
      record-card.tsx
      entry-list.tsx
    instruments/
      status-badge.tsx
      status-change-modal.tsx
    non-conformities/
      nc-badge.tsx
    shared/
      area-tree-selector.tsx  ← selector con árbol jerárquico
      user-avatar.tsx
      empty-state.tsx
      loading-skeleton.tsx
  
  lib/
    api/                      ← funciones de fetching tipadas
      records.ts
      entries.ts
      instruments.ts
      ...
    auth.ts                   ← config next-auth
    utils.ts
    formula-evaluator.ts      ← evalúa fórmulas en el cliente (mathjs)
  
  hooks/
    use-organization.ts       ← org y área del usuario actual
    use-area-tree.ts          ← árbol de áreas con utilidades
    use-record-form.ts        ← lógica del formulario dinámico
  
  store/
    organization.store.ts     ← Zustand: org activa, usuario
```

## Componente crítico: Dynamic Record Form

El formulario de entrada (`Entry`) es el corazón del frontend.
Dado un `Record` con sus `RecordField[]`, debe renderizar el formulario correcto.

```typescript
// Lógica de renderizado por tipo de campo:
// NUMBER → input numérico
// TEXT → input texto o textarea
// DATE → date picker
// RELATED_ENTRY → selector que busca entries de otro record
// MULTIPLE_RELATED_ENTRY → selector múltiple
// COMPARISON → input normal + badge de resultado (✓ / ✗) después de ingresar valor
// FORMULA → campo read-only que muestra el resultado calculado en tiempo real
```

**Importante sobre FORMULA:**
Calcular el resultado en tiempo real mientras el usuario tipea,
usando los valores actuales del formulario y la `formulaConfig.expression`.
Usar `mathjs` en el cliente para esto.

**Importante sobre COMPARISON:**
Mostrar visualmente si el valor ingresado cumple o no la condición configurada.
Si no cumple → mostrar badge rojo + mensaje descriptivo de la condición.

**Importante sobre campos IDENTIFIER:**
En modo edición de Entry `COMPLETED`, deshabilitar estos campos completamente.
Mostrar tooltip explicando que no pueden modificarse.

## Record Builder

Al crear un Record, el admin define los campos OWN en un builder interactivo:

1. Agregar campos con tipo
2. Para COMPARISON: aparece panel de configuración inline
   (elegir operador, contra qué comparar, valores)
3. Para FORMULA: aparece editor de expresión con autocomplete de campos disponibles
4. Drag & drop para reordenar campos
5. Toggle "es identificador" por campo
6. Al menos un campo debe ser identificador

## Diseño y UX

### Mobile-first (PWA)
- Sidebar colapsable en mobile (drawer)
- Formularios con inputs grandes, táctiles
- Botones de acción fijos en bottom en mobile
- Cámara nativa para adjuntar fotos en entries (input type=file accept=image/*)

### Paleta de colores
- Primary: blue-600 (#2563eb)
- Success: green-600 (comparación OK, instrumento activo)
- Warning: amber-500 (próximo a vencer)
- Danger: red-600 (vencido, comparación fallida, instrumento fuera de servicio)
- Neutral: slate

### Estados de Entry visuales
- `DRAFT` → badge gris
- `COMPLETED` → badge verde
- `REQUIRES_REVISION` → badge amarillo
- `APPROVED` → badge azul

### Estados de Instrumento
- `ACTIVE` → badge verde
- `IN_CALIBRATION` → badge azul (con ícono de reloj)
- `IN_REPAIR` → badge naranja (con ícono de herramienta)
- `DECOMMISSIONED` → badge rojo/gris

## Auth (next-auth)

```typescript
// lib/auth.ts
// Provider: Google
// Callback signIn: verificar que el email está en whitelist (llamada a API)
// Session: incluir organizationId, role, areaId
// Si el usuario tiene múltiples orgs → redirigir a /select-org
```

Ruta `/select-org`: cuando el email está en whitelist de múltiples organizaciones,
mostrar selector de organización antes de entrar al dashboard.

## Fetching con TanStack Query

```typescript
// Patrón estándar
const { data: records, isLoading } = useQuery({
  queryKey: ['records', organizationId],
  queryFn: () => api.records.list(organizationId),
})

// Mutations siempre invalidan el queryKey correspondiente
const mutation = useMutation({
  mutationFn: api.entries.create,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['entries', recordId] })
  }
})
```

## Manejo de errores
- Errores 401 → redirect a `/login`
- Errores 403 → toast "No tenés permisos para esta acción"
- Errores 404 → página not-found
- Errores 500 → toast con mensaje genérico + log en consola

## Reglas importantes
- Nunca mostrar datos de otras orgs (viene garantizado por el JWT, pero verificar)
- Los campos FORMULA nunca van en el body del POST (son calculados en el backend)
- Los campos IDENTIFIER deshabilitados en edición de Entry COMPLETED
- Siempre mostrar estado del instrumento antes de permitir su uso en una entry
