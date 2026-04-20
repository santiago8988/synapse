import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { RecipesService } from './recipes.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

@Controller('recipes')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class RecipesController {
  constructor(private service: RecipesService) {}

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
      code: string
      ingredients: Array<{ name: string; quantity: number; unit: string; order: number; fromStock?: boolean; stockRecipeId?: string }>
      steps: Array<{ order: number; name: string; description?: string; duration?: number; controls?: string }>
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
      ingredients?: Array<{ name: string; quantity: number; unit: string; order: number }>
      steps?: Array<{ order: number; name: string; description?: string; duration?: number; controls?: string }>
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
