import type { FieldDef, RecordForForm } from './types'

/**
 * Resuelve el valor numérico de un campo para usar en fórmulas/comparaciones.
 * Soporta referencias por id, por label (prefijo __label_), y valores de
 * RELATED_ENTRY transcriptos ({fieldId}_{relFieldId}).
 */
export function resolveFieldValue(
  fieldId: string,
  record: RecordForForm,
  data: Record<string, unknown>,
  formulaResults: Record<string, number>,
): number | undefined {
  // Try direct id match
  const byId = record.fields.find((f) => f.id === fieldId)
  if (byId) {
    if (byId.fieldType === 'FORMULA' && formulaResults[byId.id] !== undefined) {
      return formulaResults[byId.id]
    }
    const v = data[byId.id]
    if (v !== undefined && v !== '' && v !== null) {
      const n = Number(v)
      if (!isNaN(n)) return n
    }
  }
  // Try by label (backend persists the label for comparisons)
  const byLabel = record.fields.find(
    (f) => f.label.toUpperCase() === fieldId.toUpperCase(),
  )
  if (byLabel) {
    if (byLabel.fieldType === 'FORMULA' && formulaResults[byLabel.id] !== undefined) {
      return formulaResults[byLabel.id]
    }
    const v = data[byLabel.id]
    if (v !== undefined && v !== '' && v !== null) {
      const n = Number(v)
      if (!isNaN(n)) return n
    }
  }
  // Look into transcribed values from RELATED_ENTRY: __label_<label>
  const transcribed = data[`__label_${fieldId}`]
  if (transcribed !== undefined && transcribed !== null) {
    const n = Number(transcribed)
    if (!isNaN(n)) return n
  }
  return undefined
}

/**
 * Evalúa todas las fórmulas del record en cascada (multi-pass), resolviendo
 * referencias {label} o {fieldId}. Acepta mathjs-like expressions —
 * evaluamos con Function constructor (sanitizable: sólo admite chars básicos).
 */
export function computeFormulaResults(
  record: RecordForForm,
  data: Record<string, unknown>,
): Record<string, number> {
  const results: Record<string, number> = {}
  const formulaFields = record.fields.filter(
    (f) => f.fieldType === 'FORMULA' && f.formulaConfig?.expression,
  )

  let changed = true
  let passes = 0
  const maxPasses = 10

  while (changed && passes < maxPasses) {
    changed = false
    passes++
    for (const f of formulaFields) {
      if (results[f.id] !== undefined) continue
      const expr = f.formulaConfig?.expression ?? ''
      // Replace {label|id} with numeric value
      let replaced = expr
      let allResolved = true
      const matches = [...expr.matchAll(/\{([^}]+)\}/g)]
      for (const m of matches) {
        const ref = m[1].trim()
        const val = resolveFieldValue(ref, record, data, results)
        if (val === undefined) {
          allResolved = false
          break
        }
        replaced = replaced.replace(m[0], String(val))
      }
      if (!allResolved) continue
      // Only allow digits, operators, parentheses, decimals, spaces and basic math functions
      if (!/^[\d\s+\-*/().^%,a-zA-Z_]+$/.test(replaced)) continue
      try {
        // eslint-disable-next-line no-new-func
        const v = Function(
          '"use strict"; const {abs,sqrt,pow,min,max,round,floor,ceil,log,exp}=Math; return (' +
            replaced +
            ')',
        )()
        if (typeof v === 'number' && isFinite(v)) {
          results[f.id] = v
          changed = true
        }
      } catch {
        // skip
      }
    }
  }
  return results
}

/**
 * Evalúa una comparación. Retorna { passed, value, target, description }.
 * passed = null si aún no se puede evaluar (falta input).
 */
export interface ComparisonEval {
  passed: boolean | null
  value: number | undefined
  target: number | undefined
  description: string
}

export function evalComparison(
  field: FieldDef,
  record: RecordForForm,
  data: Record<string, unknown>,
  formulaResults: Record<string, number>,
): ComparisonEval {
  const config = field.comparisonConfig
  if (!config) return { passed: null, value: undefined, target: undefined, description: '' }

  let value: number | undefined
  if (config.fieldId) {
    value = resolveFieldValue(config.fieldId, record, data, formulaResults)
  } else {
    const raw = data[field.id]
    if (raw !== undefined && raw !== '' && raw !== null) {
      const n = Number(raw)
      if (!isNaN(n)) value = n
    }
  }

  const target =
    config.compareAgainst === 'FIELD' && config.compareFieldId
      ? resolveFieldValue(config.compareFieldId, record, data, formulaResults)
      : (config.constantValue ?? 0)

  let passed: boolean | null = null
  let desc = ''
  if (value !== undefined && target !== undefined) {
    switch (config.operator) {
      case 'GT':
        passed = value > target
        desc = `> ${target}`
        break
      case 'GTE':
        passed = value >= target
        desc = `>= ${target}`
        break
      case 'LT':
        passed = value < target
        desc = `< ${target}`
        break
      case 'LTE':
        passed = value <= target
        desc = `<= ${target}`
        break
      case 'EQ':
        passed = value === target
        desc = `= ${target}`
        break
      case 'BETWEEN':
        passed = value >= target && value <= (config.secondValue ?? target)
        desc = `${target} — ${config.secondValue}`
        break
    }
  }

  if (config.fieldId) {
    const evaluatedField = record.fields.find(
      (f) =>
        f.id === config.fieldId ||
        f.label.toUpperCase() === config.fieldId!.toUpperCase(),
    )
    if (evaluatedField) {
      const valText = value !== undefined ? value.toFixed(4).replace(/\.?0+$/, '') : '?'
      desc = `${evaluatedField.label} (${valText}) ${desc}`
    }
  }

  return { passed, value, target, description: desc }
}

/**
 * Mock values para preview mode, basados en heurísticas del label.
 */
export function mockValueFor(field: FieldDef): unknown {
  const label = field.label.toLowerCase()
  if (field.fieldType === 'NUMBER') {
    if (label.includes('patrón') || label.includes('patron')) return 100
    if (label.includes('lectura')) return 100.003
    if (label.includes('cantidad')) return 10
    if (label.includes('temp')) return 23
    return 0
  }
  if (field.fieldType === 'TEXT') {
    if (field.isIdentifier) {
      if (label.includes('lote')) return 'LOT-20260420-01'
      if (label.includes('codigo') || label.includes('código')) return 'COD-20260420-01'
      if (label.includes('muestra')) return 'M-20260420-01'
      return 'ID-20260420-01'
    }
    return ''
  }
  if (field.fieldType === 'DATE') return new Date().toISOString().slice(0, 10)
  return undefined
}

/**
 * Arma el data mock completo para preview (sólo campos OWN, sin FORMULA/COMPARISON
 * que se calculan).
 */
export function buildMockData(record: RecordForForm): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  for (const f of record.fields) {
    if (f.fieldType === 'FORMULA' || f.fieldType === 'COMPARISON') continue
    const v = mockValueFor(f)
    if (v !== undefined) data[f.id] = v
  }
  return data
}
