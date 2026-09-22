import { z } from 'zod'

/**
 * Un solo schema de ingrediente para alta y edicion.
 *
 * El tipo inline del controller declaraba menos campos en `update` que en
 * `create` —sin `fromStock` ni `stockRecipeId`— pero `recipes.service.update`
 * los escribe igual (`fromStock: i.fromStock ?? false`). Copiar ese tipo
 * hubiera reseteado el vinculo con stock cada vez que alguien editaba una
 * receta, sin error y sin aviso. Es la misma trampa que en `addFields` de
 * records: el tipo del controller se borra en runtime, asi que la verdad es lo
 * que el service escribe.
 */
const ingrediente = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().finite().nonnegative().max(1_000_000_000),
  unit: z.string().min(1).max(32),
  order: z.number().int().min(0).max(10_000),
  fromStock: z.boolean().optional(),
  stockRecipeId: z.string().cuid().optional(),
  /**
   * El objeto de la relacion, que vuelve del GET y el formulario reenvia tal
   * cual al editar. Se acepta y se ignora — el service enumera los campos que
   * escribe—; declararlo es lo que permite cerrar el schema con `.strict()` sin
   * romper el guardado de una formula existente.
   */
  stockRecipe: z
    .object({
      id: z.string(),
      name: z.string(),
      code: z.string().nullish(),
    })
    .nullish(),
}).strict()

const paso = z.object({
  order: z.number().int().min(0).max(10_000),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  duration: z.number().int().nonnegative().max(1_000_000).optional(),
  controls: z.string().max(5000).optional(),
}).strict()

/** Etiquetas de los equipos que la produccion requiere. Ver TO_DO.md §26. */
const instrumentoRequerido = z.object({
  label: z.string().min(1).max(200),
  order: z.number().int().min(0).max(10_000),
}).strict()

const MAX_FILAS = 500

export const createRecipeSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  ingredients: z.array(ingrediente).max(MAX_FILAS),
  steps: z.array(paso).max(MAX_FILAS),
  requiredInstruments: z.array(instrumentoRequerido).max(MAX_FILAS).optional(),
}).strict()

export const updateRecipeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  ingredients: z.array(ingrediente).max(MAX_FILAS).optional(),
  steps: z.array(paso).max(MAX_FILAS).optional(),
  requiredInstruments: z.array(instrumentoRequerido).max(MAX_FILAS).optional(),
}).strict()

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>
