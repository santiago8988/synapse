import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../../prisma/prisma.service'
import { InstrumentStatusChangedEvent } from '../../common/events/domain-events'

@Injectable()
export class InstrumentsService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(organizationId: string, filters?: { status?: string; recordId?: string }) {
    return this.prisma.instrument.findMany({
      where: {
        organizationId,
        ...(filters?.status && { status: filters.status as never }),
        ...(filters?.recordId && { recordId: filters.recordId }),
      },
      include: {
        entry: {
          select: { id: true, data: true, status: true, createdAt: true },
        },
        record: {
          select: { id: true, name: true, periodicity: true, notifyDaysBefore: true,
            fields: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, label: true, fieldType: true, isIdentifier: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findPatterns(organizationId: string) {
    // Patrones = instrumentos cuyo record NO tiene campo CALIBRATION_TEMPLATE
    const allInstruments = await this.prisma.instrument.findMany({
      where: { organizationId, status: 'ACTIVE' },
      include: {
        entry: { select: { id: true, data: true } },
        record: {
          select: {
            id: true,
            name: true,
            fields: { where: { isActive: true }, select: { fieldType: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return allInstruments.filter(
      (i) => !i.record.fields.some((f) => f.fieldType === 'CALIBRATION_TEMPLATE'),
    )
  }

  async findById(id: string, organizationId: string) {
    const instrument = await this.prisma.instrument.findFirst({
      where: { id, organizationId },
      include: {
        entry: {
          select: { id: true, data: true, status: true, recordId: true, createdAt: true },
        },
        record: {
          select: {
            id: true, name: true, periodicity: true, notifyDaysBefore: true,
            fields: { where: { isActive: true }, orderBy: { order: 'asc' } },
          },
        },
        statusLogs: {
          orderBy: { changedAt: 'desc' },
          take: 50,
        },
      },
    })
    if (!instrument) throw new NotFoundException('Instrumento no encontrado')
    return instrument
  }

  async changeStatus(
    id: string,
    organizationId: string,
    toStatus: string,
    reason: string | null,
    changedById: string,
  ) {
    const instrument = await this.findById(id, organizationId)
    const fromStatus = instrument.status

    if (fromStatus === toStatus) {
      throw new BadRequestException('El instrumento ya tiene ese estado')
    }

    if (fromStatus === 'DECOMMISSIONED' && toStatus !== 'DECOMMISSIONED') {
      throw new BadRequestException('No se puede reactivar un instrumento dado de baja')
    }

    // Recalcular nextCalibrationAt al volver a ACTIVE después de calibración
    let nextCalibrationAt = instrument.nextCalibrationAt
    if (toStatus === 'ACTIVE' && fromStatus === 'IN_CALIBRATION' && instrument.record.periodicity) {
      nextCalibrationAt = new Date()
      nextCalibrationAt.setDate(nextCalibrationAt.getDate() + instrument.record.periodicity)
    }

    const [updatedInstrument] = await this.prisma.$transaction([
      this.prisma.instrument.update({
        where: { id },
        data: {
          status: toStatus as never,
          nextCalibrationAt,
        },
      }),
      this.prisma.instrumentStatusLog.create({
        data: {
          instrumentId: id,
          fromStatus: fromStatus as never,
          toStatus: toStatus as never,
          reason,
          changedById,
        },
      }),
    ])

    this.eventEmitter.emit(
      InstrumentStatusChangedEvent.EVENT_NAME,
      new InstrumentStatusChangedEvent(id, organizationId, fromStatus, toStatus, reason, changedById),
    )

    return updatedInstrument
  }
}
