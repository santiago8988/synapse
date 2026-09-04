import { describe, it, expect } from 'vitest'
import {
  AUDITABLE_ENTITIES,
  buildTenantWhere,
  redactSensitive,
} from './audit-entities'

/**
 * Dos garantías con consecuencias distintas pero igual de serias:
 *
 *  - `buildTenantWhere` es lo único que impide que el AuditLog lea la fila
 *    previa de otra organización (regla 1). Es una query más por mutación, y
 *    una query sin filtro de tenant es exactamente lo que no puede pasar.
 *  - `redactSensitive` es lo que impide que un token termine escrito en una
 *    tabla append-only, de donde ya no se puede borrar (reglas 4 y 8).
 */

describe('buildTenantWhere', () => {
  it('acota por columna cuando el modelo tiene organizationId', () => {
    const where = buildTenantWhere(AUDITABLE_ENTITIES.RECORDS, 'rec-1', 'org-1')
    expect(where).toEqual({ id: 'rec-1', organizationId: 'org-1' })
  })

  it('acota por la relación cuando la fila no tiene organizationId propio', () => {
    // Entry cuelga del Record; sin este caso especial la query saldría sin
    // filtro de tenant.
    const where = buildTenantWhere(AUDITABLE_ENTITIES.ENTRIES, 'e-1', 'org-1')
    expect(where).toEqual({ id: 'e-1', record: { organizationId: 'org-1' } })
  })

  it('usa orgId en OrgMethod, que no sigue la convención', () => {
    const where = buildTenantWhere(AUDITABLE_ENTITIES.METHODS, 'm-1', 'org-1')
    expect(where).toEqual({ id: 'm-1', orgId: 'org-1' })
  })

  it('ninguna entidad mapeada produce un where sin filtro de organización', () => {
    for (const [tipo, entidad] of Object.entries(AUDITABLE_ENTITIES)) {
      const where = buildTenantWhere(entidad, 'x', 'org-1')
      const claves = Object.keys(where)
      expect(claves, `${tipo} no filtra por tenant`).toHaveLength(2)
      expect(claves, `${tipo} no filtra por tenant`).not.toEqual(['id'])
    }
  })
})

describe('redactSensitive', () => {
  it('reemplaza el valor de las claves que parecen credenciales', () => {
    const out = redactSensitive({
      id: 'x',
      token: 'eyJhbGciOi...',
      password: 'hunter2',
      accessKey: 'AKIA...',
    }) as Record<string, unknown>

    expect(out.id).toBe('x')
    expect(out.token).toBe('[REDACTED]')
    expect(out.password).toBe('[REDACTED]')
    expect(out.accessKey).toBe('[REDACTED]')
  })

  it('detecta la clave sin importar mayúsculas ni separadores', () => {
    const out = redactSensitive({
      R2_SECRET_ACCESS_KEY: 'v',
      passwordHash: 'v',
      apiKey: 'v',
      refreshToken: 'v',
    }) as Record<string, unknown>

    for (const valor of Object.values(out)) {
      expect(valor).toBe('[REDACTED]')
    }
  })

  it('redacta también dentro de objetos anidados y arrays', () => {
    const out = redactSensitive({
      data: { nested: { secret: 'v', ok: 1 } },
      list: [{ token: 'v' }, { ok: 2 }],
    }) as { data: { nested: Record<string, unknown> }; list: Record<string, unknown>[] }

    expect(out.data.nested.secret).toBe('[REDACTED]')
    expect(out.data.nested.ok).toBe(1)
    expect(out.list[0].token).toBe('[REDACTED]')
    expect(out.list[1].ok).toBe(2)
  })

  it('no toca las claves inocentes', () => {
    const entrada = { nombre: 'LOTE-1', cantidad: 5, activo: true, vacio: null }
    expect(redactSensitive(entrada)).toEqual(entrada)
  })

  it('corta la recursión en estructuras muy profundas en vez de colgarse', () => {
    let profundo: Record<string, unknown> = { fondo: 'valor' }
    for (let i = 0; i < 30; i++) profundo = { nivel: profundo }

    const out = JSON.stringify(redactSensitive(profundo))
    expect(out).toContain('[TRUNCATED]')
  })

  it('deja pasar los primitivos tal cual', () => {
    expect(redactSensitive('texto')).toBe('texto')
    expect(redactSensitive(42)).toBe(42)
    expect(redactSensitive(null)).toBe(null)
  })
})
