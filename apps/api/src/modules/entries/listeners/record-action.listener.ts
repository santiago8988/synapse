import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../../prisma/prisma.service'
import {
  EntryCreatedEvent,
  EntryFieldValueChangedEvent,
} from '../../../common/events/domain-events'
import { Prisma } from '@prisma/client'
import type { ActionCondition, ActionConditionPrimitive } from '@synapse/types'

/**
 * Escucha EntryCreatedEvent y dispara la creación automática
 * de entries en records target según los RecordActions configurados.
 * Si el source es INSTRUMENTAL, valida que el instrumento esté ACTIVE.
 * Crea companion entities (Batch/Sample) cuando el target lo requiere.
 */
@Injectable()
export class RecordActionListener {
  private readonly logger = new Logger(RecordActionListener.name)

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

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

        // Filtrar por condition (recursiva).
        if (!this.matchesCondition(action.condition, event)) continue

        // Dispatch por actionType — default CREATE_ENTRY mantiene back-compat.
        await this.dispatchAction(action, event)
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
   * el payload del evento. Soporta:
   *  - Primitivas: { type: 'EQUALS' | 'NOT_EQUALS' | 'IN' | 'NOT_IN', field, value }
   *  - Composite: { type: 'AND' | 'OR', conditions: ActionCondition[] } (recursivo)
   * Si condition es null/undefined, siempre matchea.
   */
  private matchesCondition(
    condition: unknown,
    event: EntryFieldValueChangedEvent,
  ): boolean {
    if (!condition) return true
    return this.evalCondition(condition as ActionCondition, event)
  }

  private evalCondition(
    cond: ActionCondition,
    event: EntryFieldValueChangedEvent,
  ): boolean {
    if (cond.type === 'AND') {
      return cond.conditions.every((c) => this.evalCondition(c, event))
    }
    if (cond.type === 'OR') {
      return cond.conditions.some((c) => this.evalCondition(c, event))
    }
    // Tras los checks AND/OR, el resto necesariamente matchea ActionConditionPrimitive
    // (EQUALS / NOT_EQUALS / IN / NOT_IN). TS no estrecha el union por nombres de
    // propiedad — cast explícito.
    return this.evalPrimitive(cond as ActionConditionPrimitive, event)
  }

