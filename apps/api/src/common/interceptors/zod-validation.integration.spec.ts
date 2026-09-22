import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Body, Controller, Module, Post, UseInterceptors, UploadedFile, INestApplication } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { APP_INTERCEPTOR, NestFactory } from '@nestjs/core'
import { z } from 'zod'
import { ZodBody } from '../decorators/zod-body.decorator'
import { ZodValidationInterceptor } from './zod-validation.interceptor'

/**
 * El test unitario del interceptor prueba su logica contra un contexto falso, y
 * eso deja sin verificar justo el supuesto del que depende todo el diseño: que
 * reemplazar `request.body` dentro de un interceptor global efectivamente llega
 * al `@Body()` del handler.
 *
 * Si ese supuesto fuera falso, los siete tests unitarios pasarian igual y la
 * API no estaria validando nada. Por eso este levanta un Nest de verdad —sin
 * base de datos, sin dependencias nuevas— y pega una request HTTP real.
 */

const schema = z.object({
  name: z.string().min(1),
  parentId: z.string().optional(),
})

@Controller('prueba')
class ControllerDePrueba {
  @Post()
  @ZodBody(schema)
  crear(@Body() body: unknown) {
    // Devuelve lo que efectivamente le llego al handler.
    return { recibido: body }
  }

  @Post('sin-schema')
  crearSinSchema(@Body() body: unknown) {
    return { recibido: body }
  }

  /**
   * Endpoint multipart CON schema: la combinacion que no funciona y que el
   * interceptor tiene que rechazar de forma visible.
   */
  @Post('multipart-con-schema')
  @ZodBody(schema)
  @UseInterceptors(FileInterceptor('file'))
  subirConSchema(@UploadedFile() file: unknown, @Body() body: unknown) {
    return { recibido: body, tieneArchivo: !!file }
  }

  /** Multipart sin schema: el caso legitimo, tiene que seguir andando. */
  @Post('multipart-sin-schema')
  @UseInterceptors(FileInterceptor('file'))
  subirSinSchema(@UploadedFile() file: unknown, @Body() body: unknown) {
    return { recibido: body, tieneArchivo: !!file }
  }
}

@Module({
  controllers: [ControllerDePrueba],
  providers: [{ provide: APP_INTERCEPTOR, useClass: ZodValidationInterceptor }],
})
class ModuloDePrueba {}

describe('ZodValidationInterceptor — integracion con Nest', () => {
  let app: INestApplication
  let baseUrl: string

  beforeAll(async () => {
    app = await NestFactory.create(ModuloDePrueba, { logger: false })
    await app.listen(0)
    baseUrl = await app.getUrl()
  })

  afterAll(async () => {
    await app?.close()
  })

  async function postear(ruta: string, body: unknown) {
    const res = await fetch(`${baseUrl}${ruta}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: res.status, json: await res.json() }
  }

  it('el @Body() del handler recibe el body ya parseado', async () => {
    const { status, json } = await postear('/prueba', { name: 'LABORATORIO' })

    expect(status).toBe(201)
    expect(json).toEqual({ recibido: { name: 'LABORATORIO' } })
  })

  it('los campos que el schema no declara no llegan al handler', async () => {
    const { status, json } = await postear('/prueba', {
      name: 'LABORATORIO',
      organizationId: 'org-victima',
      leaderId: 'member-ajeno',
    })

    // Esto es la verificacion que importa: el handler —y por lo tanto Prisma—
    // nunca ven los campos de mas. Es el mass assignment cerrado de punta a
    // punta, no solo en la unidad.
    expect(status).toBe(201)
    expect(json).toEqual({ recibido: { name: 'LABORATORIO' } })
  })

  it('un body invalido responde 400 sin ejecutar el handler', async () => {
    const { status, json } = await postear('/prueba', { name: '' })

    expect(status).toBe(400)
    expect(json).not.toHaveProperty('recibido')
    expect((json as { errors: { field: string }[] }).errors.map((e) => e.field)).toContain('name')
  })

  it('un endpoint sin @ZodBody sigue recibiendo el body crudo', async () => {
    const { status, json } = await postear('/prueba/sin-schema', { cualquier: 'cosa' })

    expect(status).toBe(201)
    expect(json).toEqual({ recibido: { cualquier: 'cosa' } })
  })

  async function postearMultipart(ruta: string) {
    const fd = new FormData()
    fd.append('name', 'LABORATORIO')
    fd.append('noDeclarado', 'sobreviviria')
    fd.append('file', new Blob(['%PDF-x'], { type: 'application/pdf' }), 'x.pdf')
    const res = await fetch(`${baseUrl}${ruta}`, { method: 'POST', body: fd })
    return { status: res.status, json: await res.json() }
  }

  it('multipart con @ZodBody es 400 y no un no-op silencioso', async () => {
    const { status } = await postearMultipart('/prueba/multipart-con-schema')

    // Sin este corte el decorador no hace nada: los interceptores globales
    // corren antes que los de ruta, asi que multer todavia no parseo el body.
    // Se validaria `{}` y despues multer lo pisaria con los campos sin filtrar
    // —verificado: `noDeclarado` llegaba intacto al handler—. Un endpoint de
    // subida que parece validado y no lo esta es peor que uno sin decorar.
    expect(status).toBe(400)
  })

  it('multipart sin @ZodBody sigue funcionando', async () => {
    const { status, json } = await postearMultipart('/prueba/multipart-sin-schema')

    expect(status).toBe(201)
    expect(json).toMatchObject({ tieneArchivo: true })
  })
})
