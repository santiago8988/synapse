import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AreasService } from './areas.service'
import type { PrismaService } from '../../prisma/prisma.service'

/**
 * Aislamiento multitenant de las areas.
 *
 * `update` buscaba con `findUnique({ where: { id } })` y `delete` no verificaba
 * nada: con un JWT valido de una organizacion y el id de un area de otra se
 * renombraba o se borraba el area ajena. El `:orgId` de la ruta no ayudaba,
 * porque TenantGuard lee el claim del JWT y nunca mira el path param.
 *
 * El borrado era el peor caso: `RecordArea.area` es `onDelete: Cascade`, asi que
 * se llevaba las asignaciones area-registro del otro tenant.
 *
 * Igual que en record-actions.isolation.spec.ts se usa un doble de Prisma: lo
 * que hay que verificar no es que devuelve la base sino **con que `where` se la
 * consulta**. Contra una base real el test pasaria igual si el filtro se cayera,
 * siempre que las organizaciones del test no compartieran ids.
 */

interface WhereRegistrado {
  id?: string
  organizationId?: string
}

function armarServicio() {
  const findFirst = vi.fn()
  const actualizar = vi.fn().mockResolvedValue({ id: 'area-1' })
  const eliminar = vi.fn().mockResolvedValue({ id: 'area-1' })
  const crear = vi.fn().mockResolvedValue({ id: 'area-nueva' })
  const prisma = {
    area: { findFirst, update: actualizar, delete: eliminar, create: crear },
  } as unknown as PrismaService

  return { service: new AreasService(prisma), findFirst, actualizar, eliminar, crear }
}

describe('areas — aislamiento', () => {
  let ctx: ReturnType<typeof armarServicio>

  beforeEach(() => {
    ctx = armarServicio()
  })

  describe('update', () => {
    it('busca el area acotada a la organizacion', async () => {
      ctx.findFirst.mockResolvedValue({ id: 'area-1', organizationId: 'org-1' })

      await ctx.service.update('area-1', 'org-1', { name: 'Laboratorio' })

      const where = ctx.findFirst.mock.calls[0][0].where as WhereRegistrado
      expect(where.id).toBe('area-1')
      // Sin esto, el areaId de otra organizacion alcanzaba para renombrarla.
      expect(where.organizationId).toBe('org-1')
    })

    it('un area de otra organizacion no se actualiza', async () => {
      ctx.findFirst.mockResolvedValue(null)

      await expect(
        ctx.service.update('area-ajena', 'org-1', { name: 'Tomada' }),
      ).rejects.toThrow(NotFoundException)
      expect(ctx.actualizar).not.toHaveBeenCalled()
    })

    it('no acepta un padre de otra organizacion', async () => {
      // Primera consulta: el area propia existe. Segunda: el padre no aparece
      // acotado a la organizacion.
      ctx.findFirst.mockResolvedValueOnce({ id: 'area-1', organizationId: 'org-1' })
      ctx.findFirst.mockResolvedValueOnce(null)

      await expect(
        ctx.service.update('area-1', 'org-1', { parentId: 'area-de-otro-tenant' }),
      ).rejects.toThrow(NotFoundException)
      // Colgar el arbol propio del ajeno haria que el getTree del otro lado
      // devolviera areas que no le pertenecen.
      expect(ctx.actualizar).not.toHaveBeenCalled()
    })

    it('rechaza que un area sea su propio padre', async () => {
      ctx.findFirst.mockResolvedValue({ id: 'area-1', organizationId: 'org-1' })

      await expect(
        ctx.service.update('area-1', 'org-1', { parentId: 'area-1' }),
      ).rejects.toThrow(BadRequestException)
      expect(ctx.actualizar).not.toHaveBeenCalled()
    })

    it('ignora campos del modelo que no son name ni parentId', async () => {
      ctx.findFirst.mockResolvedValue({ id: 'area-1', organizationId: 'org-1' })

      // El tipo de `data` no existe en runtime: esto es lo que puede llegar en
      // el body. Pasar `data` entero a Prisma movia el area a otro tenant.
      await ctx.service.update('area-1', 'org-1', {
        name: 'Laboratorio',
        organizationId: 'org-victima',
        leaderId: 'member-ajeno',
      } as Parameters<typeof ctx.service.update>[2])

      const data = ctx.actualizar.mock.calls[0][0].data as Record<string, unknown>
      expect(data).toEqual({ name: 'Laboratorio' })
      expect(data.organizationId).toBeUndefined()
      expect(data.leaderId).toBeUndefined()
    })

    it('permite desacoplar el padre con null sin consultarlo', async () => {
      ctx.findFirst.mockResolvedValue({ id: 'area-1', organizationId: 'org-1' })

      await ctx.service.update('area-1', 'org-1', { parentId: null })

      // Un solo findFirst: el del area. null no es un id que validar.
      expect(ctx.findFirst).toHaveBeenCalledTimes(1)
      expect(ctx.actualizar).toHaveBeenCalled()
    })
  })

  describe('delete', () => {
    it('verifica antes de borrar', async () => {
      ctx.findFirst.mockResolvedValue({ id: 'area-1', organizationId: 'org-1' })

      await ctx.service.delete('area-1', 'org-1')

      const where = ctx.findFirst.mock.calls[0][0].where as WhereRegistrado
      expect(where.organizationId).toBe('org-1')
      expect(ctx.eliminar).toHaveBeenCalledWith({ where: { id: 'area-1' } })
      expect(ctx.findFirst).toHaveBeenCalledBefore(ctx.eliminar)
    })

    it('un area de otra organizacion no se borra', async () => {
      ctx.findFirst.mockResolvedValue(null)

      await expect(ctx.service.delete('area-ajena', 'org-1')).rejects.toThrow(NotFoundException)
      // Lo importante: nunca se llega al delete, que cascadearia RecordArea.
      expect(ctx.eliminar).not.toHaveBeenCalled()
    })

    it('el error no revela que el area existe en otra organizacion', async () => {
      ctx.findFirst.mockResolvedValue(null)

      await expect(ctx.service.delete('area-ajena', 'org-1')).rejects.toThrow('Área no encontrada')
      await expect(ctx.service.delete('no-existe', 'org-1')).rejects.toThrow('Área no encontrada')
    })
  })

  describe('create', () => {
    it('no acepta un padre de otra organizacion', async () => {
      ctx.findFirst.mockResolvedValue(null)

      await expect(
        ctx.service.create('org-1', { name: 'Nueva', parentId: 'area-de-otro-tenant' }),
      ).rejects.toThrow(NotFoundException)
      expect(ctx.crear).not.toHaveBeenCalled()
    })

    it('crea sin padre sin consultar nada', async () => {
      await ctx.service.create('org-1', { name: 'Raiz' })

      expect(ctx.findFirst).not.toHaveBeenCalled()
      expect(ctx.crear).toHaveBeenCalled()
    })
  })
})
