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
          // Los flujos se localizan por el sourceRecordId que viaja dentro del
          // payload, y no por la lista de flujos actuales: si se buscaran por
          // id, los flujos borrados desaparecerian del historial — justo los que
          // mas interesa poder revisar. El precio es que este filtro no usa el
          // indice; queda acotado por organizationId y por el take.
          {
            entityType: 'RECORD_ACTIONS',
            OR: [
              { before: { path: ['sourceRecordId'], equals: recordId } },
              { after: { path: ['sourceRecordId'], equals: recordId } },
            ],
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(options.take ?? 50, 200),
    })

    // Los flujos guardan ids de registro destino; mostrar un cuid crudo en el
    // historial no le dice nada a nadie.
    const nombresDeRegistros = await this.nombresDeRegistros(logs, organizationId)

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
      changes:
        log.entityType === 'RECORD_ACTIONS'
          ? diffRecordAction(log.before, log.after, nombresDeRegistros)
          : diffEntryData(log.before, log.after, etiquetas),
    }))
  }

  /**
   * Resuelve los ids de registro que aparecen en los logs de flujos a nombres.
   * Se hace en una sola consulta para todos los logs de la tanda.
   */
  private async nombresDeRegistros(
    logs: Array<{ entityType: string; before: unknown; after: unknown }>,
    organizationId: string,
  ): Promise<Map<string, string>> {
    const ids = new Set<string>()
    for (const log of logs) {
      if (log.entityType !== 'RECORD_ACTIONS') continue
      for (const lado of [log.before, log.after]) {
        const destino = (lado as { targetRecordId?: unknown } | null)?.targetRecordId
        if (typeof destino === 'string') ids.add(destino)
      }
    }
    if (ids.size === 0) return new Map()

    const registros = await this.prisma.record.findMany({
      where: { id: { in: [...ids] }, organizationId },
      select: { id: true, name: true },
    })
    return new Map(registros.map((r) => [r.id, r.name]))
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

/**
 * Diferencias de un flujo (`RecordAction`), en los términos en que se configura
 * en el editor visual.
 *
 * No se puede usar `diffEntryData`: ese compara el objeto `data` de una entrada,
 * y un flujo no tiene `data` — tiene columnas. Sin esto los cambios de flujo
 * aparecerían en el historial sin ningún detalle, que es casi lo mismo que no
 * aparecer.
 *
 * Se comparan solo las columnas que representan una decisión del usuario.
 * `createdAt` o `id` cambiarían el diff sin decir nada.
 */
const CAMPOS_DE_FLUJO: Array<{ clave: string; etiqueta: string }> = [
  { clave: 'targetRecordId', etiqueta: 'Registro destino' },
  { clave: 'trigger', etiqueta: 'Cuándo se dispara' },
  { clave: 'actionType', etiqueta: 'Qué hace' },
  { clave: 'condition', etiqueta: 'Condición' },
  { clave: 'actionConfig', etiqueta: 'Configuración' },
  { clave: 'fieldMapping', etiqueta: 'Mapeo de campos' },
  { clave: 'allowCascade', etiqueta: 'Permitir encadenado' },
]

/** Mismas palabras que muestra el editor visual, para que no haya que traducir. */
const ETIQUETAS_DE_TRIGGER: Record<string, string> = {
  ENTRY_CREATED: 'Cuando se crea una entrada',
  ENTRY_COMPLETED: 'Cuando se completa una entrada',
  FIELD_VALUE_CHANGED: 'Cuando cambia un campo de la entrada',
  COMPARISON_FAILED: 'Cuando falla una comparación',
}

const ETIQUETAS_DE_ACCION: Record<string, string> = {
  CREATE_ENTRY: 'Crear entrada en otro registro',
  UPDATE_FIELD: 'Actualizar campo de una entrada',
  NOTIFY: 'Notificar dentro de la app',
  WEBHOOK: 'Llamar a un webhook',
  EMAIL: 'Enviar email',
}

export function diffRecordAction(
  before: unknown,
  after: unknown,
  nombresDeRegistros: Map<string, string>,
): Array<{ field: string; from: unknown; to: unknown }> {
  const previo = (before ?? null) as Record<string, unknown> | null
  const nuevo = (after ?? null) as Record<string, unknown> | null
  if (previo === null && nuevo === null) return []

  const legible = (clave: string, valor: unknown): unknown => {
    if (valor === undefined) return undefined
    if (clave === 'targetRecordId' && typeof valor === 'string') {
      return nombresDeRegistros.get(valor) ?? valor
    }
    if (clave === 'trigger' && typeof valor === 'string') {
      return ETIQUETAS_DE_TRIGGER[valor] ?? valor
    }
    if (clave === 'actionType' && typeof valor === 'string') {
      return ETIQUETAS_DE_ACCION[valor] ?? valor
    }
    // El mapeo es una lista y mostrarla cruda no aporta; interesa cuántos
    // campos viajan, y el detalle está en el editor.
    if (clave === 'fieldMapping' && Array.isArray(valor)) {
      return valor.length === 1 ? '1 campo' : `${valor.length} campos`
    }
    return valor
  }

  const cambios: Array<{ field: string; from: unknown; to: unknown }> = []
  for (const { clave, etiqueta } of CAMPOS_DE_FLUJO) {
    const antes = legible(clave, previo?.[clave])
    const despues = legible(clave, nuevo?.[clave])
    // Serializado, porque `condition` y `actionConfig` son objetos anidados.
    if (JSON.stringify(antes) === JSON.stringify(despues)) continue
    cambios.push({ field: etiqueta, from: antes, to: despues })
  }
  return cambios
}

function extraerData(valor: unknown): Record<string, unknown> | null {
  if (typeof valor !== 'object' || valor === null) return null
  const data = (valor as { data?: unknown }).data
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null
  return data as Record<string, unknown>
}
