import { Controller, Get, Post, Delete, Param, Query, Body, UseGuards } from '@nestjs/common'
import { CalibrationsService } from './calibrations.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { ZodBody } from '../../common/decorators/zod-body.decorator'
import {
  changeCalibrationStatusSchema,
  addCalibrationPatternSchema,
  saveCalibrationResultsSchema,
  type ChangeCalibrationStatusInput,
  type AddCalibrationPatternInput,
  type SaveCalibrationResultsInput,
} from '@synapse/validators'

@Controller('calibrations')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class CalibrationsController {
  constructor(private service: CalibrationsService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('entryId') entryId?: string,
  ) {
    return this.service.findAll(user.organizationId, { status, entryId })
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user.organizationId)
  }

  @Post(':id/status')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  @ZodBody(changeCalibrationStatusSchema)
  changeStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: ChangeCalibrationStatusInput,
  ) {
    return this.service.changeStatus(id, user.organizationId, body.status)
  }

  @Post(':id/patterns')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  @ZodBody(addCalibrationPatternSchema)
  addPattern(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: AddCalibrationPatternInput,
  ) {
    return this.service.addPattern(id, user.organizationId, body.patternEntryId)
  }

  @Delete(':id/patterns/:patternId')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  removePattern(
    @Param('id') id: string,
    @Param('patternId') patternId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removePattern(id, user.organizationId, patternId)
  }

  @Post(':id/results')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  @ZodBody(saveCalibrationResultsSchema)
  saveResults(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: SaveCalibrationResultsInput,
  ) {
    return this.service.saveResults(id, user.organizationId, body.results)
  }
}
