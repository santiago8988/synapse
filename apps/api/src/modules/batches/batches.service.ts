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

    // Buscar un registro STOCK activo de la org
    const stockRecord = await this.prisma.record.findFirst({
      where: { organizationId, type: 'STOCK', status: 'ACTIVE', isActive: true },
      include: { fields: { where: { isActive: true } } },
    })
    if (!stockRecord) {
      throw new BadRequestException('No hay un registro de tipo Stock activo. Crea y aprueba uno primero.')
    }

    // Encontrar los field IDs del registro stock por label
    const lotField = stockRecord.fields.find((f) => f.label.toUpperCase() === 'LOTE') || stockRecord.fields.find((f) => f.isIdentifier)
    const productField = stockRecord.fields.find((f) => f.label.toUpperCase() === 'PRODUCTO')
    const tipoField = stockRecord.fields.find((f) => f.label.toUpperCase() === 'TIPO MOVIMIENTO')
    const cantidadField = stockRecord.fields.find((f) => f.label.toUpperCase() === 'CANTIDAD')

    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { userId: changedByUserId, organizationId },
    })
    if (!orgUser) throw new NotFoundException('Usuario no encontrado')

    // Crear entries de egreso en el registro STOCK
    await this.prisma.$transaction(async (tx) => {
      for (const c of consumptions) {
        const entryData: Record<string, unknown> = {}
        if (lotField) entryData[lotField.id] = c.lotNumber.toUpperCase()
        if (productField) entryData[productField.id] = c.product.toUpperCase()
        if (tipoField) entryData[tipoField.id] = 'EGRESO'
        if (cantidadField) entryData[cantidadField.id] = c.quantity

        const entry = await tx.entry.create({
          data: {
            recordId: stockRecord.id,
            createdById: orgUser.id,
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
