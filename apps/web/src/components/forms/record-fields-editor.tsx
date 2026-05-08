'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, RotateCcw } from 'lucide-react'

// ============================================================================
// Types
// ============================================================================

export type FieldType =
  | 'NUMBER'
  | 'TEXT'
  | 'DATE'
  | 'DROPDOWN'
  | 'MATRIX_METHOD'
  | 'RECIPE_SELECT'
  | 'QUANTITY'
  | 'RELATED_ENTRY'
  | 'MULTIPLE_RELATED_ENTRY'
  | 'COMPARISON'
  | 'FORMULA'
  | 'CALIBRATION_TEMPLATE'

export interface ComparisonConfigShape {
  operator: string
  compareAgainst: 'CONSTANT' | 'FIELD'
  constantValue?: number
  fieldId?: string
  compareFieldId?: string
  secondValue?: number
  failMessage?: string
  // También puede contener options/units cuando viene de DB para DROPDOWN/QUANTITY
  options?: string[]
  units?: string[]
}

export interface FieldDef {
  id: string
  label: string
  fieldType: FieldType
  isIdentifier: boolean
  isRequired: boolean
  comparisonConfig?: ComparisonConfigShape | null
  formulaConfig?: { expression: string } | null
  dropdownOptions?: string[]
  relatedRecordId?: string
  relatedFieldIds?: string[]
  expanded?: boolean
  // Edit mode markers
  isNew?: boolean
  markedForRemoval?: boolean
  // Mantenido para round-trips con la API (no lo leemos en el editor)
  order?: number
}

export interface RecordListItem {
  id: string
  name: string
  type: string
  fields: Array<{ id: string; label: string; fieldType: string; isIdentifier: boolean }>
}

export type EditorMode = 'create' | 'edit'

// ============================================================================
// Constantes compartidas
// ============================================================================

export const fieldTypeOptions: {
  value: FieldType
  label: string
  short: string
  tone?: 'formula' | 'compare'
}[] = [
  { value: 'NUMBER', label: 'Número', short: 'NUMBER' },
  { value: 'TEXT', label: 'Texto', short: 'TEXT' },
  { value: 'DATE', label: 'Fecha', short: 'DATE' },
  { value: 'DROPDOWN', label: 'Opciones', short: 'DROPDOWN' },
  { value: 'QUANTITY', label: 'Cantidad + unidad', short: 'QUANTITY' },
  { value: 'FORMULA', label: 'Fórmula', short: 'FORMULA', tone: 'formula' },
  { value: 'COMPARISON', label: 'Comparación', short: 'COMPARISON', tone: 'compare' },
  { value: 'RELATED_ENTRY', label: 'Entrada relacionada', short: 'RELATED' },
  { value: 'MULTIPLE_RELATED_ENTRY', label: 'Múltiples relacionadas', short: 'MULTI-RELATED' },
  { value: 'MATRIX_METHOD', label: 'Matriz · Métodos', short: 'MATRIX · MÉTODOS' },
  { value: 'RECIPE_SELECT', label: 'Receta', short: 'RECIPE' },
  { value: 'CALIBRATION_TEMPLATE', label: 'Plantilla calibración', short: 'PLANTILLA' },
]

export const comparisonOperators = [
  { value: 'LT', label: '< Menor que' },
  { value: 'LTE', label: '<= Menor o igual' },
  { value: 'GT', label: '> Mayor que' },
  { value: 'GTE', label: '>= Mayor o igual' },
  { value: 'EQ', label: '= Igual a' },
  { value: 'BETWEEN', label: 'Entre (rango)' },
]

// ============================================================================
// Helpers — el editor trabaja con listas inmutables vía onChange
// ============================================================================

