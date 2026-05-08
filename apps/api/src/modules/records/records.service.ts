import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma, RecordType, FieldType } from '@prisma/client'

interface CreateRecordDto {
  name: string
  type: RecordType
  areaId?: string
  documentId?: string
  periodicity?: number
  notifyDaysBefore?: number
  fields: CreateFieldDto[]
}

interface CreateFieldDto {
  label: string
  fieldType: FieldType
  order: number
  isIdentifier?: boolean
  isRequired?: boolean
  relatedRecordId?: string
  relatedFieldIds?: string[]
  comparisonConfig?: Prisma.InputJsonValue
  formulaConfig?: Prisma.InputJsonValue
}

interface UpdateFieldDto {
  label?: string
  order?: number
  isRequired?: boolean
  comparisonConfig?: Prisma.InputJsonValue
  formulaConfig?: Prisma.InputJsonValue
}

interface EditRecordDto {
  name?: string
  areaId?: string | null
  periodicity?: number
  notifyDaysBefore?: number
  changeReason: string
  addFields?: CreateFieldDto[]
  removeFieldIds?: string[]
  updateFields?: Array<{ id: string } & UpdateFieldDto>
}

interface CreateActionDto {
  targetRecordId: string
  fieldMapping: Array<{ sourceFieldId: string; targetFieldId: string }>
}

@Injectable()
export class RecordsService {
  constructor(private prisma: PrismaService) {}

  private uppercaseFieldConfig(f: CreateFieldDto) {
    // Uppercase formula expressions
    let formulaConfig = f.formulaConfig
    if (formulaConfig && typeof formulaConfig === 'object' && 'expression' in (formulaConfig as Record<string, unknown>)) {
      formulaConfig = { expression: ((formulaConfig as { expression: string }).expression || '').toUpperCase() } as unknown as Prisma.InputJsonValue
    }
    // Uppercase dropdown options and quantity units
    let comparisonConfig = f.comparisonConfig
    if (comparisonConfig && typeof comparisonConfig === 'object') {
      const cc = comparisonConfig as Record<string, unknown>
      if (Array.isArray(cc.options)) {
        comparisonConfig = { ...cc, options: (cc.options as string[]).map((o: string) => o.toUpperCase()) } as unknown as Prisma.InputJsonValue
      }
      if (Array.isArray(cc.units)) {
        comparisonConfig = { ...cc, units: (cc.units as string[]).map((u: string) => u.toUpperCase()) } as unknown as Prisma.InputJsonValue
      }
    }
    return { formulaConfig, comparisonConfig }
  }

