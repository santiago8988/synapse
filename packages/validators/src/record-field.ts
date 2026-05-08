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
