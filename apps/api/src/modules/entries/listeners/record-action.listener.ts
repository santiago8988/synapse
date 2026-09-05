import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../../prisma/prisma.service'
import {
  findConfigWarnings,
  sanitizeFieldMapping,
  type TargetFieldRef,
} from '../../../common/flows/flow-config'
import {
  matchesCondition,
  resolveSource,
  type CompanionsBag,
} from '../../../common/flows/flow-evaluation'
import {
  sanitizeWebhookHeaders,
  validateWebhookUrl,
} from '../../../common/flows/webhook-target'
import {
  parseRecipients,
  renderMessage,
} from '../../../common/flows/notify-recipients'
import {
  EntryCreatedEvent,
  EntryFieldValueChangedEvent,
} from '../../../common/events/domain-events'
import { Prisma } from '@prisma/client'

/**
 * Escucha EntryCreatedEvent y dispara la creación automática
 * de entries en records target según los RecordActions configurados.
 * Si el source es INSTRUMENTAL, valida que el instrumento esté ACTIVE.
 * Crea companion entities (Batch/Sample) cuando el target lo requiere.
 */
/** Un destino que no responde no puede dejar el listener colgado. */
const WEBHOOK_TIMEOUT_MS = 10_000

/**
 * Cuantos saltos encadenados se permiten antes de cortar.
 *
 * `allowCascade` evita el caso comun, pero es opt-in: dos flujos que se apuntan
 * y ambos con la casilla marcada se realimentan sin fin, creando entradas hasta
 * llenar la base. El tope es la red que atrapa eso.
 */
