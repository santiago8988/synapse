import { Controller, Get, Post, Param, Query, UseGuards } from '@nestjs/common'
import { NotificationsService } from './notifications.service'
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard'
import { TenantGuard } from '../../common/guards/tenant.guard'
import { RolesGuard } from '../../common/guards/roles.guard'
import { AuditIgnore } from '../../common/decorators/audit-ignore.decorator'
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator'

/**
 * El destinatario nunca viene del request: sale del JWT. Aceptar un `userId`
 * por parámetro permitiría leer las notificaciones de cualquiera.
 */
@Controller('notifications')
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
export class NotificationsController {
  constructor(private service: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: JwtPayload,
    @Query('unread') unread?: string,
    @Query('take') take?: string,
  ) {
    return this.service.list(user.sub, user.organizationId, {
      onlyUnread: unread === 'true',
      take: take ? Number(take) : undefined,
    })
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: JwtPayload) {
    return { count: await this.service.unreadCount(user.sub, user.organizationId) }
  }

  // Marcar como leído es una preferencia de lectura del propio usuario, no un
  // cambio sobre los datos de calidad: no aporta nada al AuditLog y lo llenaría
  // de ruido.
  @Post(':id/read')
  @AuditIgnore()
  markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.service.markRead(id, user.sub, user.organizationId)
  }

  @Post('read-all')
  @AuditIgnore()
  markAllRead(@CurrentUser() user: JwtPayload) {
    return this.service.markAllRead(user.sub, user.organizationId)
  }
}
