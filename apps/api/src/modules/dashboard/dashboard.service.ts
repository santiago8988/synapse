import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(organizationId: string) {
    const now = new Date()
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(now.getDate() + 7)

    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(now.getDate() + 30)

    const [
      activeRecords,
      overdueEntries,
      openNCs,
      inProgressNCs,
      instrumentsByStatus,
      recentEntries,
      upcomingEntries,
      upcomingRevisions,
      pendingApprovals,
      expiringTrainings,
    ] = await Promise.all([
      // Registros activos
      this.prisma.record.count({
        where: { organizationId, isActive: true },
      }),

      // Entries vencidas (dueDate pasada, no completadas)
      this.prisma.entry.count({
        where: {
          record: { organizationId },
          dueDate: { lt: now },
          status: 'DRAFT',
        },
      }),

      // NCs abiertas
      this.prisma.nonConformity.count({
        where: { organizationId, status: 'OPEN' },
      }),

      // NCs en progreso
      this.prisma.nonConformity.count({
        where: { organizationId, status: 'IN_PROGRESS' },
      }),

      // Instrumentos agrupados por estado — post-Records-as-Lists. La tabla
      // `Instrument` ya no existe; el "instrumento" es una Entry de Record
      // type=INSTRUMENTAL. El estado vive en `Entry.data[<statusFieldId>]`,
      // donde el statusFieldId es el id del field DROPDOWN con isStatus=true.
      // Como `groupBy` por JSON path no es trivial, agrupamos en JS.
      this.prisma.entry
        .findMany({
          where: { record: { organizationId, type: 'INSTRUMENTAL' } },
          select: {
            data: true,
            record: {
              select: {
                fields: {
                  where: { isActive: true, fieldType: 'DROPDOWN' },
                  select: { id: true, comparisonConfig: true },
                },
              },
            },
          },
        })
        .then((entries) => {
          const counts = new Map<string, number>()
          for (const e of entries) {
            const statusField = e.record.fields.find((f) => {
              const cfg = f.comparisonConfig as { isStatus?: boolean } | null
              return cfg?.isStatus === true
            })
            if (!statusField) continue
            const data = (e.data ?? {}) as Record<string, unknown>
            const status = String(data[statusField.id] ?? '') || 'UNKNOWN'
            counts.set(status, (counts.get(status) ?? 0) + 1)
          }
          return Array.from(counts.entries()).map(([status, count]) => ({
            status,
            _count: count,
          }))
        }),

      // Últimas 10 entries
      this.prisma.entry.findMany({
        where: { record: { organizationId } },
        include: {
          record: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Entries próximas a vencer (próximos 7 días)
      this.prisma.entry.findMany({
        where: {
          record: { organizationId },
          dueDate: { gte: now, lte: sevenDaysFromNow },
          status: 'DRAFT',
        },
        include: {
          record: { select: { name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),

      // Revisiones próximas a vencer (próximos 30 días)
      this.prisma.entry.findMany({
        where: {
          record: { organizationId, type: 'NOT_PERIODIC_WITH_REVISION' },
          revisionDate: { gte: now, lte: thirtyDaysFromNow },
        },
        include: {
          record: { select: { name: true, notifyDaysBefore: true } },
        },
        orderBy: { revisionDate: 'asc' },
        take: 10,
      }),

      // Solicitudes de aprobación pendientes
      this.prisma.approvalRequest.count({
        where: {
          organizationId,
          status: { in: ['PENDING_REVIEW', 'PENDING_APPROVAL'] },
        },
      }),

      // Capacitaciones próximas a vencer (próximos 30 días)
      this.prisma.training.findMany({
        where: {
          organizationId,
          expiresAt: { gte: now, lte: thirtyDaysFromNow },
        },
        include: {
          organizationUser: {
            include: { user: { select: { name: true } } },
          },
        },
        orderBy: { expiresAt: 'asc' },
        take: 10,
      }),
    ])

    // Convertir instrumentsByStatus a un objeto legible
    const instruments: Record<string, number> = {}
    for (const group of instrumentsByStatus) {
      instruments[group.status] = group._count
    }

    return {
      activeRecords,
      overdueEntries,
      nonConformities: {
        open: openNCs,
        inProgress: inProgressNCs,
        total: openNCs + inProgressNCs,
      },
      instruments,
      recentEntries: recentEntries.map((e) => ({
        id: e.id,
        recordName: e.record.name,
        status: e.status,
        createdAt: e.createdAt,
        dueDate: e.dueDate,
      })),
      upcomingEntries: upcomingEntries.map((e) => ({
        id: e.id,
        recordName: e.record.name,
        status: e.status,
        dueDate: e.dueDate,
      })),
      upcomingRevisions: upcomingRevisions.map((e) => ({
        id: e.id,
        recordName: e.record.name,
        revisionDate: e.revisionDate,
        notifyDaysBefore: e.record.notifyDaysBefore,
      })),
      pendingApprovals,
      expiringTrainings: expiringTrainings.map((t) => ({
        id: t.id,
        name: t.name,
        userName: t.organizationUser.user.name,
        expiresAt: t.expiresAt,
      })),
    }
  }
}
