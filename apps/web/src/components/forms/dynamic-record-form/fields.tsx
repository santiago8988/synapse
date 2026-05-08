'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, X } from 'lucide-react'
import { api } from '@/lib/api'
import type { FieldDef, RecordForForm } from './types'
import type { ComparisonEval } from './helpers'

// ============================================================================
// Shared label renderer
// ============================================================================

export function FieldLabel({
  field,
  hint,
  children,
}: {
  field: FieldDef
  hint?: string
  children?: React.ReactNode
}) {
  return (
    <span className="syn-field-label">
      <span className="flex items-center gap-1.5">
        {field.label}
        {field.isRequired && <span className="req">*</span>}
        {children}
      </span>
      {hint && <span className="hint">{hint}</span>}
    </span>
  )
}

// ============================================================================
// Number / Text / Date (simple input)
// ============================================================================

export function SimpleField({
  field,
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  field: FieldDef
  value: unknown
  onChange: (v: unknown) => void
  readOnly?: boolean
  placeholder?: string
}) {
  const type =
    field.fieldType === 'NUMBER' ? 'number' : field.fieldType === 'DATE' ? 'date' : 'text'
  const inputMode =
    field.fieldType === 'NUMBER'
      ? ('decimal' as const)
      : field.fieldType === 'DATE'
        ? undefined
        : ('text' as const)

  return (
    <div className="syn-field">
      <FieldLabel field={field} />
      <input
        type={type}
        inputMode={inputMode}
        step={field.fieldType === 'NUMBER' ? 'any' : undefined}
        value={(value as string | number | undefined) ?? ''}
        onChange={(e) => {
          if (readOnly) return
          const raw = e.target.value
          onChange(
            field.fieldType === 'NUMBER' ? (raw === '' ? '' : Number(raw)) : raw,
          )
        }}
        readOnly={readOnly}
        placeholder={placeholder}
        className="syn-input"
        style={readOnly ? { background: 'var(--bg-3)', cursor: 'not-allowed' } : undefined}
      />
    </div>
  )
}

// ============================================================================
// Quantity (value + unit)
// ============================================================================

