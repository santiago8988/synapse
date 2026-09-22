import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common'
import { AreasService } from './areas.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import { ZodBody } from '../../common/decorators/zod-body.decorator'
import {
  createAreaSchema,
  updateAreaSchema,
  type CreateAreaInput,
  type UpdateAreaInput,
} from '@synapse/validators'

@Controller('organizations/:orgId/areas')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class AreasController {
  constructor(private service: AreasService) {}

  @Get()
  getTree(@CurrentUser() user: JwtPayload) {
    return this.service.getTree(user.organizationId)
  }

  @Post()
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @ZodBody(createAreaSchema)
  create(@CurrentUser() user: JwtPayload, @Body() body: CreateAreaInput) {
    return this.service.create(user.organizationId, body)
  }

  @Patch(':areaId')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  @ZodBody(updateAreaSchema)
  update(
    @CurrentUser() user: JwtPayload,
    @Param('areaId') areaId: string,
    @Body() body: UpdateAreaInput,
  ) {
    return this.service.update(areaId, user.organizationId, body)
  }

  @Delete(':areaId')
  @Roles('ADMIN')
  delete(@CurrentUser() user: JwtPayload, @Param('areaId') areaId: string) {
    return this.service.delete(areaId, user.organizationId)
  }
}
