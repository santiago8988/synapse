import { Module } from '@nestjs/common'
import { EventEmitterModule } from '@nestjs/event-emitter'

@Module({
  imports: [
    EventEmitterModule.forRoot({
      // Permitir wildcards para suscribirse a grupos de eventos (ej: 'entry.*')
      wildcard: true,
      delimiter: '.',
    }),
  ],
})
export class EventsModule {}
