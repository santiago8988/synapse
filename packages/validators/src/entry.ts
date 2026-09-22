import { z } from 'zod'

/**
 * Limites de `Entry.data`.
 *
 * Es el unico body de la API que es un mapa abierto: las claves son ids de
 * fields, asi que no se pueden enumerar en un schema. Hasta ahora entraba como
 * `Record<string, unknown>` sin limite de claves, de profundidad ni de tamano
 * de valor, y se escribia directo a una columna Json.
 *
 * El tamano total ya esta acotado aguas arriba: el body parser de Express corta
 * el JSON en 100 kB por defecto y la API no lo sube. Lo que falta acotar es la
 * forma, que es lo que puede degradar una query sobre la columna Json o llenar
 * la fila de basura sin pasarse de ese limite.
 *
 * Los numeros son holgados a proposito. Un registro con mas de 300 campos ya es
 * otra clase de problema, y el objetivo de la Fase 1.1 no es afinar cuotas sino
 * que deje de entrar cualquier cosa.
 */
export const ENTRY_DATA_MAX_CLAVES = 300
export const ENTRY_DATA_MAX_TEXTO = 10_000
export const ENTRY_DATA_MAX_ITEMS = 500

const primitivo = z.union([
  z.string().max(ENTRY_DATA_MAX_TEXTO),
  z.number().finite(),
  z.boolean(),
  z.null(),
])

/**
 * Un objeto plano de primitivos. Es la forma que tienen los values de
 * `FILE_PDF` (`{ key, name, size, url?, uploadedAt?, uploadedById? }`), que el
 * frontend reenvia tal cual porque manda `data` completa y no parcial.
 */
const objetoPlano = z.record(primitivo)

/**
 * La profundidad se declara explicita en vez de usar `z.lazy()`: recursion sin
 * fondo es justamente lo que hay que evitar, y tres niveles cubren todo lo que
 * los field types generan hoy (primitivo, objeto de archivo, lista de ids o de
 * objetos de archivo).
 */
const valorDeCampo = z.union([
  primitivo,
  z.array(z.union([primitivo, objetoPlano])).max(ENTRY_DATA_MAX_ITEMS),
  objetoPlano,
])

export const entryDataSchema = z
  .record(valorDeCampo)
  .refine((data) => Object.keys(data).length <= ENTRY_DATA_MAX_CLAVES, {
    message: `El registro no puede tener mas de ${ENTRY_DATA_MAX_CLAVES} campos`,
  })

export const createEntrySchema = z.object({
  data: entryDataSchema,
  revisionDate: z.string().max(40).optional(),
  lotNumber: z.string().max(100).optional(),
  sampleCode: z.string().max(100).optional(),
  client: z.string().max(200).optional(),
}).strict()

/**
 * `transitionReason` es el motivo que pide una transition con
 * `requireReason: true` en un field DROPDOWN-as-status. Va al `EntryStatusLog`,
 * que es append-only: lo que entre aca queda para la auditoria, asi que
 * conviene que tenga un techo.
 */
export const updateEntrySchema = z.object({
  data: entryDataSchema,
  transitionReason: z.string().max(1000).optional(),
}).strict()

export type EntryDataInput = z.infer<typeof entryDataSchema>
export type CreateEntryInput = z.infer<typeof createEntrySchema>
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>
