---
name: synapse-domain-event
description: Scaffold para definir, emitir y consumir un domain event en Synapse. Recuerda incluir organizationId en el payload, naming consistente (entity.action), captura de errores en listeners (no re-throw) y registro como provider.
---

# synapse-domain-event

Asistencia para trabajar con domain events de Synapse. Los eventos viven en `apps/api/src/common/events/domain-events.ts` y se emiten/consumen vía `EventEmitter2` de `@nestjs/event-emitter`.

## Eventos existentes (para referencia)

```typescript
// apps/api/src/common/events/domain-events.ts
EntryCreatedEvent          → 'entry.created'
EntryCompletedEvent        → 'entry.completed'
InstrumentStatusChangedEvent → 'instrument.statusChanged'
NonConformityCreatedEvent  → 'nonConformity.created'
DocumentVersionCreatedEvent → 'document.versionCreated'
```

## Patrón

### 1. Definir el evento

Editar `apps/api/src/common/events/domain-events.ts`:

```typescript
export class <Entity><Action>Event {
  static readonly EVENT_NAME = '<entity>.<action>'

  constructor(
    public readonly <entity>Id: string,
    public readonly organizationId: string,    // SIEMPRE
    // ...campos relevantes
  ) {}
}
```

**Reglas**:
- Naming: `<entity>.<action>` en `EVENT_NAME` (camelCase para entity, camelCase para action). Ejemplos: `entry.created`, `instrument.statusChanged`, `document.versionCreated`.
- Clase: `<Entity><Action>Event` en PascalCase.
- `organizationId` **siempre** en el payload — es esencial para que los listeners filtren correctamente.
- Inmutable: solo `readonly` en el constructor.
- No incluir secretos ni payloads enormes. Si el listener necesita más data, que la traiga de la DB con el id.

### 2. Emitir desde un service

```typescript
import { EventEmitter2 } from '@nestjs/event-emitter'
import { <Entity><Action>Event } from '../../common/events/domain-events'

@Injectable()
export class <Entity>Service {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async someMutation(...) {
    const result = await this.prisma.<entity>.create({ ... })
    
    this.eventEmitter.emit(
      <Entity><Action>Event.EVENT_NAME,
      new <Entity><Action>Event(result.id, organizationId, ...),
    )
    
    return result
  }
}
```

**Reglas**:
- Emitir **después** de que la mutation Prisma se persiste exitosamente.
- Si la mutation está dentro de una transacción, emitir **después** del commit. Eventos no-transaccionales con mutations a medio commitear son una fuente de bugs.
- Un evento por cambio de estado real, no por iteración.

### 3. Consumir en un listener

Crear `apps/api/src/modules/<modulo>/listeners/<event-name>.listener.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { <Entity><Action>Event } from '../../../common/events/domain-events'
import { PrismaService } from '../../../prisma/prisma.service'

@Injectable()
export class <Entity><Action>Listener {
  private logger = new Logger(<Entity><Action>Listener.name)

  constructor(private prisma: PrismaService) {}

  @OnEvent(<Entity><Action>Event.EVENT_NAME)
  async handle(event: <Entity><Action>Event) {
    try {
      // Hacer side-effect:
      // - Crear NC automática
      // - Crear próxima Entry PERIODIC
      // - Disparar cascada de RecordAction
      // - Notificar via BullMQ
      
      // SIEMPRE filtrar por event.organizationId al hacer queries
      await this.prisma.<algo>.create({
        data: { organizationId: event.organizationId, /* ... */ },
      })
    } catch (err) {
      this.logger.error(
        `Error en ${<Entity><Action>Listener.name} para evento ${JSON.stringify(event)}`,
        err,
      )
      // NO re-throwear: la mutation original ya commiteó.
      // Si el listener falla, el sistema queda con un side-effect pendiente
      // que un operador puede resolver manualmente con la info del log.
    }
  }
}
```

**Reglas**:
- **Nunca re-throwear**. La mutation que disparó el evento ya ocurrió. Re-throwear desde un listener no la rollbackea (los listeners corren después del commit) y solo confunde la respuesta HTTP.
- **Siempre logguear con contexto**: incluir el evento serializado en el log para debugging.
- **Siempre filtrar queries por `organizationId`**: no asumir que el evento "ya está aislado".
- Listeners **no escriben automáticamente al `AuditLog`** (no pasan por el `AuditInterceptor`). Si la mutation del listener es relevante para auditoría, escribir manualmente.

### 4. Registrar el listener

En `<modulo>.module.ts`:

```typescript
@Module({
  imports: [PrismaModule],
  controllers: [<Entity>Controller],
  providers: [
    <Entity>Service,
    <Entity><Action>Listener,    // ← agregar acá
  ],
})
export class <Entity>Module {}
```

NestJS instancia el listener al arrancar el módulo y registra el `@OnEvent`.

### 5. Verificación

- `pnpm --filter @synapse/api build` pasa sin errores.
- Disparar manualmente la mutation que emite el evento (vía API o seed) y verificar en logs que el listener se ejecutó.
- Si el listener crea nuevas entidades, verificar en la DB que tienen el `organizationId` correcto.

## Ejemplo de loop a evitar

Si un listener emite un evento que él mismo (u otro listener) escucha:
```
EntryCreated → MyListener → emit EntryCreated → ∞
```

**Mitigación**:
- Filtrar en el listener: `if (event.someFlag) return` para no recursar.
- Emitir un evento diferente para el side-effect: `EntryCreatedFromCascadeEvent` distinto de `EntryCreatedEvent`.
- O, simplemente, no emitir desde listeners de dominio — solo desde services con context HTTP.

## NO hacer

- No emitir eventos sincronos que esperen respuesta (no es ese el patrón). Si necesitás respuesta, llamá al service directamente.
- No usar `EventEmitter2` para comunicación cross-module sincrónica de respuestas — eso es un anti-pattern.
- No omitir `organizationId` del payload "porque el listener lo deduce".
- No escribir lógica de negocio crítica en listeners. Si algo **debe** pasar, que sea parte de la transacción del service. Listeners son para side-effects best-effort.
