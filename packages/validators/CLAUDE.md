# @synapse/validators

Schemas Zod compartidos entre `apps/api` y `apps/web`. Garantiza que la misma validación se aplica del lado del cliente y del servidor.

## Estructura

```
packages/validators/src/
  index.ts          ← re-exporta todo
  area.ts           ← validación de áreas (árbol)
  auth.ts           ← validación de payloads de auth
  organization.ts   ← validación de organización y settings
  whitelist.ts      ← validación de EmailWhitelist
```

## Reglas

1. **Una validación por entidad**. Si un Record tiene reglas particulares, vivirlas acá, no en el componente.
2. **Exportar schema y tipo inferido**:
   ```typescript
   export const createAreaSchema = z.object({ ... })
   export type CreateAreaInput = z.infer<typeof createAreaSchema>
   ```
3. **Mensajes de error en español** — los mensajes los muestra directamente el frontend.
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

En backend: usar con `ZodValidationPipe` (`apps/api/src/common/pipes/zod-validation.pipe.ts`).
En frontend: usar con `react-hook-form` + `zodResolver` de `@hookform/resolvers/zod`.

## Cuando agregar un schema nuevo

1. Crear archivo `<entidad>.ts` con todos los schemas de esa entidad.
2. Exportar schema + tipo inferido.
3. Re-exportar desde `index.ts`.
4. En backend: aplicar el pipe en el controller.
5. En frontend: pasar el schema al `useForm({ resolver: zodResolver(schema) })`.
