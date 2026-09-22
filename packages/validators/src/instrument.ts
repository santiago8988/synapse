import { z } from 'zod'

/**
 * `reason` va a `InstrumentStatusLog`, que es append-only.
 *
 * El estado del instrumental no es cosmetico: uno en IN_CALIBRATION o IN_REPAIR
 * no puede ser referenciado por una entry nueva, asi que el enum cerrado evita
 * que un valor inventado deje un instrumento en un estado que las validaciones
 * no contemplan.
 */
export const changeInstrumentStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'IN_CALIBRATION', 'IN_REPAIR', 'DECOMMISSIONED']),
  reason: z.string().max(1000).optional(),
}).strict()

export type ChangeInstrumentStatusInput = z.infer<typeof changeInstrumentStatusSchema>

/**
 * Asignar un instrumento real a una etiqueta requerida por la plantilla
 * (`POST .../instrument-assignments`). Ver TO_DO.md §26.
 *
 * `label` es texto libre y no un id: es la etiqueta que la Matriz o la Formula
 * declaro, y se copia a la asignacion para que una corrida ya cerrada siga
 * diciendo contra que equipo se ensayo aunque despues se edite la plantilla.
 */
export const assignInstrumentSchema = z.object({
  label: z.string().min(1).max(200),
  instrumentId: z.string().cuid(),
  order: z.number().int().min(0).max(10_000),
}).strict()

export type AssignInstrumentInput = z.infer<typeof assignInstrumentSchema>
