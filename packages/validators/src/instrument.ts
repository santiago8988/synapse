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
