import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { SESSION_COOKIE, clearSession, getToken, hasSessionCookie, saveSession } from './session'

/**
 * De esto depende que el middleware deje entrar o rebote. Si `saveSession` no
 * escribe la cookie, el usuario inicia sesión correctamente y queda dando
 * vueltas en la pantalla de ingreso; si `clearSession` no la borra, sigue
 * entrando a páginas privadas para rebotar en cada request.
 *
 * Y lo más importante: la cookie lleva **solo el vencimiento**, nunca el token.
 * Hay un test que lo fija, porque es la decisión de seguridad de todo esto.
 */

/** Arma un JWT de mentira: solo importa que el payload sea base64url. */
function tokenCon(payload: Record<string, unknown>): string {
  const b64 = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `encabezado.${b64}.firma`
}

const enUnaHora = Math.floor(Date.now() / 1000) + 3600
const haceUnaHora = Math.floor(Date.now() / 1000) - 3600

function borrarCookies() {
  for (const c of document.cookie.split('; ')) {
    const nombre = c.split('=')[0]
    if (nombre) document.cookie = `${nombre}=; Path=/; Max-Age=0`
  }
}

describe('session', () => {
  beforeEach(() => {
    localStorage.clear()
    borrarCookies()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('guarda el token y escribe la cookie con el vencimiento', () => {
    const token = tokenCon({ sub: 'u1', exp: enUnaHora })
    expect(saveSession(token)).toBe(true)

    expect(getToken()).toBe(token)
    expect(document.cookie).toContain(`${SESSION_COOKIE}=${enUnaHora}`)
    expect(hasSessionCookie()).toBe(true)
  })

  it('la cookie NO contiene el token', () => {
    // Es la decisión central: el middleware solo necesita saber si hay sesión
    // viva. Meter el JWT en una cookie legible por JavaScript no agregaría
    // seguridad sobre localStorage y lo haría viajar en cada request.
    const token = tokenCon({ sub: 'u1', email: 'a@b.c', exp: enUnaHora })
    saveSession(token)

    expect(document.cookie).not.toContain(token)
    expect(document.cookie).not.toContain('a@b.c')
  })

  it('un token ya vencido no escribe cookie', () => {
    // Escribir una cookie con fecha pasada dejaría al middleware tratando la
    // sesión como viva por un instante, o directamente basura en el navegador.
    expect(saveSession(tokenCon({ exp: haceUnaHora }))).toBe(false)
    expect(hasSessionCookie()).toBe(false)
  })

  it('un token sin exp no escribe cookie, pero sí se guarda', () => {
    // El token puede seguir sirviendo contra la API; lo que no se puede es
    // afirmar hasta cuándo, así que el middleware lo trata como sin sesión.
    const token = tokenCon({ sub: 'u1' })
    expect(saveSession(token)).toBe(false)
    expect(getToken()).toBe(token)
    expect(hasSessionCookie()).toBe(false)
  })

  it('un token malformado no rompe', () => {
    // Puede venir de un localStorage viejo o manipulado a mano.
    for (const basura of ['', 'no-es-un-jwt', 'a.b', 'a.$$$.c']) {
      expect(() => saveSession(basura)).not.toThrow()
      expect(hasSessionCookie(), basura).toBe(false)
    }
  })

  it('cerrar sesión borra el token y la cookie', () => {
    saveSession(tokenCon({ sub: 'u1', exp: enUnaHora }))
    expect(hasSessionCookie()).toBe(true)

    clearSession()
    expect(getToken()).toBeNull()
    expect(hasSessionCookie()).toBe(false)
  })

  it('sin sesión previa, getToken devuelve null y no hay cookie', () => {
    expect(getToken()).toBeNull()
    expect(hasSessionCookie()).toBe(false)
  })

  it('un cambio de organización pisa la sesión anterior', () => {
    const primero = tokenCon({ sub: 'u1', organizationId: 'org-1', exp: enUnaHora })
    const segundo = tokenCon({ sub: 'u1', organizationId: 'org-2', exp: enUnaHora })
    saveSession(primero)
    saveSession(segundo)
    expect(getToken()).toBe(segundo)
  })
})
