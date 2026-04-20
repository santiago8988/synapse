import { z } from 'zod'

const userRoleEnum = z.enum(['ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN', 'AUDITOR'])

export const addWhitelistSchema = z.object({
  email: z.string().email(),
  role: userRoleEnum.optional().default('TECHNICIAN'),
  areaId: z.string().cuid().optional(),
})

export const updateOrgUserSchema = z.object({
  role: userRoleEnum.optional(),
  areaId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().optional(),
})

export type AddWhitelistInput = z.infer<typeof addWhitelistSchema>
export type UpdateOrgUserInput = z.infer<typeof updateOrgUserSchema>
