import { describe, it, expect, vi } from 'vitest'
import { BadRequestException } from '@nestjs/common'
import type { EventEmitter2 } from '@nestjs/event-emitter'
import { BatchesService } from './batches.service'
import type { PrismaService } from '../../prisma/prisma.service'
import type { StorageService } from '../../common/storage/storage.service'

/**
 * Ciclo de produccion de un lote: verificar stock, iniciar y completar.
 *
 * Los tres endpoints existian en el frontend y no en el backend — el boton
 * "Verificar e iniciar" de un lote PLANIFICADO daba 404 (TO_DO.md §27). Estos
 * tests fijan el contrato que la pantalla ya esperaba, que es lo que define la
 * forma correcta: `StockCheckResult` no se invento aca, se leyo de
 * `batches/[id]/page.tsx`.
 */

const ORG = 'org-1'

function loteBase(over: Record<string, unknown> = {}) {
  return {
    id: 'lote-1',
    organizationId: ORG,
    entryId: 'entry-1',
    recordId: 'rec-1',
    status: 'PLANNED',
    recipe: {
      stepsPdfKey: null,
      stepsPdfName: null,
      ingredients: [
        { name: 'ACIDO CITRICO', quantity: 10, unit: 'kg', fromStock: true },
        { name: 'AGUA', quantity: 100, unit: 'L', fromStock: false },
      ],
    },
    ...over,
  }
}

function armar(over: { batch?: Record<string, unknown>; movimientos?: unknown[] } = {}) {
  const tx = {
    entry: { create: vi.fn().mockResolvedValue({ id: 'entry-stock' }), update: vi.fn() },
    stockMovement: { create: vi.fn() },
    batch: { update: vi.fn() },
    batchStatusLog: { create: vi.fn() },
  }

  const prisma = {
    batch: {
      findFirst: vi.fn().mockResolvedValue(loteBase(over.batch)),
      update: vi.fn().mockResolvedValue({ id: 'lote-1' }),
    },
    stockMovement: { findMany: vi.fn().mockResolvedValue(over.movimientos ?? []) },
    record: {
      findFirst: vi.fn().mockResolvedValue({
        id: 'rec-stock',
        version: 1,
        fields: [
          { id: 'f-lote', label: 'LOTE', isIdentifier: true },
          { id: 'f-prod', label: 'PRODUCTO', isIdentifier: false },
          { id: 'f-tipo', label: 'TIPO MOVIMIENTO', isIdentifier: false },
          { id: 'f-cant', label: 'CANTIDAD', isIdentifier: false },
        ],
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'rec-1', organizationId: ORG }),
    },
    organizationUser: { findFirst: vi.fn().mockResolvedValue({ id: 'org-user-1' }) },
    entry: { update: vi.fn() },
    batchStatusLog: { create: vi.fn() },
    // Soporta las dos formas: array (changeStatus) y callback (complete).
    $transaction: vi.fn((arg: unknown) =>
      Array.isArray(arg) ? Promise.all(arg) : (arg as (t: unknown) => unknown)(tx),
    ),
  } as unknown as PrismaService

  const eventEmitter = { emit: vi.fn() } as unknown as EventEmitter2
  const storage = { signedUrl: vi.fn() } as unknown as StorageService

  return { service: new BatchesService(prisma, eventEmitter, storage), prisma, tx, eventEmitter }
}

