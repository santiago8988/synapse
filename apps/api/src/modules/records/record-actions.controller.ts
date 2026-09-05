import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { RecordsService } from './records.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { Prisma } from '@prisma/client'

/**
 * Flujos (`RecordAction`) de un registro.
 *
 * **Existe como controller propio por el AuditLog.** El `AuditInterceptor`
 * deriva el tipo de entidad del nombre de la clase, así que mientras estos
 * cuatro endpoints vivían en `RecordsController` todo cambio de flujo quedaba
 * escrito como `records.*` con el id del **registro**: crear un flujo aparecía
 * como `records.created` y borrarlo como `records.deleted`, que en el registro
 * de auditoría se lee como si se hubiera borrado el registro entero. Y el
 * `before` que se capturaba era la fila del `Record`, que no había cambiado.
 *
 * Acá el tipo derivado es `RECORD_ACTIONS` y el id es el del flujo, de modo que
 * el interceptor puede leer el estado previo del flujo y guardarlo. Un flujo
 * crea entradas, modifica campos y manda datos afuera por webhook: cómo estaba
 * configurado antes de un cambio es exactamente lo que una auditoría necesita
 * poder reconstruir.
 *
 * El parámetro del flujo se llama `id` —y no `actionId`— porque es de ahí de
 * donde el interceptor toma el `entityId`.
 */
@Controller('records/:recordId/actions')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class RecordActionsController {
  constructor(private service: RecordsService) {}

  @Get()
  list(@Param('recordId') recordId: string, @CurrentUser() user: JwtPayload) {
    return this.service.listActions(recordId, user.organizationId)
  }

  @Post()
  @Roles('ADMIN', 'QUALITY_MANAGER')
  create(
    @Param('recordId') recordId: string,
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      targetRecordId: string
      fieldMapping: Array<{ sourceFieldId: string; targetFieldId: string }>
      trigger?: 'ENTRY_CREATED' | 'ENTRY_COMPLETED' | 'FIELD_VALUE_CHANGED' | 'COMPARISON_FAILED'
      condition?: Prisma.InputJsonValue | null
      allowCascade?: boolean
      actionType?: 'CREATE_ENTRY' | 'UPDATE_FIELD' | 'NOTIFY' | 'EMAIL' | 'WEBHOOK'
      actionConfig?: Prisma.InputJsonValue | null
    },
  ) {
    return this.service.addAction(recordId, user.organizationId, body)
  }

  @Patch(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  update(
    @Param('recordId') recordId: string,
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body()
    body: {
      targetRecordId?: string
      fieldMapping?: Array<{ sourceFieldId: string; targetFieldId: string }>
      trigger?: 'ENTRY_CREATED' | 'ENTRY_COMPLETED' | 'FIELD_VALUE_CHANGED' | 'COMPARISON_FAILED'
      condition?: Prisma.InputJsonValue | null
      allowCascade?: boolean
      actionType?: 'CREATE_ENTRY' | 'UPDATE_FIELD' | 'NOTIFY' | 'EMAIL' | 'WEBHOOK'
      actionConfig?: Prisma.InputJsonValue | null
    },
  ) {
    return this.service.updateAction(recordId, id, user.organizationId, body)
  }

  @Delete(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  remove(
    @Param('recordId') recordId: string,
    @Param('id') id: string,
    // La organización sale del JWT, nunca de la ruta: es lo que impide borrar
    // el flujo de otra organización pasando su id.
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.deleteAction(recordId, id, user.organizationId)
  }
}
