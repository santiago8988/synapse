import { describe, it, expect, beforeEach } from 'vitest'
import { ComparisonEvaluatorService } from './comparison-evaluator.service'

/**
 * Una comparación que falla **crea una no conformidad automática**. Así que un
 * error acá no rompe nada visible: inventa no conformidades que no existieron,
 * o se come las que sí. Las dos cosas son exactamente lo que un auditor mira.
 */

describe('ComparisonEvaluatorService', () => {
  let service: ComparisonEvaluatorService

  beforeEach(() => {
    service = new ComparisonEvaluatorService()
  })

  describe('contra una constante', () => {
    const contra = (operator: string, constantValue: number, secondValue?: number) => ({
      operator,
      compareAgainst: 'CONSTANT',
      constantValue,
      secondValue,
    })

    it('GT y GTE se diferencian en el borde', () => {
      expect(service.evaluate(contra('GT', 10), 10, {}).passed).toBe(false)
      expect(service.evaluate(contra('GTE', 10), 10, {}).passed).toBe(true)
      expect(service.evaluate(contra('GT', 10), 11, {}).passed).toBe(true)
    })

    it('LT y LTE se diferencian en el borde', () => {
      expect(service.evaluate(contra('LT', 10), 10, {}).passed).toBe(false)
      expect(service.evaluate(contra('LTE', 10), 10, {}).passed).toBe(true)
      expect(service.evaluate(contra('LT', 10), 9, {}).passed).toBe(true)
    })

    it('EQ compara numéricamente, no como texto', () => {
      expect(service.evaluate(contra('EQ', 10), 10, {}).passed).toBe(true)
      // "10" viene de un input HTML; si se comparara como string, fallaría.
      expect(service.evaluate(contra('EQ', 10), '10', {}).passed).toBe(true)
      expect(service.evaluate(contra('EQ', 10), 10.5, {}).passed).toBe(false)
    })

    it('BETWEEN incluye ambos extremos', () => {
      const cfg = contra('BETWEEN', 10, 20)
      expect(service.evaluate(cfg, 10, {}).passed).toBe(true)
      expect(service.evaluate(cfg, 20, {}).passed).toBe(true)
      expect(service.evaluate(cfg, 15, {}).passed).toBe(true)
      expect(service.evaluate(cfg, 9.99, {}).passed).toBe(false)
      expect(service.evaluate(cfg, 20.01, {}).passed).toBe(false)
    })

    it('BETWEEN sin segundo valor colapsa a una igualdad', () => {
      // Documenta el comportamiento real: sin secondValue el rango es [t, t].
      // Una config a medias no deja pasar cualquier valor.
      const cfg = { operator: 'BETWEEN', compareAgainst: 'CONSTANT', constantValue: 10 }
      expect(service.evaluate(cfg, 10, {}).passed).toBe(true)
      expect(service.evaluate(cfg, 11, {}).passed).toBe(false)
    })

    it('sin constantValue el objetivo es 0', () => {
      const cfg = { operator: 'GT', compareAgainst: 'CONSTANT' }
      expect(service.evaluate(cfg, 1, {}).passed).toBe(true)
      expect(service.evaluate(cfg, -1, {}).passed).toBe(false)
    })
  })

  describe('contra otro campo', () => {
    it('toma el valor del campo referenciado', () => {
      const cfg = { operator: 'GT', compareAgainst: 'FIELD', fieldId: 'f-min' }
      expect(service.evaluate(cfg, 15, { 'f-min': 10 }).passed).toBe(true)
      expect(service.evaluate(cfg, 5, { 'f-min': 10 }).passed).toBe(false)
    })

    it('convierte el valor del campo, que llega como texto', () => {
      const cfg = { operator: 'GTE', compareAgainst: 'FIELD', fieldId: 'f-min' }
      expect(service.evaluate(cfg, 10, { 'f-min': '10' }).passed).toBe(true)
    })

    it('sin fieldId cae a la constante', () => {
      const cfg = { operator: 'GT', compareAgainst: 'FIELD', constantValue: 5 }
      expect(service.evaluate(cfg, 6, {}).passed).toBe(true)
    })
  })

  describe('valores que no son números', () => {
    /**
     * Este grupo fija el comportamiento actual más que celebrarlo. Un campo sin
     * cargar da NaN, y toda comparación con NaN es false, así que la
     * comparación **pasa como fallida** y dispara una no conformidad. Para un
     * sistema de calidad es la dirección conservadora —avisa de más, no de
     * menos— pero conviene saber que una no conformidad puede venir de un campo
     * vacío y no de un valor fuera de rango.
     */
    it('un campo vacío da NaN y la comparación falla', () => {
      const cfg = { operator: 'GT', compareAgainst: 'CONSTANT', constantValue: 10 }
      expect(service.evaluate(cfg, undefined, {}).passed).toBe(false)
      expect(service.evaluate(cfg, null, {}).passed).toBe(false)
      expect(service.evaluate(cfg, '', {}).passed).toBe(false)
      expect(service.evaluate(cfg, 'abc', {}).passed).toBe(false)
    })

    it('el campo referenciado sin cargar también hace fallar', () => {
      const cfg = { operator: 'LTE', compareAgainst: 'FIELD', fieldId: 'f-max' }
      expect(service.evaluate(cfg, 5, {}).passed).toBe(false)
    })

    it('EQ con NaN de los dos lados sigue siendo false', () => {
      // NaN === NaN es false: dos campos vacíos no se consideran iguales.
      const cfg = { operator: 'EQ', compareAgainst: 'FIELD', fieldId: 'f-x' }
      expect(service.evaluate(cfg, undefined, {}).passed).toBe(false)
    })
  })

  describe('operador desconocido', () => {
    it('no pasa, y no rompe', () => {
      // Fail-closed: una config corrupta marca la comparación como fallida en
      // vez de darla por buena.
      const cfg = { operator: 'INVENTADO', compareAgainst: 'CONSTANT', constantValue: 1 }
      const r = service.evaluate(cfg, 1, {})
      expect(r.passed).toBe(false)
      expect(r.description).toBe('')
    })
  })

  describe('resultado', () => {
    it('devuelve el valor evaluado y una descripción legible', () => {
      const cfg = { operator: 'GT', compareAgainst: 'CONSTANT', constantValue: 10 }
      const r = service.evaluate(cfg, '15', {})
      // El value sale convertido: es lo que se guarda en comparisonResults.
      expect(r.value).toBe(15)
      expect(r.description).toBe('15 debe ser > 10')
    })
  })
})
