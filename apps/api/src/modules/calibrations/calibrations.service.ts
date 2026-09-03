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

// Flujo simplificado: COMPLETED es el estado final (no requiere aprobación
// adicional). REJECTED se mantiene por si en un futuro se reincorpora rechazo
// manual; APPROVED queda solo para data legacy (calibraciones antiguas).
const VALID_TRANSITIONS: Record<CalibrationStatus, CalibrationStatus[]> = {
  IN_PROGRESS: ['COMPLETED', 'REJECTED'],
  COMPLETED: [],
  APPROVED: [],
  REJECTED: ['IN_PROGRESS'],
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
            record: { select: { id: true, name: true } },
            instrument: { select: { id: true, status: true } },
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
                fields: { where: { isActive: true }, orderBy: { order: 'asc' }, select: { id: true, label: true, fieldType: true } },
              },
            },
            instrument: { select: { id: true, status: true } },
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

    // Validaciones específicas al pasar a COMPLETED desde IN_PROGRESS:
    //   1. Al menos 1 patrón asociado.
    //   2. Todos los tests del template tienen lecturas completas en cada
    //      uno de sus puntos (no se permite calibración a medias).
    if (newStatus === 'COMPLETED' && calibration.status === 'IN_PROGRESS') {
      if (calibration.patterns.length === 0) {
        throw new BadRequestException(
          'Asociá al menos un patrón antes de completar la calibración.',
        )
      }

      const results = (calibration.results ?? {}) as Record<
        string,
        Record<string, { readings?: unknown }>
      >
      const tests = calibration.template?.tests ?? []
      for (const test of tests) {
        const testResults = results[test.id] || {}
        for (const point of test.points) {
          const pr = testResults[point.id]
          const readings = Array.isArray(pr?.readings) ? pr!.readings : []
          const validReadings = readings.filter(
            (r) => typeof r === 'number' && !Number.isNaN(r) && r !== 0,
          )
          if (validReadings.length === 0) {
            throw new BadRequestException(
              `Falta cargar lecturas: prueba "${test.name}", punto "${point.name}".`,
            )
          }
        }
      }
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

    // Al COMPLETAR (estado final del flujo nuevo): crear la siguiente
    // calibración con dueDate = ahora + periodicity de la plantilla.
    // Antes esto se hacía al APROBAR, pero con el flujo simplificado el
    // técnico cierra el ciclo en una sola acción.
    if (newStatus === 'COMPLETED' && updated.template.periodicity) {
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
    if (calibration.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Solo se pueden modificar patrones mientras la calibración está en progreso',
      )
    }

    // Verificar que el patron exista y pertenezca a la misma org. Traigo
    // tambien el record (con field identifier) para construir el snapshot.
    const patternEntry = await this.prisma.entry.findFirst({
      where: { id: patternEntryId, record: { organizationId } },
      include: {
        instrument: true,
        record: {
          select: {
            name: true,
            fields: {
              where: { isActive: true, isIdentifier: true },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    })
    if (!patternEntry) throw new NotFoundException('Patron no encontrado')
    if (!patternEntry.instrument) {
      throw new BadRequestException('La entrada seleccionada no es un instrumento')
    }

    // Snapshot al momento de asociar el patrón. Esto persiste la evidencia
    // ISO: si después cambia el código, el status o la próxima calibración
    // del patrón, la calibración pasada NO se ve afectada.
    const identifierFieldId = patternEntry.record.fields[0]?.id
    const data = (patternEntry.data ?? {}) as Record<string, unknown>
    const snapshotIdentifier = identifierFieldId
      ? data[identifierFieldId] != null
        ? String(data[identifierFieldId])
        : null
      : null

    try {
      await this.prisma.calibrationPattern.create({
        data: {
          calibrationId: id,
          patternEntryId,
          snapshotIdentifier,
          snapshotRecordName: patternEntry.record.name,
          snapshotInstrumentStatus: patternEntry.instrument.status,
          snapshotNextCalibrationAt: patternEntry.instrument.nextCalibrationAt,
        },
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
    if (calibration.status !== 'IN_PROGRESS') {
      throw new BadRequestException(
        'Solo se pueden modificar patrones mientras la calibración está en progreso',
      )
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
