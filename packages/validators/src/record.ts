import { z } from 'zod'
import { fieldConfigSchema, flowConfigJsonSchema } from './json'

const recordTypeEnum = z.enum([
  'PERIODIC',
  'NOT_PERIODIC',
  'NOT_PERIODIC_WITH_REVISION',
  'INSTRUMENTAL',
  'BATCH',
  'SAMPLE',
  'STOCK',
])

const fieldTypeEnum = z.enum([
  'NUMBER',
  'TEXT',
  'DATE',
  'DROPDOWN',
  'MATRIX_METHOD',
  'RECIPE_SELECT',
  'QUANTITY',
  'CALIBRATION_TEMPLATE',
  'RELATED_ENTRY',
  'MULTIPLE_RELATED_ENTRY',
  'COMPARISON',
  'FORMULA',
  'FILE_PDF',
])

/** Mismo techo que `entryDataSchema`: un registro con mas campos que eso no se carga. */
const MAX_FIELDS = 300

const idsDeArea = z.array(z.string().cuid()).max(100)

const campoNuevo = z.object({
  label: z.string().min(1).max(200),
  fieldType: fieldTypeEnum,
  order: z.number().int().min(0).max(10_000),
  isIdentifier: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  relatedRecordId: z.string().cuid().optional(),
  relatedFieldIds: z.array(z.string().cuid()).max(MAX_FIELDS).optional(),
  comparisonConfig: fieldConfigSchema.optional(),
  formulaConfig: fieldConfigSchema.optional(),
}).strict()

export const createRecordSchema = z.object({
  name: z.string().min(1).max(200),
  type: recordTypeEnum,
  areaIds: idsDeArea.optional(),
  // Opcionales pero no nullable, aunque las columnas sean `Int?` / `String?`.
  // Los DTO del service las declaran `number | undefined` y ningun cliente
  // manda null: el formulario omite la clave cuando esta vacia. Aceptar null
  // seria declarar una forma de limpiarlas que hoy no existe en ningun lado.
  documentId: z.string().cuid().optional(),
  periodicity: z.number().int().positive().max(3650).optional(),
  notifyDaysBefore: z.number().int().min(0).max(365).optional(),
  fields: z.array(campoNuevo).max(MAX_FIELDS),
}).strict()

/**
 * `changeReason` es obligatorio y tiene techo: versionar un registro escribe una
 * fila nueva de version con ese motivo, y es lo que una auditoria lee para
 * entender por que cambio el formulario con el que se cargaron los ensayos.
 */
export const editRecordSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  areaIds: idsDeArea.optional(),
  periodicity: z.number().int().positive().max(3650).optional(),
  notifyDaysBefore: z.number().int().min(0).max(365).optional(),
  changeReason: z.string().min(1).max(1000),
  // `campoNuevo` completo, con `relatedRecordId` y `relatedFieldIds`.
  //
  // El tipo inline del controller no los declaraba y era facil copiarlo tal
  // cual, pero estaba desactualizado: como el tipo se borra en runtime, los dos
  // campos venian pasando igual y `editWithVersion` los escribe
  // (`relatedRecordId: f.relatedRecordId || null`). Omitirlos aca hubiera roto
  // en silencio agregar un campo RELATED_ENTRY al editar un registro — el campo
  // se creaba sin su relacion.
  addFields: z.array(campoNuevo).max(MAX_FIELDS).optional(),
  removeFieldIds: z.array(z.string().cuid()).max(MAX_FIELDS).optional(),
  updateFields: z
    .array(
      z.object({
        id: z.string().cuid(),
        label: z.string().min(1).max(200).optional(),
        order: z.number().int().min(0).max(10_000).optional(),
        isRequired: z.boolean().optional(),
        comparisonConfig: fieldConfigSchema.optional(),
        formulaConfig: fieldConfigSchema.optional(),
      }),
    )
    .max(MAX_FIELDS)
    .optional(),
}).strict()

// ─────────────────────────────────────────────
// Flujos (RecordAction)
// ─────────────────────────────────────────────

const triggerEnum = z.enum([
  'ENTRY_CREATED',
  'ENTRY_COMPLETED',
  'FIELD_VALUE_CHANGED',
  'COMPARISON_FAILED',
])

const actionTypeEnum = z.enum(['CREATE_ENTRY', 'UPDATE_FIELD', 'NOTIFY', 'EMAIL', 'WEBHOOK'])

/**
 * `sourceFieldId` **no** es un cuid: ademas del id de un field acepta `$entry.id`
 * y `$entry.<fieldId>` para referenciar la entry padre, y los paths de companion
 * (`$batch.status`, `$sample.client`, `$instrument.*`). Se acota el largo y
 * nada mas — resolver el path es tarea de `flow-evaluation.ts`.
 */
const filaDeMapeo = z.object({
  // Sin `.min(1)`: el editor agrega filas vacias
  // (`{ sourceFieldId: '', targetFieldId: '' }`) y guardar a medias es un
  // estado normal y deliberado — `sanitizeFieldMapping` las descarta del lado
  // del backend, y `flow-config.ts` trata la configuracion incompleta como
  // advertencia y no como error. Exigir contenido aca convertia en 400 el acto
  // de agregar un mapeo y guardar antes de completarlo.
  sourceFieldId: z.string().max(200),
  targetFieldId: z.string().max(200),
}).strict()

const MAX_MAPEOS = 300

export const createRecordActionSchema = z.object({
  targetRecordId: z.string().cuid(),
  fieldMapping: z.array(filaDeMapeo).max(MAX_MAPEOS),
  trigger: triggerEnum.optional(),
  condition: flowConfigJsonSchema.nullable().optional(),
  allowCascade: z.boolean().optional(),
  actionType: actionTypeEnum.optional(),
  actionConfig: flowConfigJsonSchema.nullable().optional(),
}).strict()

export const updateRecordActionSchema = createRecordActionSchema.partial()

export type CreateRecordInput = z.infer<typeof createRecordSchema>
export type EditRecordInput = z.infer<typeof editRecordSchema>
export type CreateRecordActionInput = z.infer<typeof createRecordActionSchema>
export type UpdateRecordActionInput = z.infer<typeof updateRecordActionSchema>
