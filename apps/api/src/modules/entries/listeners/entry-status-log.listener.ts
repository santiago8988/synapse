import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../../prisma/prisma.service'
import { EntryFieldValueChangedEvent } from '../../../common/events/domain-events'

/**
 * Append-only writer para `EntryStatusLog`. Escucha los `EntryFieldValueChangedEvent`
 * y, cuando el field cambiado tiene `comparisonConfig.isStatus === true`,
 * escribe un row inmutable. Reemplaza progresivamente los logs específicos
 * (`InstrumentStatusLog`, `BatchStatusLog`, futura `SampleCustodyEvent`) con
 * un único paper trail unificado para ISO 9001 §8.5 / 17025 §7.5.
 *
 * REGLA ISO: la tabla EntryStatusLog es append-only. Este listener solo INSERTA.
 * Errores se loguean sin re-throw (el update original ya commiteó).
 */
@Injectable()
export class EntryStatusLogListener {
  private readonly logger = new Logger(EntryStatusLogListener.name)

  constructor(private prisma: PrismaService) {}

  @OnEvent(EntryFieldValueChangedEvent.EVENT_NAME)
  async handleFieldValueChanged(event: EntryFieldValueChangedEvent) {
    try {
      const field = await this.prisma.recordField.findUnique({
        where: { id: event.fieldId },
        select: { comparisonConfig: true },
      })

      if (!field) return

      const cfg = field.comparisonConfig as { isStatus?: boolean } | null
      if (!cfg || cfg.isStatus !== true) return

      await this.prisma.entryStatusLog.create({
        data: {
          entryId: event.entryId,
          recordId: event.recordId,
          organizationId: event.organizationId,
          fieldId: event.fieldId,
          fromValue: event.fromValue == null ? null : String(event.fromValue),
          toValue: String(event.toValue),
          changedById: event.changedById,
          triggeredByCascade: event.triggeredByCascade,
        },
      })
    } catch (err) {
      this.logger.error(
        `Error escribiendo EntryStatusLog para entry=${event.entryId} field=${event.fieldId}`,
        err,
      )
    }
  }
}