export function QuantityField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: FieldDef
  value: unknown
  onChange: (v: { value: number | null; unit: string }) => void
  readOnly?: boolean
}) {
  const qty = (value || { value: null, unit: '' }) as { value: number | null; unit: string }
  const units = (field.comparisonConfig as { units?: string[] } | null)?.units ?? []
  return (
    <div className="syn-field">
      <FieldLabel field={field} />
      <div className="syn-unit-input">
        <input
          type="number"
          inputMode="decimal"
          step="any"
          value={qty.value ?? ''}
          placeholder="Cantidad"
          readOnly={readOnly}
          onChange={(e) =>
            onChange({
              ...qty,
              value: e.target.value ? parseFloat(e.target.value) : null,
            })
          }
        />
        <select
          value={qty.unit || ''}
          disabled={readOnly}
          onChange={(e) => onChange({ ...qty, unit: e.target.value })}
          className="unit"
          style={{ border: 0, background: 'var(--bg-3)', cursor: 'pointer', outline: 'none' }}
        >
          <option value="">—</option>
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ============================================================================
// Dropdown
// ============================================================================

export function DropdownField({
  field,
  value,
  onChange,
  readOnly,
}: {
  field: FieldDef
  value: unknown
  onChange: (v: string) => void
  readOnly?: boolean
}) {
  // Acepta dos formas de options:
  //   - Legacy: string[]
  //   - Rica (workflow engine v2): { value, label?, color?, isInitial?, isFinal? }[]
  const rawOptions =
    (field.comparisonConfig as { options?: string[] | Array<{ value: string; label?: string }> } | null)?.options ?? []
  const options: Array<{ value: string; label: string }> = rawOptions.length > 0 && typeof rawOptions[0] === 'object'
    ? (rawOptions as Array<{ value: string; label?: string }>).map((o) => ({
        value: o.value,
        label: o.label || o.value,
      }))
    : (rawOptions as string[]).map((o) => ({ value: o, label: o }))
  return (
    <div className="syn-field">
      <FieldLabel field={field} />
      <select
        value={(value as string) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        disabled={readOnly}
        className="syn-select"
      >
        <option value="">Seleccionar…</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ============================================================================
// Formula (read-only calculated)
// ============================================================================

export function FormulaField({ field, result }: { field: FieldDef; result?: number }) {
  return (
    <div className="syn-field">
      <FieldLabel field={field} hint="Calculado" />
      <div className="syn-unit-input">
        <input
          className="calc"
          readOnly
          value={result !== undefined ? trimDecimal(result) : '—'}
        />
      </div>
    </div>
  )
}

function trimDecimal(n: number): string {
  if (!isFinite(n)) return '—'
  const s = n.toFixed(6)
  return s.replace(/\.?0+$/, '')
}

// ============================================================================
// Comparison (banner de resultado + opcional input manual)
// ============================================================================

export function ComparisonField({
  field,
  evalResult,
  value,
  onChange,
  readOnly,
}: {
  field: FieldDef
  evalResult: ComparisonEval
  value: unknown
  onChange: (v: number | '') => void
  readOnly?: boolean
}) {
  const hasFieldId = !!field.comparisonConfig?.fieldId
  const failMsg =
    (field.comparisonConfig?.failMessage as string | undefined) ?? 'Fuera de tolerancia'

  // Caso 1: comparison LEGACY que pide input manual (sin fieldId configurado)
  if (!hasFieldId) {
    return (
      <div className="syn-field">
        <FieldLabel field={field} />
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={(value as number | '') ?? ''}
            placeholder={evalResult.description || 'Ingresar valor'}
            readOnly={readOnly}
            onChange={(e) =>
              onChange(e.target.value === '' ? '' : Number(e.target.value))
            }
            className="syn-input"
            style={{ flex: 1 }}
          />
          {evalResult.passed !== null && (
            <ResultChip passed={evalResult.passed} message={failMsg} compact />
          )}
        </div>
        {evalResult.description && (
          <p
            className="text-[11px]"
            style={{ color: 'var(--ink-3)', marginTop: 4 }}
          >
            Condición: {evalResult.description}
          </p>
        )}
      </div>
    )
  }

  // Caso 2: comparison derivada de otro campo — sólo muestra el banner
  return (
    <div className="syn-field">
      <FieldLabel field={field} />
      {evalResult.passed === null ? (
        <div
          className="syn-input"
          style={{ background: 'var(--bg-3)', color: 'var(--ink-3)' }}
        >
          Pendiente de evaluación
        </div>
      ) : evalResult.passed ? (
        <ResultBanner passed message="Dentro de tolerancia" />
      ) : (
        <ResultBanner passed={false} message={failMsg} />
      )}
      {evalResult.description && (
        <p
          className="text-[11px]"
          style={{ color: 'var(--ink-3)', marginTop: 4 }}
        >
          Condición: {evalResult.description}
        </p>
      )}
    </div>
  )
}

function ResultBanner({ passed, message }: { passed: boolean; message: string }) {
  return (
    <div
      style={{
        padding: '12px 14px',
        background: passed ? 'var(--ok-soft)' : 'var(--danger-soft)',
        border: `1.5px solid ${passed ? 'var(--ok)' : 'var(--danger)'}`,
        borderRadius: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontSize: 13,
        color: passed ? 'var(--ok)' : 'var(--danger)',
        fontWeight: 500,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          background: passed ? 'var(--ok)' : 'var(--danger)',
          color: '#fff',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {passed ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      </span>
      {message}
    </div>
  )
}

function ResultChip({
  passed,
  message,
  compact,
}: {
  passed: boolean
  message: string
  compact?: boolean
}) {
  return (
    <span
      className={passed ? 'syn-chip syn-chip-ok' : 'syn-chip syn-chip-fail'}
      style={{ alignSelf: 'center', flexShrink: 0 }}
      title={compact ? message : undefined}
    >
      {passed ? 'CUMPLE' : 'NO CUMPLE'}
    </span>
  )
}

// ============================================================================
// Related entry (single / multi)
// ============================================================================

interface RelatedEntry {
  id: string
  data: Record<string, unknown>
  status: string
}

interface RelatedRecord {
  id: string
  name: string
  fields: Array<{ id: string; label: string; fieldType: string; isIdentifier: boolean }>
}

export function RelatedEntryField({
  field,
  value,
  data,
  setData,
  readOnly,
  mode,
}: {
  field: FieldDef
  value: unknown
  data: Record<string, unknown>
  setData: (d: Record<string, unknown>) => void
  readOnly?: boolean
  mode: 'preview' | 'create' | 'edit' | 'view'
}) {
  const enabled = mode !== 'preview' && !!field.relatedRecordId
  const { data: entries = [] } = useQuery<RelatedEntry[]>({
    queryKey: ['entries', field.relatedRecordId],
    queryFn: () =>
      api.entries.list(field.relatedRecordId!) as Promise<RelatedEntry[]>,
    enabled,
  })
  const { data: relatedRecord } = useQuery<RelatedRecord>({
    queryKey: ['record', field.relatedRecordId],
    queryFn: () =>
      api.records.get(field.relatedRecordId!) as Promise<RelatedRecord>,
    enabled,
  })

  const identifierFields = relatedRecord?.fields.filter((f) => f.isIdentifier) ?? []
  const relatedFieldDefs =
    relatedRecord?.fields.filter((f) => field.relatedFieldIds?.includes(f.id)) ?? []
  const selectedId = value as string | undefined
  const selected = entries.find((e) => e.id === selectedId)

  const buildLabel = (entry: RelatedEntry) => {
    if (identifierFields.length === 0) return entry.id.slice(0, 8)
    return identifierFields.map((f) => entry.data[f.id] ?? '—').join(' | ')
  }

  const handleSelect = (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId)
    const next: Record<string, unknown> = { ...data, [field.id]: entryId || undefined }
    if (field.relatedFieldIds) {
      for (const relFieldId of field.relatedFieldIds) {
        delete next[`${field.id}_${relFieldId}`]
      }
    }
    if (entry && field.relatedFieldIds) {
      for (const relFieldId of field.relatedFieldIds) {
        const v = entry.data[relFieldId]
        if (v !== undefined) {
          next[`${field.id}_${relFieldId}`] = v
          const relField = relatedRecord?.fields.find((f) => f.id === relFieldId)
          if (relField) next[`__label_${relField.label}`] = v
        }
      }
    }
    setData(next)
  }

  return (
    <div className="syn-field">
      <FieldLabel field={field} hint="RELACIÓN" />
      <select
        className="syn-select"
        value={selectedId || ''}
        disabled={readOnly}
        onChange={(e) => handleSelect(e.target.value)}
      >
        <option value="">Seleccionar entrada…</option>
        {entries.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {buildLabel(entry)}
          </option>
        ))}
      </select>
      {selected && relatedFieldDefs.length > 0 && (
        <div
          style={{
            marginTop: 6,
            padding: '10px 12px',
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            display: 'grid',
            gap: 4,
          }}
        >
          <span
            className="kicker"
            style={{ color: 'var(--ink-3)', marginBottom: 4 }}
          >
            · Valores transcriptos
          </span>
          {relatedFieldDefs.map((rf) => (
            <div
              key={rf.id}
              className="flex items-center justify-between text-[12.5px]"
              style={{ color: 'var(--ink-1)' }}
            >
              <span style={{ color: 'var(--ink-3)' }}>{rf.label}</span>
              <span className="font-mono">
                {selected.data[rf.id] !== undefined && selected.data[rf.id] !== null
                  ? String(selected.data[rf.id])
                  : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function MultiRelatedEntryField({
  field,
  value,
  data,
  setData,
  readOnly,
  mode,
}: {
  field: FieldDef
  value: unknown
  data: Record<string, unknown>
  setData: (d: Record<string, unknown>) => void
  readOnly?: boolean
  mode: 'preview' | 'create' | 'edit' | 'view'
}) {
  const enabled = mode !== 'preview' && !!field.relatedRecordId
  const { data: entries = [] } = useQuery<RelatedEntry[]>({
    queryKey: ['entries', field.relatedRecordId],
    queryFn: () =>
      api.entries.list(field.relatedRecordId!) as Promise<RelatedEntry[]>,
    enabled,
  })
  const { data: relatedRecord } = useQuery<RelatedRecord>({
    queryKey: ['record', field.relatedRecordId],
    queryFn: () =>
      api.records.get(field.relatedRecordId!) as Promise<RelatedRecord>,
    enabled,
  })
  const identifierFields = relatedRecord?.fields.filter((f) => f.isIdentifier) ?? []

  const selectedIds: string[] = Array.isArray(value) ? (value as string[]) : []

  const buildLabel = (entry: RelatedEntry) => {
    if (identifierFields.length === 0) return entry.id.slice(0, 8)
    return identifierFields.map((f) => entry.data[f.id] ?? '—').join(' | ')
  }

  const toggle = (entryId: string) => {
    if (readOnly) return
    const next = selectedIds.includes(entryId)
      ? selectedIds.filter((x) => x !== entryId)
      : [...selectedIds, entryId]
    const newData: Record<string, unknown> = { ...data, [field.id]: next }
    if (field.relatedFieldIds) {
      for (const relFieldId of field.relatedFieldIds) {
        delete newData[`${field.id}_${relFieldId}`]
      }
    }
    if (field.relatedFieldIds) {
      for (const relFieldId of field.relatedFieldIds) {
        const values: unknown[] = []
        for (const eid of next) {
          const entry = entries.find((e) => e.id === eid)
          if (entry && entry.data[relFieldId] !== undefined)
            values.push(entry.data[relFieldId])
        }
        if (values.length > 0) newData[`${field.id}_${relFieldId}`] = values
      }
    }
    setData(newData)
  }

  return (
    <div className="syn-field">
      <FieldLabel field={field} hint="MÚLTIPLES" />
      <div
        style={{
          border: '1px solid var(--line-2)',
          borderRadius: 8,
          overflow: 'hidden',
          maxHeight: 180,
          overflowY: 'auto',
          background: 'var(--bg-1)',
        }}
      >
        {entries.length === 0 ? (
          <p
            className="text-[12px] text-center"
            style={{ padding: '16px', color: 'var(--ink-3)' }}
          >
            No hay entradas disponibles
          </p>
        ) : (
          entries.map((entry) => {
            const isSelected = selectedIds.includes(entry.id)
            return (
              <label
                key={entry.id}
                className="flex items-center gap-3 px-3 py-2 text-[13px] transition-colors"
                style={{
                  cursor: readOnly ? 'not-allowed' : 'pointer',
                  borderTop: '1px solid var(--line)',
                  background: isSelected ? 'var(--primary-soft)' : 'transparent',
                  color: 'var(--ink-0)',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={readOnly}
                  onChange={() => toggle(entry.id)}
                />
                {buildLabel(entry)}
              </label>
            )
          })
        )}
      </div>
      {selectedIds.length > 0 && (
        <p
          className="text-[11px]"
          style={{ color: 'var(--ink-3)', marginTop: 4 }}
        >
          {selectedIds.length} seleccionada{selectedIds.length > 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}

// ============================================================================
// Recipe / CalibrationTemplate (async selectors)
// ============================================================================

export function RecipeSelectField({
  field,
  value,
  onChange,
  readOnly,
  mode,
}: {
  field: FieldDef
  value: unknown
  onChange: (v: string | null) => void
  readOnly?: boolean
  mode: 'preview' | 'create' | 'edit' | 'view'
}) {
  const { data: recipes = [] } = useQuery<
    Array<{ id: string; name: string; code: string | null; status: string }>
  >({
    queryKey: ['recipes-for-select'],
    queryFn: () =>
      api.recipes.list() as Promise<
        Array<{ id: string; name: string; code: string | null; status: string }>
      >,
    enabled: mode !== 'preview',
  })
  const active = recipes.filter((r) => r.status === 'ACTIVE')
  return (
    <div className="syn-field">
      <FieldLabel field={field} hint="RECETA" />
      <select
        className="syn-select"
        value={(value as string) || ''}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Seleccionar receta…</option>
        {active.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name} {r.code ? `(${r.code})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

export function CalibrationTemplateField({
  field,
  value,
  onChange,
  readOnly,
  mode,
}: {
  field: FieldDef
  value: unknown
  onChange: (v: string | null) => void
  readOnly?: boolean
  mode: 'preview' | 'create' | 'edit' | 'view'
}) {
  const { data: templates = [] } = useQuery<
    Array<{ id: string; name: string; code: string | null; status: string }>
  >({
    queryKey: ['calibration-templates-for-select'],
    queryFn: () =>
      api.calibrationTemplates.list() as Promise<
        Array<{ id: string; name: string; code: string | null; status: string }>
      >,
    enabled: mode !== 'preview',
  })
  const active = templates.filter((t) => t.status === 'ACTIVE')
  return (
    <div className="syn-field">
      <FieldLabel field={field} hint="PLANTILLA" />
      <select
        className="syn-select"
        value={(value as string) || ''}
        disabled={readOnly}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">Seleccionar plantilla…</option>
        {active.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} {t.code ? `(${t.code})` : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

// ============================================================================
// Matrix + Methods (matrix single + methods multi filtered by matrix)
// ============================================================================

export function MatrixMethodField({
  field,
  value,
  onChange,
  readOnly,
  mode,
}: {
  field: FieldDef
  value: unknown
  onChange: (v: { matrixId: string | null; methodIds: string[] }) => void
  readOnly?: boolean
  mode: 'preview' | 'create' | 'edit' | 'view'
}) {
  const current = (value || { matrixId: null, methodIds: [] }) as {
    matrixId: string | null
    methodIds: string[]
  }

  const { data: matrices = [] } = useQuery<
    Array<{ id: string; name: string; code: string | null }>
  >({
    queryKey: ['matrices-for-select'],
    queryFn: () =>
      api.matrices.list() as Promise<
        Array<{ id: string; name: string; code: string | null }>
      >,
    enabled: mode !== 'preview',
  })
  const { data: methods = [] } = useQuery<
    Array<{ id: string; code: string; parameter: string; matrixId: string | null; unit: string | null }>
  >({
    queryKey: ['methods-for-select', current.matrixId ?? null],
    queryFn: () =>
      (current.matrixId
        ? api.methods.search({ matrixId: current.matrixId })
        : api.methods.search()) as Promise<
        Array<{
          id: string
          code: string
          parameter: string
          matrixId: string | null
          unit: string | null
        }>
      >,
    enabled: mode !== 'preview',
  })

  const toggleMethod = (id: string) => {
    if (readOnly) return
    const next = current.methodIds.includes(id)
      ? current.methodIds.filter((x) => x !== id)
      : [...current.methodIds, id]
    onChange({ matrixId: current.matrixId, methodIds: next })
  }

  return (
    <div className="syn-field">
      <FieldLabel field={field} hint="MATRIZ · MÉTODOS" />
      <select
        className="syn-select"
        value={current.matrixId || ''}
        disabled={readOnly}
        onChange={(e) =>
          onChange({ matrixId: e.target.value || null, methodIds: [] })
        }
      >
        <option value="">Seleccionar matriz…</option>
        {matrices.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} {m.code ? `(${m.code})` : ''}
          </option>
        ))}
      </select>
      {current.matrixId && methods.length > 0 && (
        <div
          style={{
            marginTop: 6,
            padding: '10px 12px',
            background: 'var(--bg-2)',
            border: '1px solid var(--line)',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: 180,
            overflowY: 'auto',
          }}
        >
          <span className="kicker" style={{ color: 'var(--ink-3)' }}>
            · Métodos (opcional — si no elegís ninguno se usan los parámetros de la matriz)
          </span>
          {methods.map((m) => {
            const isSelected = current.methodIds.includes(m.id)
            return (
              <label
                key={m.id}
                className="flex items-center gap-2 text-[12.5px]"
                style={{ cursor: readOnly ? 'not-allowed' : 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={readOnly}
                  onChange={() => toggleMethod(m.id)}
                />
                <span style={{ color: 'var(--ink-0)' }}>{m.code}</span>
                <span style={{ color: 'var(--ink-2)' }}>— {m.parameter}</span>
                {m.unit && (
                  <span style={{ color: 'var(--ink-3)', fontFamily: 'var(--font-mono)' }}>
                    ({m.unit})
                  </span>
                )}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Preview mode — selectors sin queries (placeholder)
// ============================================================================

export function PlaceholderSelectField({
  field,
  hint,
  placeholder,
}: {
  field: FieldDef
  hint: string
  placeholder: string
}) {
  return (
    <div className="syn-field">
      <FieldLabel field={field} hint={hint} />
      <select className="syn-select" disabled defaultValue="">
        <option value="">{placeholder}</option>
      </select>
    </div>
  )
}
