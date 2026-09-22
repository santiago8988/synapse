import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common'
import { SamplesService } from './samples.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { ZodBody } from '../../common/decorators/zod-body.decorator'
import {
  assignInstrumentSchema,
  type AssignInstrumentInput,
  changeSampleStatusSchema,
  saveSampleResultsSchema,
  saveSampleConditionsSchema,
  type ChangeSampleStatusInput,
  type SaveSampleResultsInput,
  type SaveSampleConditionsInput,
} from '@synapse/validators'

@Controller('samples')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class SamplesController {
  constructor(private service: SamplesService) {}

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
  @ZodBody(changeSampleStatusSchema)
  changeStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: ChangeSampleStatusInput,
  ) {
    return this.service.changeStatus(id, user.organizationId, body.status)
  }

  @Post(':id/results')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  @ZodBody(saveSampleResultsSchema)
  saveResults(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: SaveSampleResultsInput,
  ) {
    return this.service.saveResults(id, user.organizationId, body.results)
  }

  @Post(':id/conditions')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  @ZodBody(saveSampleConditionsSchema)
  saveConditions(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: SaveSampleConditionsInput,
  ) {
    return this.service.saveConditions(id, user.organizationId, body.conditions)
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
