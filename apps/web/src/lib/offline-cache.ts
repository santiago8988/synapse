/**
 * Nombres y limpieza de las cachés de lecturas de la API.
 *
 * Vive en `lib/` y no dentro del service worker porque lo usan los dos lados:
 * el worker para decidir dónde guardar cada respuesta, y `clearSession` para
 * borrar todo al cerrar sesión.
 *
 * ─── Por qué hay una caché por usuario ────────────────────────────────────
 *
 * En planta la tablet se comparte entre turnos. Una sola caché de API dejaría
 * que quien inicia sesión después lea, sin conexión, lo que quedó guardado del
 * turno anterior — que puede ser de otra área o directamente de otra
 * organización. El JWT ya evita eso contra el servidor; la caché del navegador
 * es el lugar donde el aislamiento se puede perder sin que nadie se entere.
 *
 * Por eso la caché se nombra con el `sub` y la organización del token que venía
 * en ese mismo pedido. No hace falta avisarle al worker quién está conectado:
 * cada request trae su identidad.
 */

/** Prefijo común. Todo lo que empieza así se borra al cerrar sesión. */
export const API_CACHE_PREFIX = 'synapse-api-'

/**
 * Nombre de caché para un pedido, a partir de su header `Authorization`.
 * Devuelve `null` cuando no hay token o no se puede leer: en ese caso el pedido
 * no se cachea, que es lo correcto —sin identidad no hay dónde guardarlo sin
 * mezclar—.
 *
 * El payload se lee **sin verificar la firma**. Acá no se autoriza nada: solo
 * se separan cachés. Un token adulterado no da acceso a nada, porque cada
 * respuesta guardada la produjo el backend validando el token de verdad.
 */
export function apiCacheName(authorization: string | null | undefined): string | null {
  if (!authorization?.startsWith('Bearer ')) return null
  try {
    const payload = authorization.slice(7).split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
    const { sub, organizationId } = JSON.parse(json) as {
      sub?: unknown
      organizationId?: unknown
    }
    if (typeof sub !== 'string' || sub.length === 0) return null
    // La organización va en el nombre porque la misma persona en otra
    // organización no debe ver lo que quedó cacheado de la anterior.
    const org = typeof organizationId === 'string' && organizationId ? organizationId : 'sin-org'
    return `${API_CACHE_PREFIX}${sub}-${org}`
  } catch {
    return null
  }
}

/**
 * Borra todas las cachés de API. Se llama al cerrar sesión: si no, los datos
 * del turno anterior quedan en el disco del dispositivo compartido.
 *
 * No toca la caché del armazón de la app (JS, CSS, fuentes) — eso no es dato de
 * nadie y volver a bajarlo en cada login sería tirar el beneficio.
 */
export async function purgeApiCaches(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const nombres = await caches.keys()
    await Promise.all(
      nombres.filter((n) => n.startsWith(API_CACHE_PREFIX)).map((n) => caches.delete(n)),
    )
  } catch {
    // Un navegador con el almacenamiento bloqueado no debe romper el logout.
  }
}
