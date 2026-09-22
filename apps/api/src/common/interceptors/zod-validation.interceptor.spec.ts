import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException, ExecutionContext, CallHandler } from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { of } from 'rxjs'
import { z } from 'zod'
import { ZodValidationInterceptor } from './zod-validation.interceptor'

/**
 * Validacion de entrada en runtime.
 *
 * El punto no es el mensaje de error: es que `request.body` quede reemplazado
 * por el resultado del parseo. `z.object()` descarta las claves que no declara,
 * asi que el handler —y Prisma detras— dejan de ver campos que nadie declaro.
 *
 * Esa es la clase que aparecio tres veces en la auditoria de seguridad
 * (`areas.update`, `organizations.update`, `documents.update`): el tipo TS se
 * borra al compilar, en runtime el body es lo que mando el cliente, y Prisma
 * acepta cualquier campo real del modelo. Un `organizationId` en el body movia
 * el recurso a otro tenant.
 */

const schemaDeArea = z.object({
  name: z.string().min(1),
  parentId: z.string().optional(),
})

function armarContexto(body: unknown, schema?: z.ZodSchema) {
  const request: { body: unknown } = { body }

  const context = {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext

  const handle = vi.fn(() => of('respuesta'))
  const next = { handle } as unknown as CallHandler

  const reflector = {
    getAllAndOverride: vi.fn(() => schema),
  } as unknown as Reflector

  return { interceptor: new ZodValidationInterceptor(reflector), context, next, handle, request }
}

describe('ZodValidationInterceptor', () => {
  let ctx: ReturnType<typeof armarContexto>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sin schema declarado no toca el body', () => {
    ctx = armarContexto({ lo: 'que', sea: 1 }, undefined)

    ctx.interceptor.intercept(ctx.context, ctx.next)

    // La migracion es endpoint por endpoint: lo no declarado todavia pasa.
    expect(ctx.request.body).toEqual({ lo: 'que', sea: 1 })
    expect(ctx.handle).toHaveBeenCalled()
  })

  it('reemplaza el body por el resultado del parseo', () => {
    ctx = armarContexto({ name: 'LABORATORIO' }, schemaDeArea)

    ctx.interceptor.intercept(ctx.context, ctx.next)

    expect(ctx.request.body).toEqual({ name: 'LABORATORIO' })
    expect(ctx.handle).toHaveBeenCalled()
  })

  it('descarta las claves que el schema no declara', () => {
    ctx = armarContexto(
      { name: 'LABORATORIO', organizationId: 'org-victima', leaderId: 'member-ajeno' },
      schemaDeArea,
    )

    ctx.interceptor.intercept(ctx.context, ctx.next)

    // Esto es lo que cierra el mass assignment: el handler nunca ve los campos
    // de mas, asi que no puede pasarselos a Prisma aunque quiera.
    expect(ctx.request.body).toEqual({ name: 'LABORATORIO' })
    expect(ctx.request.body).not.toHaveProperty('organizationId')
    expect(ctx.request.body).not.toHaveProperty('leaderId')
  })

  it('un body invalido es 400 y no llega al handler', () => {
    ctx = armarContexto({ name: '' }, schemaDeArea)

    expect(() => ctx.interceptor.intercept(ctx.context, ctx.next)).toThrow(BadRequestException)
    expect(ctx.handle).not.toHaveBeenCalled()
  })

  it('el error dice que campo fallo', () => {
    ctx = armarContexto({ parentId: 123 }, schemaDeArea)

    try {
      ctx.interceptor.intercept(ctx.context, ctx.next)
      expect.unreachable('tendria que haber tirado')
    } catch (error) {
      const respuesta = (error as BadRequestException).getResponse() as {
        message: string
        errors: { field: string; message: string }[]
      }
      expect(respuesta.message).toBe('Error de validación')
      expect(respuesta.errors.map((e) => e.field)).toContain('name')
      expect(respuesta.errors.map((e) => e.field)).toContain('parentId')
    }
  })

  it('un body ausente se valida como objeto vacio, no como TypeError', () => {
    ctx = armarContexto(undefined, z.object({ nota: z.string().optional() }))

    ctx.interceptor.intercept(ctx.context, ctx.next)

    expect(ctx.request.body).toEqual({})
    expect(ctx.handle).toHaveBeenCalled()
  })

  it('aplica los defaults del schema', () => {
    ctx = armarContexto(
      { email: 'alguien@lab.test' },
      z.object({
        email: z.string().email(),
        role: z.enum(['ADMIN', 'TECHNICIAN']).optional().default('TECHNICIAN'),
      }),
    )

    ctx.interceptor.intercept(ctx.context, ctx.next)

    // addWhitelistSchema depende de esto: el rol por defecto lo pone el schema.
    expect(ctx.request.body).toEqual({ email: 'alguien@lab.test', role: 'TECHNICIAN' })
  })
})
