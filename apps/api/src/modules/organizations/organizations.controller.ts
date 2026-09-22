import { Controller, Get, Patch, Post, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { OrganizationsService } from './organizations.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { ZodBody } from '../../common/decorators/zod-body.decorator'
import {
  addTrainingSchema,
  addWhitelistSchema,
  createPositionSchema,
  setAreaLeaderSchema,
  updateOrganizationSchema,
  updateOrgUserSchema,
  type AddTrainingInput,
  type AddWhitelistInput,
  type CreatePositionInput,
  type SetAreaLeaderInput,
  type UpdateOrganizationInput,
  type UpdateOrgUserInput,
} from '@synapse/validators'

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
  @ZodBody(updateOrganizationSchema)
  update(@CurrentUser() user: JwtPayload, @Body() body: UpdateOrganizationInput) {
    return this.service.update(user.organizationId, body)
  }

  @Get(':id/whitelist')
  @Roles('ADMIN')
  getWhitelist(@CurrentUser() user: JwtPayload) {
    return this.service.getWhitelist(user.organizationId)
  }

  @Post(':id/whitelist')
  @Roles('ADMIN')
  @ZodBody(addWhitelistSchema)
  addWhitelist(@CurrentUser() user: JwtPayload, @Body() body: AddWhitelistInput) {
    return this.service.addToWhitelist(user.organizationId, body)
  }

  @Delete(':id/whitelist/:whitelistId')
  @Roles('ADMIN')
  removeWhitelist(
    @CurrentUser() user: JwtPayload,
    @Param('whitelistId') whitelistId: string,
  ) {
    return this.service.removeFromWhitelist(whitelistId, user.organizationId)
  }

  @Get(':id/users')
  getUsers(@CurrentUser() user: JwtPayload) {
    return this.service.getUsers(user.organizationId)
  }

  @Patch(':id/users/:userId')
  @Roles('ADMIN')
  @ZodBody(updateOrgUserSchema)
  updateUser(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() body: UpdateOrgUserInput,
  ) {
    return this.service.updateUser(userId, user.organizationId, body)
  }

  // ─── Positions ──────────────────────────────

  @Get(':id/positions')
  getPositions(@CurrentUser() user: JwtPayload) {
    return this.service.getPositions(user.organizationId)
  }

  @Post(':id/positions')
  @Roles('ADMIN')
  @ZodBody(createPositionSchema)
  createPosition(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreatePositionInput,
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
  @ZodBody(setAreaLeaderSchema)
  setAreaLeader(
    @CurrentUser() user: JwtPayload,
    @Param('areaId') areaId: string,
    @Body() body: SetAreaLeaderInput,
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
  @ZodBody(addTrainingSchema)
  addTraining(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() body: AddTrainingInput,
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