  async findAll(organizationId: string, archived = false, status?: string) {
    return this.prisma.record.findMany({
      where: {
        organizationId,
        isActive: !archived,
        ...(status ? { status: status as 'DRAFT' | 'IN_REVIEW' | 'ACTIVE' } : {}),
      },
      include: {
        area: { select: { id: true, name: true } },
        document: { select: { id: true, title: true, code: true } },
        fields: { where: { isActive: true }, orderBy: { order: 'asc' } },
        _count: { select: { entries: true } },
      },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findById(id: string, organizationId: string) {
    const record = await this.prisma.record.findFirst({
      where: { id, organizationId },
      include: {
        area: true,
        document: true,
        fields: { where: { isActive: true }, orderBy: { order: 'asc' } },
        actionsAsSource: {
          include: { targetRecord: { select: { id: true, name: true } } },
        },
        actionsAsTarget: {
          include: { sourceRecord: { select: { id: true, name: true } } },
        },
      },
    })
    if (!record) throw new NotFoundException('Registro no encontrado')
    return record
  }

  // Traer todas las versiones de campos (incluyendo inactivos) para ver entries viejas
  async getFieldsForVersion(recordId: string, version: number) {
    return this.prisma.recordField.findMany({
      where: {
        recordId,
        addedInVersion: { lte: version },
        OR: [
          { removedInVersion: null },
          { removedInVersion: { gt: version } },
        ],
      },
      orderBy: { order: 'asc' },
    })
  }

  async create(organizationId: string, createdById: string, data: CreateRecordDto) {
    if (data.type === 'PERIODIC' && !data.periodicity) {
      throw new BadRequestException('Los registros periódicos requieren periodicidad en días')
    }

    // INSTRUMENTAL requiere periodicity (para calibración) y notify
    if (data.type === 'INSTRUMENTAL') {
      if (!data.periodicity) {
        throw new BadRequestException('Los registros instrumentales requieren periodicidad de calibración en días')
      }
      // Auto-agregar campo CODIGO como identifier si no lo incluyó
      const hasCodigo = data.fields.some(
        (f) => f.label.toUpperCase() === 'CODIGO' || f.label.toUpperCase() === 'CÓDIGO',
      )
      if (!hasCodigo) {
        data.fields.unshift({
          label: 'CODIGO',
          fieldType: 'TEXT' as FieldType,
          order: 0,
          isIdentifier: true,
          isRequired: true,
        })
      }
      // Auto-agregar campo ESTADO (DROPDOWN-as-status) si no lo incluyó.
      // Patrón "Records-as-Lists": el estado es un OWN field configurable, no
      // una columna fija. El usuario puede editar options/transitions después
      // — el motor genérico se adapta. Las options canónicas reproducen la
      // semántica del enum InstrumentStatus legacy y las reglas implícitas
      // de instruments.service.changeStatus (DECOMMISSIONED es terminal,
      // IN_CALIBRATION → ACTIVE recalcula nextCalibrationAt vía listener).
      const hasStatus = data.fields.some(
        (f) =>
          f.fieldType === ('DROPDOWN' as FieldType) &&
          (f.comparisonConfig as { isStatus?: boolean } | undefined)?.isStatus === true,
      )
      if (!hasStatus) {
        const estadoConfig: Prisma.InputJsonValue = {
          isStatus: true,
          options: [
            { value: 'ACTIVE', label: 'Activo', color: 'green', isInitial: true },
            { value: 'IN_CALIBRATION', label: 'En calibración', color: 'blue' },
            { value: 'IN_REPAIR', label: 'En reparación', color: 'amber' },
            { value: 'DECOMMISSIONED', label: 'Dado de baja', color: 'red', isFinal: true },
          ],
          transitions: [
            { from: 'ACTIVE', to: 'IN_CALIBRATION' },
            { from: 'ACTIVE', to: 'IN_REPAIR' },
            { from: 'ACTIVE', to: 'DECOMMISSIONED', requireReason: true },
            { from: 'IN_CALIBRATION', to: 'ACTIVE' },
            { from: 'IN_CALIBRATION', to: 'IN_REPAIR' },
            { from: 'IN_REPAIR', to: 'ACTIVE' },
            { from: 'IN_REPAIR', to: 'DECOMMISSIONED', requireReason: true },
          ],
        }
        data.fields.push({
          label: 'ESTADO',
          fieldType: 'DROPDOWN' as FieldType,
          order: data.fields.length,
          isIdentifier: false,
          isRequired: true,
          comparisonConfig: estadoConfig,
        })
      }
      // Reordenar todos los fields al final
      data.fields.forEach((f, i) => { f.order = i })
    }

    const hasIdentifier = data.fields.some((f) => f.isIdentifier)
    if (!hasIdentifier) {
      throw new BadRequestException('Al menos un campo debe ser identificador')
    }

    for (const field of data.fields) {
      this.validateFieldConfig(field)
    }

    // Validar nombre único
    const existingName = await this.prisma.record.findFirst({
      where: { organizationId, name: data.name.toUpperCase(), isActive: true },
    })
    if (existingName) {
      throw new BadRequestException('Ya existe un registro con ese nombre')
    }

    const record = await this.prisma.record.create({
      data: {
        organizationId,
        createdById,
        name: data.name.toUpperCase(),
        type: data.type,
        version: 1,
        areaId: data.areaId || null,
        documentId: data.documentId || null,
        periodicity: data.periodicity || null,
        notifyDaysBefore: data.notifyDaysBefore || null,
        fields: {
          create: data.fields.map((f) => {
            const { formulaConfig, comparisonConfig } = this.uppercaseFieldConfig(f)
            return {
              label: f.label.toUpperCase(),
              fieldType: f.fieldType,
              order: f.order,
              isIdentifier: f.isIdentifier ?? false,
              isRequired: f.isRequired ?? true,
              addedInVersion: 1,
              relatedRecordId: f.relatedRecordId || null,
              relatedFieldIds: f.relatedFieldIds || [],
              comparisonConfig: comparisonConfig ?? Prisma.JsonNull,
              formulaConfig: formulaConfig ?? Prisma.JsonNull,
            }
          }),
        },
      },
      include: {
        fields: { where: { isActive: true }, orderBy: { order: 'asc' } },
      },
    })

    // Resolver labels en comparisonConfig a IDs reales de campos creados
    for (const field of record.fields) {
      if (field.fieldType === 'COMPARISON' && field.comparisonConfig) {
        const config = field.comparisonConfig as Record<string, unknown>
        let updated = false

        // Resolver fieldId (campo a evaluar) por label
        if (config.fieldId && typeof config.fieldId === 'string') {
          const refField = record.fields.find((f) => f.label === config.fieldId)
          if (refField) {
            config.fieldId = refField.id
            updated = true
          }
        }

        // Resolver compareFieldId (campo contra el que se compara) por label
        if (config.compareFieldId && typeof config.compareFieldId === 'string') {
          const refField = record.fields.find((f) => f.label === config.compareFieldId)
          if (refField) {
            config.compareFieldId = refField.id
            updated = true
          }
        }

        if (updated) {
          await this.prisma.recordField.update({
            where: { id: field.id },
            data: { comparisonConfig: config as Prisma.InputJsonValue },
          })
        }
      }
    }

    return this.findById(record.id, organizationId)
  }

  /**
   * Editar registro = nueva versión.
   * - Campos nuevos se agregan con addedInVersion = nueva versión
   * - Campos eliminados se marcan con removedInVersion + isActive = false
   * - Campos actualizados se modifican in-place
   * - Entradas existentes no se tocan — mantienen su recordVersion
   */
  async editWithVersion(id: string, organizationId: string, data: EditRecordDto) {
    const record = await this.findById(id, organizationId)

    if (record.status === 'IN_REVIEW') {
      throw new BadRequestException('No se puede editar un registro en revisión')
    }

    const newVersion = record.version + 1

    // Actualizar record con nueva versión
    await this.prisma.record.update({
      where: { id },
      data: {
        name: data.name ?? record.name,
        areaId: data.areaId !== undefined ? data.areaId : record.areaId,
        periodicity: data.periodicity ?? record.periodicity,
        notifyDaysBefore: data.notifyDaysBefore ?? record.notifyDaysBefore,
        version: newVersion,
        changeLog: data.changeReason,
      },
    })

    // Eliminar campos (soft delete)
    if (data.removeFieldIds && data.removeFieldIds.length > 0) {
      await this.prisma.recordField.updateMany({
        where: { id: { in: data.removeFieldIds }, recordId: id },
        data: { isActive: false, removedInVersion: newVersion },
      })
    }

    // Actualizar campos existentes
    if (data.updateFields) {
      for (const uf of data.updateFields) {
        const updateData: Prisma.RecordFieldUpdateInput = {}
        if (uf.label !== undefined) updateData.label = uf.label
        if (uf.order !== undefined) updateData.order = uf.order
        if (uf.isRequired !== undefined) updateData.isRequired = uf.isRequired
        if (uf.comparisonConfig !== undefined) updateData.comparisonConfig = uf.comparisonConfig
        if (uf.formulaConfig !== undefined) updateData.formulaConfig = uf.formulaConfig

        await this.prisma.recordField.update({
          where: { id: uf.id },
          data: updateData,
        })
      }
    }

    // Agregar campos nuevos
    if (data.addFields && data.addFields.length > 0) {
      for (const f of data.addFields) {
        this.validateFieldConfig(f)
      }

      await this.prisma.recordField.createMany({
        data: data.addFields.map((f) => {
          const { formulaConfig, comparisonConfig } = this.uppercaseFieldConfig(f)
          return {
            recordId: id,
            label: f.label.toUpperCase(),
            fieldType: f.fieldType,
            order: f.order,
            isIdentifier: f.isIdentifier ?? false,
            isRequired: f.isRequired ?? true,
            isActive: true,
            addedInVersion: newVersion,
            relatedRecordId: f.relatedRecordId || null,
            relatedFieldIds: f.relatedFieldIds || [],
            comparisonConfig: comparisonConfig ?? Prisma.DbNull,
            formulaConfig: formulaConfig ?? Prisma.DbNull,
          }
        }),
      })
    }

    // Verificar que quede al menos un identifier activo
    const activeFields = await this.prisma.recordField.findMany({
      where: { recordId: id, isActive: true },
    })
    if (!activeFields.some((f) => f.isIdentifier)) {
      throw new BadRequestException('Al menos un campo activo debe ser identificador')
    }

    return this.findById(id, organizationId)
  }

  async archive(id: string, organizationId: string) {
    const record = await this.findById(id, organizationId)
    if (record.isSystem) {
      throw new BadRequestException('No se puede archivar un registro del sistema')
    }
    return this.prisma.record.update({
      where: { id },
      data: { isActive: false },
    })
  }

  async restore(id: string, organizationId: string) {
    const record = await this.prisma.record.findFirst({
      where: { id, organizationId },
    })
    if (!record) throw new NotFoundException('Registro no encontrado')
    return this.prisma.record.update({
      where: { id },
      data: { isActive: true },
    })
  }

  // ─── Actions ──────────────────────────────────

  async addAction(recordId: string, organizationId: string, data: CreateActionDto) {
    const target = await this.prisma.record.findFirst({
      where: { id: data.targetRecordId, organizationId },
      include: { fields: { where: { isActive: true } } },
    })
    if (!target) throw new BadRequestException('El registro destino no existe en esta organización')

    // Validar que todos los campos identifier del target estén mapeados
    const targetIdentifiers = target.fields.filter((f) => f.isIdentifier)
    const mappedTargetIds = data.fieldMapping.map((m) => m.targetFieldId)
    const unmappedIdentifiers = targetIdentifiers.filter((f) => !mappedTargetIds.includes(f.id))

    if (unmappedIdentifiers.length > 0) {
      throw new BadRequestException(
        `Los campos identificadores del destino deben estar mapeados: ${unmappedIdentifiers.map((f) => f.label).join(', ')}`,
      )
    }

    return this.prisma.recordAction.create({
      data: {
        sourceRecordId: recordId,
        targetRecordId: data.targetRecordId,
        fieldMapping: data.fieldMapping as unknown as Prisma.InputJsonValue,
      },
      include: {
        targetRecord: { select: { id: true, name: true } },
      },
    })
  }

  async deleteAction(actionId: string) {
    return this.prisma.recordAction.delete({ where: { id: actionId } })
  }

  // ─── Validaciones ─────────────────────────────

  private validateFieldConfig(field: CreateFieldDto) {
    if (field.fieldType === 'COMPARISON' && !field.comparisonConfig) {
      throw new BadRequestException(`El campo "${field.label}" de tipo COMPARISON requiere comparisonConfig`)
    }

    if (field.fieldType === 'FORMULA' && !field.formulaConfig) {
      throw new BadRequestException(`El campo "${field.label}" de tipo FORMULA requiere formulaConfig`)
    }

    if (
      (field.fieldType === 'RELATED_ENTRY' || field.fieldType === 'MULTIPLE_RELATED_ENTRY') &&
      !field.relatedRecordId
    ) {
      throw new BadRequestException(`El campo "${field.label}" requiere relatedRecordId`)
    }
  }
}
