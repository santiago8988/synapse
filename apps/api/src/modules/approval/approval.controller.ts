import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common'
import { ApprovalService } from './approval.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { ZodBody } from '../../common/decorators/zod-body.decorator'
import {
  assignQualityRoleSchema,
  submitForApprovalSchema,
  approvalDecisionSchema,
  type AssignQualityRoleInput,
  type SubmitForApprovalInput,
  type ApprovalDecisionInput,
} from '@synapse/validators'
import { ApprovableEntity } from '@prisma/client'

@Controller('approval')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class ApprovalController {
  constructor(private service: ApprovalService) {}

  // ─── Quality Roles ──────────────────────────

  @Get('quality-roles')
  @Roles('ADMIN')
  getQualityRoles(@CurrentUser() user: JwtPayload) {
    return this.service.getQualityRoles(user.organizationId)
  }

  @Post('quality-roles')
  @Roles('ADMIN')
  @ZodBody(assignQualityRoleSchema)
  assignQualityRole(
    @CurrentUser() user: JwtPayload,
    @Body() body: AssignQualityRoleInput,
  ) {
    return this.service.assignQualityRole(
      user.organizationId,
      body.organizationUserId,
      body.role,
    )
  }

  @Delete('quality-roles/:id')
  @Roles('ADMIN')
  removeQualityRole(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.removeQualityRole(id, user.organizationId)
  }

  // ─── Approval Requests ──────────────────────

  @Post('submit')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @ZodBody(submitForApprovalSchema)
  submitForApproval(
    @CurrentUser() user: JwtPayload,
    @Body() body: SubmitForApprovalInput,
  ) {
    return this.service.submitForApproval(
      user.organizationId,
      body.entityType,
      body.entityId,
      user.sub,
    )
  }

  @Post('requests/:id/decide')
  @ZodBody(approvalDecisionSchema)
  decide(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: ApprovalDecisionInput,
  ) {
    return this.service.decide(
      id,
      user.organizationId,
      user.sub,
      body.decision,
      body.comments,
    )
  }

  @Get('requests')
  getApprovalRequests(
    @CurrentUser() user: JwtPayload,
    @Query('entityType') entityType?: ApprovableEntity,
  ) {
    return this.service.getApprovalRequests(user.organizationId, entityType)
  }

  @Get('requests/:id')
  getApprovalRequestById(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.getApprovalRequestById(id, user.organizationId)
  }

  @Get('pending')
  getPendingForUser(@CurrentUser() user: JwtPayload) {
    return this.service.getPendingForUser(user.organizationId, user.sub)
  }
}
