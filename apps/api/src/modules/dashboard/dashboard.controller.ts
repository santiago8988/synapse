import { Controller, Get, UseGuards } from '@nestjs/common'
import { DashboardService } from './dashboard.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { AuditIgnore } from '../../common/decorators/audit-ignore.decorator'

@Controller('dashboard')
@UseGuards(JwtAuthGuard, TenantGuard)
@AuditIgnore()
export class DashboardController {
  constructor(private service: DashboardService) {}

  @Get('stats')
  getStats(@CurrentUser() user: JwtPayload) {
    return this.service.getStats(user.organizationId)
  }
}
