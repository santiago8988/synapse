import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { CalibrationTemplatesService } from './calibration-templates.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

@Controller('calibration-templates')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class CalibrationTemplatesController {
  constructor(private service: CalibrationTemplatesService) {}

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.service.findAll(user.organizationId)
  }

  @Post()
  @Roles('ADMIN', 'QUALITY_MANAGER')
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      name: string
      code?: string
      description?: string
      unitMain?: string
      unitTolerance?: string
      periodicity?: number
      notifyDaysBefore?: number
      tests: Array<{
        name: string
        description?: string
        order: number
        tolerance?: number
        toleranceUnit?: string
        readingsPerPoint?: number
        formulaError?: string
        criteriaOperator?: string
        notes?: string
        points: Array<{ name: string; order: number; load?: number; unit?: string }>
      }>
    },
  ) {
    return this.service.create(user.organizationId, user.sub, body)
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.findById(id, user.organizationId)
  }

  @Patch(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      name?: string
      code?: string
      description?: string
      unitMain?: string
      unitTolerance?: string
      tests?: Array<{
        name: string
        description?: string
        order: number
        tolerance?: number
        toleranceUnit?: string
        readingsPerPoint?: number
        formulaError?: string
        criteriaOperator?: string
        notes?: string
        points: Array<{ name: string; order: number; load?: number; unit?: string }>
      }>
    },
  ) {
    return this.service.update(id, user.organizationId, body)
  }

  @Delete(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  delete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.delete(id, user.organizationId)
  }
}
