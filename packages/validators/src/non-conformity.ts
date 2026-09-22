import { z } from 'zod'
import { fechaDeFormularioSchema } from './common'

export const createNonConformitySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  entryId: z.string().cuid().optional(),
  assignedToId: z.string().cuid().optional(),
}).strict()

export const updateNonConformityStatusSchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']),
}).strict()

export const addCorrectiveActionSchema = z.object({
  description: z.string().min(1).max(5000),
  dueDate: fechaDeFormularioSchema.optional(),
}).strict()

export type CreateNonConformityInput = z.infer<typeof createNonConformitySchema>
export type UpdateNonConformityStatusInput = z.infer<typeof updateNonConformityStatusSchema>
export type AddCorrectiveActionInput = z.infer<typeof addCorrectiveActionSchema>
