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

    return {
      data,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }
}
