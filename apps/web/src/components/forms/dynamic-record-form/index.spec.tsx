import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DynamicRecordForm } from './index'
import type { FieldDef, RecordForForm } from './types'

/**
 * El formulario dinámico es por donde entra todo el dato del sistema. Lo que se
 * cubre acá no es que se vea lindo, sino las reglas que protegen la
 * trazabilidad:
 *
 *   - Un campo identificador de una entrada COMPLETED no se puede editar
 *     (regla 3 de apps/api/CLAUDE.md). El backend también lo valida, pero si el
 *     frontend deja escribir, el usuario pierde el trabajo al guardar.
 *   - En modo lectura nada es editable.
 *   - Lo que el usuario escribe llega tal cual al handler que persiste.
 */

const campo = (over: Partial<FieldDef> & { id: string; label: string }): FieldDef => ({
  fieldType: 'TEXT',
  isIdentifier: false,
  isRequired: false,
  ...over,
})

const registro = (fields: FieldDef[]): RecordForForm => ({
  id: 'rec-1',
  name: 'CONTROL DE PROCESO',
  type: 'PERIODIC',
  fields,
})

describe('DynamicRecordForm', () => {
  it('renderiza un control por cada campo, con su etiqueta', () => {
    const r = registro([
      campo({ id: 'f-lote', label: 'LOTE' }),
      campo({ id: 'f-peso', label: 'PESO', fieldType: 'NUMBER' }),
    ])
    render(<DynamicRecordForm record={r} mode="create" value={{}} onChange={() => {}} />)

    expect(screen.getByText('LOTE')).toBeDefined()
    expect(screen.getByText('PESO')).toBeDefined()
  })

  it('muestra los valores actuales', () => {
    const r = registro([campo({ id: 'f-lote', label: 'LOTE' })])
    render(
      <DynamicRecordForm
        record={r}
        mode="edit"
        value={{ 'f-lote': 'L-001' }}
        onChange={() => {}}
      />,
    )
    expect(screen.getByDisplayValue('L-001')).toBeDefined()
  })

  it('propaga lo que el usuario escribe', () => {
    const onChange = vi.fn()
    const r = registro([campo({ id: 'f-lote', label: 'LOTE' })])
    render(<DynamicRecordForm record={r} mode="create" value={{}} onChange={onChange} />)

    fireEvent.change(screen.getByDisplayValue(''), { target: { value: 'L-002' } })

    expect(onChange).toHaveBeenCalled()
    const ultimo = onChange.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(ultimo['f-lote']).toBe('L-002')
  })

  it('con la entrada COMPLETED, el identificador queda bloqueado', () => {
    // Es la regla ISO: los campos isIdentifier son inmutables una vez que la
    // entrada esta completa, porque son los que la identifican en el registro.
    const r = registro([
      campo({ id: 'f-lote', label: 'LOTE', isIdentifier: true }),
      campo({ id: 'f-obs', label: 'OBSERVACIONES' }),
    ])
    const { container } = render(
      <DynamicRecordForm
        record={r}
        mode="edit"
        value={{ 'f-lote': 'L-001', 'f-obs': 'OK' }}
        onChange={() => {}}
        isCompleted
      />,
    )

    const identificador = container.querySelector<HTMLInputElement>('input[value="L-001"]')
    const observaciones = container.querySelector<HTMLInputElement>('input[value="OK"]')

    expect(identificador?.disabled || identificador?.readOnly).toBe(true)
    // El resto sigue editable: bloquear todo seria impedir corregir un dato
    // que la norma sí permite corregir.
    expect(observaciones?.disabled).toBeFalsy()
  })

  it('sin estar COMPLETED, el identificador se edita', () => {
    const r = registro([campo({ id: 'f-lote', label: 'LOTE', isIdentifier: true })])
    const { container } = render(
      <DynamicRecordForm
        record={r}
        mode="edit"
        value={{ 'f-lote': 'L-001' }}
        onChange={() => {}}
      />,
    )
    const input = container.querySelector<HTMLInputElement>('input[value="L-001"]')
    expect(input?.disabled).toBeFalsy()
  })

  it('en modo lectura nada es editable', () => {
    const r = registro([
      campo({ id: 'f-lote', label: 'LOTE' }),
      campo({ id: 'f-peso', label: 'PESO', fieldType: 'NUMBER' }),
    ])
    const { container } = render(
      <DynamicRecordForm
        record={r}
        mode="view"
        value={{ 'f-lote': 'L-001', 'f-peso': 10 }}
      />,
    )
    const inputs = Array.from(container.querySelectorAll('input'))
    expect(inputs.length).toBeGreaterThan(0)
    for (const input of inputs) {
      expect(input.disabled || input.readOnly).toBe(true)
    }
  })

  it('hideFieldIds oculta el campo indicado', () => {
    const r = registro([
      campo({ id: 'f-lote', label: 'LOTE' }),
      campo({ id: 'f-interno', label: 'USO INTERNO' }),
    ])
    render(
      <DynamicRecordForm
        record={r}
        mode="edit"
        value={{}}
        onChange={() => {}}
        hideFieldIds={['f-interno']}
      />,
    )
    expect(screen.getByText('LOTE')).toBeDefined()
    expect(screen.queryByText('USO INTERNO')).toBeNull()
  })

  it('un campo FORMULA no se edita a mano', () => {
    // El valor lo calcula el backend; dejar escribirlo daria la impresion de
    // que se puede corregir el resultado de un calculo.
    const r = registro([
      campo({ id: 'f-a', label: 'A', fieldType: 'NUMBER' }),
      campo({
        id: 'f-t',
        label: 'TOTAL',
        fieldType: 'FORMULA',
        formulaConfig: { expression: '{A} * 2' },
      }),
    ])
    const { container } = render(
      <DynamicRecordForm record={r} mode="edit" value={{ 'f-a': 5 }} onChange={() => {}} />,
    )
    const editables = Array.from(container.querySelectorAll('input')).filter(
      (i) => !i.disabled && !i.readOnly,
    )
    // Solo A queda editable; TOTAL no.
    expect(editables.length).toBe(1)
  })

  it('un registro sin campos no rompe', () => {
    expect(() =>
      render(<DynamicRecordForm record={registro([])} mode="create" value={{}} onChange={() => {}} />),
    ).not.toThrow()
  })
})
