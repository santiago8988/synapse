import { describe, it, expect } from 'vitest'
import {
  changeSampleStatusSchema,
  saveSampleResultsSchema,
  changeBatchStatusSchema,
  consumeStockSchema,
  changeCalibrationStatusSchema,
  saveCalibrationResultsSchema,
  approvalDecisionSchema,
  submitForApprovalSchema,
  createNonConformitySchema,
  updateNonConformityStatusSchema,
  addCorrectiveActionSchema,
  createRecipeSchema,
  updateRecipeSchema,
  changeInstrumentStatusSchema,
  createMatrixSchema,
  createMethodSchema,
  updateMethodSchema,
  createCalibrationTemplateSchema,
  updateCalibrationTemplateSchema,
} from '@synapse/validators'

/**
 * Schemas de los modulos companion y de soporte — el ultimo tramo de la
 * Fase 1.1.
 *
 * Los tests se concentran en lo que puede romper una pantalla, no en cubrir
 * cada campo: que los enums sean exactamente los que la UI manda, que los
 * campos que el service escribe no se descarten, y que los limites no dejen
 * afuera un payload real.
 */

const CUID = 'clh3k2j9x0000qwer1234asdf'

describe('enums de estado — tienen que coincidir con lo que manda la UI', () => {
  it('instrumento', () => {
    // apps/web .../instruments/[id]/page.tsx declara exactamente estos cuatro.
    for (const status of ['ACTIVE', 'IN_CALIBRATION', 'IN_REPAIR', 'DECOMMISSIONED']) {
      expect(changeInstrumentStatusSchema.safeParse({ status }).success).toBe(true)
    }
    expect(changeInstrumentStatusSchema.safeParse({ status: 'ROTO' }).success).toBe(false)
  })

  it('no conformidad', () => {
    for (const status of ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']) {
      expect(updateNonConformityStatusSchema.safeParse({ status }).success).toBe(true)
    }
    expect(updateNonConformityStatusSchema.safeParse({ status: 'ARCHIVADA' }).success).toBe(false)
  })

  it('muestra, lote y calibracion', () => {
    expect(changeSampleStatusSchema.safeParse({ status: 'IN_TESTING' }).success).toBe(true)
    expect(changeSampleStatusSchema.safeParse({ status: 'APPROVED' }).success).toBe(false)

    expect(changeBatchStatusSchema.safeParse({ status: 'APPROVED' }).success).toBe(true)
    expect(changeBatchStatusSchema.safeParse({ status: 'RECEIVED' }).success).toBe(false)

    expect(changeCalibrationStatusSchema.safeParse({ status: 'REJECTED' }).success).toBe(true)
    expect(changeCalibrationStatusSchema.safeParse({ status: 'PLANNED' }).success).toBe(false)
  })

  it('la decision de aprobacion solo admite dos valores', () => {
    // Es el acto con valor legal del circuito ISO: queda en ApprovalDecision y
    // es lo que sostiene que una plantilla paso a ACTIVE.
    expect(approvalDecisionSchema.safeParse({ decision: 'APPROVED' }).success).toBe(true)
    expect(approvalDecisionSchema.safeParse({ decision: 'REJECTED' }).success).toBe(true)
    expect(approvalDecisionSchema.safeParse({ decision: 'TAL_VEZ' }).success).toBe(false)
  })

  it('submitForApproval solo acepta las entidades aprobables', () => {
    expect(
      submitForApprovalSchema.safeParse({ entityType: 'RECIPE', entityId: CUID }).success,
    ).toBe(true)
    expect(
      submitForApprovalSchema.safeParse({ entityType: 'ENTRY', entityId: CUID }).success,
    ).toBe(false)
  })
})

