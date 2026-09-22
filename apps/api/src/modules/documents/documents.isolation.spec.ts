import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { DocumentsService } from './documents.service'
import type { PrismaService } from '../../prisma/prisma.service'
import type { StorageService } from '../../common/storage/storage.service'

/**
 * Aislamiento multitenant de los documentos.
 *
 * La lectura siempre estuvo acotada —`findById` filtra por organizacion— pero
 * `update` pasaba el body **entero** a Prisma:
 *
 *     return this.prisma.document.update({ where: { id }, data })
 *
 * El tipo `{ title?, code?, status? }` solo existe en compilacion. En runtime
 * `data` es el body tal como llego y Prisma acepta cualquier campo real del
 * modelo, asi que un PATCH sobre un documento **propio** en DRAFT abria dos
 * caminos cruzados:
 *
 * - `organizationId` movia el documento al otro tenant.
 * - `fileKey` es peor: `withFileUrl` firma una URL a partir de esa clave sin
 *   verificar de quien es, asi que escribir la key ajena y volver a leer el
 *   documento devolvia una URL firmada al PDF del otro laboratorio. De paso
 *   puenteaba la guarda de `setFileKey`, que impide reemplazar el archivo sin
 *   crear una version nueva.
 *
 * El filtro por organizacion no cubria nada de esto: el documento es propio y
 * la operacion esta autorizada. Lo que sobraban eran los campos tocables.
 *
 * Igual que en los otros specs de aislamiento se usa un doble de Prisma: lo que
 * hay que verificar no es que devuelve la base sino **con que argumentos se la
 * consulta**. Contra una base real el test pasaria igual si el filtro se
 * cayera, siempre que las organizaciones del test no compartieran ids.
 */

interface WhereRegistrado {
  id?: string
  organizationId?: string
}

const DOC_PROPIO = {
  id: 'doc-1',
  organizationId: 'org-1',
  title: 'PROCEDIMIENTO DE CALIBRACION',
  code: 'PR-001',
  version: '1.0',
  status: 'DRAFT',
  fileKey: null,
  records: [],
}

function armarServicio() {
  const findFirst = vi.fn()
  const actualizar = vi.fn().mockResolvedValue({ ...DOC_PROPIO })
  const crear = vi.fn().mockResolvedValue({ ...DOC_PROPIO, id: 'doc-2', version: '2.0' })
  const prisma = {
    document: { findFirst, update: actualizar, create: crear },
  } as unknown as PrismaService

  const firmar = vi.fn().mockResolvedValue('https://api.test/storage/documents/x?sig=y')
  const storage = { signedUrl: firmar } as unknown as StorageService

  return { service: new DocumentsService(prisma, storage), findFirst, actualizar, crear, firmar }
}

