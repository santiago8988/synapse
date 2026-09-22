import { z } from 'zod'
import { resultsJsonSchema } from './json'

export const changeSampleStatusSchema = z.object({
  status: z.enum(['RECEIVED', 'IN_TESTING', 'COMPLETED']),
})

/**
 * Resultados y condiciones de una muestra: mapas abiertos —las claves son ids
 * de parametro o de condicion— que van derecho a una columna Json. Se acota la
 * forma, igual que `Entry.data`.
 */
export const saveSampleResultsSchema = z.object({
  results: resultsJsonSchema,
})

export const saveSampleConditionsSchema = z.object({
  conditions: resultsJsonSchema,
})

export type ChangeSampleStatusInput = z.infer<typeof changeSampleStatusSchema>
export type SaveSampleResultsInput = z.infer<typeof saveSampleResultsSchema>
export type SaveSampleConditionsInput = z.infer<typeof saveSampleConditionsSchema>