const MAX_CASCADE_DEPTH = 5

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

    if (event.cascadeDepth >= MAX_CASCADE_DEPTH) {
      this.logger.warn(
        `Cascada cortada en el salto ${event.cascadeDepth} (entry ${event.entryId}): ` +
          `se alcanzo el maximo de ${MAX_CASCADE_DEPTH}. Revisar si hay flujos que se apuntan entre si.`,
      )
      return
    }

    for (const action of event.record.actionsAsSource) {
      // Anti-loop. handleEntryCreated no tenia ninguna verificacion: hasta
      // ahora daba igual porque las entradas creadas por cascada no emitian
      // evento y la cadena moria en el primer salto. Al hacer que la cadena
      // continue, esta guarda pasa a ser lo que impide el loop.
      if (event.cascadeDepth > 0 && !action.allowCascade) continue

      const mapping = sanitizeFieldMapping(action.fieldMapping)

      // Fail-closed: un flujo a medio configurar no se ejecuta. Antes creaba
      // la entry igual, con datos incompletos o con claves vacias en el JSON.
      const warnings = findConfigWarnings({
        actionType: 'CREATE_ENTRY',
        mapping,
        targetFields: action.targetRecord.fields as TargetFieldRef[],
      })
      if (warnings.length > 0) {
        this.logger.warn(
          `RecordAction ${action.id} omitida: configuracion incompleta. ${warnings.join(' ')}`,
        )
        continue
      }

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

      // La cadena sigue un salto mas. Va despues de los companions para que el
      // proximo eslabon vea el lote o la muestra ya creados.
      await this.emitCascadeCreated(
        newEntry.id,
        action.targetRecordId,
        event.organizationId,
        event.createdById,
        targetData,
        event.cascadeDepth + 1,
      )

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
      if (actions.length === 0) return

      if (event.cascadeDepth >= MAX_CASCADE_DEPTH) {
        this.logger.warn(
          `Cascada cortada en el salto ${event.cascadeDepth} (entry ${event.entryId}): ` +
            `se alcanzo el maximo de ${MAX_CASCADE_DEPTH}.`,
        )
        return
      }

      // Cargamos la entry source UNA vez con sus companions. Lo usan
      // matchesCondition (para evaluar paths $batch.* / $sample.* / $instrument.*
      // / data.<fieldId>) y executeCreateEntry para resolver fieldMapping.
      const sourceEntry = await this.prisma.entry.findUnique({
        where: { id: event.entryId },
        select: {
          data: true,
          createdById: true,
          batch: {
            select: {
              id: true,
              lotNumber: true,
              status: true,
              producedQuantity: true,
              unit: true,
            },
          },
          sample: {
            select: {
              id: true,
              sampleCode: true,
              status: true,
              client: true,
              matrixId: true,
            },
          },
          instrument: {
            select: { id: true, status: true, nextCalibrationAt: true },
          },
        },
      })
      if (!sourceEntry) return

      const sourceData = (sourceEntry.data ?? {}) as Record<string, unknown>
      const companions = {
        batch: sourceEntry.batch as Record<string, unknown> | null,
        sample: sourceEntry.sample as Record<string, unknown> | null,
        instrument: sourceEntry.instrument as Record<string, unknown> | null,
      }

      for (const action of actions) {
        // Anti-loop: omitir cascadas si la action no las permite explícitamente.
        if (event.triggeredByCascade && !action.allowCascade) continue

        // Filtrar por condition (recursiva).
        if (!matchesCondition(action.condition, event, sourceData, companions)) continue

        // Dispatch por actionType — default CREATE_ENTRY mantiene back-compat.
        await this.dispatchAction(action, event, sourceEntry, sourceData, companions)
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
   * Emite `EntryCreatedEvent` por una entry que creo una cascada, para que la
   * cadena pueda continuar un salto mas.
   *
   * Hasta ahora las entradas creadas por cascada no emitian nada, asi que un
   * flujo A -> B -> C solo ejecutaba A -> B y el resto quedaba sin pasar, en
   * silencio. Al emitir, `cascadeDepth` sube y son `allowCascade` y
   * MAX_CASCADE_DEPTH los que deciden hasta donde sigue.
   */
  private async emitCascadeCreated(
    entryId: string,
    recordId: string,
    organizationId: string,
    createdById: string,
    data: Record<string, unknown>,
    cascadeDepth: number,
  ) {
    // Solo se consulta si hay a quien avisarle: la mayoria de los registros
    // destino no tienen flujos propios y esta query seria puro costo.
    const record = await this.prisma.record.findFirst({
      where: { id: recordId, organizationId },
      include: {
        fields: { where: { isActive: true } },
        actionsAsSource: {
          include: {
            targetRecord: { include: { fields: { where: { isActive: true } } } },
          },
        },
      },
    })
    if (!record || record.actionsAsSource.length === 0) return

    this.eventEmitter.emit(
      EntryCreatedEvent.EVENT_NAME,
      new EntryCreatedEvent(
        entryId,
        recordId,
        organizationId,
        createdById,
        data,
        {},
        record,
        cascadeDepth,
      ),
    )
  }

  /**
   * Dispatcher por `actionType`. Cada caso lee `actionConfig` (Json en DB) con
   * la shape correspondiente y llama el handler. Default CREATE_ENTRY usa las
   * columnas dedicadas (targetRecordId + fieldMapping) para back-compat.
   */
  private async dispatchAction(
    action: ActionWithTarget,
    event: EntryFieldValueChangedEvent,
    sourceEntry: { createdById: string },
    sourceData: Record<string, unknown>,
    companions: CompanionsBag,
  ) {
    // Fail-closed, igual que en handleEntryCreated: la misma funcion que la UI
    // usa para marcar el flujo con "!" es la que decide si corre.
    const warnings = findConfigWarnings({
      actionType: action.actionType,
      mapping: sanitizeFieldMapping(action.fieldMapping),
      targetFields: action.targetRecord.fields as TargetFieldRef[],
      actionConfig: action.actionConfig,
    })
    if (warnings.length > 0) {
      this.logger.warn(
        `RecordAction ${action.id} omitida: configuracion incompleta. ${warnings.join(' ')}`,
      )
      return
    }

    switch (action.actionType) {
      case 'CREATE_ENTRY':
        await this.executeCreateEntry(action, event, sourceEntry, sourceData, companions)
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
    _sourceEntry: { createdById: string },
    sourceData: Record<string, unknown>,
    companions: CompanionsBag,
  ) {
    const mapping = sanitizeFieldMapping(action.fieldMapping)
    const targetData: Record<string, unknown> = {}
    for (const map of mapping) {
      const value = resolveSource(map.sourceFieldId, event, sourceData, companions)
      if (value !== undefined) {
        targetData[map.targetFieldId] = value
      }
    }

    let targetDueDate: Date | null = null
    if (action.targetRecord.type === 'PERIODIC' && action.targetRecord.periodicity) {
      targetDueDate = new Date()
      targetDueDate.setDate(targetDueDate.getDate() + action.targetRecord.periodicity)
    }

    const creada = await this.prisma.entry.create({
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

    await this.emitCascadeCreated(
      creada.id,
      action.targetRecordId,
      event.organizationId,
      event.changedById,
      targetData,
      event.cascadeDepth + 1,
    )

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
        event.cascadeDepth + 1,
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
    const config = (action.actionConfig ?? {}) as {
      recipients?: unknown
      message?: unknown
    }

    const destinatarios = parseRecipients(config.recipients)
    if (!destinatarios) {
      this.logger.warn(
        `RecordAction ${action.id} (NOTIFY) sin destinatario valido: ${JSON.stringify(config.recipients)}`,
      )
      return
    }

    const userIds = await this.resolveRecipientUserIds(
      destinatarios,
      event.organizationId,
      event.recordId,
    )
    if (userIds.length === 0) {
      this.logger.warn(
        `RecordAction ${action.id} (NOTIFY) no resolvio ningun destinatario`,
      )
      return
    }

    // El contexto sale del Record y del field para que el aviso diga algo
    // concreto en vez de un texto fijo.
    const record = await this.prisma.record.findFirst({
      where: { id: event.recordId, organizationId: event.organizationId },
      select: {
        name: true,
        fields: { where: { id: event.fieldId }, select: { label: true } },
      },
    })

    const plantilla =
      typeof config.message === 'string' && config.message.trim()
        ? config.message
        : '{campo} cambio a {nuevo} en {registro}'

    const body = renderMessage(plantilla, {
      recordName: record?.name,
      fieldLabel: record?.fields[0]?.label,
      from: event.fromValue,
      to: event.toValue,
    })

    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        organizationId: event.organizationId,
        userId,
        title: record?.name ?? 'Actualizacion de registro',
        body,
        link: `/records/${event.recordId}`,
        recordActionId: action.id,
        entryId: event.entryId,
      })),
    })

    this.logger.log(
      `RecordAction ${action.id} (NOTIFY): ${userIds.length} notificacion(es) creadas`,
    )
  }

  /**
   * Traduce el destinatario configurado a ids de usuario.
   *
   * Toda consulta va acotada a la organizacion: es lo que impide que un
   * `user:<id>` copiado de otro tenant genere una notificacion cruzada.
   */
  private async resolveRecipientUserIds(
    spec: ReturnType<typeof parseRecipients> & object,
    organizationId: string,
    recordId: string,
  ): Promise<string[]> {
    if (spec.kind === 'user') {
      const miembro = await this.prisma.organizationUser.findFirst({
        where: { userId: spec.userId, organizationId, isActive: true },
        select: { userId: true },
      })
      return miembro ? [miembro.userId] : []
    }

    if (spec.kind === 'role') {
      const miembros = await this.prisma.organizationUser.findMany({
        where: { organizationId, isActive: true, role: spec.role as never },
        select: { userId: true },
      })
      return miembros.map((m) => m.userId)
    }

    // area_owner: el lider del area del registro. Un Record puede pertenecer a
    // varias areas, asi que se notifica al lider de cada una, sin repetir.
    const record = await this.prisma.record.findFirst({
      where: { id: recordId, organizationId },
      select: {
        areas: {
          select: { area: { select: { leader: { select: { userId: true } } } } },
        },
      },
    })
    const ids = (record?.areas ?? [])
      .map((ra) => ra.area.leader?.userId)
      .filter((id): id is string => Boolean(id))
    return Array.from(new Set(ids))
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
   * WEBHOOK — avisa a un sistema externo emitiendo un pedido HTTP.
   *
   * `actionConfig`: { url, method?: 'POST' | 'PATCH', headers?: Record<string,string> }
   *
   * La URL la elige un usuario y el pedido lo emite el servidor, asi que pasa
   * por `validateWebhookUrl`, que bloquea las direcciones internas. Sin eso un
   * ADMIN podria leer los metadatos de la instancia o alcanzar servicios que
   * nunca se expusieron.
   *
   * No hay reintentos: si el destino falla, se loguea y se sigue. Reintentar
   * necesita una cola, que hoy no existe (TO_DO.md 11), y hacerlo en el mismo
   * proceso bloquearia el listener.
   */
  private async executeWebhook(
    action: ActionWithTarget,
    event: EntryFieldValueChangedEvent,
  ) {
    const config = (action.actionConfig ?? {}) as {
      url?: string
      method?: string
      headers?: unknown
    }
    if (!config.url) {
      this.logger.warn(`RecordAction ${action.id} (WEBHOOK) sin url configurada`)
      return
    }

    // En desarrollo se permite apuntar a la propia maquina, que es la forma
    // normal de probar un webhook.
    const allowInternal = process.env.NODE_ENV !== 'production'
    const validacion = await validateWebhookUrl(config.url, { allowInternal })
    if (!validacion.ok) {
      this.logger.warn(
        `RecordAction ${action.id} (WEBHOOK) rechazado: ${validacion.reason}`,
      )
      return
    }

    const method = config.method === 'PATCH' ? 'PATCH' : 'POST'
    // El payload es deliberadamente acotado: identifica que paso y donde, sin
    // volcar el contenido de la entry a un tercero.
    const payload = {
      event: 'record_action.triggered',
      actionId: action.id,
      organizationId: event.organizationId,
      recordId: event.recordId,
      entryId: event.entryId,
      field: {
        id: event.fieldId,
        from: event.fromValue,
        to: event.toValue,
      },
      occurredAt: new Date().toISOString(),
    }

    // Sin timeout, un destino que no responde deja el listener colgado.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS)

    try {
      const res = await fetch(validacion.target.url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...sanitizeWebhookHeaders(config.headers),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
        redirect: 'error', // Un redirect podria llevar a una direccion interna.
      })

      if (!res.ok) {
        this.logger.warn(
          `RecordAction ${action.id} (WEBHOOK) a ${validacion.target.url.origin} respondio ${res.status}`,
        )
        return
      }
      this.logger.log(
        `RecordAction ${action.id} (WEBHOOK) a ${validacion.target.url.origin}: ${res.status}`,
      )
    } catch (err) {
      const motivo =
        err instanceof Error && err.name === 'AbortError'
          ? `no respondio en ${WEBHOOK_TIMEOUT_MS} ms`
          : String(err)
      this.logger.warn(
        `RecordAction ${action.id} (WEBHOOK) a ${validacion.target.url.origin} fallo: ${motivo}`,
      )
    } finally {
      clearTimeout(timeout)
    }
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
    fields: Array<{ id: string; label?: string; isActive: boolean; isIdentifier: boolean }>
  }
}