describe('documents — aislamiento', () => {
  let ctx: ReturnType<typeof armarServicio>

  beforeEach(() => {
    ctx = armarServicio()
  })

  describe('findById', () => {
    it('acota la busqueda por organizacion', async () => {
      ctx.findFirst.mockResolvedValue({ ...DOC_PROPIO })

      await ctx.service.findById('doc-1', 'org-1')

      const where = ctx.findFirst.mock.calls[0][0].where as WhereRegistrado
      expect(where.id).toBe('doc-1')
      expect(where.organizationId).toBe('org-1')
    })

    it('un documento de otra organizacion no se lee', async () => {
      ctx.findFirst.mockResolvedValue(null)

      await expect(ctx.service.findById('doc-ajeno', 'org-1')).rejects.toThrow(NotFoundException)
      // Nunca se firma una URL de un archivo que no es del tenant.
      expect(ctx.firmar).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    it('busca el documento acotado a la organizacion', async () => {
      ctx.findFirst.mockResolvedValue({ ...DOC_PROPIO })

      await ctx.service.update('doc-1', 'org-1', { title: DOC_PROPIO.title })

      const where = ctx.findFirst.mock.calls[0][0].where as WhereRegistrado
      expect(where.id).toBe('doc-1')
      expect(where.organizationId).toBe('org-1')
    })

    it('un documento de otra organizacion no se actualiza', async () => {
      ctx.findFirst.mockResolvedValue(null)

      await expect(
        ctx.service.update('doc-ajeno', 'org-1', { title: 'TOMADO' }),
      ).rejects.toThrow(NotFoundException)
      expect(ctx.actualizar).not.toHaveBeenCalled()
    })

    it('el error no revela que el documento existe en otra organizacion', async () => {
      ctx.findFirst.mockResolvedValue(null)

      await expect(ctx.service.update('doc-ajeno', 'org-1', {})).rejects.toThrow(
        'Documento no encontrado',
      )
      await expect(ctx.service.update('no-existe', 'org-1', {})).rejects.toThrow(
        'Documento no encontrado',
      )
    })

    it('ignora campos del modelo que no son title, code ni status', async () => {
      ctx.findFirst.mockResolvedValue({ ...DOC_PROPIO })

      // Esto es lo que puede llegar en el body: el tipo no existe en runtime.
      await ctx.service.update('doc-1', 'org-1', {
        title: DOC_PROPIO.title,
        organizationId: 'org-victima',
        createdById: 'usuario-ajeno',
        version: '99.0',
      } as Parameters<typeof ctx.service.update>[2])

      const data = ctx.actualizar.mock.calls[0][0].data as Record<string, unknown>
      expect(data).toEqual({ title: DOC_PROPIO.title })
      // Con `data` entero, esto movia el documento al otro tenant y aparecia en
      // el listado de la victima.
      expect(data.organizationId).toBeUndefined()
      expect(data.createdById).toBeUndefined()
      expect(data.version).toBeUndefined()
    })

    it('no deja reescribir fileKey con la clave de otro tenant', async () => {
      ctx.findFirst.mockResolvedValue({ ...DOC_PROPIO })

      await ctx.service.update('doc-1', 'org-1', {
        fileKey: 'org-victima/ensayo-confidencial.pdf',
      } as Parameters<typeof ctx.service.update>[2])

      const data = ctx.actualizar.mock.calls[0][0].data as Record<string, unknown>
      // Si entrara, la lectura siguiente firmaria una URL al PDF ajeno: la firma
      // se calcula sobre la key sin mirar de quien es.
      expect(data.fileKey).toBeUndefined()
      expect(data).toEqual({})
    })

    it('sigue sin permitir editar un documento que no esta en DRAFT', async () => {
      ctx.findFirst.mockResolvedValue({ ...DOC_PROPIO, status: 'ACTIVE' })

      await expect(
        ctx.service.update('doc-1', 'org-1', { title: 'REESCRITO' }),
      ).rejects.toThrow(ConflictException)
      expect(ctx.actualizar).not.toHaveBeenCalled()
    })

    it('la verificacion de unicidad tambien esta acotada a la organizacion', async () => {
      ctx.findFirst.mockResolvedValueOnce({ ...DOC_PROPIO })
      ctx.findFirst.mockResolvedValueOnce(null)

      await ctx.service.update('doc-1', 'org-1', { title: 'OTRO TITULO' })

      const where = ctx.findFirst.mock.calls[1][0].where as WhereRegistrado
      // Sin esto, un titulo repetido en otro tenant bloquearia el propio y
      // confirmaria que ese documento existe alla.
      expect(where.organizationId).toBe('org-1')
    })
  })

  describe('setFileKey', () => {
    it('verifica la organizacion antes de escribir la clave', async () => {
      ctx.findFirst.mockResolvedValue({ ...DOC_PROPIO })

      await ctx.service.setFileKey('doc-1', 'org-1', 'org-1/manual.pdf')

      const where = ctx.findFirst.mock.calls[0][0].where as WhereRegistrado
      expect(where.organizationId).toBe('org-1')
      expect(ctx.findFirst).toHaveBeenCalledBefore(ctx.actualizar)
    })

    it('un documento de otra organizacion no recibe archivo', async () => {
      ctx.findFirst.mockResolvedValue(null)

      await expect(
        ctx.service.setFileKey('doc-ajeno', 'org-1', 'org-1/manual.pdf'),
      ).rejects.toThrow(NotFoundException)
      expect(ctx.actualizar).not.toHaveBeenCalled()
    })
  })

  describe('createNewVersion', () => {
    it('verifica la organizacion antes de marcar SUPERSEDED', async () => {
      ctx.findFirst.mockResolvedValue(null)

      await expect(
        ctx.service.createNewVersion('doc-ajeno', 'org-1', 'user-1', {}),
      ).rejects.toThrow(NotFoundException)
      // Lo importante: no se toca el estado del documento del otro tenant.
      expect(ctx.actualizar).not.toHaveBeenCalled()
      expect(ctx.crear).not.toHaveBeenCalled()
    })

    it('la version nueva nace en la organizacion de quien pide', async () => {
      ctx.findFirst.mockResolvedValue({ ...DOC_PROPIO })

      await ctx.service.createNewVersion('doc-1', 'org-1', 'user-1', { reason: 'REVISION' })

      const data = ctx.crear.mock.calls[0][0].data as Record<string, unknown>
      expect(data.organizationId).toBe('org-1')
      expect(data.createdById).toBe('user-1')
    })
  })
})
