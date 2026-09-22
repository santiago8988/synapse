import { z } from 'zod'

const userRoleEnum = z.enum(['ADMIN', 'QUALITY_MANAGER', 'TECHNICIAN', 'AUDITOR'])

export const addWhitelistSchema = z.object({
  email: z.string().email(),
  role: userRoleEnum.optional().default('TECHNICIAN'),
  areaId: z.string().cuid().optional(),
})

/**
 * El rol viaja como enum y no como `string` libre: este es el endpoint por el
 * que se escalaban privilegios cross-tenant antes de que `updateUser` filtrara
 * por organizacion, asi que conviene que lo que entra este cerrado.
 *
 * `positionId`, `phone` y `signature` faltaban: el controller los acepta y el
 * schema —que nunca se habia llegado a aplicar— los ignoraba.
 */
export const updateOrgUserSchema = z.object({
  role: userRoleEnum.optional(),
  areaId: z.string().cuid().nullable().optional(),
  positionId: z.string().cuid().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  signature: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
})

export type AddWhitelistInput = z.infer<typeof addWhitelistSchema>
export type UpdateOrgUserInput = z.infer<typeof updateOrgUserSchema>
