import { Injectable, Logger } from '@nestjs/common'
import { all, create } from 'mathjs'

/**
 * Evaluador de fórmulas de campos `FORMULA`.
 *
 * Sintaxis: las referencias a otros campos van **entre llaves**, por label o
 * por id — `{PESO} * {CANTIDAD}`. Es lo que ya usaban el editor de fórmulas y
 * el cálculo en vivo del frontend; el backend, en cambio, reemplazaba labels
 * sueltos con `new RegExp(label)`, sin escapar y sin llaves. De ahí venían tres
 * problemas:
 *
 *   - Una fórmula con espacios devolvía null en silencio: la cadena que se
 *     evaluaba conservaba los espacios y la que se usaba para validarla los
 *     quitaba, así que nunca coincidían.
 *   - Un label con metacaracteres —`PESO (KG)`— generaba una expresión regular
 *     que no matcheaba literalmente, así que la referencia quedaba sin resolver.
 *   - Se evaluaba con `Function()`, contra la regla 3 de CLAUDE.md.
 *
 * Ahora las referencias se extraen y se resuelven por comparación exacta, y la
 * expresión resultante la evalúa mathjs sobre una instancia restringida.
 */

export interface FormulaConfig {
  expression: string
}

interface FieldInfo {
  id: string
  label: string
  fieldType: string
  formulaConfig?: unknown
}

/**
 * mathjs endurecido: se desactivan las funciones que permiten salir del
 * sandbox o redefinir el entorno. Es la recomendación de la propia librería
 * para evaluar expresiones que vienen de un usuario.
 */
const math = create(all, {})

// La referencia se captura ANTES de bloquear: el import de abajo reemplaza
// math.evaluate por la version que lanza, asi que llamarla desde ahi haria
// fallar toda fórmula. Es el patron que documenta mathjs.
const evaluarExpresion = math.evaluate

const bloqueada = (nombre: string) => () => {
  throw new Error(`La función ${nombre} no está permitida en las fórmulas`)
}
math.import(
  {
    import: bloqueada('import'),
    createUnit: bloqueada('createUnit'),
    evaluate: bloqueada('evaluate'),
    parse: bloqueada('parse'),
    simplify: bloqueada('simplify'),
    derivative: bloqueada('derivative'),
    resolve: bloqueada('resolve'),
  },
  { override: true },
)

/** Referencias `{...}` dentro de la expresión. */
const REF_PATTERN = /\{([^}]+)\}/g

@Injectable()
export class FormulaEvaluatorService {
  private readonly logger = new Logger(FormulaEvaluatorService.name)

  /**
   * Evalúa todas las fórmulas del record en orden de dependencia.
   * Retorna un mapa fieldId → resultado numérico.
   * Las fórmulas pueden referenciar otros campos NUMBER u otras FORMULA.
   */
  evaluateAll(
    fields: FieldInfo[],
    data: Record<string, unknown>,
  ): Record<string, number> {
    const results: Record<string, number> = {}

    // Valores disponibles al arrancar: los campos NUMBER cargados.
    const values: Record<string, number> = {}
    for (const field of fields) {
      if (field.fieldType === 'NUMBER' && data[field.id] !== undefined) {
        const n = Number(data[field.id])
        if (Number.isFinite(n)) values[field.id] = n
      }
    }

    const formulaFields = fields.filter(
      (f) =>
        f.fieldType === 'FORMULA' &&
        f.formulaConfig &&
        (f.formulaConfig as FormulaConfig).expression,
    )
    const resolved = new Set<string>()
    let changed = true

    // Varias pasadas: una fórmula puede depender del resultado de otra. Se
    // corta cuando una pasada completa no resuelve nada nuevo.
    while (changed) {
      changed = false
      for (const field of formulaFields) {
        if (resolved.has(field.id)) continue

        const result = this.evaluateSingle(
          field.formulaConfig as FormulaConfig,
          fields,
          values,
        )
        if (result !== null) {
          results[field.id] = result
          values[field.id] = result
          resolved.add(field.id)
          changed = true
        }
      }
    }

    // Lo que no se resolvió queda en 0. Puede ser por una dependencia circular,
    // por un campo sin cargar o porque la fórmula es inválida; se loguea para
    // poder distinguirlo, porque un 0 silencioso en un registro de calidad es
    // indistinguible de un cálculo legítimo.
    for (const field of formulaFields) {
      if (!resolved.has(field.id)) {
        results[field.id] = 0
        this.logger.warn(
          `Fórmula sin resolver en el campo "${field.label}" (${field.id}): ` +
            `"${(field.formulaConfig as FormulaConfig).expression}". Se guarda 0.`,
        )
      }
    }

    return results
  }

  /**
   * Evalúa una fórmula. Devuelve null si alguna referencia todavía no tiene
   * valor —la siguiente pasada puede resolverla— y 0 si la expresión es
   * inválida.
   */
  private evaluateSingle(
    config: FormulaConfig,
    fields: FieldInfo[],
    values: Record<string, number>,
  ): number | null {
    const expression = config.expression ?? ''

    // Índice por label y por id. La comparación es exacta: nada de regex
    // construidas con texto que escribió el usuario.
    const porReferencia = new Map<string, string>()
    for (const field of fields) {
      porReferencia.set(field.label.trim().toUpperCase(), field.id)
      porReferencia.set(field.id, field.id)
    }

    let pendiente = false
    const sustituida = expression.replace(REF_PATTERN, (_match, ref: string) => {
      const clave = String(ref).trim()
      const fieldId = porReferencia.get(clave.toUpperCase()) ?? porReferencia.get(clave)
      const valor = fieldId !== undefined ? values[fieldId] : undefined

      if (valor === undefined) {
        pendiente = true
        return '0'
      }
      // Entre paréntesis para que un valor negativo no altere la precedencia.
      return `(${valor})`
    })

    // Con una referencia sin resolver no se evalúa: quizá la próxima pasada la
    // resuelve. Devolver 0 acá haría que una fórmula encadenada se congele en
    // un resultado incorrecto.
    if (pendiente) return null

    try {
      const result = evaluarExpresion(sustituida)
      return typeof result === 'number' && Number.isFinite(result) ? result : 0
    } catch (err) {
      this.logger.warn(
        `Expresión de fórmula inválida: "${expression}" → "${sustituida}". ${String(err)}`,
      )
      return 0
    }
  }
}
