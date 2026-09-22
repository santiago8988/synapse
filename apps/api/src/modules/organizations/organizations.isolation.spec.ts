import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { OrganizationsService } from './organizations.service'
import type { PrismaService } from '../../prisma/prisma.service'

/**
 * Aislamiento multitenant de la gestion de miembros e invitaciones.
 *
 * `updateUser` recibia solo el id de OrganizationUser y actualizaba con ese id a
 * secas. Era el agujero mas grave del modulo: un ADMIN de cualquier organizacion
 * podia pasar el id de un miembro de otra y ponerle `role: 'ADMIN'` o
 * `isActive: false` — escalada de privilegios y lockout cross-tenant en una sola
 * request. `removeFromWhitelist` tenia el mismo problema con las invitaciones
 * pendientes.
 *
 * Doble de Prisma a proposito: lo que se verifica es **con que `where` se
 * consulta**, no que devuelve la base.
 */

interface WhereRegistrado {
  id?: string
  organizationId?: string
}

function armarServicio() {
  const miembroFindFirst = vi.fn()
  const miembroUpdate = vi.fn().mockResolvedValue({ id: 'member-1' })
  const whitelistFindFirst = vi.fn()
  const whitelistDelete = vi.fn().mockResolvedValue({ id: 'wl-1' })
  const areaFindFirst = vi.fn()
  const positionFindFirst = vi.fn()

  const prisma = {
    organizationUser: { findFirst: miembroFindFirst, update: miembroUpdate },
    emailWhitelist: { findFirst: whitelistFindFirst, delete: whitelistDelete },
    area: { findFirst: areaFindFirst },
    position: { findFirst: positionFindFirst },
  } as unknown as PrismaService

  return {
    service: new OrganizationsService(prisma),
    miembroFindFirst,
    miembroUpdate,
    whitelistFindFirst,
    whitelistDelete,
    areaFindFirst,
    positionFindFirst,
  }
}

describe('organizations — aislamiento', () => {
  let ctx: ReturnType<typeof armarServicio>

  beforeEach(() => {
    ctx = armarServicio()
  })

  describe('updateUser', () => {
    it('busca el miembro acotado a la organizacion', async () => {
      ctx.miembroFindFirst.mockResolvedValue({ id: 'member-1' })

      await ctx.service.updateUser('member-1', 'org-1', { phone: '223' })

      const where = ctx.miembroFindFirst.mock.calls[0][0].where as WhereRegistrado
      expect(where.id).toBe('member-1')
      // Sin esto se podia promover o desactivar a un miembro de otro tenant.
      expect(where.organizationId).toBe('org-1')
    })

    it('no promueve a un miembro de otra organizacion', async () => {
      ctx.miembroFindFirst.mockResolvedValue(null)

      await expect(
        ctx.service.updateUser('member-ajeno', 'org-1', { role: 'ADMIN' }),
      ).rejects.toThrow(NotFoundException)
      expect(ctx.miembroUpdate).not.toHaveBeenCalled()
    })

    it('no desactiva a un miembro de otra organizacion', async () => {
      ctx.miembroFindFirst.mockResolvedValue(null)

      await expect(
        ctx.service.updateUser('member-ajeno', 'org-1', { isActive: false }),
      ).rejects.toThrow(NotFoundException)
      expect(ctx.miembroUpdate).not.toHaveBeenCalled()
    })

    it('no acepta un area de otra organizacion', async () => {
      ctx.miembroFindFirst.mockResolvedValue({ id: 'member-1' })
      ctx.areaFindFirst.mockResolvedValue(null)

      await expect(
        ctx.service.updateUser('member-1', 'org-1', { areaId: 'area-de-otro-tenant' }),
      ).rejects.toThrow(NotFoundException)
      expect(ctx.miembroUpdate).not.toHaveBeenCalled()
    })

    it('no acepta un puesto de otra organizacion', async () => {
      ctx.miembroFindFirst.mockResolvedValue({ id: 'member-1' })
      ctx.positionFindFirst.mockResolvedValue(null)

      await expect(
        ctx.service.updateUser('member-1', 'org-1', { positionId: 'pos-de-otro-tenant' }),
      ).rejects.toThrow(NotFoundException)
      expect(ctx.miembroUpdate).not.toHaveBeenCalled()
    })

    it('valida area y puesto contra la organizacion cuando si pertenecen', async () => {
      ctx.miembroFindFirst.mockResolvedValue({ id: 'member-1' })
      ctx.areaFindFirst.mockResolvedValue({ id: 'area-1' })
      ctx.positionFindFirst.mockResolvedValue({ id: 'pos-1' })

      await ctx.service.updateUser('member-1', 'org-1', {
        areaId: 'area-1',
        positionId: 'pos-1',
      })

      expect((ctx.areaFindFirst.mock.calls[0][0].where as WhereRegistrado).organizationId).toBe('org-1')
      expect((ctx.positionFindFirst.mock.calls[0][0].where as WhereRegistrado).organizationId).toBe('org-1')
      expect(ctx.miembroUpdate).toHaveBeenCalled()
    })

    it('limpiar area o puesto con null no dispara consultas de pertenencia', async () => {
      ctx.miembroFindFirst.mockResolvedValue({ id: 'member-1' })

      await ctx.service.updateUser('member-1', 'org-1', { areaId: null, positionId: null })

      expect(ctx.areaFindFirst).not.toHaveBeenCalled()
      expect(ctx.positionFindFirst).not.toHaveBeenCalled()
      expect(ctx.miembroUpdate).toHaveBeenCalled()
    })
  })

  describe('removeFromWhitelist', () => {
    it('verifica antes de borrar', async () => {
      ctx.whitelistFindFirst.mockResolvedValue({ id: 'wl-1' })

      await ctx.service.removeFromWhitelist('wl-1', 'org-1')

      const where = ctx.whitelistFindFirst.mock.calls[0][0].where as WhereRegistrado
      expect(where.organizationId).toBe('org-1')
      expect(ctx.whitelistFindFirst).toHaveBeenCalledBefore(ctx.whitelistDelete)
    })

    it('una invitacion de otra organizacion no se borra', async () => {
      ctx.whitelistFindFirst.mockResolvedValue(null)

      await expect(ctx.service.removeFromWhitelist('wl-ajena', 'org-1')).rejects.toThrow(
        NotFoundException,
      )
      expect(ctx.whitelistDelete).not.toHaveBeenCalled()
    })
  })
})
