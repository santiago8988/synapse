/**
 * Qué entidad de Prisma corresponde a cada controller, para poder capturar el
 * estado previo de una mutación en el AuditLog.
 *
 * Cada entrada declara además cómo se acota por organización. Esto no es
 * opcional: leer la fila anterior es una query más, y una query sin filtro de
 * tenant es exactamente lo que prohíbe la regla 1. `Entry` no tiene
 * `organizationId` propio (cuelga del Record) y `OrgMethod` usa `orgId`, así
 * que el filtro se declara por modelo en vez de asumirse.
 *
 * Los controllers que no figuran acá no capturan `before`. Se dejan afuera a
 * propósito los casos donde `params.id` no identifica a la entidad mutada
 * —OrganizationsController lo usa para la organización mientras modifica
 * whitelist, usuarios o posiciones— porque guardar la fila equivocada como
 * "estado anterior" es peor que no guardar nada.
 */

export type TenantScope =
  /** La fila tiene columna organizationId. */
  | { kind: 'column'; field: 'organizationId' | 'orgId' }
  /** La fila cuelga de un Record, que es el que tiene la organización. */
  | { kind: 'record' }

export interface AuditableEntity {
  /** Nombre del delegate en PrismaClient. */
  model: string
  scope: TenantScope
}

/** Clave = entityType que deriva el interceptor del nombre del controller. */
export const AUDITABLE_ENTITIES: Record<string, AuditableEntity> = {
  DOCUMENTS: { model: 'document', scope: { kind: 'column', field: 'organizationId' } },
  RECORDS: { model: 'record', scope: { kind: 'column', field: 'organizationId' } },
  ENTRIES: { model: 'entry', scope: { kind: 'record' } },
  INSTRUMENTS: { model: 'instrument', scope: { kind: 'column', field: 'organizationId' } },
  NON_CONFORMITIES: {
    model: 'nonConformity',
    scope: { kind: 'column', field: 'organizationId' },
  },
  RECIPES: { model: 'recipe', scope: { kind: 'column', field: 'organizationId' } },
  BATCHES: { model: 'batch', scope: { kind: 'column', field: 'organizationId' } },
  SAMPLES: { model: 'sample', scope: { kind: 'column', field: 'organizationId' } },
  MATRICES: { model: 'matrix', scope: { kind: 'column', field: 'organizationId' } },
  CALIBRATION_TEMPLATES: {
    model: 'calibrationTemplate',
    scope: { kind: 'column', field: 'organizationId' },
  },
  CALIBRATIONS: {
    model: 'calibration',
    scope: { kind: 'column', field: 'organizationId' },
  },
  // OrgMethod admite metodos globales (orgId null); el filtro por orgId hace
  // que un metodo global simplemente no devuelva `before`, que es lo correcto:
  // no pertenece a la organizacion que lo esta tocando.
  METHODS: { model: 'orgMethod', scope: { kind: 'column', field: 'orgId' } },
  AREAS: { model: 'area', scope: { kind: 'column', field: 'organizationId' } },
}

/** Construye el `where` acotado al tenant para leer la fila previa. */
export function buildTenantWhere(
  entity: AuditableEntity,
  id: string,
  organizationId: string,
): Record<string, unknown> {
  if (entity.scope.kind === 'record') {
    return { id, record: { organizationId } }
  }
  return { id, [entity.scope.field]: organizationId }
}

/**
 * Claves cuyo valor nunca debe quedar escrito en el AuditLog (regla 8). Se
 * comparan en minúsculas y por inclusión, así que `accessToken`,
 * `R2_SECRET_ACCESS_KEY` y `passwordHash` caen todas.
 */
const SENSITIVE_KEY_PARTS = [
  'password',
  'secret',
  'token',
  'authorization',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
  'credential',
]

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase()
  return SENSITIVE_KEY_PARTS.some((part) => lower.includes(part))
}

/**
 * Copia el valor reemplazando por "[REDACTED]" todo lo que parezca una
 * credencial. Se aplica tanto al estado previo como al posterior: el `after`
 * venía volcando la respuesta entera sin filtrar, y hay endpoints que
 * devuelven tokens (por ejemplo el canje de login).
 */
export function redactSensitive(value: unknown, depth = 0): unknown {
  // Cota de profundidad para no recorrer estructuras patologicas ni caer en
  // ciclos si alguna vez entra un objeto no serializable.
  if (depth > 8) return '[TRUNCATED]'
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1))
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? '[REDACTED]' : redactSensitive(val, depth + 1)
    }
    return out
  }
  return value
}
