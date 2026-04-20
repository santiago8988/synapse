import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../../prisma/prisma.service'
import { EntryCreatedEvent } from '../../../common/events/domain-events'
import { Prisma } from '@prisma/client'

/**
 * Escucha EntryCreatedEvent y dispara la creación automática
 * de entries en records target según los RecordActions configurados.
 * Si el source es INSTRUMENTAL, valida que el instrumento esté ACTIVE.
 * Crea companion entities (Batch/Sample) cuando el target lo requiere.
 */
@Injectable()
export class RecordActionListener {
  private readonly logger = new Logger(RecordActionListener.name)

  constructor(private prisma: PrismaService) {}

  @OnEvent(EntryCreatedEvent.EVENT_NAME)
  async handleEntryCreated(event: EntryCreatedEvent) {
    // Si el record source es INSTRUMENTAL, verificar estado del instrumento
    const sourceRecord = await this.prisma.record.findUnique({
      where: { id: event.recordId },
      select: { type: true },
    })

    if (sourceRecord?.type === 'INSTRUMENTAL') {
      const instrument = await this.prisma.instrument.findUnique({
        where: { entryId: event.entryId },
        select: { status: true },
      })
      if (instrument && instrument.status !== 'ACTIVE') {
        this.logger.warn(
          `RecordAction omitida: instrumento ${event.entryId} no está activo (${instrument.status})`,
        )
        return
      }
    }

    for (const action of event.record.actionsAsSource) {
      const mapping = action.fieldMapping as Array<{
        sourceFieldId: string
        targetFieldId: string
      }>
      const targetData: Record<string, unknown> = {}

      for (const map of mapping) {
        if (event.data[map.sourceFieldId] !== undefined) {
          targetData[map.targetFieldId] = event.data[map.sourceFieldId]
        }
      }

      // Calcular dueDate del target si es periódico
      let targetDueDate: Date | null = null
      if (
        action.targetRecord.type === 'PERIODIC' &&
        action.targetRecord.periodicity
      ) {
        targetDueDate = new Date()
        targetDueDate.setDate(
          targetDueDate.getDate() + action.targetRecord.periodicity,
        )
      }

      const targetType = action.targetRecord.type
      const autoComplete =
        targetType === 'INSTRUMENTAL' ||
        targetType === 'NOT_PERIODIC' ||
        targetType === 'NOT_PERIODIC_WITH_REVISION' ||
        targetType === 'STOCK'

      const newEntry = await this.prisma.entry.create({
        data: {
          recordId: action.targetRecordId,
          createdById: event.createdById,
          recordVersion: action.targetRecord.version,
          data: targetData as Prisma.InputJsonValue,
          dueDate: targetDueDate,
          triggeredById: event.entryId,
          status: autoComplete ? 'COMPLETED' : 'DRAFT',
          completedAt: autoComplete ? new Date() : null,
        },
      })

      // Crear companion entities para BATCH y SAMPLE
      const identifierField = action.targetRecord.fields.find(
        (f) => f.isIdentifier && f.isActive,
      )

      if (targetType === 'BATCH') {
        const lotNumber = identifierField
          ? String(targetData[identifierField.id] || '')
          : ''
        if (lotNumber) {
          // Extraer recipeId del campo RECIPE_SELECT mapeado
          const recipeSelectField = action.targetRecord.fields.find(
            (f) => f.fieldType === 'RECIPE_SELECT' && f.isActive,
          )
          const recipeId = recipeSelectField && targetData[recipeSelectField.id]
            ? String(targetData[recipeSelectField.id])
            : null

          await this.prisma.batch.create({
            data: {
              organizationId: event.organizationId,
              entryId: newEntry.id,
              recordId: action.targetRecordId,
              recipeId,
              lotNumber,
            },
          })
          this.logger.log(`Batch companion creado para entry ${newEntry.id}`)
        }
      }

      if (targetType === 'SAMPLE') {
        const sampleCode = identifierField
          ? String(targetData[identifierField.id] || '')
          : ''
        if (sampleCode) {
          // Extraer matrixId y methodIds del campo MATRIX_METHOD mapeado
          const matrixMethodField = action.targetRecord.fields.find(
            (f) => f.fieldType === 'MATRIX_METHOD' && f.isActive,
          )
          let matrixId: string | null = null
          let methodIds: string[] = []
          if (matrixMethodField && targetData[matrixMethodField.id]) {
            const mmValue = targetData[matrixMethodField.id] as {
              matrixId?: string
              methodIds?: string[]
            }
            matrixId = mmValue.matrixId || null
            methodIds = mmValue.methodIds || []
          }

          await this.prisma.sample.create({
            data: {
              organizationId: event.organizationId,
              entryId: newEntry.id,
              recordId: action.targetRecordId,
              sampleCode,
              matrixId,
              methodIds,
            },
          })
          this.logger.log(`Sample companion creado para entry ${newEntry.id}`)
        }
      }

      if (targetType === 'STOCK') {
        const lotField = action.targetRecord.fields.find((f) => f.label.toUpperCase() === 'LOTE' && f.isActive) || identifierField
        const productField = action.targetRecord.fields.find((f) => f.label.toUpperCase() === 'PRODUCTO' && f.isActive)
        const tipoField = action.targetRecord.fields.find((f) => f.label.toUpperCase() === 'TIPO MOVIMIENTO' && f.isActive)
        const cantidadField = action.targetRecord.fields.find((f) => f.label.toUpperCase() === 'CANTIDAD' && f.isActive)

        const lotNumber = lotField ? String(targetData[lotField.id] || '') : ''
        const product = productField ? String(targetData[productField.id] || '') : ''
        const movementType = tipoField ? String(targetData[tipoField.id] || 'INGRESO') : 'INGRESO'

        let quantity = 0
        let unit: string | null = null
        if (cantidadField && targetData[cantidadField.id]) {
          const qtyVal = targetData[cantidadField.id]
          if (typeof qtyVal === 'object' && qtyVal !== null) {
            quantity = Number((qtyVal as { value?: number }).value || 0)
            unit = ((qtyVal as { unit?: string }).unit) || null
          } else {
            quantity = Number(qtyVal || 0)
          }
        }

        if (lotNumber && product && quantity > 0) {
          await this.prisma.stockMovement.create({
            data: {
              organizationId: event.organizationId,
              entryId: newEntry.id,
              recordId: action.targetRecordId,
              product: product.toUpperCase(),
              lotNumber: lotNumber.toUpperCase(),
              movementType: movementType.toUpperCase(),
              quantity,
              unit,
            },
          })
          this.logger.log(`StockMovement companion creado para entry ${newEntry.id}`)
        }
      }

    }
  }
}
