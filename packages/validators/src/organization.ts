import { z } from 'zod'
import { fechaDeFormularioSchema } from './common'

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().optional(),
}).strict()

export const createPositionSchema = z.object({
  name: z.string().min(1).max(100),
}).strict()

export const setAreaLeaderSchema = z.object({
  leaderId: z.string().cuid().nullable(),
}).strict()

export const addTrainingSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  provider: z.string().max(200).optional(),
  completedAt: fechaDeFormularioSchema,
  expiresAt: fechaDeFormularioSchema.optional(),
  certificateUrl: z.string().url().optional(),
}).strict()

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
export type CreatePositionInput = z.infer<typeof createPositionSchema>
export type SetAreaLeaderInput = z.infer<typeof setAreaLeaderSchema>
export type AddTrainingInput = z.infer<typeof addTrainingSchema>