describe('checkStock', () => {
  it('solo mira los ingredientes que salen del inventario', async () => {
    const ctx = armar({
      movimientos: [
        { lotNumber: 'L-1', movementType: 'INGRESO', quantity: 30, unit: 'kg' },
        { lotNumber: 'L-1', movementType: 'EGRESO', quantity: 5, unit: 'kg' },
      ],
    })

    const res = await ctx.service.checkStock('lote-1', ORG)

    // AGUA tiene fromStock: false — no sale del inventario y no se chequea.
    expect(res.ingredients).toHaveLength(1)
    expect(res.ingredients[0].ingredientName).toBe('ACIDO CITRICO')
    expect(res.ingredients[0].recipeQuantity).toBe(10)
  })

  it('calcula el saldo como ingresos menos egresos', async () => {
    const ctx = armar({
      movimientos: [
        { lotNumber: 'L-1', movementType: 'INGRESO', quantity: 30, unit: 'kg' },
        { lotNumber: 'L-1', movementType: 'EGRESO', quantity: 5, unit: 'kg' },
        { lotNumber: 'L-2', movementType: 'INGRESO', quantity: 4, unit: 'kg' },
      ],
    })

    const res = await ctx.service.checkStock('lote-1', ORG)

    expect(res.ingredients[0].totalBalance).toBe(29)
    expect(res.ingredients[0].lots).toHaveLength(2)
    expect(res.ingredients[0].sufficient).toBe(true)
    expect(res.allSufficient).toBe(true)
  })

  it('marca insuficiente cuando no alcanza', async () => {
    const ctx = armar({
      movimientos: [{ lotNumber: 'L-1', movementType: 'INGRESO', quantity: 3, unit: 'kg' }],
    })

    const res = await ctx.service.checkStock('lote-1', ORG)

    expect(res.ingredients[0].sufficient).toBe(false)
    expect(res.allSufficient).toBe(false)
  })

  it('descarta los lotes sin saldo', async () => {
    const ctx = armar({
      movimientos: [
        { lotNumber: 'L-1', movementType: 'INGRESO', quantity: 10, unit: 'kg' },
        { lotNumber: 'L-1', movementType: 'EGRESO', quantity: 10, unit: 'kg' },
        { lotNumber: 'L-2', movementType: 'INGRESO', quantity: 20, unit: 'kg' },
      ],
    })

    const res = await ctx.service.checkStock('lote-1', ORG)

    expect(res.ingredients[0].lots.map((l) => l.lotNumber)).toEqual(['L-2'])
  })

  it('una formula sin ingredientes de stock devuelve la lista vacia', async () => {
    // La UI lo lee como "se puede iniciar sin restricciones".
    const ctx = armar({
      batch: {
        recipe: {
          stepsPdfKey: null,
          stepsPdfName: null,
          ingredients: [{ name: 'AGUA', quantity: 100, unit: 'L', fromStock: false }],
        },
      },
    })

    const res = await ctx.service.checkStock('lote-1', ORG)

    expect(res.ingredients).toEqual([])
    expect(res.allSufficient).toBe(true)
  })

  it('busca el producto en MAYUSCULAS, que es como se guardan los movimientos', async () => {
    const ctx = armar()

    await ctx.service.checkStock('lote-1', ORG)

    const where = (ctx.prisma.stockMovement.findMany as ReturnType<typeof vi.fn>).mock.calls[0][0]
      .where
    expect(where.product).toBe('ACIDO CITRICO')
    expect(where.organizationId).toBe(ORG)
  })
})

describe('start', () => {
  it('no toca el inventario', async () => {
    const ctx = armar()

    await ctx.service.start('lote-1', ORG, 'user-1')

    // El consumo se registra al completar, contra los lotes que el operador
    // eligio de verdad.
    expect(ctx.tx.stockMovement.create).not.toHaveBeenCalled()
  })

  it('rechaza un lote que no esta planificado', async () => {
    const ctx = armar({ batch: { status: 'IN_PROGRESS' } })

    await expect(ctx.service.start('lote-1', ORG, 'user-1')).rejects.toThrow(BadRequestException)
  })
})

describe('complete', () => {
  const consumo = { product: 'ACIDO CITRICO', lotNumber: 'L-1', quantity: 10, unit: 'kg' }
  const datos = { producedQuantity: 95, unit: 'L', consumptions: [consumo] }

  function conSaldo(saldo: number) {
    return armar({
      batch: { status: 'IN_PROGRESS' },
      movimientos: [{ lotNumber: 'L-1', movementType: 'INGRESO', quantity: saldo, unit: 'kg' }],
    })
  }

  it('rechaza un lote que no esta en produccion', async () => {
    const ctx = armar({ batch: { status: 'PLANNED' } })

    await expect(ctx.service.complete('lote-1', ORG, 'user-1', datos)).rejects.toThrow(
      BadRequestException,
    )
  })

  it('rechaza consumir mas de lo que hay en el lote', async () => {
    const ctx = conSaldo(4)

    await expect(ctx.service.complete('lote-1', ORG, 'user-1', datos)).rejects.toThrow(
      /tiene 4 y se quieren consumir 10/,
    )
  })

  it('rechaza un lote sin saldo', async () => {
    const ctx = armar({ batch: { status: 'IN_PROGRESS' }, movimientos: [] })

    await expect(ctx.service.complete('lote-1', ORG, 'user-1', datos)).rejects.toThrow(
      /no tiene saldo disponible/,
    )
  })

  it('no escribe nada si el saldo no alcanza', async () => {
    const ctx = conSaldo(4)

    await expect(ctx.service.complete('lote-1', ORG, 'user-1', datos)).rejects.toThrow()

    // Los saldos se validan antes de abrir la transaccion.
    expect(ctx.tx.stockMovement.create).not.toHaveBeenCalled()
    expect(ctx.tx.batch.update).not.toHaveBeenCalled()
  })

  it('registra el egreso y cierra el lote en la misma transaccion', async () => {
    const ctx = conSaldo(30)

    await ctx.service.complete('lote-1', ORG, 'user-1', datos)

    // Un egreso escrito con el lote sin cerrar es stock que desaparecio sin
    // explicacion, asi que las dos cosas van juntas o no van.
    const mov = ctx.tx.stockMovement.create.mock.calls[0][0].data
    expect(mov.movementType).toBe('EGRESO')
    expect(mov.product).toBe('ACIDO CITRICO')
    expect(mov.quantity).toBe(10)

    const upd = ctx.tx.batch.update.mock.calls[0][0].data
    expect(upd.status).toBe('COMPLETED')
    expect(upd.producedQuantity).toBe(95)
    expect(upd.unit).toBe('L')

    expect(ctx.tx.batchStatusLog.create).toHaveBeenCalled()
  })

  it('completa la entry del lote, como hace changeStatus', async () => {
    const ctx = conSaldo(30)

    await ctx.service.complete('lote-1', ORG, 'user-1', datos)

    expect(ctx.tx.entry.update.mock.calls[0][0].where).toEqual({ id: 'entry-1' })
  })

  it('emite EntryCompletedEvent fuera de la transaccion', async () => {
    const ctx = conSaldo(30)

    await ctx.service.complete('lote-1', ORG, 'user-1', datos)

    // Los listeners no deben poder abortar la transaccion que los disparo.
    expect(ctx.eventEmitter.emit).toHaveBeenCalledWith('entry.completed', expect.anything())
  })

  it('permite cerrar sin consumos y ahi no busca el registro de stock', async () => {
    const ctx = armar({ batch: { status: 'IN_PROGRESS' } })

    await ctx.service.complete('lote-1', ORG, 'user-1', {
      producedQuantity: 95,
      unit: 'L',
      consumptions: [],
    })

    expect(ctx.prisma.record.findFirst).not.toHaveBeenCalled()
    expect(ctx.tx.batch.update).toHaveBeenCalled()
  })
})

