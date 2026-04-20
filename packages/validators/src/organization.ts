import { z } from 'zod'

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().optional(),
})

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
