/**
 * Resolución de destinatarios de la acción NOTIFY.
 *
 * `actionConfig.recipients` es una cadena con una de estas formas:
 *
 *   `area_owner`    → el líder del área del registro que disparó el flujo.
 *                     Si el área no tiene líder, nadie.
 *   `role:<ROL>`    → todos los usuarios activos con ese rol en la organización.
 *   `user:<id>`     → un usuario puntual, siempre que siga activo en la
 *                     organización.
 *
 * La consulta va SIEMPRE acotada a `organizationId`. Es la garantía de que un
 * flujo no puede notificar —ni revelar la existencia de— usuarios de otro
 * tenant. Sin ese filtro, un `user:<id>` copiado de otra organización crearía
 * una notificación cruzada.
 */

export type RecipientSpec =
  | { kind: 'area_owner' }
  | { kind: 'role'; role: string }
  | { kind: 'user'; userId: string }

const ROLES_VALIDOS = new Set(['ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN', 'AUDITOR'])

/**
 * Interpreta el valor configurado. Devuelve null si no se entiende, y el
 * llamador no notifica a nadie: es preferible a elegir un destinatario por
 * defecto, que podría mandar información a quien no corresponde.
 */
export function parseRecipients(raw: unknown): RecipientSpec | null {
  if (typeof raw !== 'string') return null
  const valor = raw.trim()
  if (valor === '') return null

  if (valor === 'area_owner') return { kind: 'area_owner' }

  if (valor.startsWith('role:')) {
    const role = valor.slice('role:'.length).trim().toUpperCase()
    return ROLES_VALIDOS.has(role) ? { kind: 'role', role } : null
  }

  if (valor.startsWith('user:')) {
    const userId = valor.slice('user:'.length).trim()
    return userId ? { kind: 'user', userId } : null
  }

  return null
}

/**
 * Reemplaza los marcadores del mensaje configurado por datos del evento.
 * Sirve para que el aviso diga algo concreto en vez de un texto fijo.
 *
 * Solo se sustituyen marcadores conocidos: el texto lo escribe un ADMIN y lo
 * lee otra persona, así que no se interpola nada que no esté previsto acá.
 */
export function renderMessage(
  template: string,
  contexto: { recordName?: string; fieldLabel?: string; from?: unknown; to?: unknown },
): string {
  const valores: Record<string, string> = {
    registro: contexto.recordName ?? '',
    campo: contexto.fieldLabel ?? '',
    anterior: contexto.from === undefined || contexto.from === null ? '' : String(contexto.from),
    nuevo: contexto.to === undefined || contexto.to === null ? '' : String(contexto.to),
  }
  return template.replace(/\{(registro|campo|anterior|nuevo)\}/g, (_m, clave: string) =>
    valores[clave] ?? '',
  )
}