describe('consumeStock — el camino inverso, que ya existia', () => {
  /**
   * No tenia tests y se refactorizo al agregar `complete`: la resolucion del
   * registro STOCK y la escritura de los egresos pasaron a helpers compartidos.
   * Estos fijan que su comportamiento no cambio.
   */
  const consumo = {
    ingredientName: 'ACIDO CITRICO',
    product: 'ACIDO CITRICO',
    lotNumber: 'l-1',
    quantity: 10,
    unit: 'kg',
  }

  it('descuenta del inventario y pasa el lote a EN PRODUCCION', async () => {
    const ctx = armar()

    await ctx.service.consumeStock('lote-1', ORG, 'user-1', [consumo])

    expect(ctx.tx.stockMovement.create.mock.calls[0][0].data.movementType).toBe('EGRESO')
    expect(ctx.tx.batch.update.mock.calls[0][0].data.status).toBe('IN_PROGRESS')
    expect(ctx.tx.batchStatusLog.create).toHaveBeenCalled()
  })

  it('guarda producto y lote en MAYUSCULAS', async () => {
    const ctx = armar()

    await ctx.service.consumeStock('lote-1', ORG, 'user-1', [consumo])

    const mov = ctx.tx.stockMovement.create.mock.calls[0][0].data
    expect(mov.lotNumber).toBe('L-1')
    expect(mov.product).toBe('ACIDO CITRICO')
  })

  it('escribe la entry de stock con los ids de field resueltos por label', async () => {
    const ctx = armar()

    await ctx.service.consumeStock('lote-1', ORG, 'user-1', [consumo])

    const data = ctx.tx.entry.create.mock.calls[0][0].data.data
    expect(data['f-lote']).toBe('L-1')
    expect(data['f-tipo']).toBe('EGRESO')
    expect(data['f-cant']).toBe(10)
  })

  it('rechaza un lote que no esta planificado', async () => {
    const ctx = armar({ batch: { status: 'IN_PROGRESS' } })

    await expect(ctx.service.consumeStock('lote-1', ORG, 'user-1', [consumo])).rejects.toThrow(
      BadRequestException,
    )
  })
})

describe('aislamiento', () => {
  it('las tres operaciones resuelven el lote acotado a la organizacion', async () => {
    for (const correr of [
      (s: BatchesService) => s.checkStock('lote-1', ORG),
      (s: BatchesService) => s.start('lote-1', ORG, 'user-1'),
      (s: BatchesService) =>
        s.complete('lote-1', ORG, 'user-1', { producedQuantity: 1, unit: 'L', consumptions: [] }),
    ]) {
      const ctx = armar({ batch: { status: 'IN_PROGRESS' } })
      await correr(ctx.service).catch(() => undefined)

      const where = (ctx.prisma.batch.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0].where
      expect(where.organizationId).toBe(ORG)
      expect(where.id).toBe('lote-1')
    }
  })
})
