import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common'
import { RecordsService } from './records.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { ZodBody } from '../../common/decorators/zod-body.decorator'
import {
  createRecordSchema,
  editRecordSchema,
  type CreateRecordInput,
  type EditRecordInput,
} from '@synapse/validators'

@Controller('records')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class RecordsController {
  constructor(private service: RecordsService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('archived') archived?: string,
    @Query('status') status?: string,
  ) {
    return this.service.findAll(user.organizationId, archived === 'true', status)
  }

  @Post()
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @ZodBody(createRecordSchema)
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateRecordInput) {
    return this.service.create(user.organizationId, user.sub, body)
  }

  /**
   * Mapa global de flujos de la organizacion: todas las RecordAction con sus
   * registros origen y destino. Se declara antes de @Get(':id') para que la
   * ruta no la capture el parametro.
   */
  @Get('flows/overview')
  flowsOverview(@CurrentUser() user: JwtPayload) {
    return this.service.listAllActions(user.organizationId)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user.organizationId)
  }

  @Patch(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @ZodBody(editRecordSchema)
  editWithVersion(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: EditRecordInput,
  ) {
    return this.service.editWithVersion(id, user.organizationId, body)
  }

  @Delete(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  archive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.archive(id, user.organizationId)
  }

  @Post(':id/restore')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  restore(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.restore(id, user.organizationId)
  }

  // Los flujos (RecordAction) viven en RecordActionsController: el
  // AuditInterceptor deriva la entidad del nombre del controller, y aca
  // quedaban registrados como records.* con el id del registro.
}
