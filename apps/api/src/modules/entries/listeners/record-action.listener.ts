import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../../prisma/prisma.service'
import {
  EntryCreatedEvent,
  EntryFieldValueChangedEvent,
} from '../../../common/events/domain-events'
import { Prisma } from '@prisma/client'
import type { ActionCondition } from '@synapse/types'

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

  /**
   * Handler de FIELD_VALUE_CHANGED. Dispara RecordActions configuradas con
   * `trigger = FIELD_VALUE_CHANGED` cuando un field específico de una entry
   * source cambia de valor (típicamente: el DROPDOWN de status pasa a otro
   * estado y eso debe cascadear una entry en otro Record).
   *
   * El matching se hace contra `RecordAction.condition` con forma:
   *   { type: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN', field, value }
   * donde `field` puede ser "fieldId" (matchea el id del field que cambió) o
   * "toValue" (matchea el valor nuevo).
   *
   * Anti-loop: si el evento viene de una cascada (`triggeredByCascade=true`)
   * y la action no declara `allowCascade`, se omite.
   */
  @OnEvent(EntryFieldValueChangedEvent.EVENT_NAME)
  async handleFieldValueChanged(event: EntryFieldValueChangedEvent) {
    try {
      const actions = await this.prisma.recordAction.findMany({
        where: {
          sourceRecordId: event.recordId,
          trigger: 'FIELD_VALUE_CHANGED',
        },
        include: {
          targetRecord: {
            include: { fields: { where: { isActive: true } } },
          },
        },
      })

      for (const action of actions) {
        // Anti-loop: omitir cascadas si la action no las permite explícitamente.
        if (event.triggeredByCascade && !action.allowCascade) continue

        // Filtrar por condition.
        if (!this.matchesCondition(action.condition, event)) continue

        await this.executeFieldValueChangedAction(action, event)
      }
    } catch (err) {
      this.logger.error(
        `Error en handleFieldValueChanged para evento ${JSON.stringify({
          entryId: event.entryId,
          recordId: event.recordId,
          fieldId: event.fieldId,
          toValue: event.toValue,
        })}`,
        err,
      )
      // No re-throwear: el update original ya commiteó.
    }
  }

  /**
   * Evalúa una `condition` (JSON guardada en RecordAction.condition) contra
   * el payload del evento. Si condition es null/undefined, siempre matchea.
   */
  private matchesCondition(
    condition: unknown,
    event: EntryFieldValueChangedEvent,
  ): boolean {
    if (!condition) return true
    const cond = condition as ActionCondition
    if (!cond.type || !cond.field) return true

    // Resolver el lado izquierdo según el path del field en el payload.
    let actual: unknown
    switch (cond.field) {
      case 'fieldId':
        actual = event.fieldId
        break
      case 'toValue':
        actual = event.toValue
        break
      case 'fromValue':
        actual = event.fromValue
        break
      default:
        // Path no soportado: no matcheamos para evitar disparar acciones
        // por error con configs malformadas.
        return false
    }

    const expected = cond.value

    switch (cond.type) {
      case 'EQUALS':
        return String(actual) === String(expected)
      case 'NOT_EQUALS':
        return String(actual) !== String(expected)
      case 'IN':
        return Array.isArray(expected) && expected.map(String).includes(String(actual))
      case 'NOT_IN':
        return Array.isArray(expected) && !expected.map(String).includes(String(actual))
      default:
        return false
    }
  }

  /**
   * Ejecuta una RecordAction disparada por FIELD_VALUE_CHANGED: crea una
   * Entry en el target Record con field mapping aplicado desde la entry
   * source. Versión simplificada (sin companion creation) — los side-effects
   * de Batch/Sample/Stock se mantienen en handleEntryCreated por ahora.
   */
  private async executeFieldValueChangedAction(
    action: {
      id: string
      targetRecordId: string
      fieldMapping: unknown
      targetRecord: {
        type: string
        version: number
        periodicity: number | null
        fields: Array<{ id: string; isActive: boolean }>
      }
    },
    event: EntryFieldValueChangedEvent,
  ) {
    // Cargar la entry source para tener su data completa (necesaria para el
    // field mapping).
    const sourceEntry = await this.prisma.entry.findUnique({
      where: { id: event.entryId },
      select: { data: true, createdById: true },
    })
    if (!sourceEntry) return

    const sourceData = sourceEntry.data as Record<string, unknown>
    const mapping = action.fieldMapping as Array<{
      sourceFieldId: string
      targetFieldId: string
    }>
    const targetData: Record<string, unknown> = {}
    for (const map of mapping ?? []) {
      if (sourceData[map.sourceFieldId] !== undefined) {
        targetData[map.targetFieldId] = sourceData[map.sourceFieldId]
      }
    }

    let targetDueDate: Date | null = null
    if (action.targetRecord.type === 'PERIODIC' && action.targetRecord.periodicity) {
      targetDueDate = new Date()
      targetDueDate.setDate(targetDueDate.getDate() + action.targetRecord.periodicity)
    }

    await this.prisma.entry.create({
      data: {
        recordId: action.targetRecordId,
        createdById: event.changedById,
        recordVersion: action.targetRecord.version,
        data: targetData as Prisma.InputJsonValue,
        dueDate: targetDueDate,
        triggeredById: event.entryId,
        status: 'DRAFT',
      },
    })

    this.logger.log(
      `RecordAction ${action.id} disparada por FIELD_VALUE_CHANGED (field=${event.fieldId}, toValue=${String(event.toValue)})`,
    )
  }
}
