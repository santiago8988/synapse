import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../../prisma/prisma.service'
import {
  EntryCompletedEvent,
  EntryFieldValueChangedEvent,
} from '../../../common/events/domain-events'
import { Prisma } from '@prisma/client'

/**
 * Listener genérico que reproduce los side-effects que tradicionalmente vivían
 * en `instruments.service.changeStatus` (y que progresivamente vivirán acá
 * para cada companion colapsada). Escucha `EntryFieldValueChangedEvent` y
 * actúa cuando el field es un DROPDOWN-as-status:
 *
 *  - Si la option destino tiene `isFinal === true`, marca la Entry como
 *    COMPLETED + completedAt y emite `EntryCompletedEvent` para mantener la
 *    semántica del flow legacy (próxima entry periódica, NCs automáticas, etc.).
 *    Aplica para cualquier Record con field isStatus, no solo INSTRUMENTAL.
 *
 *  - Si `record.type === 'INSTRUMENTAL'` y la transición es
 *    `IN_CALIBRATION → ACTIVE` con `record.periodicity` definido, recalcula
 *    `Entry.data.nextCalibrationAt = now() + periodicity` y patchea la entry
 *    directamente (sin pasar por entries.service.update — evita re-emitir el
 *    EntryFieldValueChangedEvent y un loop innecesario).
 *
 * Errores logueados sin re-throw — el update original ya commiteó.
 *
 * En iteraciones futuras los side-effects específicos por record.type se
 * generalizarán como RecordAction declarativos (actionType: UPDATE_FIELD).
 */
@Injectable()
export class EntryCompletionListener {
  private readonly logger = new Logger(EntryCompletionListener.name)

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  @OnEvent(EntryFieldValueChangedEvent.EVENT_NAME)
  async handleFieldValueChanged(event: EntryFieldValueChangedEvent) {
    try {
      const field = await this.prisma.recordField.findUnique({
        where: { id: event.fieldId },
        select: { comparisonConfig: true, recordId: true },
      })
      if (!field) return

      const cfg = field.comparisonConfig as
        | {
            isStatus?: boolean
            options?: Array<{ value?: string; isFinal?: boolean }>
          }
        | null
      if (!cfg || cfg.isStatus !== true) return

      const toValue = String(event.toValue)
      const targetOption = (cfg.options ?? []).find(
        (o) => o && typeof o === 'object' && o.value === toValue,
      )

      // Side-effect 1: option final → marcar entry COMPLETED.
      if (targetOption?.isFinal === true) {
        await this.markEntryCompleted(event)
      }

      // Side-effect 2: recálculo de nextCalibrationAt para INSTRUMENTAL.
      if (
        String(event.fromValue) === 'IN_CALIBRATION' &&
        toValue === 'ACTIVE'
      ) {
        await this.recalcNextCalibrationAt(event)
      }
    } catch (err) {
      this.logger.error(
        `Error en EntryCompletionListener para entry=${event.entryId} field=${event.fieldId}`,
        err,
      )
    }
  }

  private async markEntryCompleted(event: EntryFieldValueChangedEvent) {
    const entry = await this.prisma.entry.findUnique({
      where: { id: event.entryId },
      select: { status: true },
    })
    if (!entry || entry.status === 'COMPLETED') return

    await this.prisma.entry.update({
      where: { id: event.entryId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })

    const record = await this.prisma.record.findUnique({
      where: { id: event.recordId },
      select: { id: true, type: true, periodicity: true, organizationId: true },
    })
    if (!record) return

    this.eventEmitter.emit(
      EntryCompletedEvent.EVENT_NAME,
      new EntryCompletedEvent(
        event.entryId,
        event.recordId,
        record.organizationId,
        { type: record.type, periodicity: record.periodicity },
      ),
    )

    this.logger.log(
      `Entry ${event.entryId} marcada COMPLETED por transición a option isFinal (field=${event.fieldId}, toValue=${event.toValue})`,
    )
  }

  private async recalcNextCalibrationAt(event: EntryFieldValueChangedEvent) {
    const record = await this.prisma.record.findUnique({
      where: { id: event.recordId },
      select: { type: true, periodicity: true },
    })
    if (!record || record.type !== 'INSTRUMENTAL' || !record.periodicity) return

    const entry = await this.prisma.entry.findUnique({
      where: { id: event.entryId },
      select: { data: true },
    })
    if (!entry) return

    const next = new Date()
    next.setDate(next.getDate() + record.periodicity)

    const data = (entry.data ?? {}) as Record<string, unknown>
    const newData: Prisma.InputJsonValue = {
      ...data,
      nextCalibrationAt: next.toISOString(),
    }

    await this.prisma.entry.update({
      where: { id: event.entryId },
      data: { data: newData },
    })

    this.logger.log(
      `nextCalibrationAt recalculado para entry ${event.entryId} (record INSTRUMENTAL, periodicity=${record.periodicity})`,
    )
  }
}
