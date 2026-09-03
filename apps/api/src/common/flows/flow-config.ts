/**
 * Validación de la configuración de un flujo (RecordAction).
 *
 * Se distinguen dos niveles, porque tienen consecuencias distintas:
 *
 *  - ERRORES: la configuración está corrupta (apunta a un campo que no existe,
 *    mapea dos veces el mismo destino). No es algo que el usuario haya querido
 *    dejar a medias, así que se rechaza al guardar.
 *
 *  - ADVERTENCIAS: la configuración está incompleta pero es coherente (todavía
 *    no se mapeó el identificador del destino). Se permite guardar —el usuario
 *    puede estar a mitad de camino— pero el flujo NO se ejecuta hasta que se
 *    complete, y la UI lo marca.
 *
 * Lo usan tanto records.service (al guardar y al listar) como
 * RecordActionListener (antes de ejecutar). Que la regla viva en un solo lugar
 * es lo que garantiza que "lo que la UI marca como incompleto" y "lo que el
 * listener se niega a ejecutar" sean exactamente el mismo conjunto.
 */

export interface FlowMappingRow {
  sourceFieldId: string
  targetFieldId: string
}

export interface TargetFieldRef {
  id: string
  label?: string
  isActive: boolean
  isIdentifier: boolean
}

/**
 * Descarta las filas a medio completar: agregar una fila de mapeo y todavía no
 * elegir origen o destino es un estado normal de edición, no un dato. Guardar
 * la fila vacía terminaba escribiendo una clave vacía en el JSON de la entry
 * destino.
 */
export function sanitizeFieldMapping(raw: unknown): FlowMappingRow[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((row): row is FlowMappingRow => {
      if (typeof row !== 'object' || row === null) return false
      const r = row as Partial<FlowMappingRow>
      return (
        typeof r.sourceFieldId === 'string' &&
        typeof r.targetFieldId === 'string' &&
        r.sourceFieldId.trim() !== '' &&
        r.targetFieldId.trim() !== ''
      )
    })
    .map((row) => ({
      sourceFieldId: row.sourceFieldId.trim(),
      targetFieldId: row.targetFieldId.trim(),
    }))
}

/**
 * Configuración corrupta. Devuelve mensajes en español listos para mostrar;
 * vacío significa que se puede guardar.
 */
export function findMappingErrors(
  mapping: FlowMappingRow[],
  targetFields: TargetFieldRef[],
): string[] {
  const errors: string[] = []
  const activeIds = new Set(targetFields.filter((f) => f.isActive).map((f) => f.id))

  const unknown = mapping.filter((m) => !activeIds.has(m.targetFieldId))
  if (unknown.length > 0) {
    errors.push(
      `El mapeo apunta a ${unknown.length === 1 ? 'un campo que no existe' : 'campos que no existen'} en el registro destino. Revisá el mapeo: puede que el campo se haya eliminado.`,
    )
  }

  const seen = new Set<string>()
  const duplicated = new Set<string>()
  for (const m of mapping) {
    if (seen.has(m.targetFieldId)) duplicated.add(m.targetFieldId)
    seen.add(m.targetFieldId)
  }
  if (duplicated.size > 0) {
    const labels = Array.from(duplicated).map(
      (id) => targetFields.find((f) => f.id === id)?.label ?? id,
    )
    errors.push(
      `Hay campos del destino mapeados más de una vez: ${labels.join(', ')}. Cada campo destino admite un solo origen.`,
    )
  }

  return errors
}

export interface ConfigWarningInput {
  actionType: string
  mapping: FlowMappingRow[]
  targetFields: TargetFieldRef[]
  actionConfig?: unknown
}

/**
 * Configuración incompleta. El flujo se guarda igual, pero no se ejecuta.
 * Vacío = el flujo está listo para correr.
 */
export function findConfigWarnings({
  actionType,
  mapping,
  targetFields,
  actionConfig,
}: ConfigWarningInput): string[] {
  const warnings: string[] = []

  if (actionType === 'CREATE_ENTRY') {
    if (mapping.length === 0) {
      warnings.push('No hay ningún campo mapeado hacia el registro destino.')
    }
    const mapped = new Set(mapping.map((m) => m.targetFieldId))
    const missing = targetFields.filter(
      (f) => f.isActive && f.isIdentifier && !mapped.has(f.id),
    )
    if (missing.length > 0) {
      warnings.push(
        `Falta mapear ${missing.length === 1 ? 'el campo identificador' : 'los campos identificadores'} del destino: ${missing
          .map((f) => f.label ?? f.id)
          .join(', ')}.`,
      )
    }
  }

  if (actionType === 'UPDATE_FIELD') {
    const cfg = (actionConfig ?? {}) as { fieldId?: string; entryIdSource?: string }
    if (!cfg.fieldId) warnings.push('Falta elegir el campo a actualizar.')
    if (!cfg.entryIdSource) warnings.push('Falta indicar sobre qué entrada se aplica.')
  }

  return warnings
}

/** Un flujo se ejecuta solo si no tiene advertencias de configuración. */
export function isFlowExecutable(input: ConfigWarningInput): boolean {
  return findConfigWarnings(input).length === 0
}
