'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { FieldDef, FormMode, RecordForForm } from './types'
import {
  buildMockData,
  computeFormulaResults,
  evalComparison,
} from './helpers'
import {
  CalibrationTemplateField,
  ComparisonField,
  DropdownField,
  FieldLabel,
  FormulaField,
  MatrixMethodField,
  MultiRelatedEntryField,
  PlaceholderSelectField,
  QuantityField,
  RecipeSelectField,
  RelatedEntryField,
  SimpleField,
} from './fields'

export type {
  FormMode,
  FieldDef,
  RecordForForm,
} from './types'

export interface DynamicRecordFormProps {
  record: RecordForForm
  mode: FormMode
  /** En create/edit/view: valores actuales del form. Ignorado en preview (usa mockData). */
  value?: Record<string, unknown>
  /** En create/edit: handler de cambio. */
  onChange?: (data: Record<string, unknown>) => void
  /** Opcional — en preview se usan estos mock values; si no, se auto-generan por heurística. */
  mockData?: Record<string, unknown>
  /** Oculta ciertos campos por id. */
  hideFieldIds?: string[]
  /** La Entry ya está COMPLETED: identificadores quedan read-only. */
  isCompleted?: boolean
  /** Título serif arriba del form (opcional — útil para preview). */
  title?: React.ReactNode
  /** Kicker mono uppercase arriba del título. */
  kicker?: string
  /** Metadata bar (ej: "DRAFT · vence — · creado por s.d."). */
  metaBar?: React.ReactNode
  /** Acciones que aparecen debajo del título (top-right). */
  headerActions?: React.ReactNode
  className?: string
  /** Variante visual: "bare" sin padding, "framed" con card. Default "bare". */
  variant?: 'bare' | 'framed'
}

export function DynamicRecordForm({
  record,
  mode,
  value,
  onChange,
  mockData,
  hideFieldIds,
  isCompleted,
  title,
  kicker,
  metaBar,
  headerActions,
  className,
  variant = 'bare',
}: DynamicRecordFormProps) {
  const isReadOnly = mode === 'view' || mode === 'preview'
  const effectiveMockData = React.useMemo(() => {
    if (mode !== 'preview') return {}
    if (mockData) return mockData
    return buildMockData(record)
  }, [mode, mockData, record])

  const data: Record<string, unknown> = mode === 'preview' ? effectiveMockData : value ?? {}

  const setData = React.useCallback(
    (next: Record<string, unknown>) => {
      if (mode === 'preview') return
      onChange?.(next)
    },
    [mode, onChange],
  )

  const setFieldValue = (fieldId: string, v: unknown) => {
    if (mode === 'preview') return
    onChange?.({ ...data, [fieldId]: v })
  }

  const formulaResults = React.useMemo(
    () => computeFormulaResults(record, data),
    [record, data],
  )

  const hidden = new Set(hideFieldIds ?? [])

  return (
    <div
      className={cn(
        variant === 'framed' &&
          'rounded-[14px] border bg-[var(--bg-1)] shadow-[var(--shadow-sm)]',
        className,
      )}
      style={
        variant === 'framed'
          ? { borderColor: 'var(--line)', padding: '20px 22px' }
          : undefined
      }
    >
      {(title || kicker || metaBar || headerActions) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 16,
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ minWidth: 0 }}>
            {kicker && <div className="kicker" style={{ marginBottom: 4 }}>{kicker}</div>}
            {title && (
              <div
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: 22,
                  lineHeight: 1.15,
                  color: 'var(--ink-0)',
                }}
              >
                {title}
              </div>
            )}
            {metaBar && (
              <div
                className="kicker"
                style={{
                  marginTop: 4,
                  color: 'var(--ink-3)',
                  letterSpacing: '0.1em',
                  fontSize: 10,
                }}
              >
                {metaBar}
              </div>
            )}
          </div>
          {headerActions && <div style={{ display: 'flex', gap: 8 }}>{headerActions}</div>}
        </div>
      )}

      <div style={{ display: 'grid', gap: 14 }}>
        {record.fields.map((field) => {
          if (hidden.has(field.id)) return null
          return (
            <FieldSwitch
              key={field.id}
              field={field}
              record={record}
              data={data}
              mode={mode}
              isCompleted={isCompleted}
              isReadOnly={isReadOnly}
              formulaResults={formulaResults}
              onSetFieldValue={setFieldValue}
              onSetData={setData}
            />
          )
        })}
      </div>
    </div>
  )
}

// ============================================================================
// Switch: elige qué field component usar para cada fieldType
// ============================================================================

