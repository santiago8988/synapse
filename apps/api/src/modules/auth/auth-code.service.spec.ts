import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AuthCodeService } from './auth-code.service'

/**
 * El código de login reemplazó al JWT en la URL. Su valor depende enteramente
 * de dos propiedades: que sirva una sola vez y que venza rápido. Si alguna se
 * rompe, volvemos a tener una credencial reutilizable escrita en los logs.
 */

describe('AuthCodeService', () => {
  let service: AuthCodeService

  beforeEach(() => {
    service = new AuthCodeService()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emite códigos opacos y distintos en cada login', () => {
    const a = service.issue('user-1', ['org-1'])
    const b = service.issue('user-1', ['org-1'])

    expect(a).not.toBe(b)
    // No debe poder deducirse el usuario ni la organización a partir del código.
    expect(a).not.toContain('user-1')
    expect(a).not.toContain('org-1')
    expect(a.length).toBeGreaterThan(20)
  })

  it('devuelve el usuario y las organizaciones autorizadas al canjearlo', () => {
    const code = service.issue('user-1', ['org-1', 'org-2'])

    expect(service.consume(code)).toEqual({
      userId: 'user-1',
      organizationIds: ['org-1', 'org-2'],
      expiresAt: expect.any(Number),
    })
  })

  it('sirve una sola vez: el segundo canje falla', () => {
    const code = service.issue('user-1', ['org-1'])

    expect(service.consume(code)).not.toBeNull()
    expect(service.consume(code)).toBeNull()
  })

  it('peek no consume, para que la pantalla de selección pueda leerlo antes', () => {
    const code = service.issue('user-1', ['org-1', 'org-2'])

    expect(service.peek(code)).not.toBeNull()
    expect(service.peek(code)).not.toBeNull()
    // Y después sigue estando disponible para el canje real.
    expect(service.consume(code)).not.toBeNull()
  })

  it('rechaza un código que nunca existió', () => {
    expect(service.consume('inventado')).toBeNull()
    expect(service.peek('inventado')).toBeNull()
  })

  it('vence a los 2 minutos', () => {
    vi.useFakeTimers()
    const code = service.issue('user-1', ['org-1'])

    vi.advanceTimersByTime(119_000)
    expect(service.peek(code)).not.toBeNull()

    vi.advanceTimersByTime(2_000)
    expect(service.peek(code)).toBeNull()
    expect(service.consume(code)).toBeNull()
  })

  it('descarta el código vencido en vez de acumularlo', () => {
    vi.useFakeTimers()
    const code = service.issue('user-1', ['org-1'])

    vi.advanceTimersByTime(3 * 60 * 1000)
    // El peek lo encuentra vencido y lo borra en el momento; que un segundo
    // intento siga dando null confirma que no quedo colgado en memoria.
    expect(service.peek(code)).toBeNull()
    expect(service.peek(code)).toBeNull()
  })

  it('un código no interfiere con otro', () => {
    const a = service.issue('user-a', ['org-a'])
    const b = service.issue('user-b', ['org-b'])

    service.consume(a)
    expect(service.consume(b)?.userId).toBe('user-b')
  })
})
