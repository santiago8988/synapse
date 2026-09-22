import { Controller, Get, Post, Param, Query, Body, UseGuards } from '@nestjs/common'
import { SamplesService } from './samples.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { ZodBody } from '../../common/decorators/zod-body.decorator'
import {
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
}
