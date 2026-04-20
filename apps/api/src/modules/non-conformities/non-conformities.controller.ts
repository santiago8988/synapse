import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common'
import { NonConformitiesService } from './non-conformities.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

@Controller('non-conformities')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class NonConformitiesController {
  constructor(private service: NonConformitiesService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('entryId') entryId?: string,
  ) {
    return this.service.findAll(user.organizationId, { status, entryId })
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findById(id, user.organizationId)
  }

  @Post()
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: { title: string; description: string; entryId?: string; assignedToId?: string },
  ) {
    return this.service.create(user.organizationId, user.sub, body)
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { status: string },
  ) {
    return this.service.updateStatus(id, user.organizationId, body.status, user.sub)
  }

  @Post(':id/corrective-actions')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  addCorrectiveAction(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { description: string; dueDate?: string },
  ) {
    return this.service.addCorrectiveAction(id, user.organizationId, user.sub, body)
  }

  @Post(':id/corrective-actions/:actionId/complete')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  completeCorrectiveAction(
    @Param('id') id: string,
    @Param('actionId') actionId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.completeCorrectiveAction(actionId, id, user.organizationId)
  }
}
