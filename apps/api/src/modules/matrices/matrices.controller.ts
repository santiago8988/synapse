import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { MatricesService } from './matrices.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

@Controller('matrices')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class MatricesController {
  constructor(private service: MatricesService) {}

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
      parameters: Array<{ name: string; method?: string; unit?: string; minValue?: number; maxValue?: number; order: number }>
      conditions?: Array<{ label: string; fieldType: string; unit?: string; options?: string[]; order: number }>
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
      parameters?: Array<{ name: string; method?: string; unit?: string; minValue?: number; maxValue?: number; order: number }>
      conditions?: Array<{ label: string; fieldType: string; unit?: string; options?: string[]; order: number }>
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
