import { Injectable } from '@nestjs/common'

export interface ComparisonConfig {
  operator: string
  compareAgainst: string
  constantValue?: number
  fieldId?: string
  secondValue?: number
}

export interface ComparisonResult {
  passed: boolean
  value: unknown
  description: string
}

@Injectable()
export class ComparisonEvaluatorService {
  evaluate(
    config: ComparisonConfig,
    fieldValue: unknown,
    data: Record<string, unknown>,
  ): ComparisonResult {
    const value = Number(fieldValue)

    let target: number
    if (config.compareAgainst === 'FIELD' && config.fieldId) {
      target = Number(data[config.fieldId])
    } else {
      target = config.constantValue ?? 0
    }

    let passed = false
    let description = ''

    switch (config.operator) {
      case 'GT':
        passed = value > target
        description = `${value} debe ser > ${target}`
        break
      case 'GTE':
        passed = value >= target
        description = `${value} debe ser >= ${target}`
        break
      case 'LT':
        passed = value < target
        description = `${value} debe ser < ${target}`
        break
      case 'LTE':
        passed = value <= target
        description = `${value} debe ser <= ${target}`
        break
      case 'EQ':
        passed = value === target
        description = `${value} debe ser = ${target}`
        break
      case 'BETWEEN':
        passed = value >= target && value <= (config.secondValue ?? target)
        description = `${value} debe estar entre ${target} y ${config.secondValue}`
        break
    }

    return { passed, value, description }
  }
}
