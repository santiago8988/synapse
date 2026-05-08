// Helper compartido para computar el chip de "condición" de un instrumento.
// Lo usan las cards "Equipos asignados" de Sample y Batch detail.
//
// Reglas:
//   OK     (verde)   → status==='ACTIVE' AND (nextCalibrationAt===null OR >now)
//   OVERDUE (amarillo) → status==='ACTIVE' AND nextCalibrationAt<=now
//   INACTIVE (rojo)   → cualquier otro status
//
// El gate de completar en el backend usa exactamente el mismo criterio:
// solo OK pasa.

export type InstrumentConditionState = 'OK' | 'OVERDUE' | 'INACTIVE'

export interface InstrumentConditionInput {
  status: string
  nextCalibrationAt: string | Date | null
}

export interface InstrumentConditionChip {
  state: InstrumentConditionState
  label: string
  cls: string // clase Synapse ya existente: syn-chip-ok / -warn / -fail
}

export function computeConditionChip(input: InstrumentConditionInput): InstrumentConditionChip {
  if (input.status !== 'ACTIVE') {
    const humanStatus =
      input.status === 'IN_CALIBRATION'
        ? 'En calibración'
        : input.status === 'IN_REPAIR'
          ? 'En reparación'
          : input.status === 'DECOMMISSIONED'
            ? 'De baja'
            : input.status
    return { state: 'INACTIVE', label: humanStatus, cls: 'syn-chip-fail' }
  }

  if (input.nextCalibrationAt) {
    const next = typeof input.nextCalibrationAt === 'string'
      ? new Date(input.nextCalibrationAt)
      : input.nextCalibrationAt
    if (next.getTime() <= Date.now()) {
      return { state: 'OVERDUE', label: 'Calibración vencida', cls: 'syn-chip-warn' }
    }
  }

  return { state: 'OK', label: 'En condiciones', cls: 'syn-chip-ok' }
}
