import { Injectable } from '@nestjs/common'

export interface FormulaConfig {
  expression: string
}

interface FieldInfo {
  id: string
  label: string
  fieldType: string
  formulaConfig?: unknown
}

@Injectable()
export class FormulaEvaluatorService {
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

    // Construir mapa de valores disponibles (arranca con los NUMBER)
    const values: Record<string, number> = {}
    for (const field of fields) {
      if (field.fieldType === 'NUMBER' && data[field.id] !== undefined) {
        values[field.id] = Number(data[field.id])
      }
    }

    // Evaluar fórmulas en orden (las que no dependen de otras primero)
    // Hacer múltiples pasadas hasta resolver todas o no avanzar más
    const formulaFields = fields.filter(
      (f) => f.fieldType === 'FORMULA' && f.formulaConfig && (f.formulaConfig as FormulaConfig).expression,
    )
    const resolved = new Set<string>()
    let changed = true

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

    // Fórmulas no resueltas quedan en 0
    for (const field of formulaFields) {
      if (!resolved.has(field.id)) {
        results[field.id] = 0
      }
    }

    return results
  }

  /**
   * Evalúa una fórmula individual. Retorna null si hay dependencias no resueltas.
   */
  private evaluateSingle(
    config: FormulaConfig,
    fields: FieldInfo[],
    values: Record<string, number>,
  ): number | null {
    try {
      let expr = config.expression

      // Reemplazar labels y IDs por valores (labels primero, más largos primero para evitar reemplazos parciales)
      const sortedFields = [...fields]
        .filter((f) => values[f.id] !== undefined)
        .sort((a, b) => b.label.length - a.label.length)

      for (const field of sortedFields) {
        expr = expr.replace(new RegExp(field.label, 'g'), String(values[field.id]))
        expr = expr.replace(new RegExp(field.id, 'g'), String(values[field.id]))
      }

      // Si quedan letras (campos no resueltos), no podemos evaluar todavía
      const sanitized = expr.replace(/[^0-9+\-*/().  ]/g, '')
      if (sanitized !== expr.replace(/\s/g, '').replace(/[^0-9+\-*/().]/g, '')) {
        return null
      }

      const result = Function(`"use strict"; return (${sanitized})`)()
      return typeof result === 'number' && isFinite(result) ? result : 0
    } catch {
      return 0
    }
  }
}
