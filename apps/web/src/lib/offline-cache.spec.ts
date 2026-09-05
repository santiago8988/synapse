import { describe, it, expect, vi, afterEach } from 'vitest'
import { API_CACHE_PREFIX, apiCacheName, purgeApiCaches } from './offline-cache'

/**
 * Lo que se fija acá es el aislamiento de la caché offline. Si `apiCacheName`
 * devolviera el mismo nombre para dos usuarios, el service worker guardaría las
 * respuestas de ambos en el mismo lugar y, sin conexión, el segundo turno de la
 * tablet leería los datos del primero. El JWT protege contra el servidor; esto
 * es lo único que protege contra el disco del dispositivo.
 */

/** Arma un `Authorization` con un JWT de mentira (solo importa el payload). */
function bearer(payload: Record<string, unknown>): string {
  const b64 = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `Bearer encabezado.${b64}.firma`
}

describe('apiCacheName', () => {
  it('nombra la caché con el usuario y la organización', () => {
    const nombre = apiCacheName(bearer({ sub: 'u1', organizationId: 'org-1' }))
    expect(nombre).toBe(`${API_CACHE_PREFIX}u1-org-1`)
  })

  it('dos usuarios distintos no comparten caché', () => {
    const a = apiCacheName(bearer({ sub: 'u1', organizationId: 'org-1' }))
    const b = apiCacheName(bearer({ sub: 'u2', organizationId: 'org-1' }))
    expect(a).not.toBe(b)
  })

  it('el mismo usuario en otra organización tampoco', () => {
    // Al cambiar de organización el JWT cambia; lo cacheado de la anterior no
    // puede seguir sirviéndose.
    const a = apiCacheName(bearer({ sub: 'u1', organizationId: 'org-1' }))
    const b = apiCacheName(bearer({ sub: 'u1', organizationId: 'org-2' }))
    expect(a).not.toBe(b)
  })

  it('el mismo token siempre da el mismo nombre', () => {
    const token = bearer({ sub: 'u1', organizationId: 'org-1', exp: 123 })
    expect(apiCacheName(token)).toBe(apiCacheName(token))
  })

  it('sin token no hay caché', () => {
    // Devolver un nombre por defecto sería justamente el pozo compartido.
    expect(apiCacheName(null)).toBeNull()
    expect(apiCacheName(undefined)).toBeNull()
    expect(apiCacheName('')).toBeNull()
  })

  it('un header que no es Bearer no cachea', () => {
    expect(apiCacheName('Basic dXNlcjpwYXNz')).toBeNull()
    expect(apiCacheName('bearer minusculas')).toBeNull()
  })

  it('un token malformado no rompe ni cachea', () => {
    for (const basura of ['Bearer ', 'Bearer no-es-jwt', 'Bearer a.b', 'Bearer a.$$$.c']) {
      expect(() => apiCacheName(basura)).not.toThrow()
      expect(apiCacheName(basura), basura).toBeNull()
    }
  })

  it('un token sin sub no cachea', () => {
    // Sin identidad no hay dónde guardar la respuesta sin mezclarla.
    expect(apiCacheName(bearer({ organizationId: 'org-1' }))).toBeNull()
    expect(apiCacheName(bearer({ sub: '' }))).toBeNull()
    expect(apiCacheName(bearer({ sub: 42 }))).toBeNull()
  })

  it('sin organización usa un marcador explícito, no vacío', () => {
    // Un nombre terminado en '-' colisionaría con cualquier otro token sin
    // organización del mismo usuario, que es un caso distinto.
    expect(apiCacheName(bearer({ sub: 'u1' }))).toBe(`${API_CACHE_PREFIX}u1-sin-org`)
  })
})

describe('purgeApiCaches', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('borra solo las cachés de API', async () => {
    const borradas: string[] = []
    vi.stubGlobal('caches', {
      keys: async () => [
        `${API_CACHE_PREFIX}u1-org-1`,
        `${API_CACHE_PREFIX}u2-org-1`,
        'next-static-js-assets',
        'google-fonts-webfonts',
      ],
      delete: async (n: string) => {
        borradas.push(n)
        return true
      },
    })

    await purgeApiCaches()

    // El armazón de la app no es dato de nadie: volver a bajarlo en cada login
    // tiraría el beneficio de tener service worker.
    expect(borradas.sort()).toEqual([
      `${API_CACHE_PREFIX}u1-org-1`,
      `${API_CACHE_PREFIX}u2-org-1`,
    ])
  })

  it('sin CacheStorage no rompe', async () => {
    // Navegador viejo, o contexto sin almacenamiento.
    vi.stubGlobal('caches', undefined)
    await expect(purgeApiCaches()).resolves.toBeUndefined()
  })

  it('un almacenamiento que falla no rompe el logout', async () => {
    // Cerrar sesión tiene que funcionar aunque el navegador tenga el
    // almacenamiento bloqueado: si no, el usuario queda con la sesión abierta.
    vi.stubGlobal('caches', {
      keys: async () => {
        throw new Error('bloqueado')
      },
      delete: async () => true,
    })
    await expect(purgeApiCaches()).resolves.toBeUndefined()
  })
})
