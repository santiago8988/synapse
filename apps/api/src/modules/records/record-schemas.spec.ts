import { describe, it, expect } from 'vitest'
import {
  createRecordSchema,
  editRecordSchema,
  createRecordActionSchema,
  updateRecordActionSchema,
  JSON_MAX_CLAVES,
  JSON_MAX_TEXTO,
} from '@synapse/validators'

/**
 * Schemas de registros y flujos.
 *
 * `records` es el modulo mas grande de la fase y el que mas facil se rompe al
 * validarlo: el Record Builder manda un arbol de campos con configuraciones
 * JSON libres, y el editor de flujos delega las condiciones compuestas a
 * "editá manualmente vía API". Los tests replican lo que **esos dos mandan hoy**
 * antes de probar que los limites existan.
 */

const campoDropdown = {
  label: 'ESTADO',
  fieldType: 'DROPDOWN' as const,
  order: 0,
  isIdentifier: true,
  isRequired: true,
  comparisonConfig: { options: ['ABIERTA', 'EN PROCESO', 'CERRADA'] },
}

describe('createRecordSchema — lo que manda el Record Builder', () => {
  it('acepta el payload de un registro periodico', () => {
    const payload = {
      name: 'VERIFICACION DIARIA BALANZA',
      type: 'PERIODIC',
      areaIds: [],
      periodicity: 1,
      notifyDaysBefore: 0,
      fields: [campoDropdown],
    }

    expect(() => createRecordSchema.parse(payload)).not.toThrow()
  })

  it('acepta un campo RELATED_ENTRY con su relacion', () => {
    const parseado = createRecordSchema.parse({
      name: 'ENSAYO',
      type: 'NOT_PERIODIC',
      fields: [
        {
          label: 'INSTRUMENTO',
          fieldType: 'RELATED_ENTRY',
          order: 0,
          relatedRecordId: 'clh3k2j9x0000qwer1234asdf',
          relatedFieldIds: ['clh3k2j9x0001qwer1234asdf'],
        },
      ],
    })

    expect(parseado.fields[0].relatedRecordId).toBe('clh3k2j9x0000qwer1234asdf')
  })

  it('acepta el comparisonConfig de un COMPARISON, que referencia labels', () => {
    // El builder resuelve fieldId a la *label* del campo y el service la
    // convierte a id despues de crear los campos.
    const payload = {
      name: 'CONTROL',
      type: 'NOT_PERIODIC',
      fields: [
        {
          label: 'DESVIO',
          fieldType: 'COMPARISON',
          order: 0,
          comparisonConfig: {
            operator: 'BETWEEN',
            compareAgainst: 'CONSTANT',
            constantValue: 0.5,
            secondValue: 1.5,
            fieldId: 'PESO NETO',
          },
        },
      ],
    }

    expect(() => createRecordSchema.parse(payload)).not.toThrow()
  })

  it('rechaza los campos que no declara', () => {
    // Con `.strict()` un campo de mas es un 400 y no un campo descartado en
    // silencio. Antes, `organizationId` en el body movia el registro de tenant.
    const resultado = createRecordSchema.safeParse({
      name: 'X',
      type: 'NOT_PERIODIC',
      fields: [],
      organizationId: 'org-victima',
      version: 99,
      status: 'ACTIVE',
    })

    expect(resultado.success).toBe(false)
  })

  it('el payload limpio sigue entrando', () => {
    expect(
      createRecordSchema.safeParse({ name: 'X', type: 'NOT_PERIODIC', fields: [] }).success,
    ).toBe(true)
  })

  it('rechaza un type que no existe', () => {
    expect(
      createRecordSchema.safeParse({ name: 'X', type: 'INVENTADO', fields: [] }).success,
    ).toBe(false)
  })

  it('rechaza un fieldType que no existe', () => {
    expect(
      createRecordSchema.safeParse({
        name: 'X',
        type: 'NOT_PERIODIC',
        fields: [{ label: 'A', fieldType: 'MAGICO', order: 0 }],
      }).success,
    ).toBe(false)
  })
})

