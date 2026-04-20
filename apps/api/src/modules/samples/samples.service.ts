import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../../prisma/prisma.service'
import { Prisma, SampleStatus } from '@prisma/client'
import { EntryCompletedEvent } from '../../common/events/domain-events'

const VALID_TRANSITIONS: Record<SampleStatus, SampleStatus[]> = {
  RECEIVED: ['IN_TESTING'],
  IN_TESTING: ['COMPLETED'],
  COMPLETED: [],
}

@Injectable()
export class SamplesService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(organizationId: string, filters?: { status?: string; recordId?: string }) {
    return this.prisma.sample.findMany({
      where: {
        organizationId,
        ...(filters?.status ? { status: filters.status as SampleStatus } : {}),
        ...(filters?.recordId ? { recordId: filters.recordId } : {}),
      },
      include: {
        record: { select: { id: true, name: true } },
        entry: { select: { id: true, data: true } },
        matrix: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string, organizationId: string) {
    const sample = await this.prisma.sample.findFirst({
      where: { id, organizationId },
      include: {
        record: {
          select: {
            id: true,
            name: true,
            fields: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, label: true, fieldType: true } },
          },
        },
        entry: true,
        matrix: {
          include: {
            parameters: { orderBy: { order: 'asc' } },
            conditions: { orderBy: { order: 'asc' } },
          },
        },
      },
    })
    if (!sample) throw new NotFoundException('Muestra no encontrada')

    // Compute effective parameters
    const effectiveParameters = await this.getEffectiveParameters(sample)

    return { ...sample, effectiveParameters }
  }

  private async getEffectiveParameters(sample: {
    methodIds: string[]
    matrix: { parameters: Array<{ id: string; name: string; method: string | null; unit: string | null; minValue: number | null; maxValue: number | null; order: number }> } | null
  }) {
    if (sample.methodIds.length > 0) {
      const methods = await this.prisma.orgMethod.findMany({
        where: { id: { in: sample.methodIds } },
        orderBy: { code: 'asc' },
      })
      return methods.map((m) => ({
        id: m.id,
        name: m.parameter,
        method: `${m.code} - ${m.name}`,
        unit: m.unit,
        minValue: m.defaultMin,
        maxValue: m.defaultMax,
      }))
    }
    if (sample.matrix) {
      return sample.matrix.parameters.map((p) => ({
        id: p.id,
        name: p.name,
        method: p.method,
        unit: p.unit,
        minValue: p.minValue,
        maxValue: p.maxValue,
      }))
    }
    return []
  }

  async changeStatus(id: string, organizationId: string, newStatus: SampleStatus) {
    const sample = await this.findById(id, organizationId)

    const allowed = VALID_TRANSITIONS[sample.status]
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `No se puede pasar de ${sample.status} a ${newStatus}`,
      )
    }

    // Validate: cannot start testing without matrix or methods
    if (newStatus === 'IN_TESTING') {
      if (!sample.matrixId && sample.methodIds.length === 0) {
        throw new BadRequestException('La muestra debe tener una matriz o métodos asignados antes de iniciar ensayos')
      }
    }

    const updateData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'COMPLETED') updateData.completedAt = new Date()

    const updatedSample = await this.prisma.sample.update({
      where: { id },
      data: updateData,
      include: {
        record: { select: { id: true, name: true } },
        matrix: { select: { id: true, name: true, code: true } },
      },
    })

    if (newStatus === 'COMPLETED') {
      await this.prisma.entry.update({
        where: { id: sample.entryId },
        data: { status: 'COMPLETED', completedAt: new Date() },
      })

      const record = await this.prisma.record.findUniqueOrThrow({
        where: { id: sample.recordId },
      })

      this.eventEmitter.emit(
        EntryCompletedEvent.EVENT_NAME,
        new EntryCompletedEvent(sample.entryId, sample.recordId, record.organizationId, record),
      )
    }

    return updatedSample
  }

  async saveResults(id: string, organizationId: string, results: Record<string, unknown>) {
    const sample = await this.findById(id, organizationId)

    if (sample.status === 'COMPLETED') {
      throw new BadRequestException('No se pueden modificar resultados de una muestra completada')
    }

    return this.prisma.sample.update({
      where: { id },
      data: {
        results: results as Prisma.InputJsonValue,
      },
      include: {
        record: { select: { id: true, name: true } },
        matrix: { include: { parameters: { orderBy: { order: 'asc' } } } },
      },
    })
  }

  async saveConditions(id: string, organizationId: string, conditions: Record<string, unknown>) {
    const sample = await this.findById(id, organizationId)

    if (sample.status === 'COMPLETED') {
      throw new BadRequestException('No se pueden modificar condiciones de una muestra completada')
    }

    return this.prisma.sample.update({
      where: { id },
      data: {
        conditions: conditions as Prisma.InputJsonValue,
      },
    })
  }
}
