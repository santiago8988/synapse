import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../../prisma/prisma.service'
import { EntryCreatedEvent } from '../../../common/events/domain-events'

/**
 * Escucha EntryCreatedEvent y, si el record es tipo INSTRUMENTAL,
 * crea automaticamente un Instrument linkeado 1:1 con la entry.
 * Si el record tiene un campo CALIBRATION_TEMPLATE, tambien crea
 * la primera Calibration asociada al instrumento.
 */
@Injectable()
export class InstrumentListener {
  constructor(private prisma: PrismaService) {}

  @OnEvent(EntryCreatedEvent.EVENT_NAME)
  async handleEntryCreated(event: EntryCreatedEvent) {
    const record = await this.prisma.record.findUnique({
      where: { id: event.recordId },
      include: { fields: { where: { isActive: true } } },
    })
    if (!record || record.type !== 'INSTRUMENTAL') return

    // Calcular proxima calibracion externa si hay periodicity en el record
    let nextCalibrationAt: Date | null = null
    if (record.periodicity) {
      nextCalibrationAt = new Date()
      nextCalibrationAt.setDate(nextCalibrationAt.getDate() + record.periodicity)
    }

    const instrument = await this.prisma.instrument.create({
      data: {
        organizationId: event.organizationId,
        entryId: event.entryId,
        recordId: event.recordId,
        status: 'ACTIVE',
        nextCalibrationAt,
      },
    })

    // Si hay campo CALIBRATION_TEMPLATE, crear primera calibracion interna
    const templateField = record.fields.find((f) => f.fieldType === 'CALIBRATION_TEMPLATE')
    if (templateField && event.data[templateField.id]) {
      const templateId = String(event.data[templateField.id])

      // Obtener periodicidad de la plantilla
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
  }
}
