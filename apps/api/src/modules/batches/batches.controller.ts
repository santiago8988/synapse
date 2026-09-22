import { Controller, Get, Post, Delete, Patch, Param, Query, Body, UseGuards } from '@nestjs/common'
import { BatchesService } from './batches.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { ZodBody } from '../../common/decorators/zod-body.decorator'
import {
  assignInstrumentSchema,
  type AssignInstrumentInput,
  changeBatchStatusSchema,
  consumeStockSchema,
  completeBatchSchema,
  updateBatchSchema,
  type ChangeBatchStatusInput,
  type ConsumeStockInput,
  type CompleteBatchInput,
  type UpdateBatchInput,
} from '@synapse/validators'

@Controller('batches')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class BatchesController {
  constructor(private service: BatchesService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('recordId') recordId?: string,
  ) {
    return this.service.findAll(user.organizationId, { status, recordId })
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user.organizationId)
  }

  @Post(':id/status')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  @ZodBody(changeBatchStatusSchema)
  changeStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: ChangeBatchStatusInput,
  ) {
    return this.service.changeStatus(
      id,
      user.organizationId,
      user.sub,
      body.status,
      { producedQuantity: body.producedQuantity, unit: body.unit, reason: body.reason },
    )
  }

  /**
   * Disponibilidad de stock para la formula del lote, antes de iniciar.
   *
   * Es de lectura, asi que no muta nada y `@AuditIgnore` no aplica: el
   * interceptor solo loguea POST/PATCH/PUT/DELETE.
   */
  @Get(':id/stock-check')
  checkStock(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.checkStock(id, user.organizationId)
  }

  /** PLANIFICADO -> EN PRODUCCION, sin tocar el inventario. */
  @Post(':id/start')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  start(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.start(id, user.organizationId, user.sub)
  }

  /** EN PRODUCCION -> COMPLETADO, registrando los egresos de stock. */
  @Post(':id/complete')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  @ZodBody(completeBatchSchema)
  complete(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: CompleteBatchInput,
  ) {
    return this.service.complete(id, user.organizationId, user.sub, body)
  }

  @Post(':id/consume-stock')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  @ZodBody(consumeStockSchema)
  consumeStock(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: ConsumeStockInput,
  ) {
    return this.service.consumeStock(id, user.organizationId, user.sub, body.consumptions)
  }

  @Patch(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  @ZodBody(updateBatchSchema)
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: UpdateBatchInput,
  ) {
    return this.service.update(id, user.organizationId, body)
  }
  // ─── Trazabilidad de instrumental (ISO 17025 §6.4) ────────────────────────

  /**
   * Asigna un instrumento real a una etiqueta que la plantilla requiere.
   *
   * Es idempotente por etiqueta: volver a asignar la misma etiqueta cambia el
   * equipo en vez de fallar, porque corregir a que equipo se apunto es normal
   * mientras la corrida esta abierta.
   */
  @Post(':id/instrument-assignments')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  @ZodBody(assignInstrumentSchema)
  assignInstrument(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: AssignInstrumentInput,
  ) {
    return this.service.assignInstrument(id, user.organizationId, user.sub, body)
  }

  @Delete(':id/instrument-assignments/:assignmentId')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  unassignInstrument(
    @Param('id') id: string,
    @Param('assignmentId') assignmentId: string,
    // La organizacion sale del JWT, nunca de la ruta: es lo que impide borrarle
    // la trazabilidad a otro laboratorio conociendo un id.
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.unassignInstrument(id, assignmentId, user.organizationId)
  }

}
