import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma } from '@prisma/client'
import { ComparisonEvaluatorService } from './services/comparison-evaluator.service'
import { FormulaEvaluatorService } from './services/formula-evaluator.service'
import { TransitionValidatorService } from './services/transition-validator.service'
import { EntryCreatedEvent, EntryCompletedEvent, EntryFieldValueChangedEvent } from '../../common/events/domain-events'
import type { UserRole } from '@synapse/types'

@Injectable()
export class EntriesService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    private comparisonEvaluator: ComparisonEvaluatorService,
    private formulaEvaluator: FormulaEvaluatorService,
    private transitionValidator: TransitionValidatorService,
  ) {}

  async findAll(recordId: string, organizationId: string) {
    const record = await this.prisma.record.findFirst({
      where: { id: recordId, organizationId },
    })
    if (!record) throw new NotFoundException('Registro no encontrado')

    // Records-as-Lists post-collapse: Instrument companion ya no existe — su
    // status y nextCalibrationAt viven en Entry.data del propio entry. Para
    // INSTRUMENTAL no incluimos nada extra; el caller lo resuelve con record.fields.
    return this.prisma.entry.findMany({
      where: { recordId },
      include: {
        batch: record.type === 'BATCH'
          ? { select: { id: true, lotNumber: true, status: true, producedQuantity: true, unit: true } }
          : false,
        sample: record.type === 'SAMPLE'
          ? { select: { id: true, sampleCode: true, status: true, client: true, results: true, conditions: true, matrixId: true, methodIds: true, matrix: { select: { id: true, name: true, code: true, parameters: { select: { id: true, name: true, unit: true, minValue: true, maxValue: true, order: true }, orderBy: { order: 'asc' as const } } } } } }
          : false,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(entryId: string, recordId: string) {
    const entry = await this.prisma.entry.findFirst({
      where: { id: entryId, recordId },
      include: { nonConformities: true },
    })
    if (!entry) throw new NotFoundException('Entrada no encontrada')
    return entry
  }

  async create(
    recordId: string,
    organizationId: string,
    createdById: string,
    data: Record<string, unknown>,
    revisionDate?: string,
    batchMeta?: { lotNumber: string },
    sampleMeta?: { sampleCode: string; client?: string; matrix?: string },
  ) {
    // Traer registro con campos activos y acciones
    const record = await this.prisma.record.findFirst({
      where: { id: recordId, organizationId },
      include: {
        fields: { where: { isActive: true }, orderBy: { order: 'asc' } },
        actionsAsSource: {
          include: {
            targetRecord: {
              include: { fields: { where: { isActive: true } } },
            },
          },
        },
      },
    })
    if (!record) throw new NotFoundException('Registro no encontrado')

    // Validar que el registro esté ACTIVE para crear entries
    if (record.status !== 'ACTIVE') {
      throw new BadRequestException('Solo se pueden crear entradas en registros con estado ACTIVE')
    }

    // Validar revisionDate para NOT_PERIODIC_WITH_REVISION
    if (record.type === 'NOT_PERIODIC_WITH_REVISION') {
      if (!revisionDate) {
        throw new BadRequestException('Los registros con revisión requieren una fecha de revisión (revisionDate)')
      }
    }

    // Auto-detectar lotNumber/sampleCode del campo identificador si no viene explícito
    const identifierField = record.fields.find((f) => f.isIdentifier)
    const identifierValue = identifierField ? String(data[identifierField.id] || '') : ''

    if (record.type === 'BATCH') {
      const lotNumber = batchMeta?.lotNumber || identifierValue
      if (!lotNumber) {
        throw new BadRequestException('Los registros de lote requieren un número de lote (campo identificador)')
      }
      batchMeta = { lotNumber }
    }

    if (record.type === 'SAMPLE') {
      const sampleCode = sampleMeta?.sampleCode || identifierValue
      if (!sampleCode) {
        throw new BadRequestException('Los registros de muestra requieren un código de muestra (campo identificador)')
      }
      sampleMeta = { sampleCode, client: sampleMeta?.client }
    }

    // Convertir valores de texto a MAYÚSCULAS
    for (const field of record.fields) {
      if (
        (field.fieldType === 'TEXT' || field.fieldType === 'DROPDOWN') &&
        typeof data[field.id] === 'string'
      ) {
        data[field.id] = (data[field.id] as string).toUpperCase()
      }
    }

    // Autocompletar el estado inicial de fields DROPDOWN-as-status que no
    // vinieron en el body. Esto evita que el usuario tenga que conocer las
    // options al crear y resuelve la regla "exactamente un option es initial".
    for (const field of record.fields) {
      const current = data[field.id]
      if (current === undefined || current === null || current === '') {
        const initial = this.transitionValidator.getInitialValueForField(field)
        if (initial !== null) {
          data[field.id] = initial
        }
      }
    }

    // Validar campos requeridos
    for (const field of record.fields) {
      if (field.isRequired && field.fieldType !== 'FORMULA' && field.fieldType !== 'COMPARISON') {
        if (data[field.id] === undefined || data[field.id] === null || data[field.id] === '') {
          throw new BadRequestException(`El campo "${field.label}" es obligatorio`)
        }
      }
    }

    // Validar estado de instrumentos vinculados via RELATED_ENTRY (Records-as-Lists:
    // el "estado" del instrumento ahora vive en Entry.data[<statusFieldId>] del
    // record INSTRUMENTAL relacionado, no en Instrument.status).
    for (const field of record.fields) {
      if (
        (field.fieldType === 'RELATED_ENTRY' || field.fieldType === 'MULTIPLE_RELATED_ENTRY') &&
        field.relatedRecordId &&
        data[field.id]
      ) {
        const relatedRecord = await this.prisma.record.findUnique({
          where: { id: field.relatedRecordId },
          select: {
            type: true,
            fields: {
              where: { isActive: true, fieldType: 'DROPDOWN' },
              select: { id: true, comparisonConfig: true },
            },
          },
        })
        if (relatedRecord?.type === 'INSTRUMENTAL') {
          // Resolver el statusFieldId del record relacionado.
          const statusField = relatedRecord.fields.find((f) => {
            const cfg = f.comparisonConfig as { isStatus?: boolean } | null
            return cfg?.isStatus === true
          })
          if (!statusField) continue

          const relatedValues = Array.isArray(data[field.id])
            ? (data[field.id] as Array<{ entryId: string } | string>)
            : [data[field.id] as { entryId: string } | string]
          for (const rv of relatedValues) {
            const entryId = typeof rv === 'string' ? rv : rv?.entryId
            if (!entryId) continue
            const relatedEntry = await this.prisma.entry.findUnique({
              where: { id: entryId },
              select: { data: true },
            })
            if (!relatedEntry) continue
            const relatedData = (relatedEntry.data ?? {}) as Record<string, unknown>
            const status = String(relatedData[statusField.id] ?? '')
            if (status && status !== 'ACTIVE') {
              const code = Object.values(relatedData)[0] || entryId
              throw new BadRequestException(
                `El instrumento "${code}" no está activo (estado: ${status}). No se puede crear la entrada.`,
              )
            }
          }
        }
      }
    }

    // Evaluar comparaciones usando el servicio dedicado
    const comparisonResults: Record<string, { passed: boolean; value: unknown; description: string }> = {}
    for (const field of record.fields) {
      if (field.fieldType === 'COMPARISON' && field.comparisonConfig) {
        comparisonResults[field.id] = this.comparisonEvaluator.evaluate(
          field.comparisonConfig as { operator: string; compareAgainst: string; constantValue?: number; fieldId?: string; secondValue?: number },
          data[field.id],
          data,
        )
      }
    }

    // Evaluar todas las fórmulas (resuelve dependencias entre fórmulas automáticamente)
    const formulaResults = this.formulaEvaluator.evaluateAll(record.fields, data)

    // Calcular dueDate para registros periódicos
    let dueDate: Date | null = null
    if (record.type === 'PERIODIC' && record.periodicity) {
      dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + record.periodicity)
    }

    // Estos tipos se auto-completan al crear
    let autoComplete =
      record.type === 'INSTRUMENTAL' ||
      record.type === 'NOT_PERIODIC' ||
      record.type === 'NOT_PERIODIC_WITH_REVISION' ||
      record.type === 'STOCK'
    // BATCH no se auto-completa: tiene lifecycle PLANNED → IN_PROGRESS → COMPLETED
    // SAMPLE no se auto-completa: se completa cuando su muestra asociada se completa

    // Workflow engine v2: si el Record tiene un DROPDOWN con isStatus, el
    // lifecycle lo maneja el field, no el enum status legacy. La entry queda
    // en DRAFT y el "estado" real vive en data[fieldId].
    const hasStatusField = record.fields.some((f) => {
      if (f.fieldType !== 'DROPDOWN') return false
      const cfg = f.comparisonConfig as { isStatus?: boolean } | null
      return cfg?.isStatus === true
    })
    if (hasStatusField) {
      autoComplete = false
    }

    // Crear la entrada (lógica core)
    const entry = await this.prisma.entry.create({
      data: {
        recordId,
        createdById,
        recordVersion: record.version,
        data: data as Prisma.InputJsonValue,
        comparisonResults: Object.keys(comparisonResults).length > 0
          ? (comparisonResults as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        formulaResults: Object.keys(formulaResults).length > 0
          ? (formulaResults as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        dueDate,
        revisionDate: revisionDate ? new Date(revisionDate) : null,
        status: autoComplete ? 'COMPLETED' : 'DRAFT',
        completedAt: autoComplete ? new Date() : null,
      },
    })

    // Crear companion entity según el tipo de record
    if (record.type === 'BATCH' && batchMeta) {
      // Extraer recipeId del campo RECIPE_SELECT
      const recipeSelectField = record.fields.find((f) => f.fieldType === 'RECIPE_SELECT')
      const batchRecipeId = recipeSelectField && data[recipeSelectField.id]
        ? String(data[recipeSelectField.id])
        : null

      await this.prisma.batch.create({
        data: {
          organizationId,
          entryId: entry.id,
          recordId,
          recipeId: batchRecipeId,
          lotNumber: batchMeta.lotNumber,
        },
      })
    }

    if (record.type === 'SAMPLE' && sampleMeta) {
      // Extraer matrixId y methodIds del campo MATRIX_METHOD
      const matrixMethodField = record.fields.find((f) => f.fieldType === 'MATRIX_METHOD')
      let sampleMatrixId: string | null = null
      let sampleMethodIds: string[] = []
      if (matrixMethodField && data[matrixMethodField.id]) {
        const mmValue = data[matrixMethodField.id] as { matrixId?: string; methodIds?: string[] }
        sampleMatrixId = mmValue.matrixId || null
        sampleMethodIds = mmValue.methodIds || []
      }

      await this.prisma.sample.create({
        data: {
          organizationId,
          entryId: entry.id,
          recordId,
          sampleCode: sampleMeta.sampleCode,
          client: sampleMeta.client ? sampleMeta.client.toUpperCase() : null,
          matrixId: sampleMatrixId,
          methodIds: sampleMethodIds,
        },
      })
    }

    if (record.type === 'STOCK') {
      const lotField = record.fields.find((f) => f.label.toUpperCase() === 'LOTE') || record.fields.find((f) => f.isIdentifier)
      const productField = record.fields.find((f) => f.label.toUpperCase() === 'PRODUCTO')
      const tipoField = record.fields.find((f) => f.label.toUpperCase() === 'TIPO MOVIMIENTO')
      const cantidadField = record.fields.find((f) => f.label.toUpperCase() === 'CANTIDAD')

      const lotNumber = lotField ? String(data[lotField.id] || '') : ''
      const product = productField ? String(data[productField.id] || '') : ''
      const movementType = tipoField ? String(data[tipoField.id] || 'INGRESO') : 'INGRESO'

      // QUANTITY field stores { value, unit } or plain number
      let quantity = 0
      let unit: string | null = null
      if (cantidadField && data[cantidadField.id]) {
        const qtyVal = data[cantidadField.id]
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
            organizationId,
            entryId: entry.id,
            recordId,
            product: product.toUpperCase(),
            lotNumber: lotNumber.toUpperCase(),
            movementType: movementType.toUpperCase(),
            quantity,
            unit,
          },
        })
      }
    }


    // Emitir evento — los listeners manejan:
    // - Creación automática de NonConformities (comparaciones fallidas)
    // - Cascading de RecordActions (crear entries en registros target)
    this.eventEmitter.emit(
      EntryCreatedEvent.EVENT_NAME,
      new EntryCreatedEvent(
        entry.id,
        recordId,
        organizationId,
        createdById,
        data,
        comparisonResults,
        record,
      ),
    )

    return entry
  }

  async update(
    entryId: string,
    recordId: string,
    data: Record<string, unknown>,
    changedById: string,
    userRole: UserRole,
    transitionReason?: string,
  ) {
    const entry = await this.findById(entryId, recordId)

    // Cargar el record con sus fields activos — lo necesitamos para validar
    // identifiers (si está COMPLETED), validar transitions (DROPDOWN-as-status)
    // y para tener organizationId al emitir eventos.
    const record = await this.prisma.record.findUniqueOrThrow({
      where: { id: recordId },
      include: { fields: { where: { isActive: true } } },
    })
    const existingData = entry.data as Record<string, unknown>

    // 1. Identifiers no se pueden modificar en entries COMPLETED.
    if (entry.status === 'COMPLETED') {
      const identifierIds = record.fields.filter((f) => f.isIdentifier).map((f) => f.id)
      for (const idField of identifierIds) {
        if (data[idField] !== undefined && data[idField] !== existingData[idField]) {
          throw new BadRequestException('No se pueden modificar campos identificadores de una entrada completada')
        }
      }
    }

    // 2. Validar transitions de DROPDOWN-as-status fields. El frontend manda
    // data completa (no parcial), así que comparamos directamente existing vs
    // data para detectar cambios de status.
    this.transitionValidator.validate(
      record.fields,
      existingData,
      data,
      userRole,
      transitionReason,
    )

    // 3. Persistir.
    const updated = await this.prisma.entry.update({
      where: { id: entryId },
      data: { data: data as Prisma.InputJsonValue },
    })

    // 4. Emitir EntryFieldValueChangedEvent por cada field que cambió.
    // Habilita triggers de RecordAction tipo FIELD_VALUE_CHANGED y permite
    // que listeners reaccionen a cambios específicos (ej. el de status).
    const fieldIds = new Set<string>([
      ...Object.keys(existingData ?? {}),
      ...Object.keys(data ?? {}),
    ])
    for (const fieldId of fieldIds) {
      const oldValue = existingData?.[fieldId]
      const newValue = data?.[fieldId]
      if (this.isSameValue(oldValue, newValue)) continue
      this.eventEmitter.emit(
        EntryFieldValueChangedEvent.EVENT_NAME,
        new EntryFieldValueChangedEvent(
          entryId,
          recordId,
          record.organizationId,
          fieldId,
          oldValue,
          newValue,
          changedById,
          false, // triggeredByCascade — futuro: heredar de contexto de cascada
        ),
      )
    }

    return updated
  }

  /** Comparación profunda simple para evitar emitir eventos por no-changes. */
  private isSameValue(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (a == null && b == null) return true
    if (a == null || b == null) return false
    return JSON.stringify(a) === JSON.stringify(b)
  }

  async complete(entryId: string, recordId: string) {
    await this.findById(entryId, recordId)

    const updatedEntry = await this.prisma.entry.update({
      where: { id: entryId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })

    // Traer datos del record para el evento
    const record = await this.prisma.record.findUniqueOrThrow({
      where: { id: recordId },
    })

    // Emitir evento — el listener maneja la próxima entry periódica
    this.eventEmitter.emit(
      EntryCompletedEvent.EVENT_NAME,
      new EntryCompletedEvent(entryId, recordId, record.organizationId, record),
    )

    return updatedEntry
  }
}
