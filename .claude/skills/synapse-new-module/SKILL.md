---
name: synapse-new-module
description: Genera el scaffold de un nuevo módulo NestJS en apps/api/src/modules/ siguiendo las convenciones de Synapse — guards multitenant, DTO Zod, filtro organizationId en services, registro en app.module.ts y consideraciones para AuditLog y domain events. Invocar cuando se necesite crear un módulo backend nuevo.
---

# synapse-new-module

Crea un módulo NestJS conforme a las convenciones del workspace `apps/api`. El usuario provee el nombre del módulo y opcionalmente:
- Si emite domain events.
- Si tiene companion entity (Batch, Sample, Instrument, Calibration, etc.).
- Si requiere `AreaAccessGuard`.

## Pasos

### 1. Crear la estructura de carpetas

```
apps/api/src/modules/<module-name>/
  <module-name>.module.ts
  <module-name>.controller.ts
  <module-name>.service.ts
  dto/
    create-<entity>.dto.ts
    update-<entity>.dto.ts
  listeners/                 ← solo si consume domain events
    <event-name>.listener.ts
```

### 2. Plantilla `<module-name>.module.ts`

```typescript
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { <Entity>Controller } from './<module-name>.controller'
import { <Entity>Service } from './<module-name>.service'

@Module({
  imports: [PrismaModule],
  controllers: [<Entity>Controller],
  providers: [<Entity>Service],
  exports: [<Entity>Service],
})
export class <Entity>Module {}
```

### 3. Plantilla `<module-name>.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { <Entity>Service } from './<module-name>.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { create<Entity>Schema, update<Entity>Schema } from '@synapse/validators'

@Controller('<resource-path>')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class <Entity>Controller {
  constructor(private service: <Entity>Service) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.organizationId)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user.organizationId)
  }

  @Post()
  @Roles('ADMIN', 'QUALITY_MANAGER')
  create(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(create<Entity>Schema)) body: Create<Entity>Input,
  ) {
    return this.service.create(user.organizationId, user.sub, body)
  }

  @Patch(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(update<Entity>Schema)) body: Update<Entity>Input,
  ) {
    return this.service.update(id, user.organizationId, body)
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.remove(id, user.organizationId)
  }
}
```

### 4. Plantilla `<module-name>.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PrismaService } from '../../prisma/prisma.service'
import { Create<Entity>Input, Update<Entity>Input } from '@synapse/validators'

@Injectable()
export class <Entity>Service {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async findAll(organizationId: string) {
    return this.prisma.<entity>.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string, organizationId: string) {
    const entity = await this.prisma.<entity>.findFirst({
      where: { id, organizationId },
    })
    if (!entity) throw new NotFoundException('<Entity> no encontrado')
    return entity
  }

  async create(organizationId: string, createdById: string, data: Create<Entity>Input) {
    const created = await this.prisma.<entity>.create({
      data: { ...data, organizationId, createdById },
    })
    // this.eventEmitter.emit(<EventName>.EVENT_NAME, new <EventName>(...))
    return created
  }

  async update(id: string, organizationId: string, data: Update<Entity>Input) {
    const existing = await this.findById(id, organizationId)
    return this.prisma.<entity>.update({
      where: { id: existing.id },
      data,
    })
  }

  async remove(id: string, organizationId: string) {
    const existing = await this.findById(id, organizationId)
    return this.prisma.<entity>.delete({ where: { id: existing.id } })
  }
}
```

### 5. Registrar el módulo

Editar `apps/api/src/app.module.ts`:
- Importar `<Entity>Module` arriba.
- Agregar a `imports: []`.

### 6. Crear el schema Zod en `@synapse/validators`

Editar `packages/validators/src/index.ts` y crear `packages/validators/src/<entity>.ts` con `create<Entity>Schema` y `update<Entity>Schema`.

### 7. Si emite domain event

1. Agregar la clase de evento en `apps/api/src/common/events/domain-events.ts` con `EVENT_NAME` estático y `organizationId` en el payload.
2. Emitir en el service: `this.eventEmitter.emit(MyEvent.EVENT_NAME, new MyEvent(...))`.

### 8. Si consume domain event

Crear `listeners/<event>.listener.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { <SomeEvent> } from '../../../common/events/domain-events'

@Injectable()
export class <SomeEvent>Listener {
  private logger = new Logger(<SomeEvent>Listener.name)

  @OnEvent(<SomeEvent>.EVENT_NAME)
  async handle(event: <SomeEvent>) {
    try {
      // hacer algo, siempre filtrando por event.organizationId
    } catch (err) {
      this.logger.error('Error en listener', err)
      // no re-throwear
    }
  }
}
```

Registrar el listener como provider en el module.

### 9. Si tiene companion entity

Si la entity es 1:1 con `Entry` (BATCH/SAMPLE/INSTRUMENTAL/CALIBRATION/STOCK), seguir el patrón de los módulos existentes (`batches/`, `samples/`, `instruments/`, `calibrations/`):
- La companion se crea en `entries.service.create` cuando `record.type` corresponde.
- La companion tiene `entryId` único y FK a `Entry`.
- Cambios de estado de la companion van a un `*StatusLog` append-only.

## Recordatorios automáticos al usuario

Antes de terminar, recordar verificar:
- [ ] Enums nuevos en `packages/types/src/enums.ts`.
- [ ] Migración Prisma generada con `pnpm --filter @synapse/api db:migrate -- --name <descriptivo>`.
- [ ] Si la mutation toca tabla append-only, frenar y pedir confirmación.
- [ ] `pnpm --filter @synapse/api build` o `tsc --noEmit` pasa sin errores.
- [ ] Si requiere `AreaAccessGuard`, agregarlo al `@UseGuards()` en endpoints específicos.
- [ ] Considerar si necesita endpoint de listado paginado (límite default 50).

## NO hacer

- No crear servicios fuera de `modules/`.
- No usar `prisma.$queryRawUnsafe`.
- No olvidar `organizationId` en el `where` — esto rompe el aislamiento multitenant.
- No marcar el controller con `@AuditIgnore()` salvo justificación documentada.
