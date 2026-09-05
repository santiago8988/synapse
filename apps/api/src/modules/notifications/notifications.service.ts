import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

/**
 * Notificaciones dentro de la app.
 *
 * Toda consulta filtra por `userId` **y** por `organizationId`. El userId solo
 * no alcanza: una persona puede pertenecer a varias organizaciones, y al
 * cambiar de organización activa no debería seguir viendo los avisos de la
 * anterior.
 */
@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async list(
    userId: string,
    organizationId: string,
    options: { onlyUnread?: boolean; take?: number } = {},
  ) {
    return this.prisma.notification.findMany({
      where: {
        userId,
        organizationId,
        ...(options.onlyUnread ? { readAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(options.take ?? 30, 100),
    })
  }

  async unreadCount(userId: string, organizationId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, organizationId, readAt: null },
    })
  }

  /**
   * Marca una notificación como leída. El `where` incluye al destinatario, así
   * que intentar marcar la de otra persona devuelve 404 en vez de modificarla.
   */
  async markRead(id: string, userId: string, organizationId: string) {
    const existe = await this.prisma.notification.findFirst({
      where: { id, userId, organizationId },
      select: { id: true },
    })
    if (!existe) throw new NotFoundException('Notificación no encontrada')

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    })
  }

  /** Marca todas las del usuario en la organización activa. */
  async markAllRead(userId: string, organizationId: string) {
    const { count } = await this.prisma.notification.updateMany({
      where: { userId, organizationId, readAt: null },
      data: { readAt: new Date() },
    })
    return { updated: count }
  }
}
