import { z } from 'zod'

export const updateOrganizationSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().optional(),
})

export const createPositionSchema = z.object({
  name: z.string().min(1).max(100),
})

export const setAreaLeaderSchema = z.object({
  leaderId: z.string().cuid().nullable(),
})

/**
 * Fecha que llega de un `<input type="date">`, o sea `YYYY-MM-DD`.
 *
 * No se usa `.datetime()` porque exige ISO 8601 completo con hora y rechazaria
 * justamente lo que manda el formulario. Lo que se valida es que `new Date()`
 * pueda parsearla: hoy una cadena cualquiera llega hasta Prisma como
 * `Invalid Date` y revienta con un 500 en vez de un 400.
 */
const fechaDeFormulario = z
  .string()
  .refine((valor) => !Number.isNaN(Date.parse(valor)), { message: 'Fecha inválida' })

export const addTrainingSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  provider: z.string().max(200).optional(),
  completedAt: fechaDeFormulario,
  expiresAt: fechaDeFormulario.optional(),
  certificateUrl: z.string().url().optional(),
})

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>
export type CreatePositionInput = z.infer<typeof createPositionSchema>
export type SetAreaLeaderInput = z.infer<typeof setAreaLeaderSchema>
export type AddTrainingInput = z.infer<typeof addTrainingSchema>
