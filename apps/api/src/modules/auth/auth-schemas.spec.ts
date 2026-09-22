import { describe, it, expect } from 'vitest'
import {
  exchangeOrganizationsSchema,
  exchangeSchema,
  switchOrgSchema,
} from '@synapse/validators'
import { AuthCodeService } from './auth-code.service'

/**
 * Schemas del flujo de ingreso — las tres unicas rutas con body de la
 * superficie sin autenticar, mas `switch-org`.
 *
 * El riesgo de validar aca no es dejar pasar algo: es rechazar algo legitimo.
 * Un schema demasiado ajustado en `/auth/exchange` no rompe una pantalla, rompe
 * el login entero, y lo hace en el unico lugar donde la persona todavia no
 * entro y no tiene a donde ir. Por eso el primer test canjea un codigo emitido
 * por el generador de verdad en vez de uno inventado: si alguien cambia el
 * formato en `auth-code.service`, este test dice si el schema lo sigue
 * aceptando.
 */

describe('codigo de login', () => {
  const codigos = new AuthCodeService()

  it('acepta un codigo emitido por AuthCodeService', () => {
    const code = codigos.issue('user-1', ['org-1'])

    expect(() => exchangeSchema.parse({ code })).not.toThrow()
    expect(() => exchangeOrganizationsSchema.parse({ code })).not.toThrow()
  })

  it('acepta cien codigos seguidos, no uno con suerte', () => {
    // base64url sobre 32 bytes: el largo es estable, pero el alfabeto incluye
    // `-` y `_`, que aparecen solo en algunos. Cien alcanza para que salgan.
    for (let i = 0; i < 100; i++) {
      const code = codigos.issue(`user-${i}`, ['org-1'])
      expect(exchangeSchema.safeParse({ code }).success).toBe(true)
    }
  })

  it('un codigo roto igual llega al handler, que da el mensaje util', () => {
    // A proposito no se valida el formato: un link cortado al copiarlo tiene
    // que seguir respondiendo "el código venció o ya fue usado", que le dice al
    // usuario qué hacer, y no un "Error de validación" generico.
    expect(exchangeSchema.safeParse({ code: 'roto' }).success).toBe(true)
  })

  it('rechaza lo que no es un string', () => {
    expect(exchangeSchema.safeParse({ code: { inyectado: true } }).success).toBe(false)
    expect(exchangeSchema.safeParse({ code: ['a', 'b'] }).success).toBe(false)
    expect(exchangeSchema.safeParse({ code: 42 }).success).toBe(false)
  })

  it('rechaza un codigo desmedido y uno vacio', () => {
    expect(exchangeSchema.safeParse({ code: 'x'.repeat(201) }).success).toBe(false)
    expect(exchangeSchema.safeParse({ code: '' }).success).toBe(false)
  })

  it('exige el codigo', () => {
    expect(exchangeSchema.safeParse({}).success).toBe(false)
  })
})

describe('exchangeSchema', () => {
  it('organizationId es opcional: con una sola organizacion no viaja', () => {
    const parseado = exchangeSchema.parse({ code: 'abc' })

    expect(parseado.organizationId).toBeUndefined()
  })

  it('descarta los campos que no declara', () => {
    const parseado = exchangeSchema.parse({
      code: 'abc',
      userId: 'otro-usuario',
      role: 'ADMIN',
    })

    // `userId` por body seria un bypass de autenticacion. El handler nunca lo
    // leyo, pero ahora tampoco llega.
    expect(parseado).toEqual({ code: 'abc' })
  })
})

describe('switchOrgSchema', () => {
  it('acepta un cuid', () => {
    expect(switchOrgSchema.safeParse({ organizationId: 'clh3k2j9x0000qwer1234asdf' }).success).toBe(
      true,
    )
  })

  it('descarta userId, que es el campo peligroso de este endpoint', () => {
    const parseado = switchOrgSchema.parse({
      organizationId: 'clh3k2j9x0000qwer1234asdf',
      userId: 'victima',
    })

    // Con `userId` aceptado, cualquiera pediria un token de cualquiera.
    expect(parseado).toEqual({ organizationId: 'clh3k2j9x0000qwer1234asdf' })
  })

  it('exige organizationId', () => {
    expect(switchOrgSchema.safeParse({}).success).toBe(false)
  })
})
