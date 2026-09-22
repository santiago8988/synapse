import { z } from 'zod'
import { resultsJsonSchema } from './json'

export const changeCalibrationStatusSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED']),
}).strict()

export const addCalibrationPatternSchema = z.object({
  patternEntryId: z.string().cuid(),
}).strict()

/**
 * `{ [testId]: { [pointId]: { readings: number[] } } }`. Tres niveles, que es
 * exactamente lo que `resultsJsonSchema` admite.
 */
export const saveCalibrationResultsSchema = z.object({
  results: resultsJsonSchema,
}).strict()

export type ChangeCalibrationStatusInput = z.infer<typeof changeCalibrationStatusSchema>
export type AddCalibrationPatternInput = z.infer<typeof addCalibrationPatternSchema>
export type SaveCalibrationResultsInput = z.infer<typeof saveCalibrationResultsSchema>
