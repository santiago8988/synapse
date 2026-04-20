import { Controller, Get, Post, Patch, Param, Body, UseGuards } from '@nestjs/common'
import { EntriesService } from './entries.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

@Controller('records/:recordId/entries')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class EntriesController {
  constructor(private service: EntriesService) {}

  @Get()
  findAll(
    @Param('recordId') recordId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findAll(recordId, user.organizationId)
  }

  @Post()
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  create(
    @Param('recordId') recordId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: {
      data: Record<string, unknown>
      revisionDate?: string
      lotNumber?: string
      sampleCode?: string
      client?: string
    },
  ) {
    return this.service.create(
      recordId,
      user.organizationId,
      user.sub,
      body.data,
      body.revisionDate,
      body.lotNumber ? { lotNumber: body.lotNumber } : undefined,
      body.sampleCode ? { sampleCode: body.sampleCode, client: body.client } : undefined,
    )
  }

  @Get(':id')
  findOne(
    @Param('recordId') recordId: string,
    @Param('id') id: string,
  ) {
    return this.service.findById(id, recordId)
  }

  @Patch(':id')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  update(
    @Param('recordId') recordId: string,
    @Param('id') id: string,
    @Body() body: { data: Record<string, unknown> },
  ) {
    return this.service.update(id, recordId, body.data)
  }

  @Post(':id/complete')
  @Roles('ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN')
  complete(
    @Param('recordId') recordId: string,
    @Param('id') id: string,
  ) {
    return this.service.complete(id, recordId)
  }
}
