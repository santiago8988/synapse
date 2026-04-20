import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { StockService } from './stock.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

@Controller('stock')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class StockController {
  constructor(private service: StockService) {}

  @Get()
  getSummary(@CurrentUser() user: JwtPayload) {
    return this.service.getSummary(user.organizationId)
  }

  @Get('available')
  getAvailableLots(
    @CurrentUser() user: JwtPayload,
    @Query('product') product: string,
  ) {
    return this.service.getAvailableLots(user.organizationId, product)
  }

  @Get('movements')
  getMovements(
    @CurrentUser() user: JwtPayload,
    @Query('product') product?: string,
    @Query('lotNumber') lotNumber?: string,
  ) {
    return this.service.getMovements(user.organizationId, { product, lotNumber })
  }
}
