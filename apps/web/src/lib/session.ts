/**
 * Manejo de la sesión del lado del cliente.
 *
 * El JWT vive en `localStorage` y viaja en el header `Authorization`. El
 * middleware de Next, en cambio, corre en el servidor y solo ve cookies, así
 * que necesita alguna señal para saber si hay sesión antes de renderizar una
 * página privada.
 *
 * La señal es **solo el vencimiento**, nunca el token. Poner el JWT en una
 * cookie legible por JavaScript no agregaría seguridad sobre `localStorage` y
 * sí lo haría viajar en cada request al origen web, que es más exposición a
 * cambio de nada.
 *
 * Lo que se gana con esto es enrutado: dejar de renderizar el armazón de una
 * página privada para rebotar al toque. **No es un control de acceso.** Quien
 * fabrique la cookie a mano ve el cascarón de la app y nada más: cada llamada
 * a la API sigue exigiendo el JWT y responde 401 sin él.
 */

import { purgeApiCaches } from './offline-cache'

const TOKEN_KEY = 'synapse_token'

/** Cookie que lee el middleware. Contiene el `exp` del JWT, en segundos. */
export const SESSION_COOKIE = 'synapse_session_exp'

/**
 * Lee el `exp` del JWT **sin verificar la firma**. Alcanza para el uso que se
 * le da —decidir si conviene mostrar una pantalla privada— y verificarla
 * requeriría el secreto del backend, que no tiene por qué estar acá.
 */
function readExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1]
    if (!payload) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='))
    const exp = (JSON.parse(json) as { exp?: number }).exp
    return typeof exp === 'number' ? exp : null
  } catch {
    return null
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

/** ¿Ya existe la cookie que lee el middleware? */
export function hasSessionCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').some((c) => c.startsWith(`${SESSION_COOKIE}=`))
}

/**
 * Guarda la sesión tras un login o un cambio de organización.
 * Devuelve false si el token no trae un vencimiento usable o ya venció: en ese
 * caso no se escribe la cookie y el middleware sigue tratando la sesión como
 * inexistente, que es lo correcto.
 */
export function saveSession(token: string): boolean {
  if (typeof window === 'undefined') return false
  localStorage.setItem(TOKEN_KEY, token)

  const exp = readExpiry(token)
  if (exp === null || exp * 1000 <= Date.now()) return false

  // La cookie vence junto con el token, así el navegador la limpia solo.
  const expires = new Date(exp * 1000).toUTCString()
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${SESSION_COOKIE}=${exp}; Path=/; Expires=${expires}; SameSite=Lax${secure}`
  return true
}

/**
 * Cierra la sesión: borra el token, la cookie del middleware y las respuestas
 * de la API que el service worker haya guardado.
 *
 * Lo de las cachés importa en el caso de uso real: la tablet de planta se
 * comparte entre turnos. Sin esto, quien entra después puede quedarse sin
 * conexión y leer lo que dejó el turno anterior.
 *
 * El borrado es asincrónico y no se espera: el logout no debe quedar colgado
 * porque el almacenamiento del navegador tarde. La caché está nombrada por
 * usuario de todas formas, así que la limpieza es defensa en profundidad, no
 * lo único que separa a un usuario del otro.
 */
export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
  void purgeApiCaches()
}
