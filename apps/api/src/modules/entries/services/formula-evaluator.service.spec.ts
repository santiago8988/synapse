import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FormulaEvaluatorService } from './formula-evaluator.service'

/**
 * El resultado de una fórmula termina guardado en una Entry y, en muchos
 * registros, es el dato que se audita. Un cálculo silenciosamente equivocado
 * —o un 0 donde debía haber un número— es la peor forma de fallar acá.
 */

interface Campo {
  id: string
  label: string
  fieldType: string
  formulaConfig?: unknown
}

const numero = (id: string, label: string): Campo => ({
  id,
  label,
  fieldType: 'NUMBER',
})

const formula = (id: string, label: string, expression: string): Campo => ({
  id,
  label,
  fieldType: 'FORMULA',
  formulaConfig: { expression },
})

describe('FormulaEvaluatorService', () => {
  let service: FormulaEvaluatorService

  beforeEach(() => {
    service = new FormulaEvaluatorService()
    // El service loguea las fórmulas sin resolver; en los tests molesta.
    vi.spyOn(service['logger'], 'warn').mockImplementation(() => undefined)
  })

  it('resuelve una fórmula con referencias por label', () => {
    const campos = [
      numero('f-peso', 'PESO'),
      numero('f-cant', 'CANTIDAD'),
      formula('f-total', 'TOTAL', '{PESO} * {CANTIDAD}'),
    ]
    const out = service.evaluateAll(campos, { 'f-peso': 10, 'f-cant': 5 })
    expect(out['f-total']).toBe(50)
  })

  it('los espacios no rompen la fórmula', () => {
    // Este era el bug: "2 + 3" devolvia null y el campo quedaba en 0.
    const campos = [
      numero('f-a', 'A'),
      numero('f-b', 'B'),
      formula('f-r', 'R', '{A} + {B}'),
      formula('f-r2', 'R2', '( {A} - {B} ) * 2'),
    ]
    const out = service.evaluateAll(campos, { 'f-a': 10, 'f-b': 2 })
    expect(out['f-r']).toBe(12)
    expect(out['f-r2']).toBe(16)
  })

  it('acepta referencias por id además de por label', () => {
    const campos = [numero('f-a', 'A'), formula('f-r', 'R', '{f-a} * 3')]
    expect(service.evaluateAll(campos, { 'f-a': 7 })['f-r']).toBe(21)
  })

  it('un label con paréntesis no rompe la resolución', () => {
    // Antes el label se metia en un `new RegExp(label)` sin escapar, asi que
    // "PESO (KG)" generaba un patron que no matcheaba literalmente.
    const campos = [
      numero('f-peso', 'PESO (KG)'),
      formula('f-doble', 'DOBLE', '{PESO (KG)} * 2'),
    ]
    expect(service.evaluateAll(campos, { 'f-peso': 4 })['f-doble']).toBe(8)
  })

  it('respeta la precedencia y los paréntesis', () => {
    const campos = [
      numero('f-a', 'A'),
      formula('f-r', 'R', '2 + {A} * 3'),
      formula('f-r2', 'R2', '(2 + {A}) * 3'),
    ]
    const out = service.evaluateAll(campos, { 'f-a': 4 })
    expect(out['f-r']).toBe(14)
    expect(out['f-r2']).toBe(18)
  })

  it('un valor negativo no altera la precedencia', () => {
    const campos = [numero('f-a', 'A'), formula('f-r', 'R', '10 - {A}')]
    expect(service.evaluateAll(campos, { 'f-a': -5 })['f-r']).toBe(15)
  })

  it('encadena fórmulas que dependen de otras', () => {
    const campos = [
      numero('f-a', 'A'),
      formula('f-doble', 'DOBLE', '{A} * 2'),
      formula('f-final', 'FINAL', '{DOBLE} + 1'),
    ]
    const out = service.evaluateAll(campos, { 'f-a': 5 })
    expect(out['f-doble']).toBe(10)
    expect(out['f-final']).toBe(11)
  })

  it('soporta funciones de mathjs', () => {
    const campos = [
      numero('f-a', 'A'),
      numero('f-b', 'B'),
      formula('f-r', 'R', 'round({A} / {B}, 2)'),
    ]
    expect(service.evaluateAll(campos, { 'f-a': 10, 'f-b': 3 })['f-r']).toBe(3.33)
  })

  it('un campo sin cargar deja la fórmula en 0', () => {
    const campos = [
      numero('f-a', 'A'),
      numero('f-b', 'B'),
      formula('f-r', 'R', '{A} + {B}'),
    ]
    // Sin B no se puede calcular; 0 es el contrato historico.
    expect(service.evaluateAll(campos, { 'f-a': 10 })['f-r']).toBe(0)
  })

  it('una dependencia circular termina en 0 en vez de colgarse', () => {
    const campos = [
      formula('f-x', 'X', '{Y} + 1'),
      formula('f-y', 'Y', '{X} + 1'),
    ]
    const out = service.evaluateAll(campos, {})
    expect(out['f-x']).toBe(0)
    expect(out['f-y']).toBe(0)
  })

  it('una división por cero no propaga Infinity', () => {
    const campos = [
      numero('f-a', 'A'),
      numero('f-b', 'B'),
      formula('f-r', 'R', '{A} / {B}'),
    ]
    expect(service.evaluateAll(campos, { 'f-a': 5, 'f-b': 0 })['f-r']).toBe(0)
  })

  it('una expresión inválida da 0 y no rompe', () => {
    const campos = [numero('f-a', 'A'), formula('f-r', 'R', '{A} +* 2')]
    expect(service.evaluateAll(campos, { 'f-a': 1 })['f-r']).toBe(0)
  })

  it('una referencia a un campo inexistente da 0', () => {
    const campos = [formula('f-r', 'R', '{NO_EXISTE} * 2')]
    expect(service.evaluateAll(campos, {})['f-r']).toBe(0)
  })

  it('bloquea las funciones peligrosas de mathjs', () => {
    // `import` permitiria redefinir el entorno de evaluacion. Debe fallar y
    // caer en 0, no ejecutarse.
    const campos = [formula('f-r', 'R', 'import({})')]
    expect(service.evaluateAll(campos, {})['f-r']).toBe(0)
  })

  it('no evalúa símbolos sueltos fuera de llaves', () => {
    // Sin llaves no es una referencia: mathjs no conoce el simbolo y la
    // expresion queda invalida, en vez de sustituirse por accidente.
    const campos = [numero('f-a', 'A'), formula('f-r', 'R', 'A * 2')]
    expect(service.evaluateAll(campos, { 'f-a': 5 })['f-r']).toBe(0)
  })

  it('un record sin fórmulas devuelve un mapa vacío', () => {
    expect(service.evaluateAll([numero('f-a', 'A')], { 'f-a': 1 })).toEqual({})
  })
})
