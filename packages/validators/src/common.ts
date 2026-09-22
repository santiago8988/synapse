import { z } from 'zod'

/**
 * Fecha que llega de un `<input type="date">`, o sea `YYYY-MM-DD`.
 *
 * No se usa `.datetime()` porque exige ISO 8601 completo con hora y rechazaria
 * justo lo que mandan los formularios. Lo que se valida es que `new Date()`
 * pueda parsearla: sin esto una cadena cualquiera llega hasta Prisma como
 * `Invalid Date` y sale un 500 en vez de un 400.
 */
export const fechaDeFormularioSchema = z
  .string()
  .refine((valor) => !Number.isNaN(Date.parse(valor)), { message: 'Fecha invalida' })
