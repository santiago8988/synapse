import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

interface AuditFilters {
  entityType?: string
  entityId?: string
  userId?: string
  action?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, filters: AuditFilters) {
    const page = filters.page || 1
    const pageSize = Math.min(filters.pageSize || 20, 100)
    const skip = (page - 1) * pageSize

    const where = {
      organizationId,
      ...(filters.entityType && { entityType: filters.entityType }),
      ...(filters.entityId && { entityId: filters.entityId }),
      ...(filters.userId && { userId: filters.userId }),
      ...(filters.action && { action: { contains: filters.action } }),
      ...(filters.from || filters.to
        ? {
            createdAt: {
              ...(filters.from && { gte: new Date(filters.from) }),
              ...(filters.to && { lte: new Date(filters.to) }),
            },
          }
        : {}),
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ])

    // AuditLog guarda userId suelto: no hay relacion con User en el schema, y
    // agregarle una FK a una tabla append-only con filas historicas es un
    // riesgo innecesario. Se resuelven los usuarios de la pagina en una sola
    // query y se adjuntan al resultado.
    const userIds = Array.from(new Set(data.map((log) => log.userId)))
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : []
    const byId = new Map(users.map((u) => [u.id, u]))

    return {
      data: data.map((log) => ({
        ...log,
        // null cuando el usuario ya no existe: el log es historico y la fila a
        // la que apunta puede haberse borrado. La UI muestra el id en ese caso.
        user: byId.get(log.userId) ?? null,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }
}
