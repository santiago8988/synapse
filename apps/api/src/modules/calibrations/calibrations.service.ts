import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CalibrationStatus, Prisma } from '@prisma/client'

const PATTERNS_INCLUDE = {
  patterns: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      pattern: {
        select: {
          id: true,
          data: true,
          record: { select: { id: true, name: true } },
          instrument: {
            select: { id: true, status: true, nextCalibrationAt: true },
          },
        },
      },
    },
  },
}

const VALID_TRANSITIONS: Record<CalibrationStatus, CalibrationStatus[]> = {
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: ['APPROVED', 'REJECTED'],
  APPROVED: [],
  REJECTED: [],
}

@Injectable()
export class CalibrationsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, filters?: { status?: string; entryId?: string }) {
    return this.prisma.calibration.findMany({
      where: {
        organizationId,
        ...(filters?.status ? { status: filters.status as CalibrationStatus } : {}),
        ...(filters?.entryId ? { entryId: filters.entryId } : {}),
      },
      include: {
        entry: {
          select: {
            id: true,
            data: true,
            record: {
              select: {
                id: true,
                name: true,
                type: true,
                fields: {
                  where: { isActive: true, fieldType: 'DROPDOWN' },
                  select: { id: true, comparisonConfig: true },
                },
              },
            },
          },
        },
        template: { select: { id: true, name: true, code: true } },
        ...PATTERNS_INCLUDE,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string, organizationId: string) {
    const calibration = await this.prisma.calibration.findFirst({
      where: { id, organizationId },
      include: {
        entry: {
          select: {
            id: true,
            data: true,
            record: {
              select: {
                id: true,
                name: true,
                type: true,
                fields: {
                  where: { isActive: true },
                  orderBy: { order: 'asc' },
                  select: { id: true, label: true, fieldType: true, comparisonConfig: true },
                },
              },
            },
          },
        },
        ...PATTERNS_INCLUDE,
        template: {
          include: {
            tests: {
              orderBy: { order: 'asc' },
              include: { points: { orderBy: { order: 'asc' } } },
            },
          },
        },
      },
    })
    if (!calibration) throw new NotFoundException('Calibracion no encontrada')
    return calibration
  }

  async changeStatus(id: string, organizationId: string, newStatus: CalibrationStatus) {
    const calibration = await this.findById(id, organizationId)

    const allowed = VALID_TRANSITIONS[calibration.status]
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `No se puede pasar de ${calibration.status} a ${newStatus}`,
      )
    }

    const updateData: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'COMPLETED') updateData.completedAt = new Date()

    const updated = await this.prisma.calibration.update({
      where: { id },
      data: updateData,
      include: {
        template: { select: { id: true, name: true, code: true, periodicity: true } },
      },
    })

    // Al aprobar: crear la siguiente calibracion con dueDate
    if (newStatus === 'APPROVED' && updated.template.periodicity) {
      const nextDueDate = new Date()
      nextDueDate.setDate(nextDueDate.getDate() + updated.template.periodicity)

      await this.prisma.calibration.create({
        data: {
          organizationId,
          entryId: calibration.entryId,
          templateId: calibration.templateId,
          dueDate: nextDueDate,
        },
      })
    }

    return updated
  }

  async addPattern(id: string, organizationId: string, patternEntryId: string) {
    const calibration = await this.findById(id, organizationId)
    if (calibration.status === 'APPROVED') {
      throw new BadRequestException('No se pueden modificar patrones en una calibracion aprobada')
    }

    // Verificar que el patron exista y pertenezca a la misma org. El patrón es
    // una Entry de un Record `type=INSTRUMENTAL` (post-Records-as-Lists, ya no
    // hay tabla Instrument).
    const patternEntry = await this.prisma.entry.findFirst({
      where: { id: patternEntryId, record: { organizationId } },
      include: { record: { select: { type: true } } },
    })
    if (!patternEntry) throw new NotFoundException('Patron no encontrado')
    if (patternEntry.record.type !== 'INSTRUMENTAL') {
      throw new BadRequestException('La entrada seleccionada no es un instrumento')
    }

    try {
      await this.prisma.calibrationPattern.create({
        data: { calibrationId: id, patternEntryId },
      })
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Ese patron ya esta agregado a esta calibracion')
      }
      throw e
    }

    return this.findById(id, organizationId)
  }

  async removePattern(id: string, organizationId: string, calibrationPatternId: string) {
    const calibration = await this.findById(id, organizationId)
    if (calibration.status === 'APPROVED') {
      throw new BadRequestException('No se pueden modificar patrones en una calibracion aprobada')
    }

    const cp = await this.prisma.calibrationPattern.findFirst({
      where: { id: calibrationPatternId, calibrationId: id },
    })
    if (!cp) throw new NotFoundException('Patron de calibracion no encontrado')

    await this.prisma.calibrationPattern.delete({ where: { id: calibrationPatternId } })

    return this.findById(id, organizationId)
  }

  async saveResults(id: string, organizationId: string, results: Record<string, unknown>) {
    const calibration = await this.findById(id, organizationId)

    if (calibration.status === 'APPROVED') {
      throw new BadRequestException('No se pueden modificar resultados de una calibracion aprobada')
    }

    return this.prisma.calibration.update({
      where: { id },
      data: {
        results: results as Prisma.InputJsonValue,
      },
      include: {
        template: {
          include: {
            tests: {
              orderBy: { order: 'asc' },
              include: { points: { orderBy: { order: 'asc' } } },
            },
          },
        },
      },
    })
  }
}
