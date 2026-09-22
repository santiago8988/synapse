import { z } from 'zod'

export const createAreaSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().cuid().optional(),
}).strict()

export const updateAreaSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  parentId: z.string().cuid().nullable().optional(),
}).strict()

export type CreateAreaInput = z.infer<typeof createAreaSchema>
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>