/** Devuelve las opciones de un DROPDOWN/QUANTITY venga de donde venga (nuevo o DB). */
function readOptions(field: FieldDef): string[] {
  if (field.dropdownOptions) return field.dropdownOptions
  if (field.fieldType === 'DROPDOWN') return field.comparisonConfig?.options ?? []
  if (field.fieldType === 'QUANTITY') return field.comparisonConfig?.units ?? []
  return []
}

/** Build a default field for a given type. */
export function makeNewField(
  fieldType: FieldType,
  tempId: string,
  order: number,
  { isNew = false }: { isNew?: boolean } = {},
): FieldDef {
  const base: FieldDef = {
    id: tempId,
    label: '',
    fieldType,
    order,
    isIdentifier: false,
    isRequired: true,
    expanded: true,
    isNew: isNew || undefined,
  }
  if (fieldType === 'COMPARISON') {
    base.comparisonConfig = {
      operator: 'GTE',
      compareAgainst: 'CONSTANT',
      constantValue: 0,
    }
  }
  if (fieldType === 'FORMULA') base.formulaConfig = { expression: '' }
  if (fieldType === 'DROPDOWN') base.dropdownOptions = ['']
  if (fieldType === 'QUANTITY') base.dropdownOptions = ['kg', 'g']
  return base
}

// ============================================================================
// Editor principal
// ============================================================================

let _counter = 0
const nextTempId = () => {
  _counter++
  return `${Date.now()}_${_counter}`
}

export interface RecordFieldsEditorProps {
  fields: FieldDef[]
  onChange: (next: FieldDef[]) => void
  allRecords: RecordListItem[]
  mode: EditorMode
}

export function RecordFieldsEditor({
  fields,
  onChange,
  allRecords,
  mode,
}: RecordFieldsEditorProps) {
  // Campos numéricos visibles al construir una FORMULA o COMPARISON → los existentes de NUMBER/FORMULA y related-entry resueltos
  const numericFields = useMemo(
    () =>
      fields.filter((f) => {
        if (!f.label) return false
        if (f.markedForRemoval) return false
        if (f.fieldType === 'NUMBER' || f.fieldType === 'FORMULA') return true
        if (
          (f.fieldType === 'RELATED_ENTRY' || f.fieldType === 'MULTIPLE_RELATED_ENTRY') &&
          f.relatedRecordId &&
          f.relatedFieldIds?.length
        ) {
          const relRecord = allRecords.find((r) => r.id === f.relatedRecordId)
          if (!relRecord) return false
          return f.relatedFieldIds.some((fid) => {
            const rf = relRecord.fields.find((rf) => rf.id === fid)
            return rf?.fieldType === 'NUMBER'
          })
        }
        return false
      }),
    [fields, allRecords],
  )

  const addField = (fieldType: FieldType) => {
    const prefix = mode === 'edit' ? 'new_' : 'temp_'
    const nf = makeNewField(fieldType, `${prefix}${nextTempId()}`, fields.length, {
      isNew: mode === 'edit',
    })
    onChange([...fields, nf])
  }

  const updateField = (id: string, updates: Partial<FieldDef>) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...updates } : f)))
  }

  /** En modo edit, los campos existentes se "marcan" para borrar (no desaparecen). Los nuevos se borran de una. */
  const removeField = (id: string) => {
    const target = fields.find((f) => f.id === id)
    if (!target) return
    if (mode === 'edit' && !target.isNew) {
      onChange(fields.map((f) => (f.id === id ? { ...f, markedForRemoval: true } : f)))
    } else {
      onChange(fields.filter((f) => f.id !== id))
    }
  }

  const unmarkField = (id: string) => {
    onChange(fields.map((f) => (f.id === id ? { ...f, markedForRemoval: false } : f)))
  }

  const moveField = (index: number, direction: 'up' | 'down') => {
    const arr = [...fields]
    const target = direction === 'up' ? index - 1 : index + 1
    if (target < 0 || target >= arr.length) return
    ;[arr[index], arr[target]] = [arr[target], arr[index]]
    onChange(arr.map((f, i) => ({ ...f, order: i })))
  }

  return (
    <div className="syn-fields-list">
      {fields.map((field, index) => (
        <BuilderFieldCard
          key={field.id}
          index={index}
          total={fields.length}
          field={field}
          numericFields={numericFields.filter((f) => f.id !== field.id)}
          allRecords={allRecords}
          mode={mode}
          onUpdate={(u) => updateField(field.id, u)}
          onRemove={() => removeField(field.id)}
          onUnmark={() => unmarkField(field.id)}
          onMoveUp={() => moveField(index, 'up')}
          onMoveDown={() => moveField(index, 'down')}
          onToggleExpand={() => updateField(field.id, { expanded: !field.expanded })}
        />
      ))}

      <AddFieldMenu onAdd={addField} />
    </div>
  )
}

