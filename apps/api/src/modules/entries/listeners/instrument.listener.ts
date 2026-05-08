import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../../prisma/prisma.service'
import { EntryCreatedEvent } from '../../../common/events/domain-events'
import { Prisma } from '@prisma/client'

/**
 * Listener para Records `type=INSTRUMENTAL` post-colapso (Records-as-Lists).
 *
 * Antes: creaba la companion `Instrument` 1:1 con la Entry. Eso ya no aplica
 * — la tabla `Instrument` fue dropeada en `20260508130000_collapse_instrument`
 * y el "instrumento" es la Entry misma.
 *
 * Ahora hace dos side-effects de creación:
 *  1) Si el Record tiene `periodicity`, patchea `Entry.data.nextCalibrationAt`
 *     con `now() + periodicity` (lo que antes se guardaba en la columna
 *     `Instrument.nextCalibrationAt`).
 *  2) Si la Entry incluye un field `CALIBRATION_TEMPLATE`, crea la primer
 *     `Calibration` apuntando a la Entry. La FK `Calibration.entryId` no
 *     requirió cambios — ya apuntaba a Entry.
 *
 * Errores logueados sin re-throw — la Entry ya commiteó.
 */
@Injectable()
export class InstrumentListener {
  private readonly logger = new Logger(InstrumentListener.name)

  constructor(private prisma: PrismaService) {}

  @OnEvent(EntryCreatedEvent.EVENT_NAME)
  async handleEntryCreated(event: EntryCreatedEvent) {
    try {
      const record = await this.prisma.record.findUnique({
        where: { id: event.recordId },
        include: { fields: { where: { isActive: true } } },
      })
      if (!record || record.type !== 'INSTRUMENTAL') return

      // 1. Patchear Entry.data.nextCalibrationAt si hay periodicity.
      if (record.periodicity) {
        const nextCalibrationAt = new Date()
        nextCalibrationAt.setDate(nextCalibrationAt.getDate() + record.periodicity)

        const entry = await this.prisma.entry.findUnique({
          where: { id: event.entryId },
          select: { data: true },
        })
        const data = (entry?.data ?? {}) as Record<string, unknown>
        if (data.nextCalibrationAt === undefined) {
          const newData: Prisma.InputJsonValue = {
            ...data,
            nextCalibrationAt: nextCalibrationAt.toISOString(),
          }
          await this.prisma.entry.update({
            where: { id: event.entryId },
            data: { data: newData },
          })
        }
      }

      // 2. Crear primera Calibration si hay campo CALIBRATION_TEMPLATE.
      const templateField = record.fields.find((f) => f.fieldType === 'CALIBRATION_TEMPLATE')
      if (templateField && event.data[templateField.id]) {
        const templateId = String(event.data[templateField.id])

        const template = await this.prisma.calibrationTemplate.findUnique({
          where: { id: templateId },
        })

        let dueDate: Date | null = null
        if (template?.periodicity) {
          dueDate = new Date()
          dueDate.setDate(dueDate.getDate() + template.periodicity)
        }

        await this.prisma.calibration.create({
          data: {
            organizationId: event.organizationId,
            entryId: event.entryId,
            templateId,
            dueDate,
          },
        })
      }
    } catch (err) {
      this.logger.error(
        `Error en InstrumentListener para entry=${event.entryId} record=${event.recordId}`,
        err,
      )
    }
  }
}
