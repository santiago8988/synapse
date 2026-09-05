import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { RecordsService } from './records.service'
import type { PrismaService } from '../../prisma/prisma.service'

/**
 * Aislamiento multitenant de los flujos (`RecordAction`).
 *
 * `deleteAction` recibía solo el `actionId` y borraba con ese id a secas: con
 * un JWT válido de una organización y el id de un flujo de otra, se borraba el
 * flujo ajeno. Estos tests existen para que ese agujero no vuelva sin que nadie
 * se entere, que es exactamente como llegó la primera vez.
 *
 * Se usa un doble de Prisma en vez de una base: lo que hay que verificar no es
 * qué devuelve la base, sino **con qué `where` se la consulta**. Un test contra
 * una base real pasaría igual si el filtro de organización se cayera, siempre
 * que las dos organizaciones del test no compartieran ids.
 */

interface WhereRegistrado {
  id?: string
  sourceRecordId?: string
  sourceRecord?: { organizationId?: string }
}

function armarServicio() {
  const findFirst = vi.fn()
  const eliminar = vi.fn().mockResolvedValue({ id: 'flow-1' })
  const prisma = {
    recordAction: { findFirst, delete: eliminar },
  } as unknown as PrismaService

  return { service: new RecordsService(prisma), findFirst, eliminar }
}

describe('deleteAction — aislamiento', () => {
  let ctx: ReturnType<typeof armarServicio>

  beforeEach(() => {
    ctx = armarServicio()
  })

  it('busca el flujo acotado a la organización y al registro de la URL', async () => {
    ctx.findFirst.mockResolvedValue({ id: 'flow-1' })

    await ctx.service.deleteAction('rec-1', 'flow-1', 'org-1')

    const where = ctx.findFirst.mock.calls[0][0].where as WhereRegistrado
    expect(where.id).toBe('flow-1')
    // Sin esto, el actionId de otra organización alcanzaría para borrar.
    expect(where.sourceRecord?.organizationId).toBe('org-1')
    // Y sin esto, un flujo de otro registro de la misma organización también.
    expect(where.sourceRecordId).toBe('rec-1')
  })

  it('borra solo después de verificar', async () => {
    ctx.findFirst.mockResolvedValue({ id: 'flow-1' })

    await ctx.service.deleteAction('rec-1', 'flow-1', 'org-1')

    expect(ctx.eliminar).toHaveBeenCalledWith({ where: { id: 'flow-1' } })
    expect(ctx.findFirst).toHaveBeenCalledBefore(ctx.eliminar)
  })

  it('un flujo de otra organización no se borra', async () => {
    // El `findFirst` acotado no lo encuentra, así que nunca se llega al delete.
    ctx.findFirst.mockResolvedValue(null)

    await expect(ctx.service.deleteAction('rec-1', 'flow-ajeno', 'org-1')).rejects.toThrow(
      NotFoundException,
    )
    expect(ctx.eliminar).not.toHaveBeenCalled()
  })

  it('el error no revela que el flujo existe en otra organización', async () => {
    ctx.findFirst.mockResolvedValue(null)

    // Mismo mensaje que para un id inventado: distinguirlos le confirmaría a
    // quien prueba ids cuáles existen en otro lado.
    await expect(ctx.service.deleteAction('rec-1', 'flow-ajeno', 'org-1')).rejects.toThrow(
      'Flujo no encontrado',
    )
    await expect(ctx.service.deleteAction('rec-1', 'no-existe', 'org-1')).rejects.toThrow(
      'Flujo no encontrado',
    )
  })
})
