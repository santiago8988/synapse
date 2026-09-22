# @synapse/validators

Schemas Zod compartidos entre `apps/api` y `apps/web`. Garantiza que la misma validación se aplica del lado del cliente y del servidor.

## Estructura

```
packages/validators/src/
  index.ts          ← re-exporta todo
  area.ts           ← áreas (árbol)
  auth.ts           ← flujo de ingreso: exchange, switch-org
  document.ts       ← documentos: alta y edición
  entry.ts          ← entries + límites de Entry.data
  json.ts           ← JSON acotado para las columnas de configuración
  organization.ts   ← organización, puestos, líder de área, capacitaciones
  record.ts         ← registros y flujos (RecordAction)
  record-field.ts   ← comparisonConfig de DROPDOWN, condiciones y actionConfig
  whitelist.ts      ← EmailWhitelist y miembros de la organización
```

**El paquete emite CommonJS** (`main: ./dist/index.js`). Los schemas son valores
en runtime, no tipos: `apps/api` compila a CommonJS y hace un `require` real, y
apuntar `main` al `.ts` dejaba el dist sin arrancar. `types` sigue en `src` para
que el typecheck y el editor no necesiten build previo.

## Reglas

1. **Una validación por entidad**. Si un Record tiene reglas particulares, vivirlas acá, no en el componente.
2. **Exportar schema y tipo inferido**:
   ```typescript
   export const createAreaSchema = z.object({ ... })
   export type CreateAreaInput = z.infer<typeof createAreaSchema>
   ```
3. **Mensajes de error en español** — los mensajes los muestra directamente el frontend.

   > Los schemas agregados en la Fase 1.1 del plan de seguridad usan en buena
   > parte los mensajes por defecto de Zod, que vienen en inglés. Hoy no se ven:
   > `ZodValidationInterceptor` responde un `message` generico y el frontend lee
   > solo ese. Las dos puntas del problema estan anotadas juntas en
   > `TO_DO.md` §25.
4. **No importar de NestJS ni de React** — el package es agnóstico.
5. **No importar de `@prisma/client`** — usar tipos de `@synapse/types` cuando se necesiten enums.

## Reglas ISO específicas que viven acá

Las siguientes validaciones son críticas para certificación y **deben** estar en `@synapse/validators` (no replicarse ad-hoc en cada lado):

1. **`isIdentifier` en Entry COMPLETED**: schema que valida que en un PATCH a una entry COMPLETED no vengan campos identificadores.
2. **`comparisonConfig`**: forma del JSON validada — operador válido, `compareAgainst` correcto, `secondValue` requerido si `BETWEEN`, `fieldId` requerido si `compareAgainst = 'FIELD'`.
3. **`formulaConfig`**: validar que la `expression` solo contenga IDs de campos existentes (no validar la sintaxis matemática acá — eso lo hace `mathjs` en backend).
4. **Email de whitelist**: lowercase + trim antes de validar formato.
5. **`fieldMapping` de RecordAction**: cada par `{ sourceFieldId, targetFieldId }` debe ser de tipos compatibles.
6. **Texto que se va a uppercasear**: validar que no tenga caracteres no imprimibles antes del upper-case.

## Patrón

```typescript
import { z } from 'zod'

export const createWhitelistSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase().trim(),
  role: z.enum(['ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN', 'AUDITOR']),
  areaId: z.string().nullable().optional(),
})

export type CreateWhitelistInput = z.infer<typeof createWhitelistSchema>
```

En backend: `@ZodBody(schema)` sobre el handler
(`apps/api/src/common/decorators/zod-body.decorator.ts`). Lo aplica
`ZodValidationInterceptor`, que corre global. **No funciona en endpoints
multipart** —ahi el interceptor global corre antes que multer y el body todavia
no existe— asi que las subidas validan en el handler; el interceptor devuelve
400 si se le pone el decorador igual.

`ZodValidationPipe` (`common/pipes/zod-validation.pipe.ts`) quedo sin uso: un
pipe global no recibe el `ExecutionContext` y no puede saber que schema le toca
al handler.
En frontend: usar con `react-hook-form` + `zodResolver` de `@hookform/resolvers/zod`.

## Cuando agregar un schema nuevo

1. Crear archivo `<entidad>.ts` con todos los schemas de esa entidad.
2. Exportar schema + tipo inferido.
3. Re-exportar desde `index.ts`.
4. En backend: `@ZodBody(schema)` en el handler (no en endpoints multipart).
5. En frontend: pasar el schema al `useForm({ resolver: zodResolver(schema) })`.
6. Antes de dar por hecho el schema, **verificar contra lo que el frontend manda
   hoy**. El riesgo de validar no es dejar pasar algo: es rechazar algo legitimo
   y romper una pantalla que funcionaba.
