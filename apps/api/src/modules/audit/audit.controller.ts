import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { AuditService } from './audit.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { AuditIgnore } from '../../common/decorators/audit-ignore.decorator'

@Controller('audit')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
@AuditIgnore()
export class AuditController {
  constructor(private service: AuditService) {}

  @Get()
  @Roles('ADMIN', 'AUDITOR')
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.findAll(user.organizationId, {
      entityType,
      entityId,
      userId,
      action,
      from,
      to,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    })
  }
}
