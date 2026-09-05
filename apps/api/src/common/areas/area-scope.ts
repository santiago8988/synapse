/**
 * Resolución del alcance de áreas de un usuario.
 *
 * La regla del sistema —documentada desde el principio y hasta ahora aplicada
 * en casi ningún lado— es que cada uno ve **su área y todas las que cuelgan de
 * ella**. Acá vive esa regla, en una pieza reusable y probada, para que cada
 * módulo que la necesite no la reinvente con un criterio propio.
 *
 * `AreaAccessGuard` implementa lo mismo con consultas recursivas —una por nivel
 * del árbol— y además no está aplicado a ningún endpoint. Este módulo trae las
 * áreas de la organización de una sola vez y camina el árbol en memoria: un
 * tablero que resuelve el árbol seis veces por carga no es viable.
 */

export interface AreaNodo {
  id: string
  parentId: string | null
}

/** Lo mínimo que hace falta saber del usuario para resolver su alcance. */
export interface UsuarioConArea {
  role: string
  areaId?: string | null
}

/**
 * Roles que ven toda la organización.
 *
 * `AUDITOR` está por definición del rol: auditar una sola área no es auditar.
 * `ADMIN` porque administra la organización entera, incluido el árbol de áreas.
 */
const ROLES_SIN_RESTRICCION = new Set(['ADMIN', 'AUDITOR'])

/**
 * Ids del área dada más todas sus descendientes, a cualquier profundidad.
 *
 * Es tolerante a árboles mal formados: un ciclo —que la interfaz no deja armar,
 * pero un `UPDATE` a mano sí— haría que una implementación ingenua no termine
 * nunca. Acá cada id se visita una sola vez.
 */
export function descendientesDe(areas: AreaNodo[], raizId: string): string[] {
  const hijosPorPadre = new Map<string, string[]>()
  for (const area of areas) {
    if (!area.parentId) continue
    const hermanos = hijosPorPadre.get(area.parentId)
    if (hermanos) hermanos.push(area.id)
    else hijosPorPadre.set(area.parentId, [area.id])
  }

  const alcanzadas = new Set<string>([raizId])
  const pendientes = [raizId]
  while (pendientes.length > 0) {
    const actual = pendientes.pop() as string
    for (const hijo of hijosPorPadre.get(actual) ?? []) {
      if (alcanzadas.has(hijo)) continue
      alcanzadas.add(hijo)
      pendientes.push(hijo)
    }
  }
  return [...alcanzadas]
}

/**
 * Áreas que el usuario puede ver.
 *
 * Devuelve `null` cuando **no hay restricción** —ADMIN y AUDITOR—, que no es lo
 * mismo que un array vacío: vacío significa "no ve ninguna área", y es lo que
 * le toca a alguien sin área asignada. Confundir los dos casos convierte
 * silenciosamente un tablero vacío en un tablero completo, o al revés.
 */
export function alcanceDeAreas(
  usuario: UsuarioConArea,
  areas: AreaNodo[],
): string[] | null {
  if (ROLES_SIN_RESTRICCION.has(usuario.role)) return null
  if (!usuario.areaId) return []
  return descendientesDe(areas, usuario.areaId)
}

/**
 * Filtro Prisma para los `Record` que el usuario puede ver.
 *
 * Un `Record` pertenece a **0 o más** áreas (junction `RecordArea`), y ese cero
 * obliga a una decisión: un registro sin área no es "de otra área", es **sin
 * clasificar**. Se muestra a todos.
 *
 * La alternativa —esconderlo— hace desaparecer trabajo sin que nadie se entere,
 * que es el peor modo de fallar para un tablero cuyo propósito es justamente
 * que nada se escape. Y como quien lo ve puede clasificarlo, mostrarlo es lo
 * que hace que el hueco se cierre en vez de agrandarse.
 */
export function filtroDeRecordsVisibles(
  organizationId: string,
  areasVisibles: string[] | null,
) {
  if (areasVisibles === null) return { organizationId }
  return {
    organizationId,
    OR: [
      { areas: { some: { areaId: { in: areasVisibles } } } },
      { areas: { none: {} } },
    ],
  }
}
