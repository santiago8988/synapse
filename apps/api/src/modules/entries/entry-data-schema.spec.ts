import { describe, it, expect } from 'vitest'
import {
  createEntrySchema,
  entryDataSchema,
  updateEntrySchema,
  ENTRY_DATA_MAX_CLAVES,
  ENTRY_DATA_MAX_TEXTO,
  ENTRY_DATA_MAX_ITEMS,
} from '@synapse/validators'

/**
 * Limites de `Entry.data`, el unico body de la API que es un mapa abierto: las
 * claves son ids de fields, asi que no se pueden enumerar.
 *
 * Los tests que importan son dos y tiran para lados opuestos: que lo que el
 * frontend manda hoy siga entrando —si un limite es demasiado ajustado, el
 * sintoma es un formulario que deja de guardar— y que lo que no tiene forma de
 * field quede afuera.
 */

describe('entryDataSchema', () => {
  describe('lo que el frontend manda hoy tiene que entrar', () => {
    it('acepta los primitivos de los field types', () => {
      const data = {
        'field-texto': 'MUESTRA 001',
        'field-numero': 23.5,
        'field-booleano': true,
        'field-vacio': null,
      }

      expect(entryDataSchema.parse(data)).toEqual(data)
    })

    it('acepta el value de un FILE_PDF', () => {
      // El frontend manda `data` completa, no parcial, asi que reenvia el
      // objeto del archivo tal como lo devolvio el upload.
      const data = {
        'field-pdf': {
          key: 'org-1/certificado.pdf',
          name: 'certificado.pdf',
          size: 82311,
          uploadedAt: '2026-09-21T00:00:00.000Z',
          uploadedById: 'user-1',
        },
      }

      expect(entryDataSchema.parse(data)).toEqual(data)
    })

    it('acepta una lista de ids relacionados', () => {
      const data = { 'field-multi': ['entry-1', 'entry-2', 'entry-3'] }

      expect(entryDataSchema.parse(data)).toEqual(data)
    })

    it('acepta una lista de objetos de archivo', () => {
      const data = {
        'field-pdfs': [
          { key: 'org-1/a.pdf', name: 'a.pdf', size: 10 },
          { key: 'org-1/b.pdf', name: 'b.pdf', size: 20 },
        ],
      }

      expect(entryDataSchema.parse(data)).toEqual(data)
    })

    it('acepta un registro vacio', () => {
      expect(entryDataSchema.parse({})).toEqual({})
    })
  })

  describe('lo que no tiene forma de field queda afuera', () => {
    it('rechaza mas claves que el maximo', () => {
      const data: Record<string, string> = {}
      for (let i = 0; i <= ENTRY_DATA_MAX_CLAVES; i++) data[`f${i}`] = 'x'

      expect(() => entryDataSchema.parse(data)).toThrow()
    })

    it('acepta exactamente el maximo de claves', () => {
      const data: Record<string, string> = {}
      for (let i = 0; i < ENTRY_DATA_MAX_CLAVES; i++) data[`f${i}`] = 'x'

      expect(() => entryDataSchema.parse(data)).not.toThrow()
    })

    it('rechaza un texto mas largo que el maximo', () => {
      const data = { 'field-texto': 'x'.repeat(ENTRY_DATA_MAX_TEXTO + 1) }

      expect(() => entryDataSchema.parse(data)).toThrow()
    })

    it('rechaza una lista mas larga que el maximo', () => {
      const data = { 'field-multi': Array(ENTRY_DATA_MAX_ITEMS + 1).fill('id') }

      expect(() => entryDataSchema.parse(data)).toThrow()
    })

    it('rechaza anidamiento mas profundo que un objeto plano', () => {
      // La profundidad esta declarada explicita justamente para que esto no
      // entre: recursion sin fondo sobre una columna Json es lo que se evita.
      const data = { 'field-x': { a: { b: { c: 'demasiado' } } } }

      expect(() => entryDataSchema.parse(data)).toThrow()
    })

    it('rechaza NaN e Infinity, que no sobreviven a JSON', () => {
      expect(() => entryDataSchema.parse({ f: Number.NaN })).toThrow()
      expect(() => entryDataSchema.parse({ f: Number.POSITIVE_INFINITY })).toThrow()
    })
  })
})

describe('createEntrySchema', () => {
  it('descarta los campos que no declara', () => {
    const parseado = createEntrySchema.parse({
      data: { 'field-1': 'X' },
      lotNumber: 'L-001',
      recordId: 'rec-de-otro',
      organizationId: 'org-victima',
      status: 'COMPLETED',
    })

    // recordId sale de la URL y organizationId del JWT: que vengan en el body
    // no significa nada, y ahora tampoco llegan al handler.
    expect(parseado).toEqual({ data: { 'field-1': 'X' }, lotNumber: 'L-001' })
  })

  it('exige data', () => {
    expect(() => createEntrySchema.parse({ lotNumber: 'L-001' })).toThrow()
  })
})

describe('updateEntrySchema', () => {
  it('acepta data con motivo de transition', () => {
    const parseado = updateEntrySchema.parse({
      data: { estado: 'RESUELTA' },
      transitionReason: 'SE CORRIGIO EL DESVIO',
    })

    expect(parseado.transitionReason).toBe('SE CORRIGIO EL DESVIO')
  })

  it('exige data, porque el frontend manda el mapa completo y no un parcial', () => {
    expect(() => updateEntrySchema.parse({ transitionReason: 'SOLO EL MOTIVO' })).toThrow()
  })

  it('le pone techo al motivo, que va a un log append-only', () => {
    expect(() =>
      updateEntrySchema.parse({ data: {}, transitionReason: 'x'.repeat(1001) }),
    ).toThrow()
  })
})
