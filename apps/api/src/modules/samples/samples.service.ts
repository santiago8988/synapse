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
        instrumentAssignments: {
          orderBy: { order: 'asc' },
          include: {
            instrument: {
              select: {
                id: true,
                status: true,
                nextCalibrationAt: true,
                entry: { select: { id: true, data: true } },
                record: { select: { id: true, name: true } },
              },
            },
          },
        },
        matrix: {
          include: {
            parameters: { orderBy: { order: 'asc' } },
            conditions: { orderBy: { order: 'asc' } },
            requiredInstruments: { orderBy: { order: 'asc' } },
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
  /**
   * Asigna un instrumento real a una de las etiquetas que la plantilla
   * requiere. Ver TO_DO.md §26.
   *
   * Es un upsert por (sampleId, label): cambiar el equipo de una etiqueta ya
   * cubierta es una correccion normal mientras la corrida esta abierta, no un
   * conflicto. Lo que el indice unico impide es que el mismo equipo cubra dos
   * etiquetas distintas.
   *
   * **No se valida el estado del instrumento a proposito.** Un equipo en
   * calibracion, en reparacion o dado de baja se puede asignar: si de hecho se
   * uso, el registro tiene que decirlo — bloquearlo empuja a falsear el dato.
   * La UI muestra la condicion de cada equipo con un chip para que la decision
   * sea informada, y el AuditLog queda con quien asigno que.
   */
  async assignInstrument(
    sampleId: string,
    organizationId: string,
    assignedByUserId: string,
    data: { label: string; instrumentId: string; order: number },
  ) {
    await this.findById(sampleId, organizationId)

    // El instrumento tiene que ser de la misma organizacion: el id viene del
    // body y sin este filtro se podria apuntar al equipo de otro laboratorio.
    const instrumento = await this.prisma.instrument.findFirst({
      where: { id: data.instrumentId, organizationId },
      select: { id: true },
    })
    if (!instrumento) throw new NotFoundException('Instrumento no encontrado')

    const orgUser = await this.prisma.organizationUser.findFirst({
      where: { userId: assignedByUserId, organizationId },
    })
    if (!orgUser) throw new NotFoundException('Usuario no encontrado')

    await this.prisma.sampleInstrumentAssignment.upsert({
      where: { sampleId_label: { sampleId, label: data.label } },
      create: {
        sampleId,
        label: data.label,
        order: data.order,
        instrumentId: data.instrumentId,
        assignedById: orgUser.id,
      },
      update: {
        order: data.order,
        instrumentId: data.instrumentId,
        assignedById: orgUser.id,
        assignedAt: new Date(),
      },
    })

    return this.findById(sampleId, organizationId)
  }

  /**
   * Quita una asignacion. El id de la asignacion llega de la URL, asi que se
   * busca acotado al muestra —que ya se resolvio contra la
   * organizacion—: sin eso, conocer un id alcanzaria para borrarle la
   * trazabilidad a otro laboratorio.
   */
  async unassignInstrument(sampleId: string, assignmentId: string, organizationId: string) {
    await this.findById(sampleId, organizationId)

    const asignacion = await this.prisma.sampleInstrumentAssignment.findFirst({
      where: { id: assignmentId, sampleId },
      select: { id: true },
    })
    if (!asignacion) throw new NotFoundException('Asignacion no encontrada')

    await this.prisma.sampleInstrumentAssignment.delete({ where: { id: assignmentId } })

    return this.findById(sampleId, organizationId)
  }

}
