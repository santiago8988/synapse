import { z } from 'zod'

const punto = z.object({
  name: z.string().min(1).max(200),
  order: z.number().int().min(0).max(10_000),
  load: z.number().finite().optional(),
  unit: z.string().max(32).optional(),
}).strict()

/**
 * Una prueba de la plantilla con sus puntos de medicion.
 *
 * `criteriaOperator` y `formulaError` quedan como strings acotados: el primero
 * no tiene enum declarado en Prisma y el segundo es una expresion que evalua
 * mathjs del lado del backend, sobre una instancia restringida. Cerrarlos por
 * adivinanza romperia plantillas que ya existen.
 */
const prueba = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  order: z.number().int().min(0).max(10_000),
  tolerance: z.number().finite().optional(),
  toleranceUnit: z.string().max(32).optional(),
  readingsPerPoint: z.number().int().positive().max(1000).optional(),
  formulaError: z.string().max(2000).optional(),
  criteriaOperator: z.string().max(50).optional(),
  notes: z.string().max(5000).optional(),
  points: z.array(punto).max(500),
}).strict()

const MAX_PRUEBAS = 200

const campos = {
  name: z.string().min(1).max(200),
  code: z.string().max(50).optional(),
  description: z.string().max(5000).optional(),
  unitMain: z.string().max(32).optional(),
  unitTolerance: z.string().max(32).optional(),
  periodicity: z.number().int().positive().max(3650).optional(),
  notifyDaysBefore: z.number().int().min(0).max(365).optional(),
}

export const createCalibrationTemplateSchema = z.object({
  ...campos,
  tests: z.array(prueba).max(MAX_PRUEBAS),
}).strict()

/**
 * Incluye `periodicity` y `notifyDaysBefore`, que el tipo inline del controller
 * declaraba en `create` pero no en `update`.
 *
 * El service si los declara y los escribe
 * (`data.periodicity !== undefined ? (data.periodicity ?? null) : template.periodicity`),
 * asi que copiar el tipo del controller hubiera hecho que cambiar la
 * periodicidad de una plantilla de calibracion no tuviera efecto. Es la cuarta
 * vez que el tipo inline de un controller resulta estar desactualizado: el tipo
 * se borra al compilar, asi que la verdad es lo que el service escribe.
 */
export const updateCalibrationTemplateSchema = z.object({
  ...campos,
  name: campos.name.optional(),
  tests: z.array(prueba).max(MAX_PRUEBAS).optional(),
}).strict()

export type CreateCalibrationTemplateInput = z.infer<typeof createCalibrationTemplateSchema>
export type UpdateCalibrationTemplateInput = z.infer<typeof updateCalibrationTemplateSchema>
