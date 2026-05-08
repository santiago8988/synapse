import { z } from 'zod'

/**
 * Schemas de validación para `RecordField.comparisonConfig` cuando el field
 * es DROPDOWN. Acepta dos formas:
 *   - Legacy: `{ options: string[], units?: string[] }` (lo que ya guardaban
 *     los seeds y los configuradores existentes).
 *   - Rica con status: `{ options: DropdownStateOption[], isStatus?, transitions? }`.
 *
 * El backend usa estos schemas en el flujo de Records (crear/editar fields)
 * y en el flujo de Entries (validar transitions al hacer update).
 */

const userRoleSchema = z.enum(['ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN', 'AUDITOR'])

const stateColorSchema = z.enum(['gray', 'slate', 'blue', 'green', 'amber', 'red'])

export const dropdownStateOptionSchema = z.object({
  value: z.string().min(1, 'El value de la opción es obligatorio').max(64),
  label: z.string().max(120).optional(),
  color: stateColorSchema.optional(),
  isInitial: z.boolean().optional(),
  isFinal: z.boolean().optional(),
  description: z.string().max(500).optional(),
})
export type DropdownStateOptionInput = z.infer<typeof dropdownStateOptionSchema>

export const fieldTransitionSchema = z.object({
  from: z.string().min(1, 'El estado origen es obligatorio'),
  to: z.string().min(1, 'El estado destino es obligatorio'),
  requiredRoles: z.array(userRoleSchema).optional(),
  requireReason: z.boolean().optional(),
})
export type FieldTransitionInput = z.infer<typeof fieldTransitionSchema>

/**
 * Schema completo del comparisonConfig de DROPDOWN. Las dos formas de
 * `options` (string[] vs DropdownStateOption[]) se aceptan vía union.
 */
export const dropdownStatusConfigSchema = z
  .object({
    options: z.union([
      z.array(z.string().min(1).max(64)).min(1, 'Al menos una opción es requerida'),
      z.array(dropdownStateOptionSchema).min(1, 'Al menos una opción es requerida'),
    ]),
    isStatus: z.boolean().optional(),
    transitions: z.array(fieldTransitionSchema).optional(),
    units: z.array(z.string().min(1).max(32)).optional(),
  })
  .superRefine((cfg, ctx) => {
    // Si declara isStatus, las options deben ser ricas (con metadata).
    if (cfg.isStatus) {
      const isRich =
        Array.isArray(cfg.options) &&
        cfg.options.length > 0 &&
        typeof cfg.options[0] === 'object'
      if (!isRich) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'Cuando isStatus es true, options debe ser un array de objetos con value (no strings)',
        })
        return
      }

      const opts = cfg.options as DropdownStateOptionInput[]

      // Exactamente un option debe tener isInitial: true.
      const initials = opts.filter((o) => o.isInitial)
      if (initials.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'Un campo isStatus debe tener exactamente una opción con isInitial: true',
        })
      } else if (initials.length > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: `Hay ${initials.length} opciones con isInitial: true; debe ser exactamente una`,
        })
      }

      // Values deben ser únicos.
      const seen = new Set<string>()
      for (const o of opts) {
        if (seen.has(o.value)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['options'],
            message: `El value "${o.value}" está duplicado entre las opciones`,
          })
          break
        }
        seen.add(o.value)
      }

      // Cada transition.from y .to debe corresponder a un option.value (o "*" en from).
      if (cfg.transitions) {
        const validValues = new Set(opts.map((o) => o.value))
        cfg.transitions.forEach((t, i) => {
          if (t.from !== '*' && !validValues.has(t.from)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['transitions', i, 'from'],
              message: `"${t.from}" no es una opción válida ni "*"`,
            })
          }
          if (!validValues.has(t.to)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['transitions', i, 'to'],
              message: `"${t.to}" no es una opción válida`,
            })
          }
        })
      }
    }
  })
export type DropdownStatusConfigInput = z.infer<typeof dropdownStatusConfigSchema>

/**
 * Helper: parsea un comparisonConfig que vino de la DB (Json) y devuelve
 * la estructura tipada si es válida. Devuelve null si no parsea.
 */
export function parseDropdownStatusConfig(raw: unknown): DropdownStatusConfigInput | null {
  const result = dropdownStatusConfigSchema.safeParse(raw)
  return result.success ? result.data : null
}

// ─────────────────────────────────────────────
// Workflow engine — RecordAction.condition (recursivo) y actionConfig
// ─────────────────────────────────────────────

const conditionPrimitiveValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.array(z.number()),
])

