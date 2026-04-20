import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common'
import { MethodsService } from './methods.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

@Controller('methods')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class MethodsController {
  constructor(private service: MethodsService) {}

  @Get()
  search(
    @CurrentUser() user: JwtPayload,
    @Query('search') search?: string,
  ) {
    return this.service.search(user.organizationId, search)
  }

  @Post()
  @Roles('ADMIN', 'QUALITY_MANAGER')
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      code: string
      name: string
      parameter: string
      unit?: string
      defaultMin?: number
      defaultMax?: number
      sourceRef?: string
    },
  ) {
    return this.service.create(user.organizationId, body)
  }

  @Patch(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      code?: string
      name?: string
      parameter?: string
      unit?: string
      defaultMin?: number
      defaultMax?: number
      sourceRef?: string
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
