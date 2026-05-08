import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common'
import { InstrumentsService } from './instruments.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'
import type { UserRole } from '@synapse/types'

@Controller('instruments')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class InstrumentsController {
  constructor(private service: InstrumentsService) {}

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: string,
    @Query('recordId') recordId?: string,
  ) {
    return this.service.findAll(user.organizationId, { status, recordId })
  }

  @Get('patterns')
  findPatterns(@CurrentUser() user: JwtPayload) {
    return this.service.findPatterns(user.organizationId)
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.findById(id, user.organizationId)
  }

  // No hay POST crear ni PATCH editar — los instruments se crean automáticamente
  // vía listener cuando se crea una entry en un record INSTRUMENTAL.
  // Los datos descriptivos se editan desde la entry del registro.

  @Post(':id/status')
  @Roles('ADMIN', 'QUALITY_MANAGER')
  changeStatus(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { status: string; reason?: string },
  ) {
    return this.service.changeStatus(
      id,
      user.organizationId,
      body.status,
      body.reason || null,
      user.sub,
      user.role as UserRole,
    )
  }
}
