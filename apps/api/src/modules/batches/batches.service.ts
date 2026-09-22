import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../../prisma/prisma.service'
import { BatchStatus, Prisma } from '@prisma/client'
import { EntryCompletedEvent } from '../../common/events/domain-events'
import { StorageService } from '../../common/storage/storage.service'

const VALID_TRANSITIONS: Record<BatchStatus, BatchStatus[]> = {
  PLANNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: ['PLANNED'],
}

@Injectable()
export class BatchesService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private storage: StorageService,
  ) {}

  async findAll(organizationId: string, filters?: { status?: string; recordId?: string }) {
    return this.prisma.batch.findMany({
      where: {
        organizationId,
        ...(filters?.status ? { status: filters.status as BatchStatus } : {}),
        ...(filters?.recordId ? { recordId: filters.recordId } : {}),
      },
      include: {
        record: { select: { id: true, name: true } },
        recipe: { select: { id: true, name: true, code: true } },
        entry: { select: { id: true, data: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string, organizationId: string) {
    const batch = await this.prisma.batch.findFirst({
      where: { id, organizationId },
      include: {
        record: {
          select: {
            id: true,
            name: true,
            fields: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, label: true, fieldType: true } },
          },
        },
        recipe: {
          include: {
            ingredients: {
              orderBy: { order: 'asc' },
              include: { stockRecipe: { select: { id: true, name: true, code: true } } },
            },
            steps: { orderBy: { order: 'asc' } },
          },
        },
        entry: true,
        statusLogs: {
          orderBy: { changedAt: 'desc' },
        },
      },
    })
    if (!batch) throw new NotFoundException('Lote no encontrado')
    return this.withRecipeStepsUrl(batch)
  }

  /**
   * El detalle del lote enlaza el PDF de pasos de la fórmula, pero la trae por
   * include directo y no por RecipesService, así que la URL se firma acá
   * también. La fuente es stepsPdfKey; stepsPdfUrl ya no se persiste.
   */
  private async withRecipeStepsUrl<
    T extends { recipe: { stepsPdfKey: string | null; stepsPdfName: string | null } | null },
  >(batch: T): Promise<T> {
    const recipe = batch.recipe
    if (!recipe?.stepsPdfKey) return batch
    return {
      ...batch,
      recipe: {
        ...recipe,
        stepsPdfUrl: await this.storage.signedUrl('recipes', recipe.stepsPdfKey, {
          downloadName: recipe.stepsPdfName ?? undefined,
        }),
      },
    }
  }

  async changeStatus(
    id: string,
    organizationId: string,
    changedByUserId: string,
    newStatus: BatchStatus,
    data?: { producedQuantity?: number; unit?: string; reason?: string },
  ) {
    const batch = await this.findById(id, organizationId)

    const allowed = VALID_TRANSITIONS[batch.status]
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `No se puede pasar de ${batch.status} a ${newStatus}`,
      )
    }

    // Obtener OrganizationUser.id
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { userId: changedByUserId, organizationId },
    })
    if (!orgUser) throw new NotFoundException('Usuario no encontrado')

    const updateData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'IN_PROGRESS') updateData.startedAt = new Date()
    if (newStatus === 'COMPLETED' || newStatus === 'APPROVED') updateData.completedAt = new Date()
    if (newStatus === 'PLANNED') {
      updateData.startedAt = null
      updateData.completedAt = null
    }
    if (data?.producedQuantity !== undefined) updateData.producedQuantity = data.producedQuantity
    if (data?.unit) updateData.unit = data.unit

    const [updatedBatch] = await this.prisma.$transaction([
      this.prisma.batch.update({
        where: { id },
        data: updateData,
        include: {
          record: { select: { id: true, name: true } },
          recipe: { select: { id: true, name: true, code: true } },
        },
      }),
      this.prisma.batchStatusLog.create({
        data: {
          batchId: id,
          fromStatus: batch.status,
          toStatus: newStatus,
          reason: data?.reason || null,
          changedById: orgUser.id,
        },
      }),
    ])

    // Al completar el batch, completar su entry asociada
    if (newStatus === 'COMPLETED') {
      await this.prisma.entry.update({
        where: { id: batch.entryId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })

      const record = await this.prisma.record.findUniqueOrThrow({
        where: { id: batch.recordId },
      })

      this.eventEmitter.emit(
        EntryCompletedEvent.EVENT_NAME,
        new EntryCompletedEvent(batch.entryId, batch.recordId, record.organizationId, record),
      )
    }

    return updatedBatch
  }

  async update(
    id: string,
    organizationId: string,
    data: { producedQuantity?: number; unit?: string },
  ) {
    const batch = await this.findById(id, organizationId)

    return this.prisma.batch.update({
      where: { id },
      data: {
        producedQuantity: data.producedQuantity,
        unit: data.unit,
      },
      include: {
        record: { select: { id: true, name: true } },
        recipe: { select: { id: true, name: true, code: true } },
      },
    })
  }

  /**
   * El registro STOCK de la organizacion con sus campos resueltos por label.
   *
   * El stock no es una tabla propia: es un Record de tipo STOCK cuyas entries
   * son los movimientos, asi que para escribir un egreso hay que encontrar los
   * ids de los fields por su etiqueta. Lo usan `consumeStock` y `complete`.
   */
  private async resolverRegistroDeStock(organizationId: string) {
    const stockRecord = await this.prisma.record.findFirst({
      where: { organizationId, type: 'STOCK', status: 'ACTIVE', isActive: true },
      include: { fields: { where: { isActive: true } } },
    })
    if (!stockRecord) {
      throw new BadRequestException('No hay un registro de tipo Stock activo. Crea y aprueba uno primero.')
    }

    return {
      stockRecord,
      lotField:
        stockRecord.fields.find((f) => f.label.toUpperCase() === 'LOTE') ||
        stockRecord.fields.find((f) => f.isIdentifier),
      productField: stockRecord.fields.find((f) => f.label.toUpperCase() === 'PRODUCTO'),
      tipoField: stockRecord.fields.find((f) => f.label.toUpperCase() === 'TIPO MOVIMIENTO'),
      cantidadField: stockRecord.fields.find((f) => f.label.toUpperCase() === 'CANTIDAD'),
    }
  }

  /**
   * Saldo por lote de un producto. Misma cuenta que `StockService.getAvailableLots`,
   * resuelta aca para no acoplar BatchesModule a StockModule por una sola suma.
   *
   * Los movimientos guardan el producto y el lote en MAYUSCULAS, asi que la
   * busqueda tambien.
   */
  private async saldosPorLote(organizationId: string, product: string) {
    const movimientos = await this.prisma.stockMovement.findMany({
      where: { organizationId, product: product.toUpperCase() },
    })

    const porLote = new Map<string, { lotNumber: string; balance: number; unit: string | null }>()
    for (const mov of movimientos) {
      if (!porLote.has(mov.lotNumber)) {
        porLote.set(mov.lotNumber, { lotNumber: mov.lotNumber, balance: 0, unit: mov.unit })
      }
      const lote = porLote.get(mov.lotNumber)!
      lote.balance += mov.movementType === 'INGRESO' ? mov.quantity : -mov.quantity
    }

    return Array.from(porLote.values()).filter((l) => l.balance > 0)
  }

  /**
   * Escribe los egresos de stock dentro de una transaccion ya abierta: una
   * entry COMPLETED en el registro STOCK y su StockMovement por cada consumo.
   *
   * Recibe la `tx` en vez de abrir la suya para que el consumo y el cambio de
   * estado del lote sean atomicos. Un egreso registrado con el lote que no
   * avanzo de estado es stock que desaparecio sin explicacion, y el inventario
   * es parte del paper trail.
   */
  private async escribirEgresos(
    tx: Prisma.TransactionClient,
    organizationId: string,
    creadoPorId: string,
    stock: Awaited<ReturnType<BatchesService['resolverRegistroDeStock']>>,
    consumos: Array<{ product: string; lotNumber: string; quantity: number }>,
  ) {
    const { stockRecord, lotField, productField, tipoField, cantidadField } = stock

    for (const c of consumos) {
      const entryData: Record<string, unknown> = {}
      if (lotField) entryData[lotField.id] = c.lotNumber.toUpperCase()
      if (productField) entryData[productField.id] = c.product.toUpperCase()
      if (tipoField) entryData[tipoField.id] = 'EGRESO'
      if (cantidadField) entryData[cantidadField.id] = c.quantity

      const entry = await tx.entry.create({
        data: {
          recordId: stockRecord.id,
          createdById: creadoPorId,
          recordVersion: stockRecord.version,
          data: entryData as Prisma.InputJsonValue,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })

      await tx.stockMovement.create({
        data: {
          organizationId,
          entryId: entry.id,
          recordId: stockRecord.id,
          product: c.product.toUpperCase(),
          lotNumber: c.lotNumber.toUpperCase(),
          movementType: 'EGRESO',
          quantity: c.quantity,
        },
      })
    }
  }

  private async resolverOrgUser(changedByUserId: string, organizationId: string) {
    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { userId: changedByUserId, organizationId },
    })
    if (!orgUser) throw new NotFoundException('Usuario no encontrado')
    return orgUser
  }

  /**
   * Disponibilidad de stock para los ingredientes de la formula del lote.
   *
   * Solo mira los ingredientes marcados `fromStock`: los demas no salen del
   * inventario. Una formula sin ninguno devuelve la lista vacia, que la UI lee
   * como "se puede iniciar sin restricciones".
   *
   * El producto se deriva del nombre del ingrediente en MAYUSCULAS, que es la
   * misma regla que usa el formulario al armar los consumos. No hay un vinculo
   * duro entre `RecipeIngredient` y el producto de stock: si alguna vez lo hay,
   * este es el lugar donde cambiarlo.
   */
  async checkStock(id: string, organizationId: string) {
    const batch = await this.findById(id, organizationId)

    const deStock = (batch.recipe?.ingredients ?? []).filter((i) => i.fromStock)

    const ingredients = await Promise.all(
      deStock.map(async (ing) => {
        const lots = await this.saldosPorLote(organizationId, ing.name)
        const totalBalance = lots.reduce((suma, l) => suma + l.balance, 0)
        return {
          ingredientName: ing.name,
          product: ing.name.toUpperCase(),
          recipeQuantity: ing.quantity,
          unit: ing.unit,
          totalBalance,
          lots,
          sufficient: totalBalance >= ing.quantity,
        }
      }),
    )

    return {
      allSufficient: ingredients.every((i) => i.sufficient),
      ingredients,
    }
  }

  /**
   * Arranca la produccion sin tocar el inventario.
   *
   * El consumo se registra al completar, contra los lotes que el operador
   * elige de verdad: cual se uso no se sabe hasta que se uso. `consumeStock`
   * cubre el camino inverso —descontar al iniciar— y sigue disponible.
   */
  async start(id: string, organizationId: string, changedByUserId: string) {
    const batch = await this.findById(id, organizationId)

    if (batch.status !== 'PLANNED') {
      throw new BadRequestException('Solo se puede iniciar un lote en estado Planificado')
    }

    return this.changeStatus(id, organizationId, changedByUserId, 'IN_PROGRESS', {
      reason: 'Inicio de produccion',
    })
  }

  /**
   * Cierra la produccion: registra los egresos de stock, guarda la cantidad
   * producida y pasa el lote a COMPLETED.
   *
   * Todo va en una sola transaccion. Si el egreso quedara escrito y el cambio
   * de estado no, el inventario mostraria material consumido por un lote que
   * sigue en curso, y eso no se reconstruye despues.
   *
   * A diferencia de `consumeStock`, aca si se valida que el lote elegido tenga
   * saldo: completar es el punto donde el numero se vuelve definitivo, y un
   * saldo negativo no es un estado que el inventario pueda representar.
   */
  async complete(
    id: string,
    organizationId: string,
    changedByUserId: string,
    data: {
      producedQuantity: number
      unit: string
      consumptions: Array<{ product: string; lotNumber: string; quantity: number; unit: string }>
    },
  ) {
    const batch = await this.findById(id, organizationId)

    if (batch.status !== 'IN_PROGRESS') {
      throw new BadRequestException('Solo se puede completar un lote en produccion')
    }

    const orgUser = await this.resolverOrgUser(changedByUserId, organizationId)

    // Validar saldos antes de escribir nada.
    for (const c of data.consumptions) {
      const lotes = await this.saldosPorLote(organizationId, c.product)
      const lote = lotes.find((l) => l.lotNumber === c.lotNumber.toUpperCase())
      if (!lote) {
        throw new BadRequestException(
          `El lote ${c.lotNumber} de ${c.product} no tiene saldo disponible`,
        )
      }
      if (lote.balance < c.quantity) {
        throw new BadRequestException(
          `El lote ${c.lotNumber} de ${c.product} tiene ${lote.balance} y se quieren consumir ${c.quantity}`,
        )
      }

    }

    const stock = data.consumptions.length > 0
      ? await this.resolverRegistroDeStock(organizationId)
      : null

    await this.prisma.$transaction(async (tx) => {
      if (stock) {
        await this.escribirEgresos(tx, organizationId, orgUser.id, stock, data.consumptions)
      }

      await tx.batch.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          producedQuantity: data.producedQuantity,
          unit: data.unit,
        },
      })

      await tx.batchStatusLog.create({
        data: {
          batchId: id,
          fromStatus: 'IN_PROGRESS',
          toStatus: 'COMPLETED',
          reason:
            data.consumptions.length > 0
              ? `Cierre de produccion con egreso de ${data.consumptions.length} ingrediente(s)`
              : 'Cierre de produccion',
          changedById: orgUser.id,
        },
      })

      // Misma regla que changeStatus: completar el lote completa su entry.
      await tx.entry.update({
        where: { id: batch.entryId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })
    })

    // Fuera de la transaccion: los listeners no deben poder abortarla.
    const record = await this.prisma.record.findUniqueOrThrow({ where: { id: batch.recordId } })
    this.eventEmitter.emit(
      EntryCompletedEvent.EVENT_NAME,
      new EntryCompletedEvent(batch.entryId, batch.recordId, record.organizationId, record),
    )

    return this.findById(id, organizationId)
  }

  async consumeStock(
    id: string,
    organizationId: string,
    changedByUserId: string,
    consumptions: Array<{ ingredientName: string; product: string; lotNumber: string; quantity: number; unit: string }>,
  ) {
    const batch = await this.findById(id, organizationId)

    if (batch.status !== 'PLANNED') {
      throw new BadRequestException('Solo se puede consumir stock de un lote en estado Planificado')
    }

    const stock = await this.resolverRegistroDeStock(organizationId)
    const orgUser = await this.resolverOrgUser(changedByUserId, organizationId)

    await this.prisma.$transaction(async (tx) => {
      await this.escribirEgresos(tx, organizationId, orgUser.id, stock, consumptions)

      // Transicionar batch a IN_PROGRESS
      await tx.batch.update({
        where: { id },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      })

      await tx.batchStatusLog.create({
        data: {
          batchId: id,
          fromStatus: 'PLANNED',
          toStatus: 'IN_PROGRESS',
          reason: `Consumo de ${consumptions.length} ingrediente(s) del stock`,
          changedById: orgUser.id,
        },
      })
    })

    return this.findById(id, organizationId)
  }
}
