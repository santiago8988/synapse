import { Injectable, NotFoundException } from '@nestjs/common'
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

  /**
   * Historia de un registro: sus propios cambios mas los de todas sus entradas.
   *
   * Devuelve una vista reducida a proposito. El listado global de /audit expone
   * IP y los payloads crudos y por eso esta limitado a ADMIN y AUDITOR
   * (apps/web/CLAUDE.md, regla 4). Aca se omiten los dos y en su lugar se
   * calcula que campos cambiaron, que es lo que sirve para reconstruir el
   * cambio. Con eso la pestaña puede verla tambien QUALITY_MANAGER sin ampliar
   * la superficie de datos sensibles.
   */
  async findForRecord(
    recordId: string,
    organizationId: string,
    options: { take?: number } = {},
  ) {
    const record = await this.prisma.record.findFirst({
      where: { id: recordId, organizationId },
      select: {
        id: true,
        // Los fields inactivos tambien: un log viejo puede referirse a un campo
        // que despues se elimino, y sin su label quedaria un id crudo.
        fields: { select: { id: true, label: true } },
        entries: { select: { id: true } },
      },
    })
    if (!record) throw new NotFoundException('Registro no encontrado')

    const etiquetas = new Map(record.fields.map((f) => [f.id, f.label]))
    const entryIds = record.entries.map((e) => e.id)

    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        OR: [
          { entityType: 'RECORDS', entityId: recordId },
          // Usa el indice (entityType, entityId). Para un registro con muchisimas
          // entradas este IN crece; si algun dia molesta, la salida es guardar
          // recordId en AuditLog en vez de derivarlo.
          ...(entryIds.length > 0
            ? [{ entityType: 'ENTRIES', entityId: { in: entryIds } }]
            : []),
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(options.take ?? 50, 200),
    })

    const userIds = Array.from(new Set(logs.map((l) => l.userId)))
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : []
    const porId = new Map(users.map((u) => [u.id, u]))

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      createdAt: log.createdAt,
      user: porId.get(log.userId) ?? null,
      changes: diffEntryData(log.before, log.after, etiquetas),
    }))
  }

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

/**
 * Que campos cambiaron entre el estado previo y el posterior de una entrada.
 *
 * Solo aplica cuando ambos lados traen un objeto `data`, que es la forma de una
 * Entry. Para otras entidades devuelve vacio en vez de inventar un diff sobre
 * formas que no coinciden: el `after` de una mutacion es el cuerpo de la
 * respuesta, no necesariamente la misma fila que el `before`.
 */
function diffEntryData(
  before: unknown,
  after: unknown,
  etiquetas: Map<string, string>,
): Array<{ field: string; from: unknown; to: unknown }> {
  const datosPrevios = extraerData(before)
  const datosNuevos = extraerData(after)
  if (!datosPrevios || !datosNuevos) return []

  const claves = new Set([...Object.keys(datosPrevios), ...Object.keys(datosNuevos)])
  const cambios: Array<{ field: string; from: unknown; to: unknown }> = []

  for (const clave of claves) {
    const antes = datosPrevios[clave]
    const despues = datosNuevos[clave]
    // Comparacion por serializacion: los valores pueden ser objetos (QUANTITY,
    // MATRIX_METHOD) y comparar por referencia daria siempre distinto.
    if (JSON.stringify(antes) === JSON.stringify(despues)) continue
    cambios.push({ field: etiquetas.get(clave) ?? clave, from: antes, to: despues })
  }
  return cambios
}

function extraerData(valor: unknown): Record<string, unknown> | null {
  if (typeof valor !== 'object' || valor === null) return null
  const data = (valor as { data?: unknown }).data
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  return data as Record<string, unknown>
}
