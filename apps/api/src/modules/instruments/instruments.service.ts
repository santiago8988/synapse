import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { EntriesService } from '../entries/entries.service'
import type { UserRole } from '@synapse/types'

/**
 * Wrapper sobre `entries` post-colapso (Records-as-Lists). La tabla `Instrument`
 * fue dropeada en `20260508130000_collapse_instrument`. El "instrumento" es
 * ahora una Entry de un Record `type=INSTRUMENTAL` con un field DROPDOWN
 * `isStatus=true` que guarda el estado.
 *
 * Los endpoints `/instruments/*` siguen respondiendo (sin breaking changes en
 * el frontend legacy) — internamente delegan a `EntriesService` y consultan
 * `EntryStatusLog` para el historial.
 */
@Injectable()
export class InstrumentsService {
  constructor(
    private prisma: PrismaService,
    private entries: EntriesService,
  ) {}

  /** Resuelve el field DROPDOWN-as-status de un Record INSTRUMENTAL. Null si no existe. */
  private getStatusField(
    fields: Array<{ id: string; fieldType: string; comparisonConfig: unknown; isActive?: boolean }>,
  ): { id: string } | null {
    const f = fields.find((field) => {
      if (field.fieldType !== 'DROPDOWN') return false
      if (field.isActive === false) return false
      const cfg = field.comparisonConfig as { isStatus?: boolean } | null
      return cfg?.isStatus === true
    })
    return f ? { id: f.id } : null
  }

  /** Lista entries de records INSTRUMENTAL con resolved status field. */
  async findAll(organizationId: string, filters?: { status?: string; recordId?: string }) {
    const entries = await this.prisma.entry.findMany({
      where: {
        record: {
          organizationId,
          type: 'INSTRUMENTAL',
          ...(filters?.recordId && { id: filters.recordId }),
        },
      },
      include: {
        record: {
          select: {
            id: true,
            name: true,
            periodicity: true,
            notifyDaysBefore: true,
            fields: {
              where: { isActive: true },
              orderBy: { order: 'asc' },
              select: {
                id: true,
                label: true,
                fieldType: true,
                isIdentifier: true,
                comparisonConfig: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Si filters.status presente, filtrar leyendo del statusFieldId por record.
    return entries
      .filter((e) => {
        if (!filters?.status) return true
        const statusField = this.getStatusField(e.record.fields)
        if (!statusField) return false
        const data = (e.data ?? {}) as Record<string, unknown>
        return String(data[statusField.id] ?? '') === filters.status
      })
      .map((e) => this.resolveStatus(e))
  }

  /** Patrones = entries INSTRUMENTAL ACTIVE en records sin field CALIBRATION_TEMPLATE. */
  async findPatterns(organizationId: string) {
    const all = await this.findAll(organizationId, { status: 'ACTIVE' })
    return all.filter(
      (e) => !e.record.fields.some((f) => f.fieldType === 'CALIBRATION_TEMPLATE'),
    )
  }

  async findById(id: string, organizationId: string) {
    const entry = await this.prisma.entry.findFirst({
      where: { id, record: { organizationId, type: 'INSTRUMENTAL' } },
      include: {
        record: {
          select: {
            id: true,
            name: true,
            periodicity: true,
            notifyDaysBefore: true,
            fields: {
              where: { isActive: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    })
    if (!entry) throw new NotFoundException('Instrumento no encontrado')

    const resolved = this.resolveStatus(entry)
    const statusField = this.getStatusField(entry.record.fields)
    const statusLogs = statusField
      ? await this.prisma.entryStatusLog.findMany({
          where: { entryId: id, fieldId: statusField.id },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : []

    return { ...resolved, statusLogs }
  }

  /**
   * Cambia el estado del instrumento (Entry). Wrapper sobre EntriesService.update
   * con patch del statusFieldId. Side-effects (transition validation,
   * EntryStatusLog write, recálculo de nextCalibrationAt) los manejan los
   * listeners genéricos.
   */
  async changeStatus(
    id: string,
    organizationId: string,
    toStatus: string,
    reason: string | null,
    changedById: string,
    userRole: UserRole,
  ) {
    const entry = await this.prisma.entry.findFirst({
      where: { id, record: { organizationId, type: 'INSTRUMENTAL' } },
      include: {
        record: { include: { fields: { where: { isActive: true } } } },
      },
    })
    if (!entry) throw new NotFoundException('Instrumento no encontrado')

    const statusField = this.getStatusField(entry.record.fields)
    if (!statusField) {
      throw new BadRequestException(
        'El record INSTRUMENTAL no tiene un field DROPDOWN configurado como status (isStatus: true)',
      )
    }

    const existingData = (entry.data ?? {}) as Record<string, unknown>
    const newData = { ...existingData, [statusField.id]: toStatus }

    // Delegamos al flow estándar de update — el TransitionValidator valida
    // transitions, los listeners escriben EntryStatusLog y recalculan
    // nextCalibrationAt cuando aplica.
    return this.entries.update(
      id,
      entry.recordId,
      newData,
      changedById,
      userRole,
      reason ?? undefined,
    )
  }

  /** Decora una Entry INSTRUMENTAL con su status canónico (resolved del field DROPDOWN). */
  private resolveStatus<
    T extends {
      data: unknown
      record: {
        fields: Array<{ id: string; fieldType: string; comparisonConfig: unknown; isActive?: boolean }>
      }
    },
  >(entry: T): T & { status: string | null; nextCalibrationAt: string | null } {
    const statusField = this.getStatusField(entry.record.fields)
    const data = (entry.data ?? {}) as Record<string, unknown>
    const status = statusField ? String(data[statusField.id] ?? '') || null : null
    const nextCalibrationAt = (data.nextCalibrationAt as string | undefined) ?? null
    return { ...entry, status, nextCalibrationAt }
  }
}
