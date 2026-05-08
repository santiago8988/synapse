import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common'
import type {
  DropdownStateOption,
  DropdownStatusConfig,
  FieldTransition,
  UserRole,
} from '@synapse/types'

interface RecordFieldLite {
  id: string
  label: string
  fieldType: string
  comparisonConfig: unknown
}

/**
 * Valida cambios en campos DROPDOWN-as-status. La forma del config se parsea
 * con un type guard liviano (sin Zod en este service para evitar runtime
 * deps de `@synapse/validators` — los schemas Zod se reservan para el flujo
 * de creación/edición de RecordFields, donde sí queremos validación rica).
 *
 * Reglas (ver WORKFLOW_ENGINE_SPEC.md §3.4):
 *   1. La transición (from → to) debe estar en la lista, o existir un wildcard
 *      `from === "*"` con el mismo `to`.
 *   2. Si la transición declara `requiredRoles`, el rol del usuario debe estar.
 *   3. Si la transición declara `requireReason`, el caller debe proveer
 *      `transitionReason` no vacío.
 *
 * El servicio no toca la DB; es puramente validación de payload contra config.
 */
@Injectable()
export class TransitionValidatorService {
  /**
   * Valida los cambios de cada DROPDOWN-as-status field del Record.
   * Lanza BadRequestException o ForbiddenException en la primera violación.
   */
  validate(
    fields: RecordFieldLite[],
    oldData: Record<string, unknown>,
    newData: Record<string, unknown>,
    userRole: UserRole,
    transitionReason?: string,
  ): void {
    for (const field of fields) {
      if (field.fieldType !== 'DROPDOWN') continue

      const config = parseDropdownStatusConfig(field.comparisonConfig)
      if (!config || !config.isStatus) continue

      const oldValue = normalizeValue(oldData[field.id])
      const newValue = normalizeValue(newData[field.id])

      // Si no se está cambiando, no hay nada que validar.
      if (oldValue === newValue) continue
      // Si newValue es undefined, el caller no lo está tocando → skip.
      if (newValue === undefined) continue

      // Si oldValue es undefined (entry sin status seteado todavía) y
      // newValue == initial, dejamos pasar (es un set inicial implícito).
      if (oldValue === undefined) {
        const initial = getInitialValue(config)
        if (initial && newValue === initial) continue
      }

      // newValue debe ser una opción declarada.
      const allowedValues = getAllowedValues(config)
      if (!allowedValues.includes(String(newValue))) {
        throw new BadRequestException(
          `El valor "${newValue}" no es una opción válida del campo "${field.label}".`,
        )
      }

      // Si no hay transitions declaradas, free movement.
      if (!config.transitions || config.transitions.length === 0) continue

      // Buscar transition aplicable.
      const fromKey = oldValue === undefined ? null : String(oldValue)
      const toKey = String(newValue)
      const transition = findTransition(config.transitions, fromKey, toKey)

      if (!transition) {
        throw new BadRequestException(
          `Transición no permitida en "${field.label}": ${fromKey ?? '(vacío)'} → ${toKey}.`,
        )
      }

      // Validar rol requerido.
      if (transition.requiredRoles && transition.requiredRoles.length > 0) {
        if (!transition.requiredRoles.includes(userRole)) {
          throw new ForbiddenException(
            `Tu rol no tiene permiso para ejecutar la transición ${fromKey ?? '(vacío)'} → ${toKey} en "${field.label}".`,
          )
        }
      }

      // Validar reason requerido.
      if (transition.requireReason) {
        if (!transitionReason || transitionReason.trim().length === 0) {
          throw new BadRequestException(
            `La transición ${fromKey ?? '(vacío)'} → ${toKey} en "${field.label}" requiere un motivo.`,
          )
        }
      }
    }
  }

  /**
   * Devuelve el value inicial de un DROPDOWN-as-status, o null si:
   *   - El field no es DROPDOWN
   *   - El config no es válido o no es isStatus
   *   - Ningún option tiene isInitial: true
   *
   * Lo usa entries.service.create para autocompletar el estado inicial.
   */
  getInitialValueForField(field: RecordFieldLite): string | null {
    if (field.fieldType !== 'DROPDOWN') return null
    const config = parseDropdownStatusConfig(field.comparisonConfig)
    if (!config || !config.isStatus) return null
    return getInitialValue(config)
  }
}

// ─────────────────────────────────────────────
// Helpers (puros, sin estado — fuera de la clase para no exportarlos)
// ─────────────────────────────────────────────

/**
 * Type guard liviano: parsea un comparisonConfig que vino de la DB (Json) y
 * devuelve la estructura tipada si tiene la forma esperada.
 *
 * No usa Zod para no introducir dep runtime sobre `@synapse/validators` que
 * en este monorepo es un package TS-source no compilado. La validación
 * estricta del config se hace en el flujo de Record.update vía Zod cuando
 * un admin guarda un field; acá solo verificamos shape para decidir si
 * la lógica de transitions aplica.
 */
function parseDropdownStatusConfig(raw: unknown): DropdownStatusConfig | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (!Array.isArray(obj.options)) return null
  // Validamos shape mínima de transitions si está presente.
  if (obj.transitions !== undefined) {
    if (!Array.isArray(obj.transitions)) return null
    for (const t of obj.transitions) {
      if (typeof t !== 'object' || t === null) return null
      const tt = t as Record<string, unknown>
      if (typeof tt.from !== 'string' || typeof tt.to !== 'string') return null
    }
  }
  return obj as unknown as DropdownStatusConfig
}

function normalizeValue(v: unknown): string | undefined {
  if (v === undefined || v === null || v === '') return undefined
  return String(v)
}

function isRichOptions(
  options: string[] | DropdownStateOption[],
): options is DropdownStateOption[] {
  return options.length > 0 && typeof options[0] === 'object'
}

function getInitialValue(config: DropdownStatusConfig): string | null {
  if (isRichOptions(config.options)) {
    const initial = config.options.find((o) => o.isInitial)
    return initial ? initial.value : null
  }
  return null
}

function getAllowedValues(config: DropdownStatusConfig): string[] {
  if (isRichOptions(config.options)) {
    return config.options.map((o) => o.value)
  }
  return config.options
}

function findTransition(
  transitions: FieldTransition[],
  fromKey: string | null,
  toKey: string,
): FieldTransition | null {
  // Match exacto first; wildcard "*" como fallback.
  const exact = transitions.find((t) => t.from === fromKey && t.to === toKey)
  if (exact) return exact
  const wildcard = transitions.find((t) => t.from === '*' && t.to === toKey)
  return wildcard ?? null
}
