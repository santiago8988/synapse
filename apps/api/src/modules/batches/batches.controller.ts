import { Controller, Get, Post, Patch, Param, Query, Body, UseGuards } from '@nestjs/common'
import { BatchesService } from './batches.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { BatchStatus } from '@prisma/client'

@Controller('batches')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class BatchesController {
  constructor(private service: BatchesService) {}

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
  changeStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      status: BatchStatus
      producedQuantity?: number
      unit?: string
      reason?: string
    },
  ) {
    return this.service.changeStatus(
      id,
      user.organizationId,
      user.sub,
      body.status,
      { producedQuantity: body.producedQuantity, unit: body.unit, reason: body.reason },
    )
  }

  @Post(':id/consume-stock')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  consumeStock(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      consumptions: Array<{ ingredientName: string; product: string; lotNumber: string; quantity: number; unit: string }>
    },
  ) {
    return this.service.consumeStock(id, user.organizationId, user.sub, body.consumptions)
  }

  @Patch(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { producedQuantity?: number; unit?: string },
  ) {
    return this.service.update(id, user.organizationId, body)
  }
}