describe('editRecordSchema — lo que manda el detalle del registro', () => {
  const base = { changeReason: 'SE AGREGO UN CAMPO' }

  it('acepta el payload de una edicion con campos nuevos y actualizados', () => {
    const payload = {
      ...base,
      name: 'NUEVO NOMBRE',
      addFields: [campoDropdown],
      removeFieldIds: ['clh3k2j9x0002qwer1234asdf'],
      updateFields: [
        { id: 'clh3k2j9x0003qwer1234asdf', label: 'PESO', order: 1, isRequired: false },
      ],
    }

    expect(() => editRecordSchema.parse(payload)).not.toThrow()
  })

  it('addFields conserva relatedRecordId y relatedFieldIds', () => {
    // El tipo inline del controller no los declaraba, pero el tipo se borra en
    // runtime y `editWithVersion` los escribe. Descartarlos aca hubiera roto en
    // silencio agregar un RELATED_ENTRY al editar: el campo se creaba sin su
    // relacion y nadie se enteraba hasta usarlo.
    const parseado = editRecordSchema.parse({
      ...base,
      addFields: [
        {
          label: 'INSTRUMENTO',
          fieldType: 'RELATED_ENTRY',
          order: 3,
          relatedRecordId: 'clh3k2j9x0000qwer1234asdf',
          relatedFieldIds: ['clh3k2j9x0001qwer1234asdf'],
        },
      ],
    })

    expect(parseado.addFields?.[0].relatedRecordId).toBe('clh3k2j9x0000qwer1234asdf')
    expect(parseado.addFields?.[0].relatedFieldIds).toEqual(['clh3k2j9x0001qwer1234asdf'])
  })

  it('exige changeReason', () => {
    // Versionar escribe una fila con el motivo: es lo que una auditoria lee
    // para saber por que cambio el formulario con el que se cargaron ensayos.
    expect(editRecordSchema.safeParse({ name: 'X' }).success).toBe(false)
    expect(editRecordSchema.safeParse({ changeReason: '' }).success).toBe(false)
  })
})

describe('JSON de configuracion acotado', () => {
  function conConfig(comparisonConfig: unknown) {
    return createRecordSchema.safeParse({
      name: 'X',
      type: 'NOT_PERIODIC',
      fields: [{ label: 'A', fieldType: 'DROPDOWN', order: 0, comparisonConfig }],
    })
  }

  it('rechaza un texto desmedido adentro de la config', () => {
    expect(conConfig({ options: ['x'.repeat(JSON_MAX_TEXTO + 1)] }).success).toBe(false)
  })

  it('rechaza mas claves que el maximo', () => {
    const gordo: Record<string, string> = {}
    for (let i = 0; i <= JSON_MAX_CLAVES; i++) gordo[`k${i}`] = 'v'

    expect(conConfig(gordo).success).toBe(false)
  })

  it('rechaza anidamiento sin fondo', () => {
    let profundo: Record<string, unknown> = { fin: true }
    for (let i = 0; i < 12; i++) profundo = { nivel: profundo }

    expect(conConfig(profundo).success).toBe(false)
  })
})

describe('schemas de flujos (RecordAction)', () => {
  const targetRecordId = 'clh3k2j9x0000qwer1234asdf'

  it('acepta un flujo simple', () => {
    const payload = {
      targetRecordId,
      fieldMapping: [{ sourceFieldId: 'clh3k2j9x0001qwer1234asdf', targetFieldId: 'clh3k2j9x0002qwer1234asdf' }],
      trigger: 'ENTRY_COMPLETED',
      actionType: 'CREATE_ENTRY',
      allowCascade: false,
      condition: null,
    }

    expect(() => createRecordActionSchema.parse(payload)).not.toThrow()
  })

  it('sourceFieldId acepta los paths del motor, que no son cuids', () => {
    // `$entry.id`, `$entry.<fieldId>` y los paths de companion son validos y no
    // tienen forma de id. Exigir cuid aca hubiera roto todo flujo que
    // referencie a la entry padre o al lote/muestra/instrumento.
    const parseado = createRecordActionSchema.parse({
      targetRecordId,
      fieldMapping: [
        { sourceFieldId: '$entry.id', targetFieldId: 'clh3k2j9x0002qwer1234asdf' },
        { sourceFieldId: '$batch.status', targetFieldId: 'clh3k2j9x0003qwer1234asdf' },
      ],
    })

    expect(parseado.fieldMapping).toHaveLength(2)
  })

  it('acepta una condicion compuesta AND/OR anidada', () => {
    // El editor visual no las cubre y manda a "editá manualmente vía API", asi
    // que la forma tiene que seguir entrando.
    const condition = {
      type: 'AND',
      conditions: [
        { type: 'EQUALS', field: '$batch.status', value: 'REJECTED' },
        {
          type: 'OR',
          conditions: [
            { type: 'GT', field: 'peso', value: 100 },
            { type: 'BETWEEN', field: 'ph', value: [6, 8] },
          ],
        },
      ],
    }

    expect(createRecordActionSchema.safeParse({ targetRecordId, fieldMapping: [], condition }).success).toBe(
      true,
    )
  })

  it('rechaza un trigger o actionType que no existen', () => {
    expect(
      createRecordActionSchema.safeParse({ targetRecordId, fieldMapping: [], trigger: 'CUANDO_QUIERA' })
        .success,
    ).toBe(false)
    expect(
      createRecordActionSchema.safeParse({ targetRecordId, fieldMapping: [], actionType: 'BORRAR_TODO' })
        .success,
    ).toBe(false)
  })

  it('el update acepta un cambio parcial', () => {
    expect(updateRecordActionSchema.safeParse({ allowCascade: true }).success).toBe(true)
  })
})
