import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../../prisma/prisma.service'
import { NonConformityCreatedEvent } from '../../common/events/domain-events'

@Injectable()
export class NonConformitiesService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(organizationId: string, filters?: { status?: string; entryId?: string }) {
    return this.prisma.nonConformity.findMany({
      where: {
        organizationId,
        ...(filters?.status && { status: filters.status as never }),
        ...(filters?.entryId && { entryId: filters.entryId }),
      },
      include: {
        entry: { select: { id: true, recordId: true, status: true } },
        _count: { select: { correctiveActions: true } },
      },
      orderBy: { detectedAt: 'desc' },
    })
  }

  async findById(id: string, organizationId: string) {
    const nc = await this.prisma.nonConformity.findFirst({
      where: { id, organizationId },
      include: {
        entry: { select: { id: true, recordId: true, status: true, data: true } },
        correctiveActions: { orderBy: { createdAt: 'asc' } },
      },
    })
    if (!nc) throw new NotFoundException('No conformidad no encontrada')
    return nc
  }

  async create(
    organizationId: string,
    createdById: string,
    data: {
      title: string
      description: string
      entryId?: string
      assignedToId?: string
    },
  ) {
    const nc = await this.prisma.nonConformity.create({
      data: {
        organizationId,
        createdById,
        title: data.title,
        description: data.description,
        entryId: data.entryId,
        assignedToId: data.assignedToId,
        status: 'OPEN',
      },
    })

    this.eventEmitter.emit(
      NonConformityCreatedEvent.EVENT_NAME,
      new NonConformityCreatedEvent(nc.id, organizationId, data.entryId || null, data.title),
    )

    return nc
  }

  async updateStatus(
    id: string,
    organizationId: string,
    newStatus: string,
    userId: string,
  ) {
    const nc = await this.findById(id, organizationId)
    const currentStatus = nc.status

    // Validar transiciones permitidas
    const validTransitions: Record<string, string[]> = {
      OPEN: ['IN_PROGRESS'],
      IN_PROGRESS: ['RESOLVED'],
      RESOLVED: ['CLOSED'],
    }

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `No se puede cambiar de ${currentStatus} a ${newStatus}`,
      )
    }

    // Para resolver, requiere al menos 1 acción correctiva completada
    if (newStatus === 'RESOLVED') {
      const completedActions = nc.correctiveActions.filter((a) => a.completedAt !== null)
      if (completedActions.length === 0) {
        throw new BadRequestException(
          'Se requiere al menos una acción correctiva completada para resolver',
        )
      }
    }

    return this.prisma.nonConformity.update({
      where: { id },
      data: {
        status: newStatus as never,
        ...(newStatus === 'RESOLVED' && { resolvedAt: new Date() }),
      },
    })
  }

  async addCorrectiveAction(
    ncId: string,
    organizationId: string,
    createdById: string,
    data: { description: string; dueDate?: string },
  ) {
    await this.findById(ncId, organizationId)

    return this.prisma.correctiveAction.create({
      data: {
        nonConformityId: ncId,
        createdById,
        description: data.description,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
      },
    })
  }

  async completeCorrectiveAction(
    actionId: string,
    ncId: string,
    organizationId: string,
  ) {
    // Verificar que la NC existe y pertenece a la org
    await this.findById(ncId, organizationId)

    const action = await this.prisma.correctiveAction.findFirst({
      where: { id: actionId, nonConformityId: ncId },
    })
    if (!action) throw new NotFoundException('Acción correctiva no encontrada')

    return this.prisma.correctiveAction.update({
      where: { id: actionId },
      data: { completedAt: new Date() },
    })
  }
}
