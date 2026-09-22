import { z } from 'zod'

/**
 * NO lleva `.strict()`, a diferencia del resto de los schemas. Dos motivos:
 *
 *  1. El formulario manda `requiredInstruments` (TO_DO.md §26), igual que el de
 *     matrices.
 *  2. Cada ingrediente que vuelve del GET arrastra `stockRecipe`, el objeto de
 *     la relacion, y el formulario lo reenvia tal cual al editar.
 *
 * Con `.strict()` las dos cosas serian un 400 en cada guardado de formula.
 */

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
})

const paso = z.object({
  order: z.number().int().min(0).max(10_000),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  duration: z.number().int().nonnegative().max(1_000_000).optional(),
  controls: z.string().max(5000).optional(),
})

const MAX_FILAS = 500

export const createRecipeSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().min(1).max(50),
  ingredients: z.array(ingrediente).max(MAX_FILAS),
  steps: z.array(paso).max(MAX_FILAS),
})

export const updateRecipeSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().min(1).max(50).optional(),
  ingredients: z.array(ingrediente).max(MAX_FILAS).optional(),
  steps: z.array(paso).max(MAX_FILAS).optional(),
})

export type CreateRecipeInput = z.infer<typeof createRecipeSchema>
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>