const actionConditionPrimitiveSchema = z
  .object({
    type: z.enum([
      'EQUALS', 'NOT_EQUALS',
      'IN', 'NOT_IN',
      'LT', 'LTE', 'GT', 'GTE',
      'BETWEEN',
    ]),
    field: z.string().min(1, 'El path del campo es obligatorio'),
    value: conditionPrimitiveValueSchema,
  })
  .superRefine((cond, ctx) => {
    // Operadores numéricos requieren value escalar number.
    if (['LT', 'LTE', 'GT', 'GTE'].includes(cond.type)) {
      if (typeof cond.value !== 'number') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: `El operador ${cond.type} requiere un valor numérico`,
        })
      }
    }
    // BETWEEN requiere array de exactamente 2 numbers.
    if (cond.type === 'BETWEEN') {
      const ok =
        Array.isArray(cond.value) &&
        cond.value.length === 2 &&
        cond.value.every((v) => typeof v === 'number')
      if (!ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'BETWEEN requiere un array [min, max] con dos números',
        })
      }
    }
    // IN / NOT_IN requieren array.
    if (['IN', 'NOT_IN'].includes(cond.type)) {
      if (!Array.isArray(cond.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: `${cond.type} requiere un array de valores`,
        })
      }
    }
  })

/**
 * Schema recursivo para `RecordAction.condition`. Acepta tanto la condición
 * primitiva (EQUALS / NOT_EQUALS / IN / NOT_IN sobre un field del payload) como
 * la composite (AND / OR de un array de condiciones recursivas, sin límite).
 *
 * Implementado con `z.lazy` para evitar la circular dep en la inferencia.
 */
export type ActionConditionInput =
  | z.infer<typeof actionConditionPrimitiveSchema>
  | { type: 'AND' | 'OR'; conditions: ActionConditionInput[] }

export const actionConditionSchema: z.ZodType<ActionConditionInput> = z.lazy(() =>
  z.union([
    actionConditionPrimitiveSchema,
    z.object({
      type: z.enum(['AND', 'OR']),
      conditions: z
        .array(actionConditionSchema)
        .min(1, 'AND/OR requieren al menos una condición'),
    }),
  ]),
)

/** Helper: parsea un condition que vino de la DB (Json). Null si no parsea. */
export function parseActionCondition(raw: unknown): ActionConditionInput | null {
  if (raw === null || raw === undefined) return null
  const result = actionConditionSchema.safeParse(raw)
  return result.success ? result.data : null
}

const updateFieldActionConfigSchema = z.object({
  entryIdSource: z.enum(['self', 'related']),
  fieldId: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
})
export type UpdateFieldActionConfigInput = z.infer<typeof updateFieldActionConfigSchema>

const notifyActionConfigSchema = z.object({
  recipients: z.string().min(1),
  message: z.string().min(1).max(2000),
})
export type NotifyActionConfigInput = z.infer<typeof notifyActionConfigSchema>

const emailActionConfigSchema = z.object({
  to: z.array(z.string().email()).min(1),
  subject: z.string().min(1).max(200),
  body: z.string().min(1),
})
export type EmailActionConfigInput = z.infer<typeof emailActionConfigSchema>

const webhookActionConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['POST', 'PATCH']),
  headers: z.record(z.string()).optional(),
})
export type WebhookActionConfigInput = z.infer<typeof webhookActionConfigSchema>

/**
 * Valida que el `actionConfig` de una RecordAction matchee su `actionType`.
 * Devuelve el config validado o null si la combinación es inválida. Se usa
 * en `RecordActionListener.execute<Type>` antes de actuar (defense-in-depth)
 * y en cualquier flujo de creación de RecordAction (frontend + backend).
 */
export function parseActionConfig(
  actionType: string,
  raw: unknown,
):
  | null
  | { type: 'CREATE_ENTRY' }
  | ({ type: 'UPDATE_FIELD' } & UpdateFieldActionConfigInput)
  | ({ type: 'NOTIFY' } & NotifyActionConfigInput)
  | ({ type: 'EMAIL' } & EmailActionConfigInput)
  | ({ type: 'WEBHOOK' } & WebhookActionConfigInput) {
  switch (actionType) {
    case 'CREATE_ENTRY':
      return { type: 'CREATE_ENTRY' }
    case 'UPDATE_FIELD': {
      const r = updateFieldActionConfigSchema.safeParse(raw)
      return r.success ? { type: 'UPDATE_FIELD', ...r.data } : null
    }
    case 'NOTIFY': {
      const r = notifyActionConfigSchema.safeParse(raw)
      return r.success ? { type: 'NOTIFY', ...r.data } : null
    }
    case 'EMAIL': {
      const r = emailActionConfigSchema.safeParse(raw)
      return r.success ? { type: 'EMAIL', ...r.data } : null
    }
    case 'WEBHOOK': {
      const r = webhookActionConfigSchema.safeParse(raw)
      return r.success ? { type: 'WEBHOOK', ...r.data } : null
    }
    default:
      return null
  }
}