/** Helper para que las páginas muestren el contador sin tener que filtrar ellas mismas. */
export function visibleFieldCount(fields: FieldDef[]): number {
  return fields.filter((f) => !f.markedForRemoval).length
}

// ============================================================================
// BuilderFieldCard
// ============================================================================

function BuilderFieldCard({
  index,
  total,
  field,
  numericFields,
  allRecords,
  mode,
  onUpdate,
  onRemove,
  onUnmark,
  onMoveUp,
  onMoveDown,
  onToggleExpand,
}: {
  index: number
  total: number
  field: FieldDef
  numericFields: FieldDef[]
  allRecords: RecordListItem[]
  mode: EditorMode
  onUpdate: (u: Partial<FieldDef>) => void
  onRemove: () => void
  onUnmark: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onToggleExpand: () => void
}) {
  const typeOpt = fieldTypeOptions.find((t) => t.value === field.fieldType)
  const toneClass = typeOpt?.tone ? ' ' + typeOpt.tone : ''
  const isExisting = mode === 'edit' && !field.isNew
  const configReadOnly = isExisting
  const isRemoved = !!field.markedForRemoval

  return (
    <div
      className={
        'syn-field-card' + (field.expanded ? ' selected' : '') + (isRemoved ? ' removed' : '')
      }
      style={
        isRemoved
          ? {
              opacity: 0.55,
              background: 'var(--danger-soft)',
              borderStyle: 'dashed',
            }
          : undefined
      }
    >
      <div className="syn-fc-head">
        <div className="syn-fc-drag" title="Reordenar">
          <div className="flex flex-col">
            <button
              type="button"
              onClick={onMoveUp}
              disabled={index === 0 || isRemoved}
              className="disabled:opacity-30"
              style={{ padding: 1, color: 'var(--ink-4)' }}
            >
              <ChevronUp className="h-3 w-3" />
            </button>
            <button
              type="button"
              onClick={onMoveDown}
              disabled={index === total - 1 || isRemoved}
              className="disabled:opacity-30"
              style={{ padding: 1, color: 'var(--ink-4)' }}
            >
              <ChevronDown className="h-3 w-3" />
            </button>
          </div>
        </div>
        <input
          className="syn-fc-name"
          placeholder="Nombre del campo…"
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          disabled={isRemoved}
          style={
            isRemoved
              ? { textDecoration: 'line-through', color: 'var(--danger)' }
              : undefined
          }
        />
        <span className={'syn-fc-type' + toneClass}>{typeOpt?.short ?? field.fieldType}</span>
        <button
          type="button"
          onClick={() => onUpdate({ isIdentifier: !field.isIdentifier })}
          disabled={isRemoved}
          title={field.isIdentifier ? 'Identificador' : 'Marcar como identificador'}
          className="rounded px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] disabled:opacity-40"
          style={{
            background: field.isIdentifier ? 'var(--primary-soft)' : 'transparent',
            color: field.isIdentifier ? 'var(--primary-hex)' : 'var(--ink-4)',
          }}
        >
          ID
        </button>
        <button
          type="button"
          onClick={onToggleExpand}
          className="rounded p-1"
          style={{ color: 'var(--ink-3)' }}
        >
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform"
            style={{ transform: field.expanded ? 'rotate(180deg)' : 'none' }}
          />
        </button>
      </div>

      {field.expanded && (
        <div className="syn-fc-expand">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <label
              className="flex items-center gap-2 text-[13px]"
              style={{ color: 'var(--ink-1)', cursor: isRemoved ? 'not-allowed' : 'pointer' }}
            >
              <input
                type="checkbox"
                checked={field.isRequired}
                onChange={(e) => onUpdate({ isRequired: e.target.checked })}
                disabled={isRemoved}
              />
              Requerido
            </label>
            {isExisting && !isRemoved && (
              <span
                className="font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: 'var(--ink-3)' }}
              >
                · campo existente · tipo y configuración bloqueados
              </span>
            )}
            {isRemoved ? (
              <button
                type="button"
                onClick={onUnmark}
                className="ml-auto text-[12px]"
                style={{ color: 'var(--ink-2)' }}
              >
                <RotateCcw className="mr-1 inline h-3 w-3" /> Restaurar
              </button>
            ) : (
              <button
                type="button"
                onClick={onRemove}
                className="ml-auto text-[12px]"
                style={{ color: 'var(--danger)' }}
              >
                <Trash2 className="mr-1 inline h-3 w-3" />
                {isExisting ? 'Marcar para eliminar' : 'Eliminar'}
              </button>
            )}
          </div>

          {field.fieldType === 'COMPARISON' && field.comparisonConfig && (
            <ComparisonConfig
              config={field.comparisonConfig}
              numericFields={numericFields}
              onChange={(cfg) => onUpdate({ comparisonConfig: cfg })}
              readOnly={configReadOnly}
            />
          )}

          {field.fieldType === 'FORMULA' && field.formulaConfig && (
            <div className="syn-field">
              <span className="syn-field-label">
                Expresión <span className="hint">mathjs · refs entre {'{}'}</span>
              </span>
              <input
                className="syn-input"
                style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                value={field.formulaConfig.expression}
                onChange={(e) => onUpdate({ formulaConfig: { expression: e.target.value } })}
                placeholder="({lectura} - {patrón}) * 1000"
                readOnly={configReadOnly}
              />
              {numericFields.length > 0 && (
                <p
                  className="text-[11px]"
                  style={{ color: 'var(--ink-3)', marginTop: 4, fontFamily: 'var(--font-mono)' }}
                >
                  disponibles: {numericFields.map((f) => `{${f.label || '—'}}`).join(' · ')}
                </p>
              )}
            </div>
          )}

          {field.fieldType === 'DROPDOWN' && (
            <DropdownOptionsEditor
              options={readOptions(field)}
              onChange={(opts) => onUpdate({ dropdownOptions: opts })}
              readOnly={configReadOnly}
            />
          )}

          {field.fieldType === 'QUANTITY' && (
            <DropdownOptionsEditor
              label="Unidades admitidas"
              options={readOptions(field).length ? readOptions(field) : ['kg']}
              onChange={(opts) => onUpdate({ dropdownOptions: opts })}
              readOnly={configReadOnly}
            />
          )}

          {(field.fieldType === 'RELATED_ENTRY' ||
            field.fieldType === 'MULTIPLE_RELATED_ENTRY') && (
            <RelatedEntryConfig
              field={field}
              allRecords={allRecords}
              onUpdate={onUpdate}
              readOnly={configReadOnly}
            />
          )}

          {(field.fieldType === 'MATRIX_METHOD' ||
            field.fieldType === 'RECIPE_SELECT' ||
            field.fieldType === 'CALIBRATION_TEMPLATE') && (
            <p className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
              Este tipo de campo se configura automáticamente. El técnico elegirá la{' '}
              {field.fieldType === 'MATRIX_METHOD'
                ? 'matriz y los métodos'
                : field.fieldType === 'RECIPE_SELECT'
                  ? 'receta'
                  : 'plantilla de calibración'}{' '}
              al cargar la entrada.
            </p>
          )}

          {(field.fieldType === 'NUMBER' ||
            field.fieldType === 'TEXT' ||
            field.fieldType === 'DATE') && (
            <p className="text-[12.5px]" style={{ color: 'var(--ink-3)' }}>
              Sin configuración extra — el input se renderiza directo.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Per-type editors
// ============================================================================

function ComparisonConfig({
  config,
  numericFields,
  onChange,
  readOnly,
}: {
  config: ComparisonConfigShape
  numericFields: FieldDef[]
  onChange: (cfg: ComparisonConfigShape) => void
  readOnly?: boolean
}) {
  const update = (u: Partial<ComparisonConfigShape>) => onChange({ ...config, ...u })
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div className="syn-field">
        <span className="syn-field-label">Campo a evaluar</span>
        <select
          className="syn-select"
          value={config.fieldId ?? ''}
          onChange={(e) => update({ fieldId: e.target.value || undefined })}
          disabled={readOnly}
        >
          <option value="">— valor de este mismo campo —</option>
          {numericFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label || '(sin nombre)'}
            </option>
          ))}
        </select>
      </div>
      <div className="syn-field">
        <span className="syn-field-label">Operador</span>
        <select
          className="syn-select"
          value={config.operator}
          onChange={(e) => update({ operator: e.target.value })}
          disabled={readOnly}
        >
          {comparisonOperators.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="syn-field" style={{ gridColumn: '1 / -1' }}>
        <span className="syn-field-label">Comparar contra</span>
        <div className="syn-radio-group">
          <span
            className={'syn-radio-opt ' + (config.compareAgainst === 'CONSTANT' ? 'on' : '')}
            onClick={() => !readOnly && update({ compareAgainst: 'CONSTANT' })}
            style={readOnly ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
          >
            <span className="dot" /> Constante
          </span>
          <span
            className={'syn-radio-opt ' + (config.compareAgainst === 'FIELD' ? 'on' : '')}
            onClick={() => !readOnly && update({ compareAgainst: 'FIELD' })}
            style={readOnly ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
          >
            <span className="dot" /> Campo
          </span>
        </div>
      </div>
      {config.compareAgainst === 'CONSTANT' ? (
        <>
          <div className="syn-field">
            <span className="syn-field-label">
              {config.operator === 'BETWEEN' ? 'Mínimo' : 'Valor'}
            </span>
            <input
              className="syn-input"
              type="number"
              value={config.constantValue ?? ''}
              onChange={(e) => update({ constantValue: Number(e.target.value) })}
              readOnly={readOnly}
            />
          </div>
          {config.operator === 'BETWEEN' && (
            <div className="syn-field">
              <span className="syn-field-label">Máximo</span>
              <input
                className="syn-input"
                type="number"
                value={config.secondValue ?? ''}
                onChange={(e) => update({ secondValue: Number(e.target.value) })}
                readOnly={readOnly}
              />
            </div>
          )}
        </>
      ) : (
        <div className="syn-field" style={{ gridColumn: '1 / -1' }}>
          <span className="syn-field-label">Campo de referencia</span>
          <select
            className="syn-select"
            value={config.compareFieldId ?? ''}
            onChange={(e) => update({ compareFieldId: e.target.value || undefined })}
            disabled={readOnly}
          >
            <option value="">Elegí un campo…</option>
            {numericFields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label || '(sin nombre)'}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="syn-field" style={{ gridColumn: '1 / -1' }}>
        <span className="syn-field-label">Mensaje en fallo</span>
        <input
          className="syn-input"
          value={config.failMessage ?? ''}
          onChange={(e) => update({ failMessage: e.target.value })}
          placeholder="Ej: Valor fuera de tolerancia — generar NC"
          readOnly={readOnly}
        />
      </div>
    </div>
  )
}

function DropdownOptionsEditor({
  label = 'Opciones',
  options,
  onChange,
  readOnly,
}: {
  label?: string
  options: string[]
  onChange: (opts: string[]) => void
  readOnly?: boolean
}) {
  const update = (idx: number, v: string) =>
    onChange(options.map((o, i) => (i === idx ? v : o)))
  const remove = (idx: number) => onChange(options.filter((_, i) => i !== idx))
  const add = () => onChange([...options, ''])
  return (
    <div className="syn-field">
      <span className="syn-field-label">{label}</span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {options.map((opt, i) => (
          <div key={i} style={{ display: 'flex', gap: 6 }}>
            <input
              className="syn-input"
              value={opt}
              placeholder={`Opción ${i + 1}`}
              onChange={(e) => update(i, e.target.value)}
              readOnly={readOnly}
            />
            {!readOnly && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="syn-btn syn-btn-subtle"
                style={{ padding: '6px 10px', color: 'var(--ink-3)' }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button
            type="button"
            onClick={add}
            className="syn-btn syn-btn-subtle"
            style={{ alignSelf: 'flex-start', padding: '6px 10px', fontSize: 12 }}
          >
            <Plus className="h-3 w-3" /> Agregar opción
          </button>
        )}
      </div>
    </div>
  )
}

function RelatedEntryConfig({
  field,
  allRecords,
  onUpdate,
  readOnly,
}: {
  field: FieldDef
  allRecords: RecordListItem[]
  onUpdate: (u: Partial<FieldDef>) => void
  readOnly?: boolean
}) {
  const relatedRecord = allRecords.find((r) => r.id === field.relatedRecordId)
  const selectedIds = field.relatedFieldIds ?? []
  const toggle = (id: string) => {
    if (readOnly) return
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    onUpdate({ relatedFieldIds: next })
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div className="syn-field">
        <span className="syn-field-label">Registro relacionado</span>
        <select
          className="syn-select"
          value={field.relatedRecordId ?? ''}
          onChange={(e) =>
            onUpdate({ relatedRecordId: e.target.value || undefined, relatedFieldIds: [] })
          }
          disabled={readOnly}
        >
          <option value="">Elegí un registro…</option>
          {allRecords.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>
      {relatedRecord && (
        <div className="syn-field">
          <span className="syn-field-label">
            Campos a traer <span className="hint">{selectedIds.length} seleccionados</span>
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {relatedRecord.fields.map((f) => (
              <span
                key={f.id}
                className={'syn-radio-opt ' + (selectedIds.includes(f.id) ? 'on' : '')}
                onClick={() => toggle(f.id)}
                style={readOnly ? { pointerEvents: 'none', opacity: 0.6 } : undefined}
              >
                <span className="dot" />
                {f.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// AddFieldMenu
// ============================================================================

function AddFieldMenu({ onAdd }: { onAdd: (t: FieldType) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="syn-add-field-btn"
        onClick={() => setOpen((o) => !o)}
      >
        <Plus className="h-3 w-3" /> Agregar campo
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            className="absolute left-0 right-0 z-50 mt-2 grid grid-cols-2 gap-1 rounded-[10px] border p-2 shadow-lg"
            style={{
              background: 'var(--bg-1)',
              borderColor: 'var(--line-2)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {fieldTypeOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onAdd(opt.value)
                  setOpen(false)
                }}
                className="flex items-center gap-2 rounded-[7px] px-3 py-2 text-left text-[13px] transition-colors"
                style={{ color: 'var(--ink-1)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--bg-3)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <span className={'syn-fc-type' + (opt.tone ? ' ' + opt.tone : '')}>
                  {opt.short}
                </span>
                <span style={{ color: 'var(--ink-0)' }}>{opt.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