function FieldSwitch({
  field,
  record,
  data,
  mode,
  isCompleted,
  isReadOnly,
  formulaResults,
  onSetFieldValue,
  onSetData,
}: {
  field: FieldDef
  record: RecordForForm
  data: Record<string, unknown>
  mode: FormMode
  isCompleted?: boolean
  isReadOnly: boolean
  formulaResults: Record<string, number>
  onSetFieldValue: (id: string, v: unknown) => void
  onSetData: (d: Record<string, unknown>) => void
}) {
  const value = data[field.id]
  // Identificador de entry COMPLETED: read-only
  const identifierLocked =
    isCompleted && field.isIdentifier && (mode === 'edit' || mode === 'view')
  const readOnly = isReadOnly || identifierLocked

  switch (field.fieldType) {
    case 'FORMULA':
      return <FormulaField field={field} result={formulaResults[field.id]} />

    case 'COMPARISON': {
      const evalRes = evalComparison(field, record, data, formulaResults)
      return (
        <ComparisonField
          field={field}
          evalResult={evalRes}
          value={value}
          onChange={(v) => onSetFieldValue(field.id, v)}
          readOnly={readOnly}
        />
      )
    }

    case 'QUANTITY':
      return (
        <QuantityField
          field={field}
          value={value}
          onChange={(v) => onSetFieldValue(field.id, v)}
          readOnly={readOnly}
        />
      )

    case 'DROPDOWN':
      return (
        <DropdownField
          field={field}
          value={value}
          onChange={(v) => onSetFieldValue(field.id, v)}
          readOnly={readOnly}
        />
      )

    case 'RELATED_ENTRY':
      if (mode === 'preview') {
        return (
          <PlaceholderSelectField
            field={field}
            hint="RELACIÓN"
            placeholder="(selector en vivo)"
          />
        )
      }
      return (
        <RelatedEntryField
          field={field}
          value={value}
          data={data}
          setData={onSetData}
          readOnly={readOnly}
          mode={mode}
        />
      )

    case 'MULTIPLE_RELATED_ENTRY':
      if (mode === 'preview') {
        return (
          <PlaceholderSelectField
            field={field}
            hint="MÚLTIPLES"
            placeholder="(selector múltiple)"
          />
        )
      }
      return (
        <MultiRelatedEntryField
          field={field}
          value={value}
          data={data}
          setData={onSetData}
          readOnly={readOnly}
          mode={mode}
        />
      )

    case 'RECIPE_SELECT':
      if (mode === 'preview') {
        return (
          <PlaceholderSelectField
            field={field}
            hint="RECETA"
            placeholder="(seleccionar receta al ingresar)"
          />
        )
      }
      return (
        <RecipeSelectField
          field={field}
          value={value}
          onChange={(v) => onSetFieldValue(field.id, v)}
          readOnly={readOnly}
          mode={mode}
        />
      )

    case 'CALIBRATION_TEMPLATE':
      if (mode === 'preview') {
        return (
          <PlaceholderSelectField
            field={field}
            hint="PLANTILLA"
            placeholder="(seleccionar plantilla al ingresar)"
          />
        )
      }
      return (
        <CalibrationTemplateField
          field={field}
          value={value}
          onChange={(v) => onSetFieldValue(field.id, v)}
          readOnly={readOnly}
          mode={mode}
        />
      )

    case 'MATRIX_METHOD':
      if (mode === 'preview') {
        return (
          <PlaceholderSelectField
            field={field}
            hint="MATRIZ · MÉTODOS"
            placeholder="(matriz + métodos al ingresar)"
          />
        )
      }
      return (
        <MatrixMethodField
          field={field}
          value={value}
          onChange={(v) => onSetFieldValue(field.id, v)}
          readOnly={readOnly}
          mode={mode}
        />
      )

    // NUMBER / TEXT / DATE → simple input
    default:
      return (
        <SimpleField
          field={field}
          value={value}
          onChange={(v) => onSetFieldValue(field.id, v)}
          readOnly={readOnly}
          placeholder={
            mode === 'preview'
              ? placeholderFor(field.label, field.fieldType)
              : undefined
          }
        />
      )
  }
}

function placeholderFor(label: string, type: string): string {
  const l = label.toLowerCase()
  if (type === 'NUMBER') {
    if (l.includes('patrón') || l.includes('patron')) return '100.000'
    if (l.includes('lectura')) return '100.003'
    return '0'
  }
  if (type === 'TEXT') {
    if (l.includes('lote')) return 'LOT-20260420-01'
    if (l.includes('muestra')) return 'M-20260420-01'
    if (l.includes('codigo') || l.includes('código')) return 'COD-20260420-01'
  }
  return ''
}

// Re-exportar helpers públicos
export { computeFormulaResults, evalComparison } from './helpers'
export { FieldLabel }