  private evalPrimitive(
    cond: ActionConditionPrimitive,
    event: EntryFieldValueChangedEvent,
  ): boolean {
    if (!cond.type || !cond.field) return false

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
        // Path no soportado: no matcheamos para evitar disparar acciones por
        // error con configs malformadas (fail-closed).
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
      case 'LT':
        return Number(actual) < Number(expected)
      case 'LTE':
        return Number(actual) <= Number(expected)
      case 'GT':
        return Number(actual) > Number(expected)
      case 'GTE':
        return Number(actual) >= Number(expected)
      case 'BETWEEN':
        return (
          Array.isArray(expected) &&
          expected.length === 2 &&
          Number(actual) >= Number(expected[0]) &&
          Number(actual) <= Number(expected[1])
        )
      default:
        return false
    }
  }

  /**
   * Resuelve un `sourceFieldId` del fieldMapping a su valor actual. Soporta:
   *   - `$entry.id` → id de la entry que disparó el evento.
   *   - `$entry.<fieldId>` → valor de un field específico de la entry padre.
   *   - `$event.toValue` / `$event.fromValue` / `$event.fieldId` → del evento FIELD_VALUE_CHANGED.
   *   - `<fieldId>` (default) → valor del field en la entry padre. Caso histórico.
   */
  private resolveSource(
    sourceFieldId: string,
    event: EntryFieldValueChangedEvent,
    sourceData: Record<string, unknown>,
  ): unknown {
    if (sourceFieldId === '$entry.id') return event.entryId
    if (sourceFieldId.startsWith('$entry.')) {
      return sourceData[sourceFieldId.slice('$entry.'.length)]
    }
    if (sourceFieldId === '$event.toValue') return event.toValue
    if (sourceFieldId === '$event.fromValue') return event.fromValue
    if (sourceFieldId === '$event.fieldId') return event.fieldId
    return sourceData[sourceFieldId]
  }

  /**
   * Dispatcher por `actionType`. Cada caso lee `actionConfig` (Json en DB) con
   * la shape correspondiente y llama el handler. Default CREATE_ENTRY usa las
   * columnas dedicadas (targetRecordId + fieldMapping) para back-compat.
   */
  private async dispatchAction(
    action: ActionWithTarget,
    event: EntryFieldValueChangedEvent,
  ) {
    switch (action.actionType) {
      case 'CREATE_ENTRY':
        await this.executeCreateEntry(action, event)
        break
      case 'UPDATE_FIELD':
        await this.executeUpdateField(action, event)
        break
      case 'NOTIFY':
        await this.executeNotify(action, event)
        break
      case 'EMAIL':
        await this.executeEmail(action, event)
        break
      case 'WEBHOOK':
        await this.executeWebhook(action, event)
        break
      default:
        this.logger.warn(
          `RecordAction ${action.id}: actionType desconocido "${String(action.actionType)}", omitida`,
        )
    }
  }

  /**
   * CREATE_ENTRY (default) — comportamiento histórico: crea una Entry en el
   * target Record con field mapping aplicado desde la entry source.
   * No crea companion entities (las cascadas vía FIELD_VALUE_CHANGED apuntan
   * al modelo Records-as-Lists; las companion las maneja handleEntryCreated).
   */
  private async executeCreateEntry(
    action: ActionWithTarget,
    event: EntryFieldValueChangedEvent,
  ) {
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
      const value = this.resolveSource(map.sourceFieldId, event, sourceData)
      if (value !== undefined) {
        targetData[map.targetFieldId] = value
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
      `RecordAction ${action.id} (CREATE_ENTRY) disparada por FIELD_VALUE_CHANGED (field=${event.fieldId}, toValue=${String(event.toValue)})`,
    )
  }

  /**
   * UPDATE_FIELD — patcha un field de una entry. Funcional desde VFE.6.
   *
   * Shape del actionConfig:
   *   {
   *     entryIdSource: '$entry.id' | '<fieldId-relacionada>',
   *     fieldId: string,
   *     value: string | number | boolean | null,
   *   }
   *
   * - `$entry.id` → patchea la entry que disparó el evento (caso típico
   *   "cuando NC se cierra, marcar el field REVISADA del mismo Record").
   * - `<fieldId-relacionada>` → resuelve el id desde sourceData[fieldId]
   *   (cuando el flow apunta a una entry distinta vía un RELATED_ENTRY).
   *
   * Emite `EntryFieldValueChangedEvent` con `triggeredByCascade: true` para
   * que listeners downstream puedan respetar el anti-loop.
   */
  private async executeUpdateField(
    action: ActionWithTarget,
    event: EntryFieldValueChangedEvent,
  ) {
    const cfg = action.actionConfig as
      | {
          entryIdSource?: string
          fieldId?: string
          value?: string | number | boolean | null
        }
      | null
    if (!cfg || !cfg.entryIdSource || !cfg.fieldId) {
      this.logger.warn(
        `RecordAction ${action.id} (UPDATE_FIELD) — actionConfig incompleta, omitida`,
      )
      return
    }

    // Resolver entryId destino. Necesitamos sourceData solo si hay que
    // resolver un fieldId distinto a $entry.id.
    let targetEntryId: string
    if (cfg.entryIdSource === '$entry.id') {
      targetEntryId = event.entryId
    } else {
      const sourceEntry = await this.prisma.entry.findUnique({
        where: { id: event.entryId },
        select: { data: true },
      })
      if (!sourceEntry) return
      const sourceData = (sourceEntry.data ?? {}) as Record<string, unknown>
      const candidate = sourceData[cfg.entryIdSource]
      if (typeof candidate !== 'string' || !candidate) {
        this.logger.warn(
          `RecordAction ${action.id} (UPDATE_FIELD) — no se pudo resolver entryIdSource "${cfg.entryIdSource}"`,
        )
        return
      }
      targetEntryId = candidate
    }

    const targetEntry = await this.prisma.entry.findUnique({
      where: { id: targetEntryId },
      select: { data: true, recordId: true, record: { select: { organizationId: true } } },
    })
    if (!targetEntry) {
      this.logger.warn(
        `RecordAction ${action.id} (UPDATE_FIELD) — entry destino ${targetEntryId} no existe`,
      )
      return
    }

    const currentData = (targetEntry.data ?? {}) as Record<string, unknown>
    const oldValue = currentData[cfg.fieldId]
    const newValue = cfg.value ?? null

    // No-op: si el valor no cambia, no escribimos ni emitimos.
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
      this.logger.debug(
        `RecordAction ${action.id} (UPDATE_FIELD) — no-op (mismo valor) en entry ${targetEntryId} field ${cfg.fieldId}`,
      )
      return
    }

    const newData = { ...currentData, [cfg.fieldId]: newValue }
    await this.prisma.entry.update({
      where: { id: targetEntryId },
      data: { data: newData as Prisma.InputJsonValue },
    })

    // Emitir evento con triggeredByCascade=true → anti-loop. Las RecordAction
    // sin allowCascade=true van a ignorar este evento.
    this.eventEmitter.emit(
      EntryFieldValueChangedEvent.EVENT_NAME,
      new EntryFieldValueChangedEvent(
        targetEntryId,
        targetEntry.recordId,
        targetEntry.record.organizationId,
        cfg.fieldId,
        oldValue,
        newValue,
        event.changedById,
        true, // triggeredByCascade
        `Cascada de RecordAction ${action.id}`,
      ),
    )

    this.logger.log(
      `RecordAction ${action.id} (UPDATE_FIELD) entry=${targetEntryId} field=${cfg.fieldId} → ${JSON.stringify(newValue)}`,
    )
  }

  /**
   * NOTIFY — envía notificación al destinatario derivado. STUB: requiere
   * BullMQ + worker de notificaciones (módulo notifications no implementado
   * todavía).
   */
  private async executeNotify(
    action: ActionWithTarget,
    event: EntryFieldValueChangedEvent,
  ) {
    this.logger.log(
      `RecordAction ${action.id} (NOTIFY) — STUB: actionConfig=${JSON.stringify(action.actionConfig)}, event=${event.entryId}`,
    )
  }

  /**
   * EMAIL — envía email. STUB: requiere transport (Resend/nodemailer) +
   * BullMQ queue.
   */
  private async executeEmail(
    action: ActionWithTarget,
    event: EntryFieldValueChangedEvent,
  ) {
    this.logger.log(
      `RecordAction ${action.id} (EMAIL) — STUB: actionConfig=${JSON.stringify(action.actionConfig)}, event=${event.entryId}`,
    )
  }

  /**
   * WEBHOOK — POST/PATCH a URL externa. STUB: implementación real requiere
   * retry + circuit breaker + log de respuestas para auditoría.
   */
  private async executeWebhook(
    action: ActionWithTarget,
    event: EntryFieldValueChangedEvent,
  ) {
    this.logger.log(
      `RecordAction ${action.id} (WEBHOOK) — STUB: actionConfig=${JSON.stringify(action.actionConfig)}, event=${event.entryId}`,
    )
  }
}

type ActionWithTarget = {
  id: string
  actionType: string
  actionConfig: unknown
  targetRecordId: string
  fieldMapping: unknown
  targetRecord: {
    type: string
    version: number
    periodicity: number | null
    fields: Array<{ id: string; isActive: boolean }>
  }
}
