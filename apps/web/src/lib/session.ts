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

/** Guarda la sesión tras un login o un cambio de organización. */
export function saveSession(token: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(TOKEN_KEY, token)

  const exp = readExpiry(token)
  if (exp === null) return

  // La cookie vence junto con el token, así el navegador la limpia solo.
  const expires = new Date(exp * 1000).toUTCString()
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${SESSION_COOKIE}=${exp}; Path=/; Expires=${expires}; SameSite=Lax${secure}`
}

/** Cierra la sesión: borra el token y la cookie del middleware. */
export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(TOKEN_KEY)
  document.cookie = `${SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`
}
