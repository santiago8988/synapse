import { z } from 'zod'

const camposDeMetodo = {
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(200),
  parameter: z.string().min(1).max(200),
  unit: z.string().max(32).optional(),
  defaultMin: z.number().finite().optional(),
  defaultMax: z.number().finite().optional(),
  sourceRef: z.string().max(500).optional(),
}

export const createMethodSchema = z.object(camposDeMetodo)

/** `Partial<CreateMethodDto>`, que es lo que el service declara. */
export const updateMethodSchema = createMethodSchema.partial()

export type CreateMethodInput = z.infer<typeof createMethodSchema>
export type UpdateMethodInput = z.infer<typeof updateMethodSchema>
