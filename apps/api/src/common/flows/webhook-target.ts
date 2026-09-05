import { lookup } from 'dns/promises'
import { isIP } from 'net'

/**
 * Validación del destino de un webhook.
 *
 * Un webhook hace que **el servidor** emita un pedido HTTP a una URL que
 * eligió un usuario. Sin control, un ADMIN puede apuntarlo a la red interna:
 * `http://169.254.169.254/` devuelve las credenciales de la instancia en AWS y
 * GCP, y `http://localhost:5432` o `http://10.0.0.5` alcanzan servicios que no
 * están expuestos a internet. Eso es SSRF, y la única defensa es no dejar
 * salir el pedido.
 *
 * Se valida en dos capas, porque un nombre de dominio puede resolver a una IP
 * privada aunque el nombre no lo parezca:
 *
 *   1. La URL: protocolo, ausencia de credenciales, y si el host ya es una IP,
 *      que no sea privada.
 *   2. La resolución DNS del host contra las mismas reglas.
 *
 * Queda un hueco conocido: entre que se valida y que se emite el pedido, el DNS
 * podría cambiar a una IP interna (DNS rebinding). Cerrarlo exige emitir el
 * pedido contra la IP ya resuelta, fijando el `Host`. Vale la pena si alguna
 * vez los webhooks se abren a usuarios menos confiables que un ADMIN.
 */

export interface WebhookTarget {
  url: URL
  /** IP a la que resolvió el host, para dejar rastro en el log. */
  address: string
}

export type WebhookValidation =
  | { ok: true; target: WebhookTarget }
  | { ok: false; reason: string }

/** Rangos que nunca deben ser destino de un webhook. */
function esDireccionInterna(ip: string): boolean {
  const version = isIP(ip)

  if (version === 4) {
    const [a, b] = ip.split('.').map(Number)
    if (a === 10) return true // 10.0.0.0/8 — privada
    if (a === 127) return true // loopback
    if (a === 0) return true // "esta red"
    if (a === 169 && b === 254) return true // link-local: metadatos del cloud
    if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
    if (a === 192 && b === 168) return true // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT
    if (a >= 224) return true // multicast y reservadas
    return false
  }

  if (version === 6) {
    const normalizada = ip.toLowerCase()
    if (normalizada === '::1' || normalizada === '::') return true
    if (normalizada.startsWith('fe80')) return true // link-local
    if (normalizada.startsWith('fc') || normalizada.startsWith('fd')) return true // unique-local
    // IPv4 mapeada dentro de IPv6: se evalúa la parte v4. Node normaliza
    // `::ffff:10.0.0.1` a `::ffff:a00:1`, en hexadecimal, así que hay que
    // contemplar las dos formas o el rango privado pasa de largo.
    const conPuntos = normalizada.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (conPuntos) return esDireccionInterna(conPuntos[1])

    const enHex = normalizada.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)
    if (enHex) {
      const alto = parseInt(enHex[1], 16)
      const bajo = parseInt(enHex[2], 16)
      const v4 = [alto >> 8, alto & 0xff, bajo >> 8, bajo & 0xff].join('.')
      return esDireccionInterna(v4)
    }
    return false
  }

  // No es una IP: lo resuelve el chequeo de DNS.
  return false
}

export interface ValidateOptions {
  /**
   * Permite http y direcciones internas. Solo para desarrollo, donde apuntar
   * un webhook a la propia máquina es la forma normal de probarlo.
   */
  allowInternal?: boolean
}

export async function validateWebhookUrl(
  raw: string,
  options: ValidateOptions = {},
): Promise<WebhookValidation> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, reason: 'La URL del webhook no es válida' }
  }

  const permitidos = options.allowInternal ? ['http:', 'https:'] : ['https:']
  if (!permitidos.includes(url.protocol)) {
    return {
      ok: false,
      reason: options.allowInternal
        ? 'El webhook solo admite http o https'
        : 'El webhook debe usar https',
    }
  }

  // Las credenciales en la URL terminarían escritas en logs.
  if (url.username || url.password) {
    return { ok: false, reason: 'La URL del webhook no puede llevar credenciales' }
  }

  // El host entre corchetes es IPv6 literal.
  const host = url.hostname.replace(/^\[|\]$/g, '')

  if (!options.allowInternal) {
    if (host.toLowerCase() === 'localhost' || host.toLowerCase().endsWith('.localhost')) {
      return { ok: false, reason: 'El webhook no puede apuntar a la máquina del servidor' }
    }
    if (isIP(host) && esDireccionInterna(host)) {
      return { ok: false, reason: 'El webhook no puede apuntar a una dirección interna' }
    }
  }

  // Si el host es un nombre, hay que ver a dónde resuelve: `interno.ejemplo.com`
  // puede apuntar a 10.0.0.5 sin que el nombre lo delate.
  let address = host
  if (!isIP(host)) {
    try {
      const resuelto = await lookup(host)
      address = resuelto.address
    } catch {
      return { ok: false, reason: 'No se pudo resolver el host del webhook' }
    }
    if (!options.allowInternal && esDireccionInterna(address)) {
      return {
        ok: false,
        reason: 'El host del webhook resuelve a una dirección interna',
      }
    }
  }

  return { ok: true, target: { url, address } }
}

/**
 * Headers que no puede fijar el usuario: los administra el cliente HTTP y
 * pisarlos rompe el pedido o permite confundir al destino.
 */
const HEADERS_RESERVADOS = new Set([
  'host',
  'content-length',
  'connection',
  'transfer-encoding',
  'content-type',
])

export function sanitizeWebhookHeaders(
  raw: unknown,
): Record<string, string> {
  if (typeof raw !== 'object' || raw === null) return {}
  const out: Record<string, string> = {}
  for (const [clave, valor] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof valor !== 'string') continue
    if (HEADERS_RESERVADOS.has(clave.toLowerCase())) continue
    // Un salto de línea permitiría inyectar headers adicionales.
    if (/[\r\n]/.test(clave) || /[\r\n]/.test(valor)) continue
    out[clave] = valor
  }
  return out
}
