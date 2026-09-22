import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import { EntriesService } from './entries.service'
import { UserRole } from '@synapse/types'
import type { PrismaService } from '../../prisma/prisma.service'

/**
 * Aislamiento multitenant de las entradas de registro — los datos de calidad.
 *
 * Una Entry se identifica por `recordId` + `entryId`, y ninguno de los dos dice a
 * que organizacion pertenece: eso lo dice el Record. `findById` se acotaba solo
 * por `recordId`, asi que `findOne`, `update`, `complete`, `getFieldValue` y
 * `setFieldValue` se resolvian sin mirar la organizacion nunca. Con un par de ids
 * se leian, editaban, cerraban o se les borraba el adjunto a los registros de
 * calidad de otro tenant.
 *
 * Todos los caminos pasan ahora por `assertRecordInOrg`. Estos tests verifican
 * **el `where` de esa consulta** y que nada escriba antes de que se resuelva.
 */

interface WhereRegistrado {
  id?: string
  organizationId?: string
}

function armarServicio() {
  const recordFindFirst = vi.fn()
  const entryFindFirst = vi.fn()
  const entryUpdate = vi.fn().mockResolvedValue({ id: 'entry-1', status: 'COMPLETED' })
  const recordFindUniqueOrThrow = vi.fn().mockResolvedValue({
    id: 'rec-1',
    organizationId: 'org-1',
    type: 'GENERIC',
    fields: [],
  })

  const prisma = {
    record: { findFirst: recordFindFirst, findUniqueOrThrow: recordFindUniqueOrThrow },
    entry: { findFirst: entryFindFirst, update: entryUpdate },
  } as unknown as PrismaService

  const service = new EntriesService(
    prisma,
    { emit: vi.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
    { signedUrl: vi.fn() } as never,
  )

  return { service, recordFindFirst, entryFindFirst, entryUpdate }
}

/** Entry sin campos de archivo: `signEntryFiles` no necesita firmar nada. */
const ENTRY = { id: 'entry-1', recordId: 'rec-1', data: {}, nonConformities: [] }

describe('entries — aislamiento', () => {
  let ctx: ReturnType<typeof armarServicio>

  beforeEach(() => {
    ctx = armarServicio()
  })

  it('findById acota el registro a la organizacion', async () => {
    ctx.recordFindFirst.mockResolvedValue({ id: 'rec-1', organizationId: 'org-1', type: 'GENERIC' })
    ctx.entryFindFirst.mockResolvedValue(ENTRY)

    await ctx.service.findById('entry-1', 'rec-1', 'org-1')

    const where = ctx.recordFindFirst.mock.calls[0][0].where as WhereRegistrado
    expect(where.id).toBe('rec-1')
    // Sin esto, cualquier par recordId+entryId servia.
    expect(where.organizationId).toBe('org-1')
  })

  it('findById de otra organizacion no devuelve la entrada', async () => {
    // El record acotado no aparece, asi que nunca se consulta la entry.
    ctx.recordFindFirst.mockResolvedValue(null)

    await expect(ctx.service.findById('entry-1', 'rec-ajeno', 'org-1')).rejects.toThrow(
      NotFoundException,
    )
    expect(ctx.entryFindFirst).not.toHaveBeenCalled()
  })

  it('complete no cierra una entrada de otra organizacion', async () => {
    ctx.recordFindFirst.mockResolvedValue(null)

    await expect(ctx.service.complete('entry-1', 'rec-ajeno', 'org-1')).rejects.toThrow(
      NotFoundException,
    )
    // Lo que importa: no se escribio nada.
    expect(ctx.entryUpdate).not.toHaveBeenCalled()
  })

  it('complete verifica la organizacion antes de escribir', async () => {
    ctx.recordFindFirst.mockResolvedValue({ id: 'rec-1', organizationId: 'org-1', type: 'GENERIC' })
    ctx.entryFindFirst.mockResolvedValue(ENTRY)

    await ctx.service.complete('entry-1', 'rec-1', 'org-1')

    expect(ctx.recordFindFirst).toHaveBeenCalledBefore(ctx.entryUpdate)
    expect((ctx.recordFindFirst.mock.calls[0][0].where as WhereRegistrado).organizationId).toBe('org-1')
  })

  it('getFieldValue no lee un adjunto de otra organizacion', async () => {
    ctx.recordFindFirst.mockResolvedValue(null)

    // Es el que alimenta el DELETE de archivos: si resolviera, el controller
    // seguia hasta storage.remove con la key del otro tenant.
    await expect(
      ctx.service.getFieldValue('entry-1', 'rec-ajeno', 'org-1', 'campo'),
    ).rejects.toThrow(NotFoundException)
    expect(ctx.entryFindFirst).not.toHaveBeenCalled()
  })

  it('setFieldValue no escribe en una entrada de otra organizacion', async () => {
    ctx.recordFindFirst.mockResolvedValue(null)

    await expect(
      ctx.service.setFieldValue(
        'entry-1',
        'rec-ajeno',
        'org-1',
        'campo',
        null,
        'user-1',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow(NotFoundException)
    expect(ctx.entryUpdate).not.toHaveBeenCalled()
  })

  it('update no escribe en una entrada de otra organizacion', async () => {
    ctx.recordFindFirst.mockResolvedValue(null)

    await expect(
      ctx.service.update(
        'entry-1',
        'rec-ajeno',
        'org-1',
        { campo: 'x' },
        'user-1',
        UserRole.ADMIN,
      ),
    ).rejects.toThrow(NotFoundException)
    expect(ctx.entryUpdate).not.toHaveBeenCalled()
  })

  it('el error no revela que el registro existe en otra organizacion', async () => {
    ctx.recordFindFirst.mockResolvedValue(null)

    await expect(ctx.service.findById('entry-1', 'rec-ajeno', 'org-1')).rejects.toThrow(
      'Registro no encontrado',
    )
    await expect(ctx.service.findById('entry-1', 'no-existe', 'org-1')).rejects.toThrow(
      'Registro no encontrado',
    )
  })
})
