import { z } from 'zod'

/**
 * JSON acotado, para las columnas Json que guardan configuracion libre.
 *
 * `comparisonConfig`, `formulaConfig`, `condition` y `actionConfig` son JSONB y
 * hasta ahora entraban como `Prisma.InputJsonValue` sin limite de claves, de
 * profundidad ni de tamano. Esto les pone un techo.
 *
 * **Acota la forma, no el significado, y es a proposito.** Existen schemas
 * semanticos para estas configuraciones —`dropdownStatusConfigSchema`,
 * `actionConditionSchema`, `parseActionConfig` en `record-field.ts`— y no se
 * aplican en la entrada por dos razones:
 *
 *  1. El diseno de los flujos permite **guardar configuraciones incompletas**:
 *     `common/flows/flow-config.ts` distingue errores (se rechazan) de
 *     advertencias (se guardan, pero el flujo no corre hasta completarse). Un
 *     schema semantico en el body convertiria toda advertencia en un rechazo y
 *     romperia la edicion a medias, que es un estado normal.
 *  2. El editor visual no cubre las condiciones compuestas AND/OR — dice
 *     explicitamente "editá manualmente vía API por ahora". Cerrar la forma
 *     ahora cerraria esa puerta antes de que exista el reemplazo.
 *
 * La validacion semantica ya ocurre donde importa: antes de **ejecutar** un
 * flujo. Una configuracion malformada se guarda pero no corre.
 */

export const JSON_MAX_CLAVES = 100
export const JSON_MAX_TEXTO = 5_000
export const JSON_MAX_ITEMS = 200

const primitivo = z.union([
  z.string().max(JSON_MAX_TEXTO),
  z.number().finite(),
  z.boolean(),
  z.null(),
])

type ValorJson = string | number | boolean | null | ValorJson[] | { [k: string]: ValorJson }

/**
 * Valor JSON con profundidad maxima explicita.
 *
 * La profundidad se pasa como parametro y se consume en cada nivel en vez de
 * usar `z.lazy()` sin fondo: la recursion sin limite sobre un body es
 * exactamente lo que hay que evitar, porque un anidamiento suficientemente
 * profundo puede voltear el parser antes de que nadie mire el contenido.
 */
function valorJson(profundidad: number): z.ZodType<ValorJson> {
  if (profundidad <= 0) return primitivo as z.ZodType<ValorJson>

  const interno = valorJson(profundidad - 1)
  return z.union([
    primitivo,
    z.array(interno).max(JSON_MAX_ITEMS),
    objetoDe(interno),
  ]) as z.ZodType<ValorJson>
}

function objetoDe(valor: z.ZodType<ValorJson>) {
  return z.record(valor).refine((o) => Object.keys(o).length <= JSON_MAX_CLAVES, {
    message: `No puede tener mas de ${JSON_MAX_CLAVES} claves`,
  })
}

/**
 * El tope es siempre un objeto, no un valor suelto.
 *
 * Ademas de ser lo que estas configuraciones son, evita una friccion concreta:
 * `Prisma.InputJsonValue` no admite `null` en el tope —para eso existe
 * `Prisma.JsonNull`— asi que un schema que aceptara `null` a nivel raiz no
 * tipaba contra el DTO. Los `null` anidados si se aceptan, que es lo que Prisma
 * permite.
 */

/**
 * Configuracion de un field (`comparisonConfig`, `formulaConfig`). Son objetos
 * mayormente planos: opciones de un DROPDOWN, operador y referencias de un
 * COMPARISON, la formula de un FORMULA.
 */
export const fieldConfigSchema = objetoDe(valorJson(3))

/**
 * `RecordAction.condition` y `actionConfig`. Mas profundo porque las
 * condiciones AND/OR anidan: cada nivel es `{ type, conditions: [...] }`, o sea
 * dos niveles de JSON por nivel logico. Cinco admite dos niveles de anidamiento
 * logico ademas del primero, que es mas de lo que cualquier flujo usa.
 */
export const flowConfigJsonSchema = objetoDe(valorJson(5))

export type FieldConfigInput = z.infer<typeof fieldConfigSchema>
export type FlowConfigJsonInput = z.infer<typeof flowConfigJsonSchema>
