import { z } from 'zod'

const cantidad = z.number().finite().nonnegative().max(1_000_000_000)

/**
 * `reason` queda registrado en `BatchStatusLog`, que es append-only: lo que
 * entre aca es lo que una auditoria va a leer, asi que tiene techo.
 */
export const changeBatchStatusSchema = z.object({
  status: z.enum(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'APPROVED', 'REJECTED']),
  producedQuantity: cantidad.optional(),
  unit: z.string().max(32).optional(),
  reason: z.string().max(1000).optional(),
}).strict()

export const consumeStockSchema = z.object({
  consumptions: z
    .array(
      z.object({
        ingredientName: z.string().min(1).max(200),
        product: z.string().min(1).max(200),
        lotNumber: z.string().min(1).max(100),
        quantity: cantidad,
        unit: z.string().min(1).max(32),
      }),
    )
    .max(500),
}).strict()

/**
 * Cierre de produccion. Los consumos NO llevan `ingredientName`, a diferencia
 * de `consumeStockSchema`: el formulario de cierre manda solo lo que hace falta
 * para descontar del inventario, y el nombre del ingrediente ya esta en la
 * formula.
 */
export const completeBatchSchema = z.object({
  producedQuantity: cantidad,
  unit: z.string().min(1).max(32),
  consumptions: z
    .array(
      z.object({
        product: z.string().min(1).max(200),
        lotNumber: z.string().min(1).max(100),
        quantity: cantidad,
        unit: z.string().min(1).max(32),
      }).strict(),
    )
    .max(500),
}).strict()

export const updateBatchSchema = z.object({
  producedQuantity: cantidad.optional(),
  unit: z.string().max(32).optional(),
}).strict()

export type ChangeBatchStatusInput = z.infer<typeof changeBatchStatusSchema>
export type ConsumeStockInput = z.infer<typeof consumeStockSchema>
export type CompleteBatchInput = z.infer<typeof completeBatchSchema>
export type UpdateBatchInput = z.infer<typeof updateBatchSchema>
