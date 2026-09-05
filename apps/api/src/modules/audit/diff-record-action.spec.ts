import { describe, it, expect } from 'vitest'
import { diffRecordAction } from './audit.service'

/**
 * El diff de un flujo es lo que un auditor lee para saber qué cambió.
 *
 * Antes los cambios de flujo se registraban con el nombre del controller que
 * los alojaba —borrar un flujo quedaba escrito como `records.deleted`— y el
 * `before` que se guardaba era la fila del `Record`, que no había cambiado. O
 * sea que el historial decía que algo pasó, sin decir qué.
 *
 * Un flujo crea entradas, pisa campos y manda datos afuera por webhook. Que se
 * pueda reconstruir cómo estaba configurado antes de un cambio no es un lujo.
 */

const nombres = new Map([
  ['rec-nc', 'NO CONFORMIDADES'],
  ['rec-stock', 'MOVIMIENTOS DE STOCK'],
])

const flujoBase = {
  id: 'flow-1',
  sourceRecordId: 'rec-1',
  targetRecordId: 'rec-nc',
  trigger: 'ENTRY_COMPLETED',
  actionType: 'CREATE_ENTRY',
  condition: null,
  actionConfig: null,
  fieldMapping: [{ sourceFieldId: 'a', targetFieldId: 'b' }],
  allowCascade: false,
  createdAt: '2026-09-01T10:00:00.000Z',
}

describe('diffRecordAction', () => {
  it('sin cambios no reporta nada', () => {
    expect(diffRecordAction(flujoBase, { ...flujoBase }, nombres)).toEqual([])
  })

  it('traduce el registro destino a su nombre', () => {
    // Un cuid crudo en el historial no le dice nada a nadie.
    const cambios = diffRecordAction(
      flujoBase,
      { ...flujoBase, targetRecordId: 'rec-stock' },
      nombres,
    )
    expect(cambios).toEqual([
      { field: 'Registro destino', from: 'NO CONFORMIDADES', to: 'MOVIMIENTOS DE STOCK' },
    ])
  })

  it('si el destino ya no existe muestra el id en vez de nada', () => {
    const cambios = diffRecordAction(
      flujoBase,
      { ...flujoBase, targetRecordId: 'rec-borrado' },
      nombres,
    )
    expect(cambios[0].to).toBe('rec-borrado')
  })

  it('usa las mismas palabras que el editor visual', () => {
    // Si el historial dijera ENTRY_COMPLETED y el editor "Cuando se completa
    // una entrada", habría que traducir mentalmente entre las dos pantallas.
    const cambios = diffRecordAction(
      flujoBase,
      { ...flujoBase, trigger: 'COMPARISON_FAILED', actionType: 'NOTIFY' },
      nombres,
    )
    expect(cambios).toContainEqual({
      field: 'Cuándo se dispara',
      from: 'Cuando se completa una entrada',
      to: 'Cuando falla una comparación',
    })
    expect(cambios).toContainEqual({
      field: 'Qué hace',
      from: 'Crear entrada en otro registro',
      to: 'Notificar dentro de la app',
    })
  })

  it('detecta que se apagó o encendió el encadenado', () => {
    // Es el interruptor anti-loop: quién lo tocó y cuándo importa.
    const cambios = diffRecordAction(flujoBase, { ...flujoBase, allowCascade: true }, nombres)
    expect(cambios).toEqual([
      { field: 'Permitir encadenado', from: false, to: true },
    ])
  })

  it('detecta cambios dentro de la condición, que es un objeto anidado', () => {
    const cambios = diffRecordAction(
      { ...flujoBase, condition: { op: 'EQUALS', field: 'f1', value: 'A' } },
      { ...flujoBase, condition: { op: 'EQUALS', field: 'f1', value: 'B' } },
      nombres,
    )
    expect(cambios).toHaveLength(1)
    expect(cambios[0].field).toBe('Condición')
  })

  it('resume el mapeo por cantidad de campos', () => {
    const cambios = diffRecordAction(
      flujoBase,
      {
        ...flujoBase,
        fieldMapping: [
          { sourceFieldId: 'a', targetFieldId: 'b' },
          { sourceFieldId: 'c', targetFieldId: 'd' },
        ],
      },
      nombres,
    )
    expect(cambios).toEqual([{ field: 'Mapeo de campos', from: '1 campo', to: '2 campos' }])
  })

  it('ignora las columnas que no son decisiones del usuario', () => {
    // `id` y `createdAt` cambiarían el diff sin decir nada.
    const cambios = diffRecordAction(
      flujoBase,
      { ...flujoBase, id: 'otro', createdAt: '2026-09-05T10:00:00.000Z' },
      nombres,
    )
    expect(cambios).toEqual([])
  })

  it('una creación lista la configuración con la que nació', () => {
    // No hay estado previo; todo lo configurado es el cambio.
    const cambios = diffRecordAction(null, flujoBase, nombres)
    const campos = cambios.map((c) => c.field)
    expect(campos).toContain('Registro destino')
    expect(campos).toContain('Cuándo se dispara')
    expect(cambios.every((c) => c.from === undefined)).toBe(true)
  })

  it('un borrado deja registrado qué se borró', () => {
    // Es el caso que más importa: el flujo ya no existe en ningún lado.
    const cambios = diffRecordAction(flujoBase, null, nombres)
    expect(cambios.find((c) => c.field === 'Registro destino')).toEqual({
      field: 'Registro destino',
      from: 'NO CONFORMIDADES',
      to: undefined,
    })
  })

  it('sin ninguno de los dos lados no rompe', () => {
    expect(diffRecordAction(null, null, nombres)).toEqual([])
  })
})
