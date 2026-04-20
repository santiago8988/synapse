import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'
import { EntryCompletedEvent } from '../../../common/events/domain-events'

/**
 * Escucha EntryCompletedEvent y crea la próxima entry programada
 * para registros de tipo PERIODIC.
 * Copia los campos identifier de la entry completada a la nueva.
 */
@Injectable()
export class DueDateListener {
  private readonly logger = new Logger(DueDateListener.name)

  constructor(private prisma: PrismaService) {}

  @OnEvent(EntryCompletedEvent.EVENT_NAME)
  async handleEntryCompleted(event: EntryCompletedEvent) {
    this.logger.log(`EntryCompleted: entryId=${event.entryId}, recordType=${event.record.type}, periodicity=${event.record.periodicity}`)

    if (event.record.type !== 'PERIODIC' || !event.record.periodicity) {
      this.logger.log('Skipping: not PERIODIC or no periodicity')
      return
    }

    // Traer la entry completada con sus datos
    const completedEntry = await this.prisma.entry.findUnique({
      where: { id: event.entryId },
    })
    if (!completedEntry) {
      this.logger.warn('Completed entry not found')
      return
    }

    // Traer los campos identifier del record para copiarlos
    const identifierFields = await this.prisma.recordField.findMany({
      where: {
        recordId: event.recordId,
        isActive: true,
        isIdentifier: true,
      },
    })

    // Copiar solo los valores de campos identifier
    const completedData = completedEntry.data as Record<string, unknown>
    const nextData: Record<string, unknown> = {}
    for (const field of identifierFields) {
      if (completedData[field.id] !== undefined) {
        nextData[field.id] = completedData[field.id]
      }
    }

    // Calcular próxima dueDate
    const nextDueDate = new Date()
    nextDueDate.setDate(nextDueDate.getDate() + event.record.periodicity)

    this.logger.log(`Creating next entry: identifiers=${JSON.stringify(nextData)}, dueDate=${nextDueDate.toISOString()}`)

    await this.prisma.entry.create({
      data: {
        recordId: event.recordId,
        createdById: completedEntry.createdById,
        recordVersion: completedEntry.recordVersion,
        data: nextData as Prisma.InputJsonValue,
        dueDate: nextDueDate,
        status: 'DRAFT',
      },
    })

    this.logger.log('Next periodic entry created successfully')
  }
}
