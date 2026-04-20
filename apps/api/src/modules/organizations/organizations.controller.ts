import { Controller, Get, Patch, Post, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { OrganizationsService } from './organizations.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

@Controller('organizations')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class OrganizationsController {
  constructor(private service: OrganizationsService) {}

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload) {
    return this.service.findById(user.organizationId)
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@CurrentUser() user: JwtPayload, @Body() body: { name?: string; logoUrl?: string }) {
    return this.service.update(user.organizationId, body)
  }

  @Get(':id/whitelist')
  @Roles('ADMIN')
  getWhitelist(@CurrentUser() user: JwtPayload) {
    return this.service.getWhitelist(user.organizationId)
  }

  @Post(':id/whitelist')
  @Roles('ADMIN')
  addWhitelist(@CurrentUser() user: JwtPayload, @Body() body: { email: string; role?: string; areaId?: string }) {
    return this.service.addToWhitelist(user.organizationId, body)
  }

  @Delete(':id/whitelist/:whitelistId')
  @Roles('ADMIN')
  removeWhitelist(@Param('whitelistId') whitelistId: string) {
    return this.service.removeFromWhitelist(whitelistId)
  }

  @Get(':id/users')
  getUsers(@CurrentUser() user: JwtPayload) {
    return this.service.getUsers(user.organizationId)
  }

  @Patch(':id/users/:userId')
  @Roles('ADMIN')
  updateUser(
    @Param('userId') userId: string,
    @Body() body: {
      role?: string
      areaId?: string | null
      positionId?: string | null
      phone?: string | null
      signature?: string | null
      isActive?: boolean
    },
  ) {
    return this.service.updateUser(userId, body)
  }

  // ─── Positions ──────────────────────────────

  @Get(':id/positions')
  getPositions(@CurrentUser() user: JwtPayload) {
    return this.service.getPositions(user.organizationId)
  }

  @Post(':id/positions')
  @Roles('ADMIN')
  createPosition(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string },
  ) {
    return this.service.createPosition(user.organizationId, body.name)
  }

  @Delete(':id/positions/:positionId')
  @Roles('ADMIN')
  deletePosition(
    @CurrentUser() user: JwtPayload,
    @Param('positionId') positionId: string,
  ) {
    return this.service.deletePosition(positionId, user.organizationId)
  }

  // ─── Area Leader ────────────────────────────

  @Patch(':id/areas/:areaId/leader')
  @Roles('ADMIN')
  setAreaLeader(
    @CurrentUser() user: JwtPayload,
    @Param('areaId') areaId: string,
    @Body() body: { leaderId: string | null },
  ) {
    return this.service.setAreaLeader(user.organizationId, areaId, body.leaderId)
  }

  // ─── Trainings ──────────────────────────────

  @Get(':id/users/:userId/trainings')
  getTrainings(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
  ) {
    return this.service.getTrainings(user.organizationId, userId)
  }

  @Post(':id/users/:userId/trainings')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  addTraining(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() body: {
      name: string
      description?: string
      provider?: string
      completedAt: string
      expiresAt?: string
      certificateUrl?: string
    },
  ) {
    return this.service.addTraining(user.organizationId, userId, body)
  }

  @Delete(':id/users/:userId/trainings/:trainingId')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  removeTraining(
    @CurrentUser() user: JwtPayload,
    @Param('trainingId') trainingId: string,
  ) {
    return this.service.removeTraining(trainingId, user.organizationId)
  }
}
