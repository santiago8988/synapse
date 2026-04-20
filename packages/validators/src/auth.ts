import { z } from 'zod'

export const switchOrgSchema = z.object({
  organizationId: z.string().cuid(),
})

export type SwitchOrgInput = z.infer<typeof switchOrgSchema>