describe('recetas — el campo que el service escribe y el controller no declaraba', () => {
  const ingrediente = {
    name: 'ACIDO CITRICO',
    quantity: 2.5,
    unit: 'kg',
    order: 1,
    fromStock: true,
    stockRecipeId: CUID,
  }

  it('el alta conserva fromStock y stockRecipeId', () => {
    const parseado = createRecipeSchema.parse({
      name: 'SOLUCION A',
      code: 'REC-001',
      ingredients: [ingrediente],
      steps: [{ order: 1, name: 'MEZCLAR' }],
    })

    expect(parseado.ingredients[0].fromStock).toBe(true)
    expect(parseado.ingredients[0].stockRecipeId).toBe(CUID)
  })

  it('la edicion tambien los conserva', () => {
    // El tipo inline del controller los omitia en `update`, pero
    // `recipes.service.update` los escribe igual. Copiar ese tipo hubiera
    // reseteado el vinculo con stock en cada edicion, sin error y sin aviso.
    const parseado = updateRecipeSchema.parse({ ingredients: [ingrediente] })

    expect(parseado.ingredients?.[0].fromStock).toBe(true)
    expect(parseado.ingredients?.[0].stockRecipeId).toBe(CUID)
  })

  it('acepta una cantidad decimal, que es como la manda el formulario', () => {
    // parseFloat(e.target.value) || 0 — siempre number, nunca string.
    expect(
      updateRecipeSchema.safeParse({
        ingredients: [{ name: 'X', quantity: 0.125, unit: 'g', order: 1 }],
      }).success,
    ).toBe(true)
  })
})

describe('matrices', () => {
  it('acepta el payload del formulario', () => {
    const payload = {
      name: 'AGUA POTABLE',
      code: 'MTZ-01',
      parameters: [{ name: 'PH', unit: '', minValue: 6.5, maxValue: 8.5, order: 1 }],
      conditions: [{ label: 'TEMPERATURA', fieldType: 'NUMBER', unit: 'C', order: 1 }],
    }

    expect(() => createMatrixSchema.parse(payload)).not.toThrow()
  })

  it('descarta requiredInstruments en vez de rechazarlo — la excepcion a .strict()', () => {
    // matrices y recipes son los dos unicos schemas sin `.strict()`. El
    // formulario manda `requiredInstruments`, una feature que existe entera en
    // el frontend y de la que el backend no tiene ni modelo ni endpoint
    // (TO_DO.md §26). Cerrarlos hoy convertiria cada guardado en un 400.
    //
    // Este test es el recordatorio: cuando §26 se resuelva, tiene que fallar, y
    // ahi se agrega `.strict()`.
    const parseado = createMatrixSchema.parse({
      name: 'X',
      parameters: [],
      requiredInstruments: [{ label: 'TERMOMETRO', order: 1 }],
    })

    expect(parseado).not.toHaveProperty('requiredInstruments')
  })

  it('recetas tampoco es estricto: reenvia stockRecipe al editar', () => {
    // Cada ingrediente que vuelve del GET arrastra el objeto de la relacion, y
    // el formulario lo manda de vuelta tal cual.
    const parseado = updateRecipeSchema.parse({
      requiredInstruments: [{ label: 'BALANZA', order: 1 }],
      ingredients: [
        {
          name: 'ACIDO',
          quantity: 1,
          unit: 'kg',
          order: 1,
          stockRecipe: { id: CUID, name: 'BASE', code: 'B-1' },
        },
      ],
    })

    expect(parseado.ingredients?.[0].name).toBe('ACIDO')
  })
})

describe('JSON de resultados', () => {
  it('acepta la forma de una calibracion: test > punto > lecturas', () => {
    const results = {
      'test-1': { 'punto-1': { readings: [1.01, 1.02, 0.99] } },
    }

    expect(saveCalibrationResultsSchema.safeParse({ results }).success).toBe(true)
  })

  it('acepta resultados planos de una muestra', () => {
    expect(
      saveSampleResultsSchema.safeParse({ results: { 'param-1': 7.2, 'param-2': 'CONFORME' } })
        .success,
    ).toBe(true)
  })

  it('rechaza anidamiento sin fondo', () => {
    let profundo: Record<string, unknown> = { fin: true }
    for (let i = 0; i < 12; i++) profundo = { nivel: profundo }

    expect(saveSampleResultsSchema.safeParse({ results: profundo }).success).toBe(false)
  })
})

