import { describe, it, expect } from 'vitest'
import {
  findConfigWarnings,
  findMappingErrors,
  isFlowExecutable,
  sanitizeFieldMapping,
  type TargetFieldRef,
} from './flow-config'

/**
 * Estas funciones deciden dos cosas con consecuencias reales: si una
 * configuración de flujo se puede guardar, y si el motor la ejecuta. La UI las
 * usa para pintar el "!" y el listener para decidir si corre, así que un
 * cambio silencioso acá desincroniza lo que el usuario ve de lo que pasa.
 */

const campos = (over: Partial<TargetFieldRef>[] = []): TargetFieldRef[] => [
  { id: 'f-id', label: 'CÓDIGO', isActive: true, isIdentifier: true },
  { id: 'f-obs', label: 'OBSERVACIONES', isActive: true, isIdentifier: false },
  ...(over as TargetFieldRef[]),
]

describe('sanitizeFieldMapping', () => {
  it('descarta las filas a medio completar', () => {
    const out = sanitizeFieldMapping([
      { sourceFieldId: 'a', targetFieldId: 'f-id' },
      { sourceFieldId: '', targetFieldId: 'f-obs' },
      { sourceFieldId: 'b', targetFieldId: '' },
      { sourceFieldId: '   ', targetFieldId: '   ' },
    ])
    expect(out).toEqual([{ sourceFieldId: 'a', targetFieldId: 'f-id' }])
  })

  it('recorta espacios en vez de tratarlos como valor', () => {
    expect(
      sanitizeFieldMapping([{ sourceFieldId: ' a ', targetFieldId: ' f-id ' }]),
    ).toEqual([{ sourceFieldId: 'a', targetFieldId: 'f-id' }])
  })

  it('tolera cualquier basura sin romper, porque el valor viene de un JSONB', () => {
    expect(sanitizeFieldMapping(null)).toEqual([])
    expect(sanitizeFieldMapping('no soy un array')).toEqual([])
    expect(sanitizeFieldMapping([null, 42, { otra: 'cosa' }])).toEqual([])
  })
})

describe('findMappingErrors', () => {
  it('acepta un mapeo que apunta a campos activos del destino', () => {
    const errores = findMappingErrors(
      [{ sourceFieldId: 'a', targetFieldId: 'f-id' }],
      campos(),
    )
    expect(errores).toEqual([])
  })

  it('rechaza un mapeo hacia un campo que no existe en el destino', () => {
    const errores = findMappingErrors(
      [{ sourceFieldId: 'a', targetFieldId: 'f-borrado' }],
      campos(),
    )
    expect(errores).toHaveLength(1)
    expect(errores[0]).toContain('no existe')
  })

  it('rechaza un campo del destino mapeado dos veces', () => {
    const errores = findMappingErrors(
      [
        { sourceFieldId: 'a', targetFieldId: 'f-id' },
        { sourceFieldId: 'b', targetFieldId: 'f-id' },
      ],
      campos(),
    )
    expect(errores).toHaveLength(1)
    expect(errores[0]).toContain('CÓDIGO')
  })

  it('trata un campo inactivo como inexistente', () => {
    const errores = findMappingErrors(
      [{ sourceFieldId: 'a', targetFieldId: 'f-viejo' }],
      campos([{ id: 'f-viejo', label: 'VIEJO', isActive: false, isIdentifier: false }]),
    )
    expect(errores).toHaveLength(1)
  })
})

describe('findConfigWarnings · CREATE_ENTRY', () => {
  const base = { actionType: 'CREATE_ENTRY', targetFields: campos() }

  it('no advierte nada cuando los identificadores están mapeados', () => {
    const w = findConfigWarnings({
      ...base,
      mapping: [{ sourceFieldId: 'a', targetFieldId: 'f-id' }],
    })
    expect(w).toEqual([])
  })

  it('advierte cuando falta mapear el identificador del destino', () => {
    const w = findConfigWarnings({
      ...base,
      mapping: [{ sourceFieldId: 'a', targetFieldId: 'f-obs' }],
    })
    expect(w).toHaveLength(1)
    expect(w[0]).toContain('CÓDIGO')
  })

  it('advierte cuando no hay ningún mapeo', () => {
    const w = findConfigWarnings({ ...base, mapping: [] })
    // Sin mapeo faltan las dos cosas: el mapeo en si y el identificador.
    expect(w.length).toBeGreaterThanOrEqual(1)
    expect(w.join(' ')).toContain('ningún campo mapeado')
  })

  it('ignora los identificadores inactivos', () => {
    const w = findConfigWarnings({
      actionType: 'CREATE_ENTRY',
      targetFields: campos([
        { id: 'f-viejo', label: 'VIEJO', isActive: false, isIdentifier: true },
      ]),
      mapping: [{ sourceFieldId: 'a', targetFieldId: 'f-id' }],
    })
    expect(w).toEqual([])
  })
})

describe('findConfigWarnings · UPDATE_FIELD', () => {
  it('advierte cuando falta el campo a actualizar', () => {
    const w = findConfigWarnings({
      actionType: 'UPDATE_FIELD',
      mapping: [],
      targetFields: campos(),
      actionConfig: { entryIdSource: '$entry.id' },
    })
    expect(w).toHaveLength(1)
    expect(w[0]).toContain('campo a actualizar')
  })

  it('no exige mapeo de identificadores, porque no crea nada', () => {
    const w = findConfigWarnings({
      actionType: 'UPDATE_FIELD',
      mapping: [],
      targetFields: campos(),
      actionConfig: { entryIdSource: '$entry.id', fieldId: 'f-obs' },
    })
    expect(w).toEqual([])
  })
})

describe('isFlowExecutable', () => {
  it('un flujo incompleto no se ejecuta', () => {
    expect(
      isFlowExecutable({
        actionType: 'CREATE_ENTRY',
        mapping: [],
        targetFields: campos(),
      }),
    ).toBe(false)
  })

  it('un flujo completo se ejecuta', () => {
    expect(
      isFlowExecutable({
        actionType: 'CREATE_ENTRY',
        mapping: [{ sourceFieldId: 'a', targetFieldId: 'f-id' }],
        targetFields: campos(),
      }),
    ).toBe(true)
  })
})
