import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { PrismaService } from '../../../prisma/prisma.service'
import { EntryCreatedEvent } from '../../../common/events/domain-events'

/**
 * Escucha EntryCreatedEvent y crea NonConformities automáticas
 * cuando una comparación falla.
 */
@Injectable()
export class NonConformityListener {
  constructor(private prisma: PrismaService) {}

  @OnEvent(EntryCreatedEvent.EVENT_NAME)
  async handleEntryCreated(event: EntryCreatedEvent) {
    for (const [fieldId, result] of Object.entries(event.comparisonResults)) {
      if (!result.passed) {
        const field = event.record.fields.find((f) => f.id === fieldId)
        await this.prisma.nonConformity.create({
          data: {
            organizationId: event.organizationId,
            entryId: event.entryId,
            fieldId,
            title: `Comparación fallida: ${field?.label || fieldId}`,
            description: result.description,
            createdById: event.createdById,
          },
        })
      }
    }
  }
}
