import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { JwtPayload } from '../../common/decorators/current-user.decorator'
import { alcanceDeAreas, filtroDeRecordsVisibles } from '../../common/areas/area-scope'
import { ApprovalService } from '../approval/approval.service'

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private approval: ApprovalService,
  ) {}

  /**
   * Resumen de lo que requiere atención, acotado a lo que el usuario ve.
   *
   * Todo lo de acá pasa por dos filtros y el orden importa: primero
   * `organizationId` —el aislamiento entre inquilinos, que no es negociable— y
   * después el árbol de áreas. El segundo decide cuánto de lo propio se muestra;
   * el primero, que nunca se muestre lo ajeno.
   */
  async getStats(user: JwtPayload) {
    const organizationId = user.organizationId
    const now = new Date()
    const sevenDaysFromNow = new Date()
    sevenDaysFromNow.setDate(now.getDate() + 7)

    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(now.getDate() + 30)

    // Las áreas de la organización se traen una sola vez y el árbol se camina
    // en memoria: resolverlo por consulta recursiva en cada una de las siete
    // agregaciones de abajo seria pagar el mismo arbol seis veces.
    const areas = await this.prisma.area.findMany({
      where: { organizationId },
      select: { id: true, parentId: true },
    })
    const areasVisibles = alcanceDeAreas(user, areas)
    const recordVisible = filtroDeRecordsVisibles(organizationId, areasVisibles)

    /**
     * No conformidades: el área les llega por la entrada que las originó. Las
     * que se cargan a mano no tienen entrada, y como los registros sin
     * clasificar, se muestran a todos — una NC que nadie ve es exactamente el
     * problema que las NC existen para evitar.
     */
    const ncVisible =
      areasVisibles === null
        ? { organizationId }
        : {
            organizationId,
            OR: [{ entry: { record: recordVisible } }, { entryId: null }],
          }

    /** Filtro de personas: null = toda la organización. */
    const personaVisible =
      areasVisibles === null
        ? { organizationId }
        : {
            organizationId,
            // La capacitación propia siempre se ve, aunque el usuario no tenga
            // área: es su vencimiento y nadie más lo va a mirar por él.
            OR: [{ areaId: { in: areasVisibles } }, { userId: user.sub }],
          }

    const [
      activeRecords,
      overdueEntriesList,
      openNCs,
      inProgressNCs,
      instrumentsByStatus,
      recentEntries,
      upcomingEntries,
      upcomingRevisions,
      instrumentsDueCalibration,
      pendingApprovalsForUser,
      expiringTrainings,
    ] = await Promise.all([
      // Registros activos
      this.prisma.record.count({
        where: { ...recordVisible, isActive: true },
      }),

      // Entries vencidas (dueDate pasada, no completadas). Se traen los datos,
      // no solo el conteo: un número sin a dónde ir obliga a salir a buscarlas.
      this.prisma.entry.findMany({
        where: {
          record: recordVisible,
          dueDate: { lt: now },
          status: 'DRAFT',
        },
        include: {
          record: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),

      // NCs abiertas
      this.prisma.nonConformity.count({
        where: { ...ncVisible, status: 'OPEN' },
      }),

      // NCs en progreso
      this.prisma.nonConformity.count({
        where: { ...ncVisible, status: 'IN_PROGRESS' },
      }),

      // Instrumentos agrupados por estado
      this.prisma.instrument.groupBy({
        by: ['status'],
        where: { organizationId, record: recordVisible },
        _count: true,
      }),

      // Últimas 10 entries
      this.prisma.entry.findMany({
        where: { record: recordVisible },
        include: {
          record: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),

      // Entries próximas a vencer (próximos 7 días)
      this.prisma.entry.findMany({
        where: {
          record: recordVisible,
          dueDate: { gte: now, lte: sevenDaysFromNow },
          status: 'DRAFT',
        },
        include: {
          record: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),

      // Revisiones próximas a vencer (próximos 30 días)
      this.prisma.entry.findMany({
        where: {
          record: { ...recordVisible, type: 'NOT_PERIODIC_WITH_REVISION' },
          revisionDate: { gte: now, lte: thirtyDaysFromNow },
        },
        include: {
          record: { select: { id: true, name: true, notifyDaysBefore: true } },
        },
        orderBy: { revisionDate: 'asc' },
        take: 10,
      }),

      // Instrumentos con la calibración vencida o por vencer en 30 días. Es el
      // dato accionable del parque de instrumental: cuántos hay en calibración
      // ahora mismo no le sirve a nadie para decidir algo.
      this.prisma.instrument.findMany({
        where: {
          organizationId,
          record: recordVisible,
          status: { not: 'DECOMMISSIONED' },
          nextCalibrationAt: { not: null, lte: thirtyDaysFromNow },
        },
        select: {
          id: true,
          nextCalibrationAt: true,
          // El instrumento no tiene nombre propio: su identidad vive en la
          // entry que lo creó, y el nombre visible sale del registro.
          record: { select: { name: true } },
        },
        orderBy: { nextCalibrationAt: 'asc' },
        take: 10,
      }),

      // Aprobaciones que le tocan a este usuario, no las de toda la
      // organización. Un `ApprovalRequest` apunta a su entidad de forma
      // polimórfica (entityType + entityId), así que no tiene área que filtrar;
      // pero el alcance que importa acá no es el área sino el rol de calidad:
      // lo accionable es lo que uno tiene que revisar o aprobar.
      this.approval.getPendingForUser(organizationId, user.sub),

      // Capacitaciones próximas a vencer (próximos 30 días)
      this.prisma.training.findMany({
        where: {
          organizationId,
          organizationUser: personaVisible,
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
      overdueEntries: overdueEntriesList.length,
      overdueEntriesList: overdueEntriesList.map((e) => ({
        id: e.id,
        recordId: e.record.id,
        recordName: e.record.name,
        dueDate: e.dueDate,
      })),
      nonConformities: {
        open: openNCs,
        inProgress: inProgressNCs,
        total: openNCs + inProgressNCs,
      },
      instruments,
      recentEntries: recentEntries.map((e) => ({
        id: e.id,
        recordId: e.record.id,
        recordName: e.record.name,
        status: e.status,
        createdAt: e.createdAt,
        dueDate: e.dueDate,
      })),
      upcomingEntries: upcomingEntries.map((e) => ({
        id: e.id,
        recordId: e.record.id,
        recordName: e.record.name,
        status: e.status,
        dueDate: e.dueDate,
      })),
      upcomingRevisions: upcomingRevisions.map((e) => ({
        id: e.id,
        recordId: e.record.id,
        recordName: e.record.name,
        revisionDate: e.revisionDate,
        notifyDaysBefore: e.record.notifyDaysBefore,
      })),
      instrumentsDueCalibration: instrumentsDueCalibration.map((i) => ({
        id: i.id,
        recordName: i.record.name,
        nextCalibrationAt: i.nextCalibrationAt,
      })),
      pendingApprovals: pendingApprovalsForUser.length,
      expiringTrainings: expiringTrainings.map((t) => ({
        id: t.id,
        name: t.name,
        userName: t.organizationUser.user.name,
        expiresAt: t.expiresAt,
      })),
    }
  }
}
