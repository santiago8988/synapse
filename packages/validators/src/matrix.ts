import { z } from 'zod'

const parametro = z.object({
  name: z.string().min(1).max(200),
  method: z.string().max(200).optional(),
  unit: z.string().max(32).optional(),
  minValue: z.number().finite().optional(),
  maxValue: z.number().finite().optional(),
  order: z.number().int().min(0).max(10_000),
})

/**
 * `fieldType` queda como string acotado y no como enum: las condiciones de una
 * matriz son un subconjunto propio de tipos, distinto del `FieldType` de los
 * records, y no esta declarado en ningun enum de Prisma. Cerrarlo por adivinanza
 * romperia matrices existentes.
 */
const condicion = z.object({
  label: z.string().min(1).max(200),
  fieldType: z.string().min(1).max(50),
  unit: z.string().max(32).optional(),
  options: z.array(z.string().max(120)).max(200).optional(),
  order: z.number().int().min(0).max(10_000),
})

const MAX_FILAS = 300

export const createMatrixSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(50).optional(),
  description: z.string().max(5000).optional(),
  parameters: z.array(parametro).max(MAX_FILAS),
  conditions: z.array(condicion).max(MAX_FILAS).optional(),
})

export const updateMatrixSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(50).optional(),
  description: z.string().max(5000).optional(),
  parameters: z.array(parametro).max(MAX_FILAS).optional(),
  conditions: z.array(condicion).max(MAX_FILAS).optional(),
})

export type CreateMatrixInput = z.infer<typeof createMatrixSchema>
export type UpdateMatrixInput = z.infer<typeof updateMatrixSchema>
