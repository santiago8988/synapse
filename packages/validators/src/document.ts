import { z } from 'zod'

const documentStatusEnum = z.enum(['DRAFT', 'ACTIVE', 'SUPERSEDED'])

export const createDocumentSchema = z.object({
  title: z.string().min(1).max(200),
  code: z.string().max(50).optional(),
}).strict()

/**
 * Los campos editables de un documento, y nada mas.
 *
 * Este es el endpoint donde el body crudo llegaba entero a Prisma. `Document`
 * tiene dos campos que no son editables y que el modelo si acepta:
 * `organizationId`, que movia el documento a otro tenant, y `fileKey`, que
 * direcciona el archivo — escribir la key ajena devolvia una URL firmada al PDF
 * de otro laboratorio. Ninguno de los dos figura aca, asi que el parseo los
 * descarta antes de que el handler los vea.
 *
 * `version` tampoco: la calcula `createNewVersion`, no el cliente.
 */
export const updateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  code: z.string().max(50).optional(),
  status: documentStatusEnum.optional(),
}).strict()

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
