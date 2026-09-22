import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NotFoundException } from '@nestjs/common'
import type { EventEmitter2 } from '@nestjs/event-emitter'
import { SamplesService } from './samples/samples.service'
import { BatchesService } from './batches/batches.service'
import type { PrismaService } from '../prisma/prisma.service'
import type { StorageService } from '../common/storage/storage.service'

/**
 * Trazabilidad de instrumental (ISO 17025 §6.4) — TO_DO.md §26.
 *
 * Que equipo real se uso en que muestra o lote. La plantilla declara etiquetas
 * genericas; cada corrida les asigna el instrumento concreto.
 *
 * Lo que estos tests cuidan es el aislamiento. La feature cruza tres entidades
 * —la corrida, el instrumento y la asignacion— y cada una llega por un id
 * distinto: la corrida por la URL, el instrumento por el body y la asignacion
 * por la URL otra vez. Cada uno es una via de cruce entre laboratorios si no se
 * acota, y es exactamente la clase de agujero que aparecio siete veces en la
 * auditoria de seguridad.
 */

const ORG = 'org-1'
const INSTRUMENTO = 'clh3k2j9x0000qwer1234asdf'

function armar(over: { instrumento?: unknown; asignacion?: unknown } = {}) {
  const delegado = {
    upsert: vi.fn().mockResolvedValue({ id: 'asig-1' }),
    findFirst: vi.fn().mockResolvedValue(
      over.asignacion === undefined ? { id: 'asig-1' } : over.asignacion,
    ),
    delete: vi.fn().mockResolvedValue({ id: 'asig-1' }),
  }

  const prisma = {
    // `methodIds` y `matrix` los necesita getEffectiveParameters, por el que
    // pasa findById; no tienen que ver con las asignaciones.
    sample: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'corrida-1',
        organizationId: ORG,
        methodIds: [],
        matrix: null,
      }),
    },
    batch: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'corrida-1',
        organizationId: ORG,
        recipe: null,
      }),
    },
    instrument: {
      findFirst: vi.fn().mockResolvedValue(
        over.instrumento === undefined ? { id: INSTRUMENTO } : over.instrumento,
      ),
    },
    organizationUser: { findFirst: vi.fn().mockResolvedValue({ id: 'org-user-1' }) },
    sampleInstrumentAssignment: delegado,
    batchInstrumentAssignment: delegado,
  } as unknown as PrismaService

  const storage = { signedUrl: vi.fn() } as unknown as StorageService
  const events = { emit: vi.fn() } as unknown as EventEmitter2

  return {
    muestras: new SamplesService(prisma, events),
    lotes: new BatchesService(prisma, events, storage),
    prisma,
    delegado,
  }
}

const datos = { label: 'TERMOMETRO', instrumentId: INSTRUMENTO, order: 1 }

describe('asignar un instrumento', () => {
  let ctx: ReturnType<typeof armar>

  beforeEach(() => {
    ctx = armar()
  })

  it('el instrumento se busca acotado a la organizacion', async () => {
    await ctx.muestras.assignInstrument('corrida-1', ORG, 'user-1', datos)

    // El id viene del body: sin este filtro se podria apuntar al equipo de otro
    // laboratorio y la muestra quedaria trazada contra un instrumento ajeno.
    const where = (ctx.prisma.instrument.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .where
    expect(where.id).toBe(INSTRUMENTO)
    expect(where.organizationId).toBe(ORG)
  })

  it('un instrumento de otra organizacion no se asigna', async () => {
    ctx = armar({ instrumento: null })

    await expect(
      ctx.muestras.assignInstrument('corrida-1', ORG, 'user-1', datos),
    ).rejects.toThrow(NotFoundException)
    expect(ctx.delegado.upsert).not.toHaveBeenCalled()
  })

  it('reasignar la misma etiqueta cambia el equipo en vez de fallar', async () => {
    await ctx.muestras.assignInstrument('corrida-1', ORG, 'user-1', datos)

    // Corregir a que equipo se apunto es normal mientras la corrida esta
    // abierta, asi que es upsert por (corrida, etiqueta) y no un create.
    const llamada = ctx.delegado.upsert.mock.calls[0][0]
    expect(llamada.where).toEqual({ sampleId_label: { sampleId: 'corrida-1', label: 'TERMOMETRO' } })
    expect(llamada.update.instrumentId).toBe(INSTRUMENTO)
  })

  it('registra quien asigno', async () => {
    await ctx.muestras.assignInstrument('corrida-1', ORG, 'user-1', datos)

    const llamada = ctx.delegado.upsert.mock.calls[0][0]
    expect(llamada.create.assignedById).toBe('org-user-1')
  })

  it('en lotes vale lo mismo', async () => {
    await ctx.lotes.assignInstrument('corrida-1', ORG, 'user-1', datos)

    const where = (ctx.prisma.instrument.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .where
    expect(where.organizationId).toBe(ORG)
    expect(ctx.delegado.upsert.mock.calls[0][0].where).toEqual({
      batchId_label: { batchId: 'corrida-1', label: 'TERMOMETRO' },
    })
  })
})

describe('quitar una asignacion', () => {
  it('la asignacion se busca acotada a la corrida', async () => {
    const ctx = armar()

    await ctx.muestras.unassignInstrument('corrida-1', 'asig-1', ORG)

    // El id de la asignacion llega de la URL. La corrida ya se resolvio contra
    // la organizacion, asi que acotar a ella es lo que cierra el cruce.
    const where = ctx.delegado.findFirst.mock.calls[0][0].where
    expect(where.id).toBe('asig-1')
    expect(where.sampleId).toBe('corrida-1')
  })

  it('una asignacion de otra corrida no se borra', async () => {
    const ctx = armar({ asignacion: null })

    await expect(
      ctx.muestras.unassignInstrument('corrida-1', 'asig-ajena', ORG),
    ).rejects.toThrow(NotFoundException)
    expect(ctx.delegado.delete).not.toHaveBeenCalled()
  })

  it('verifica antes de borrar', async () => {
    const ctx = armar()

    await ctx.muestras.unassignInstrument('corrida-1', 'asig-1', ORG)

    expect(ctx.delegado.findFirst).toHaveBeenCalledBefore(ctx.delegado.delete)
  })
})

describe('la corrida siempre se resuelve contra la organizacion', () => {
  it('asignar y desasignar pasan por findById acotado', async () => {
    const ctx = armar()

    await ctx.muestras.assignInstrument('corrida-1', ORG, 'user-1', datos)
    await ctx.muestras.unassignInstrument('corrida-1', 'asig-1', ORG)

    for (const llamada of (ctx.prisma.sample.findFirst as ReturnType<typeof vi.fn>).mock.calls) {
      expect(llamada[0].where.organizationId).toBe(ORG)
    }
  })
})