describe('limites y campos de mas', () => {
  it('consumo de stock: acepta el payload real y le pone techo', () => {
    const fila = {
      ingredientName: 'ACIDO',
      product: 'ACIDO CITRICO',
      lotNumber: 'L-2026-01',
      quantity: 12.5,
      unit: 'kg',
    }

    expect(consumeStockSchema.safeParse({ consumptions: [fila] }).success).toBe(true)
    expect(consumeStockSchema.safeParse({ consumptions: Array(501).fill(fila) }).success).toBe(
      false,
    )
  })

  it('la no conformidad rechaza campos que no declara', () => {
    expect(
      createNonConformitySchema.safeParse({
        title: 'DESVIO EN PESADA',
        description: 'EL VALOR QUEDO FUERA DE TOLERANCIA',
        organizationId: 'org-victima',
        status: 'CLOSED',
        createdById: 'otro-usuario',
      }).success,
    ).toBe(false)

    expect(
      createNonConformitySchema.safeParse({
        title: 'DESVIO EN PESADA',
        description: 'EL VALOR QUEDO FUERA DE TOLERANCIA',
      }).success,
    ).toBe(true)
  })

  it('la accion correctiva acepta la fecha del input date', () => {
    expect(
      addCorrectiveActionSchema.safeParse({ description: 'RECALIBRAR', dueDate: '2026-10-01' })
        .success,
    ).toBe(true)
    // Sin esto, una cadena cualquiera llega a Prisma como Invalid Date y sale
    // un 500 en vez de un 400.
    expect(
      addCorrectiveActionSchema.safeParse({ description: 'X', dueDate: 'cuando pueda' }).success,
    ).toBe(false)
  })

  it('metodos: el update es parcial y el create exige lo obligatorio', () => {
    expect(updateMethodSchema.safeParse({ unit: 'mg/L' }).success).toBe(true)
    expect(createMethodSchema.safeParse({ code: 'M-1' }).success).toBe(false)
    expect(
      createMethodSchema.safeParse({ code: 'M-1', name: 'PH', parameter: 'PH' }).success,
    ).toBe(true)
  })
})

describe('plantillas de calibracion', () => {
  const prueba = {
    name: 'EXCENTRICIDAD',
    order: 1,
    tolerance: 0.01,
    readingsPerPoint: 3,
    points: [{ name: 'CENTRO', order: 1, load: 100, unit: 'g' }],
  }

  it('acepta el alta con sus pruebas y puntos', () => {
    expect(() =>
      createCalibrationTemplateSchema.parse({
        name: 'VERIFICACION BALANZA',
        code: 'CT-01',
        periodicity: 30,
        notifyDaysBefore: 5,
        tests: [prueba],
      }),
    ).not.toThrow()
  })

  it('la edicion conserva periodicity y notifyDaysBefore', () => {
    // El tipo inline del controller los declaraba en create y NO en update,
    // pero el service si los escribe. Copiarlo hubiera hecho que cambiar la
    // periodicidad de una plantilla no tuviera ningun efecto.
    const parseado = updateCalibrationTemplateSchema.parse({
      name: 'VERIFICACION BALANZA',
      periodicity: 90,
      notifyDaysBefore: 10,
    })

    expect(parseado.periodicity).toBe(90)
    expect(parseado.notifyDaysBefore).toBe(10)
  })

  it('formulaError entra como texto acotado, no como formula validada', () => {
    // La evalua mathjs en el backend sobre una instancia restringida; validar
    // la sintaxis aca seria un segundo motor que se desincroniza del primero.
    expect(
      createCalibrationTemplateSchema.safeParse({
        name: 'X',
        tests: [{ ...prueba, formulaError: '{LECTURA} - {PATRON}' }],
      }).success,
    ).toBe(true)
  })
})
