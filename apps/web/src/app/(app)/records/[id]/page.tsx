'use client'

import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Hash,
  Type,
  Calendar,
  GitCompare,
  Calculator,
  Link2,
  Star,
  Clock,
  Settings,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  Zap,
  History,
  Archive,
  Send,
  Microscope,
  ListFilter,
  FlaskConical,
  Scale,
  Ruler,
  LayoutGrid,
} from 'lucide-react'
import { KanbanBoard, type KanbanCard, type KanbanColor, type KanbanColumn, type KanbanTransition } from '@/components/kanban'
import { FlowEditor } from '@/components/flow-editor'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { DynamicRecordForm } from '@/components/forms/dynamic-record-form'
import { EntryActionBar } from '@/components/forms/entry-action-bar'
import {
  RecordFieldsEditor,
  type FieldDef as SharedFieldDef,
  type RecordListItem as SharedRecordListItem,
} from '@/components/forms/record-fields-editor'

const typeConfig: Record<string, { label: string; variant: string }> = {
  PERIODIC: { label: 'Periódico', variant: 'info' },
  NOT_PERIODIC: { label: 'No periódico', variant: 'secondary' },
  NOT_PERIODIC_WITH_REVISION: { label: 'Con revisión', variant: 'warning' },
  INSTRUMENTAL: { label: 'Instrumental', variant: 'default' },
  BATCH: { label: 'Lote/Producción', variant: 'success' },
  SAMPLE: { label: 'Muestra', variant: 'info' },
  STOCK: { label: 'Stock', variant: 'warning' },
}

interface FieldDef {
  id: string
  label: string
  fieldType: string
  order: number
  isIdentifier: boolean
  isRequired: boolean
  comparisonConfig: Record<string, unknown> | null
  formulaConfig: { expression: string } | null
  relatedRecordId?: string
  relatedFieldIds?: string[]
  isNew?: boolean
  markedForRemoval?: boolean
}

interface RecordDetail {
  id: string
  name: string
  type: 'PERIODIC' | 'NOT_PERIODIC' | 'NOT_PERIODIC_WITH_REVISION' | 'INSTRUMENTAL' | 'BATCH' | 'SAMPLE' | 'STOCK'
  version: number
  changeLog: string | null
  periodicity: number | null
  notifyDaysBefore: number | null
  isActive: boolean
  createdAt: string
  area: { id: string; name: string } | null
  document: { id: string; title: string; code: string | null } | null
  fields: FieldDef[]
  actionsAsSource: Array<{ id: string; targetRecord: { id: string; name: string } }>
  actionsAsTarget: Array<{ id: string; sourceRecord: { id: string; name: string } }>
}

interface RecordListItem {
  id: string
  name: string
  type: string
  periodicity: number | null
  fields: Array<{
    id: string
    label: string
    fieldType: string
    isIdentifier: boolean
    comparisonConfig?: { options?: string[] } | null
  }>
}


// =========================================================================
// Cards del layout Synapse (non-editing): fields read-only + cascade + compliance + entries tabbed
// =========================================================================

function SynFieldsReadOnlyCard({ record }: { record: RecordDetail }) {
  const fieldTypeDisplay: Record<string, string> = {
    NUMBER: 'NUMBER',
    TEXT: 'TEXT',
    DATE: 'DATE',
    COMPARISON: 'COMPARISON',
    FORMULA: 'FORMULA',
    DROPDOWN: 'DROPDOWN',
    QUANTITY: 'QUANTITY',
    MATRIX_METHOD: 'MATRIX · MÉTODOS',
    RECIPE_SELECT: 'RECIPE',
    CALIBRATION_TEMPLATE: 'PLANTILLA',
    RELATED_ENTRY: 'RELATED',
    MULTIPLE_RELATED_ENTRY: 'MULTI-RELATED',
  }

  const getMeta = (f: FieldDef): string => {
    if (f.fieldType === 'FORMULA') return '· calc'
    if (f.fieldType === 'COMPARISON' && f.comparisonConfig) {
      const cfg = f.comparisonConfig as Record<string, unknown>
      const op = cfg.operator as string
      const v1 = cfg.constantValue
      const v2 = cfg.secondValue
      if (op === 'BETWEEN' && typeof v1 === 'number' && typeof v2 === 'number') {
        const mid = (Number(v1) + Number(v2)) / 2
        const tol = Math.abs(Number(v2) - Number(v1)) / 2
        return mid === 0 ? `± ${tol}` : `${op.toLowerCase()} ${v1}..${v2}`
      }
      if (typeof v1 === 'number') return `${op?.toLowerCase() ?? ''} ${v1}`
      return '—'
    }
    if (f.fieldType === 'TEXT' && f.isIdentifier) return '—'
    if (f.fieldType === 'TEXT') return '—'
    if (f.fieldType === 'DATE') return f.isRequired ? '· req' : '· opt'
    if (f.fieldType === 'NUMBER') return f.isRequired ? '· req' : '· opt'
    if (f.fieldType === 'RELATED_ENTRY' || f.fieldType === 'MULTIPLE_RELATED_ENTRY')
      return f.isRequired ? 'rel · req' : 'rel'
    return f.isRequired ? '· req' : '· opt'
  }

  const getTypeKicker = (f: FieldDef, isFirstIdentifier: boolean): string => {
    if (isFirstIdentifier && f.fieldType === 'TEXT') return 'DEFAULT · TEXTO'
    return fieldTypeDisplay[f.fieldType] ?? f.fieldType
  }

  // Sólo marcamos "default" al primer identificador TEXT (mimica el CÓDIGO del prototipo)
  const firstIdentifierId = record.fields.find(
    (f) => f.isIdentifier && f.fieldType === 'TEXT',
  )?.id

  return (
    <div className="syn-card">
      <div className="syn-card-head">
        <div>
          <div className="eyebrow">· Campos del registro</div>
          <h3 style={{ marginTop: 6 }}>
            {record.fields.length} <span className="italic">campos.</span>
          </h3>
        </div>
      </div>
      <div>
        {record.fields.map((f, i) => (
          <div
            key={f.id}
            style={{
              padding: '14px 20px',
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 16,
              alignItems: 'center',
              borderTop: i === 0 ? 'none' : '1px solid var(--line)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: 'var(--ink-0)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{f.label || '—'}</span>
                {f.isIdentifier && (
                  <span
                    className="kicker"
                    style={{
                      color: 'var(--primary-hex)',
                      letterSpacing: '0.16em',
                      fontSize: 9,
                    }}
                  >
                    ID
                  </span>
                )}
              </div>
              <div
                className="kicker"
                style={{ marginTop: 3, fontSize: 10 }}
              >
                {getTypeKicker(f, f.id === firstIdentifierId)}
              </div>
            </div>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--ink-2)',
                whiteSpace: 'nowrap',
              }}
            >
              {getMeta(f)}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SynCascadeCard({
  record,
  allRecords,
}: {
  record: RecordDetail
  allRecords: RecordListItem[]
}) {
  const queryClient = useQueryClient()
  const actions = record.actionsAsSource ?? []
  const incoming = record.actionsAsTarget ?? []

  const [showAdd, setShowAdd] = useState(false)
  const [step, setStep] = useState<'select' | 'map'>('select')
  const [targetId, setTargetId] = useState('')
  const [mapping, setMapping] = useState<
    Array<{
      source:
        | { kind: 'field' | 'batch' | 'sample' | 'instrument' | 'calibration'; key: string }
        | { kind: 'literal'; value: string }
      targetFieldId: string
    }>
  >([])

  const resetForm = () => {
    setShowAdd(false)
    setStep('select')
    setTargetId('')
    setMapping([])
  }

  const addMutation = useMutation({
    mutationFn: (data: { targetRecordId: string; fieldMapping: typeof mapping }) =>
      api.records.addAction(record.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record', record.id] })
      resetForm()
      toast.success('Acción agregada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (actionId: string) => api.records.deleteAction(record.id, actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record', record.id] })
      toast.success('Acción eliminada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const targetRecord = step === 'map' ? allRecords.find((r) => r.id === targetId) : null

  return (
    <div className="syn-card">
      <div className="syn-card-head">
        <div>
          <div className="eyebrow">· Acciones cascada</div>
          <h3 style={{ marginTop: 6 }}>Automáticas</h3>
        </div>
        {!showAdd && (
          <button
            type="button"
            className="syn-btn syn-btn-subtle"
            style={{ padding: '6px 10px' }}
            onClick={() => {
              setShowAdd(true)
              setStep('select')
            }}
          >
            <Plus className="h-3 w-3" /> Agregar
          </button>
        )}
      </div>
      <div style={{ padding: '16px 20px' }}>
        {actions.length === 0 && incoming.length === 0 && !showAdd && (
          <p className="text-[13px]" style={{ color: 'var(--ink-3)', margin: 0 }}>
            Sin cascadas configuradas. Al completar una entry acá se puede generar otra automáticamente en un registro destino.
          </p>
        )}

        {(actions.length > 0 || incoming.length > 0) && (
          <div className="syn-cascade-card">
            {actions.map((a, i) => (
              <div
                key={a.id}
                style={{
                  marginTop: i === 0 ? 0 : 10,
                  paddingTop: i === 0 ? 0 : 10,
                  borderTop: i === 0 ? 'none' : '1px dashed var(--line)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}
                  >
                    <span className="syn-chip syn-chip-active">
                      <span className="pulse" /> ON COMPLETE
                    </span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-1)' }}>
                    <span className="syn-cascade-arrow">→</span> Genera entry en{' '}
                    {a.targetRecord ? (
                      <Link href={`/records/${a.targetRecord.id}`} className="hover:underline">
                        <code>{a.targetRecord.name}</code>
                      </Link>
                    ) : (
                      <code>—</code>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className="syn-btn syn-btn-subtle"
                  style={{ padding: '4px 6px', color: 'var(--danger)' }}
                  onClick={() => deleteMutation.mutate(a.id)}
                  disabled={deleteMutation.isPending}
                  title="Eliminar acción"
                  aria-label="Eliminar acción"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {incoming.map((a, i) => (
              <div
                key={a.id}
                style={{
                  marginTop: actions.length > 0 || i > 0 ? 10 : 0,
                  paddingTop: actions.length > 0 || i > 0 ? 10 : 0,
                  borderTop:
                    actions.length > 0 || i > 0 ? '1px dashed var(--line)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span className="syn-chip syn-chip-draft">INCOMING</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--ink-1)' }}>
                  <span className="syn-cascade-arrow">←</span> Disparado por{' '}
                  {a.sourceRecord ? (
                    <Link href={`/records/${a.sourceRecord.id}`} className="hover:underline">
                      <code>{a.sourceRecord.name}</code>
                    </Link>
                  ) : (
                    <code>—</code>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paso 1 — elegir registro destino */}
        {showAdd && step === 'select' && (
          <div
            className="mt-3 rounded-[10px] border p-3 space-y-3"
            style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
          >
            <div className="kicker">· Paso 1 — registro destino</div>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="syn-select w-full"
            >
              <option value="">Seleccionar registro…</option>
              {allRecords
                .filter((r) => r.id !== record.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.type === 'PERIODIC' ? ' (periódico)' : ''}
                  </option>
                ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                className="syn-btn syn-btn-primary"
                disabled={!targetId}
                onClick={() => {
                  setMapping([])
                  setStep('map')
                }}
              >
                Siguiente: mapear campos
              </button>
              <button type="button" className="syn-btn syn-btn-ghost" onClick={resetForm}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Paso 2 — mapear campos */}
        {showAdd && step === 'map' && targetRecord && (() => {
          const sourceFields = record.fields
          const targetFields = targetRecord.fields

          // Virtual fields expuestos por entidades asociadas al record source.
          // Se resuelven en el listener al momento de la cascada (completion).
          const virtualSources: Array<{
            kind: 'batch' | 'sample' | 'instrument' | 'calibration'
            key: string
            label: string
            fieldType: string
          }> = []
          if (record.type === 'BATCH') {
            virtualSources.push(
              { kind: 'batch', key: 'producedQuantity', label: 'Cantidad producida', fieldType: 'QUANTITY' },
              { kind: 'batch', key: 'lotNumber', label: 'Número de lote', fieldType: 'TEXT' },
              { kind: 'batch', key: 'status', label: 'Estado del batch', fieldType: 'TEXT' },
              { kind: 'batch', key: 'completedAt', label: 'Fecha de finalización', fieldType: 'DATE' },
              { kind: 'batch', key: 'startedAt', label: 'Fecha de inicio', fieldType: 'DATE' },
            )
          } else if (record.type === 'SAMPLE') {
            virtualSources.push(
              { kind: 'sample', key: 'sampleCode', label: 'Código de muestra', fieldType: 'TEXT' },
              { kind: 'sample', key: 'client', label: 'Cliente', fieldType: 'TEXT' },
              { kind: 'sample', key: 'status', label: 'Estado de muestra', fieldType: 'TEXT' },
              { kind: 'sample', key: 'completedAt', label: 'Fecha de finalización', fieldType: 'DATE' },
            )
          } else if (record.type === 'INSTRUMENTAL') {
            virtualSources.push(
              { kind: 'instrument', key: 'status', label: 'Estado del instrumento', fieldType: 'TEXT' },
              { kind: 'instrument', key: 'nextCalibrationAt', label: 'Próxima calibración', fieldType: 'DATE' },
            )
            const hasCalibrationTemplate = record.fields.some((f) => f.fieldType === 'CALIBRATION_TEMPLATE')
            if (hasCalibrationTemplate) {
              virtualSources.push(
                { kind: 'calibration', key: 'status', label: 'Estado calibración', fieldType: 'TEXT' },
                { kind: 'calibration', key: 'completedAt', label: 'Fecha calibración', fieldType: 'DATE' },
                { kind: 'calibration', key: 'dueDate', label: 'Vencimiento calibración', fieldType: 'DATE' },
              )
            }
          }

          const virtualGroupLabel =
            record.type === 'BATCH'
              ? 'Datos del batch'
              : record.type === 'SAMPLE'
                ? 'Datos de la muestra'
                : record.type === 'INSTRUMENTAL'
                  ? 'Datos del instrumento'
                  : ''

          // Encoding: `${kind}:${key-or-value}`. Para `literal`, el "key" es el valor a escribir.
          const encode = (s: { kind: string; key?: string; value?: string }) =>
            s.kind === 'literal' ? `literal:${s.value ?? ''}` : `${s.kind}:${s.key ?? ''}`

          const getMapping = (tfId: string) => {
            const m = mapping.find((x) => x.targetFieldId === tfId)
            if (!m) return ''
            return m.source.kind === 'literal'
              ? `literal:${m.source.value}`
              : `${m.source.kind}:${m.source.key}`
          }
          const setMappingFor = (tfId: string, encoded: string) => {
            const rest = mapping.filter((m) => m.targetFieldId !== tfId)
            if (encoded) {
              const [kind, ...keyParts] = encoded.split(':')
              const rhs = keyParts.join(':')
              if (kind === 'literal') {
                rest.push({ source: { kind: 'literal', value: rhs }, targetFieldId: tfId })
              } else {
                rest.push({
                  source: { kind: kind as 'field' | 'batch' | 'sample' | 'instrument' | 'calibration', key: rhs },
                  targetFieldId: tfId,
                })
              }
            }
            setMapping(rest)
          }
          const targetIdentifiers = targetFields.filter((f) => f.isIdentifier)
          const allIdsMapped = targetIdentifiers.every((tf) =>
            mapping.some((m) => m.targetFieldId === tf.id),
          )

          return (
            <div
              className="mt-3 rounded-[10px] border p-3 space-y-3"
              style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
            >
              <div className="flex items-center justify-between">
                <div className="kicker">· Paso 2 — mapear campos</div>
                <span
                  className="font-mono text-[10px] uppercase tracking-[0.08em]"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {record.name} → {targetRecord.name}
                </span>
              </div>
              <p className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
                Elegí qué valor del origen se copia a cada campo del destino.
                Los identificadores (★) son obligatorios.
              </p>
              <div className="space-y-2">
                {targetFields.map((tf) => {
                  const fieldCompatibles = sourceFields.filter(
                    (sf) => sf.fieldType === tf.fieldType,
                  )
                  const virtualCompatibles = virtualSources.filter(
                    (v) => v.fieldType === tf.fieldType,
                  )
                  // Literales habilitados sólo para DROPDOWN (por ahora): se listan las
                  // opciones del propio campo destino como "valor fijo" que se escribirá
                  // siempre que esta acción dispare.
                  const literalOptions: string[] =
                    tf.fieldType === 'DROPDOWN'
                      ? (tf.comparisonConfig?.options ?? [])
                      : []
                  const current = getMapping(tf.id)
                  const missingId = tf.isIdentifier && !current
                  const totalCompatibles =
                    fieldCompatibles.length + virtualCompatibles.length + literalOptions.length
                  return (
                    <div
                      key={tf.id}
                      className="flex items-center gap-2 rounded-[8px] p-2"
                      style={{
                        background: 'var(--bg-1)',
                        border: `1px solid ${missingId ? 'var(--warn)' : 'var(--line)'}`,
                      }}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        <span className="text-[13px] font-medium" style={{ color: 'var(--ink-0)' }}>
                          {tf.label}
                        </span>
                        {tf.isIdentifier && (
                          <Star
                            className="h-3 w-3 shrink-0"
                            style={{ color: 'var(--warn)' }}
                            fill="currentColor"
                          />
                        )}
                      </div>
                      <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                        ←
                      </span>
                      <select
                        value={current}
                        onChange={(e) => setMappingFor(tf.id, e.target.value)}
                        className="syn-select"
                        style={{ width: 220, fontSize: 12, padding: '6px 10px', minHeight: 32 }}
                      >
                        <option value="">
                          {tf.isIdentifier ? '⚠ Obligatorio' : '— Sin mapear —'}
                        </option>
                        {fieldCompatibles.length > 0 && (
                          <optgroup label="Campos del registro">
                            {fieldCompatibles.map((sf) => (
                              <option key={sf.id} value={`field:${sf.id}`}>
                                {sf.label}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {virtualCompatibles.length > 0 && (
                          <optgroup label={virtualGroupLabel}>
                            {virtualCompatibles.map((v) => (
                              <option key={`${v.kind}:${v.key}`} value={`${v.kind}:${v.key}`}>
                                {v.label}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {literalOptions.length > 0 && (
                          <optgroup label="Valor fijo">
                            {literalOptions.map((opt) => (
                              <option key={`literal:${opt}`} value={`literal:${opt}`}>
                                = {opt}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {totalCompatibles === 0 && (
                          <option disabled>Sin orígenes compatibles ({tf.fieldType})</option>
                        )}
                      </select>
                    </div>
                  )
                })}
              </div>
              {targetRecord.type === 'PERIODIC' && (
                <div
                  className="rounded-[8px] p-2.5 text-[12px]"
                  style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
                >
                  La entry generada tendrá dueDate = hoy + {targetRecord.periodicity || '?'} días (periodicidad del destino).
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="syn-btn syn-btn-primary"
                  disabled={!allIdsMapped || addMutation.isPending}
                  onClick={() =>
                    addMutation.mutate({ targetRecordId: targetId, fieldMapping: mapping })
                  }
                >
                  {addMutation.isPending ? 'Creando…' : 'Crear acción'}
                </button>
                <button
                  type="button"
                  className="syn-btn syn-btn-ghost"
                  onClick={() => setStep('select')}
                >
                  Atrás
                </button>
                <button type="button" className="syn-btn syn-btn-ghost" onClick={resetForm}>
                  Cancelar
                </button>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}

interface SynEntryLite {
  id: string
  status: string
  comparisonResults: Record<string, { passed: boolean }> | null
  createdAt: string
  data: Record<string, unknown>
  batch?: { id: string; lotNumber: string; status: string; producedQuantity: number | null; unit: string | null } | null
  sample?: { id: string; sampleCode: string; status: string } | null
}

function SynComplianceCard({ entries }: { entries: SynEntryLite[] }) {
  const last30 = entries.slice(0, 30)
  const completed = last30.filter((e) => e.status === 'COMPLETED')
  const passed = completed.filter((e) => {
    if (!e.comparisonResults) return true
    return Object.values(e.comparisonResults).every((r) => r.passed)
  }).length
  const denom = completed.length || 1
  const pct = Math.round((passed / denom) * 100)
  const oldest = last30[last30.length - 1]
  return (
    <div className="syn-card">
      <div className="syn-card-head">
        <div>
          <div className="eyebrow">· Cumplimiento</div>
          <h3 style={{ marginTop: 6 }}>
            {last30.length >= 30 ? '30 días' : `Últimas ${last30.length}`}
          </h3>
        </div>
      </div>
      <div style={{ padding: '20px 22px' }}>
        {last30.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--ink-3)', margin: 0 }}>
            Aún no hay entradas completadas para calcular cumplimiento.
          </p>
        ) : (
          <>
            <div
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 42,
                lineHeight: 1,
                color: 'var(--ink-0)',
                letterSpacing: '-0.02em',
              }}
            >
              {pct}
              <span style={{ fontStyle: 'italic', color: 'var(--primary-hex)' }}>%</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 8 }}>
              {passed} de {completed.length} verificaciones dentro de tolerancia
            </div>
            <div className="syn-compliance-strip">
              {last30.map((e) => {
                let bg: string
                if (e.status !== 'COMPLETED') bg = 'var(--ink-4)'
                else if (!e.comparisonResults) bg = 'var(--ok)'
                else {
                  const ok = Object.values(e.comparisonResults).every((r) => r.passed)
                  bg = ok ? 'var(--ok)' : 'var(--danger)'
                }
                return (
                  <span
                    key={e.id}
                    style={{ background: bg, opacity: bg === 'var(--danger)' ? 1 : 0.82 }}
                    title={new Date(e.createdAt).toLocaleString('es-AR')}
                  />
                )
              })}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 6,
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: 'var(--ink-3)',
                letterSpacing: '0.08em',
              }}
            >
              <span>
                {oldest
                  ? new Date(oldest.createdAt)
                      .toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                      .toUpperCase()
                  : '—'}
              </span>
              <span>HOY</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SynEntriesTabbedCard({
  record,
  entries,
  recipesMap,
  matricesMap,
  calibrationTemplatesMap,
  onNewEntry,
  onOpenEntry,
  onTabChange,
}: {
  record: RecordDetail
  entries: SynEntryLite[]
  recipesMap: Record<string, { name: string; code: string | null }>
  matricesMap: Record<string, { name: string; code: string | null }>
  calibrationTemplatesMap: Record<string, { name: string; code: string | null }>
  onNewEntry: () => void
  onOpenEntry: (id: string) => void
  onTabChange?: (tab: 'entries' | 'versions' | 'audit' | 'kanban' | 'flows') => void
}) {
  // Workflow engine v2: detectar field DROPDOWN-as-status. Si existe, se
  // habilita la pestaña Kanban con drag-drop entre columnas = options del
  // field. La transición se valida en el backend; el modal de motivo del
  // KanbanBoard captura `transitionReason` cuando la regla lo exige.
  const queryClient = useQueryClient()
  const statusField = useMemo(() => {
    return record.fields.find((f) => {
      if (f.fieldType !== 'DROPDOWN') return false
      const cfg = f.comparisonConfig as { isStatus?: boolean } | null
      return cfg?.isStatus === true
    }) ?? null
  }, [record])
  const hasStatusField = !!statusField

  const kanbanData = useMemo<{
    columns: KanbanColumn[]
    transitions: KanbanTransition[]
  } | null>(() => {
    if (!statusField) return null
    const cfg = statusField.comparisonConfig as {
      options?: Array<{ value: string; label?: string; color?: KanbanColor }>
      transitions?: KanbanTransition[]
    } | null
    if (!cfg?.options) return null
    const columns: KanbanColumn[] = cfg.options.map((o) => ({
      id: o.value,
      label: o.label || o.value,
      color: (o.color as KanbanColor) || 'gray',
    }))
    return { columns, transitions: cfg.transitions ?? [] }
  }, [statusField])

  const kanbanCards = useMemo<KanbanCard[]>(() => {
    if (!statusField) return []
    const identifierField = record.fields.find((f) => f.isIdentifier)
    return entries.map((e) => {
      const data = e.data as Record<string, unknown>
      const statusValue = String(data[statusField.id] ?? '')
      const titleValue = identifierField ? String(data[identifierField.id] ?? '—') : `#${e.id.slice(-6)}`
      const subtitleField = record.fields.find(
        (f) =>
          !f.isIdentifier &&
          f.id !== statusField.id &&
          f.fieldType === 'TEXT' &&
          data[f.id],
      )
      const subtitleValue = subtitleField ? String(data[subtitleField.id]) : undefined
      return {
        id: e.id,
        columnId: statusValue,
        title: titleValue,
        subtitle: subtitleValue,
      }
    })
  }, [entries, statusField, record])

  const handleKanbanCardMove = async (
    cardId: string,
    _fromColumnId: string,
    toColumnId: string,
    reason?: string,
  ) => {
    if (!statusField) return
    const entry = entries.find((e) => e.id === cardId)
    if (!entry) return
    const newData = { ...(entry.data as Record<string, unknown>), [statusField.id]: toColumnId }
    try {
      await api.entries.update(record.id, cardId, newData, reason)
      await queryClient.invalidateQueries({ queryKey: ['entries', record.id] })
      toast.success(reason ? 'Transición registrada con motivo' : 'Estado actualizado')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al cambiar estado')
      throw err
    }
  }

  const [tab, setTabInner] = useState<'entries' | 'versions' | 'audit' | 'kanban' | 'flows'>(
    hasStatusField ? 'kanban' : 'entries',
  )
  // Notificar al padre el cambio de tab para que pueda adaptar el layout
  // (ej. cuando tab==='flows' el padre oculta la sidebar izquierda).
  const setTab = (next: 'entries' | 'versions' | 'audit' | 'kanban' | 'flows') => {
    setTabInner(next)
    onTabChange?.(next)
  }
  // Notificación inicial: al montar, propagamos el tab default.
  useEffect(() => {
    onTabChange?.(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const visibleFields = record.fields.filter(
    (f) => f.fieldType !== 'FORMULA' && f.fieldType !== 'COMPARISON',
  )
  const canCreate = !(record.type === 'PERIODIC' && record.actionsAsTarget.length > 0)

  // Map de los colores de DropdownStateOption (workflow engine v2) a las
  // CSS classes existentes de syn-chip.
  const colorToChipClass: Record<string, string> = {
    gray: 'syn-chip-draft',
    slate: 'syn-chip-draft',
    blue: 'syn-chip-active',
    green: 'syn-chip-ok',
    amber: 'syn-chip-warn',
    red: 'syn-chip-fail',
  }

  /**
   * Si el field es DROPDOWN con options ricas (workflow engine v2),
   * renderiza un badge con color y label del option matching. Si no
   * matchea o el field no usa options ricas, devuelve null y la celda
   * cae al formatCell normal.
   */
  const renderRichDropdownBadge = (
    f: { fieldType: string; comparisonConfig: Record<string, unknown> | null },
    value: unknown,
  ) => {
    if (f.fieldType !== 'DROPDOWN') return null
    const cfg = f.comparisonConfig as {
      options?: unknown[]
    } | null
    const opts = cfg?.options
    if (!Array.isArray(opts) || opts.length === 0) return null
    if (typeof opts[0] !== 'object' || opts[0] === null) return null
    const richOpts = opts as Array<{ value: string; label?: string; color?: string }>
    const opt = richOpts.find((o) => o.value === String(value))
    if (!opt) return null
    const chipCls = colorToChipClass[opt.color || 'gray'] || 'syn-chip-draft'
    return <span className={`syn-chip ${chipCls}`}>{opt.label || opt.value}</span>
  }

  const formatCell = (v: unknown, type: string) => {
    if (v === null || v === undefined || v === '') return '—'
    if (type === 'DATE' && typeof v === 'string') return new Date(v).toLocaleDateString('es-AR')
    if (type === 'QUANTITY' && typeof v === 'object') {
      const q = v as { value?: number | string | null; unit?: string | null }
      if (q.value === null || q.value === undefined || q.value === '') return '—'
      return `${q.value}${q.unit ? ' ' + q.unit : ''}`
    }
    if (type === 'QUANTITY') return String(v)
    if (type === 'RECIPE_SELECT' && typeof v === 'string') {
      const r = recipesMap[v]
      if (!r) return v.slice(-8).toUpperCase()
      return r.code ? `${r.code} · ${r.name}` : r.name
    }
    if (type === 'MATRIX_METHOD' && typeof v === 'object') {
      const mm = v as { matrixId?: string; methodIds?: string[] }
      if (!mm.matrixId) return '—'
      const matrix = matricesMap[mm.matrixId]
      const matrixLabel = matrix
        ? (matrix.code ? `${matrix.code} · ${matrix.name}` : matrix.name)
        : mm.matrixId.slice(-8).toUpperCase()
      const n = mm.methodIds?.length ?? 0
      return n > 0 ? `${matrixLabel} · ${n} método${n === 1 ? '' : 's'}` : matrixLabel
    }
    if (type === 'CALIBRATION_TEMPLATE' && typeof v === 'string') {
      const tpl = calibrationTemplatesMap[v]
      if (!tpl) return v.slice(-8).toUpperCase()
      return tpl.code ? `${tpl.code} · ${tpl.name}` : tpl.name
    }
    if (typeof v === 'object') return '·'
    return String(v)
  }

  const batchStatusChip = (s: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      PLANNED: { cls: 'syn-chip-draft', label: 'PLANIFICADO' },
      IN_PROGRESS: { cls: 'syn-chip-warn', label: 'EN PROGRESO' },
      COMPLETED: { cls: 'syn-chip-active', label: 'FINALIZADO' },
      APPROVED: { cls: 'syn-chip-ok', label: 'APROBADO' },
      REJECTED: { cls: 'syn-chip-fail', label: 'RECHAZADO' },
    }
    return map[s] ?? { cls: 'syn-chip-draft', label: s }
  }

  const sampleStatusChip = (s: string) => {
    const map: Record<string, { cls: string; label: string }> = {
      RECEIVED: { cls: 'syn-chip-draft', label: 'RECIBIDA' },
      IN_TESTING: { cls: 'syn-chip-warn', label: 'EN ENSAYO' },
      COMPLETED: { cls: 'syn-chip-ok', label: 'COMPLETADA' },
    }
    return map[s] ?? { cls: 'syn-chip-draft', label: s }
  }

  return (
    <div className="syn-card">
      <div className="syn-card-head">
        <div className="syn-tabs">
          {hasStatusField && (
            <button
              type="button"
              onClick={() => setTab('kanban')}
              className={'syn-tab ' + (tab === 'kanban' ? 'active' : '')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Kanban
            </button>
          )}
          <button
            type="button"
            onClick={() => setTab('entries')}
            className={'syn-tab ' + (tab === 'entries' ? 'active' : '')}
          >
            Entries · {entries.length}
          </button>
          <button
            type="button"
            onClick={() => setTab('versions')}
            className={'syn-tab ' + (tab === 'versions' ? 'active' : '')}
          >
            Versiones · {record.version}
          </button>
          <button
            type="button"
            onClick={() => setTab('audit')}
            className={'syn-tab ' + (tab === 'audit' ? 'active' : '')}
          >
            Auditoría
          </button>
          <button
            type="button"
            onClick={() => setTab('flows')}
            className={'syn-tab ' + (tab === 'flows' ? 'active' : '')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Zap className="h-3.5 w-3.5" />
            Flujos
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="syn-btn syn-btn-subtle" style={{ padding: '6px 10px' }}>
            <ListFilter className="h-3.5 w-3.5" /> Filtrar
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={onNewEntry}
              className="syn-btn syn-btn-primary"
              style={{ padding: '6px 12px' }}
            >
              <Plus className="h-3 w-3" /> Nueva entry
            </button>
          )}
        </div>
      </div>

      {tab === 'entries' && (
        entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
            <div className="kicker mb-1" style={{ color: 'var(--ink-3)' }}>· Vacío</div>
            <div
              className="text-[24px]"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
            >
              Sin <span className="italic">entradas.</span>
            </div>
            <p className="max-w-xs text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
              Creá la primera entrada para comenzar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="syn-table">
              <thead>
                <tr>
                  {visibleFields.map((f) => (
                    <th key={f.id}>{f.label}</th>
                  ))}
                  {record.type === 'BATCH' && <th>Cantidad Producida</th>}
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Resultado</th>
                  {(record.type === 'BATCH' || record.type === 'SAMPLE') && (
                    <th style={{ textAlign: 'right' }}>Estado</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const data = e.data ?? {}
                  const hasFailed = e.comparisonResults
                    ? Object.values(e.comparisonResults).some((r) => !r.passed)
                    : false
                  return (
                    <tr
                      key={e.id}
                      onClick={() => onOpenEntry(e.id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {visibleFields.map((f, i) => {
                        const cls = i === 0 ? 'col-mono' : ''
                        const isNum = f.fieldType === 'NUMBER' || f.fieldType === 'QUANTITY'
                        const style: React.CSSProperties =
                          hasFailed && isNum
                            ? { color: 'var(--danger)', fontFamily: 'var(--font-mono)', fontSize: 12 }
                            : isNum
                              ? { fontFamily: 'var(--font-mono)', fontSize: 12 }
                              : {}
                        // Workflow engine v2: si el field es DROPDOWN con
                        // options ricas (incluyendo isStatus), render como
                        // badge con color del option en lugar de texto plano.
                        const richBadge = renderRichDropdownBadge(f, data[f.id])
                        return (
                          <td
                            key={f.id}
                            className={cls}
                            style={style}
                            data-label={f.label}
                            data-role={i === 0 || f.isIdentifier ? 'identifier' : undefined}
                          >
                            {richBadge ?? formatCell(data[f.id], f.fieldType)}
                          </td>
                        )
                      })}
                      {record.type === 'BATCH' && (
                        <td
                          data-label="Cantidad Producida"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
                        >
                          {e.batch?.producedQuantity != null
                            ? `${e.batch.producedQuantity}${e.batch.unit ? ' ' + e.batch.unit : ''}`
                            : '—'}
                        </td>
                      )}
                      <td data-label="Fecha" style={{ color: 'var(--ink-2)', fontSize: 12 }}>
                        {new Date(e.createdAt)
                          .toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
                          .toLowerCase()}{' '}
                        ·{' '}
                        {new Date(e.createdAt).toLocaleTimeString('es-AR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td
                        data-label="Resultado"
                        data-role="status"
                        style={{ textAlign: 'right' }}
                      >
                        {(() => {
                          if (record.type === 'BATCH' && e.batch) {
                            const c = batchStatusChip(e.batch.status)
                            return <span className={`syn-chip ${c.cls}`}>{c.label}</span>
                          }
                          if (record.type === 'SAMPLE' && e.sample) {
                            const c = sampleStatusChip(e.sample.status)
                            return <span className={`syn-chip ${c.cls}`}>{c.label}</span>
                          }
                          if (hasFailed) {
                            return <span className="syn-chip syn-chip-fail">FALLIDA</span>
                          }
                          if (e.status === 'COMPLETED') {
                            return <span className="syn-chip syn-chip-ok">OK</span>
                          }
                          return <span className="syn-chip syn-chip-draft">DRAFT</span>
                        })()}
                      </td>
                      {(record.type === 'BATCH' || record.type === 'SAMPLE') && (
                        <td
                          data-label="Estado"
                          data-role="status"
                          style={{ textAlign: 'right' }}
                        >
                          {hasFailed ? (
                            <span className="syn-chip syn-chip-fail">FALLIDA</span>
                          ) : e.status === 'COMPLETED' ? (
                            <span className="syn-chip syn-chip-ok">COMPLETADA</span>
                          ) : (
                            <span className="syn-chip syn-chip-draft">BORRADOR</span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'versions' && (
        <div style={{ padding: 20, fontSize: 13, color: 'var(--ink-2)' }}>
          {record.version} versión{record.version !== 1 ? 'es' : ''} publicada
          {record.version !== 1 ? 's' : ''}.
          {record.changeLog && (
            <>
              {' · Último cambio: '}
              <em style={{ color: 'var(--ink-1)' }}>{record.changeLog}</em>
            </>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div style={{ padding: 20, fontSize: 13, color: 'var(--ink-2)' }}>
          Log inmutable de cambios. Próximamente: timeline de eventos con firma digital y sello temporal.
        </div>
      )}

      {tab === 'flows' && (
        <div style={{ padding: 16 }}>
          <FlowEditor
            recordId={record.id}
            recordName={record.name}
            recordFields={record.fields.map((f) => ({
              id: f.id,
              label: f.label,
              fieldType: f.fieldType,
              isIdentifier: f.isIdentifier,
              comparisonConfig: f.comparisonConfig,
            }))}
          />
        </div>
      )}

      {tab === 'kanban' && hasStatusField && kanbanData && (
        <div style={{ padding: 16 }}>
          <KanbanBoard
            columns={kanbanData.columns}
            cards={kanbanCards}
            allowedTransitions={kanbanData.transitions}
            onCardMove={handleKanbanCardMove}
            emptyState={
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                <div className="kicker mb-1" style={{ color: 'var(--ink-3)' }}>· Vacío</div>
                <div
                  className="text-[24px]"
                  style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
                >
                  Sin <span className="italic">entradas.</span>
                </div>
                <p className="max-w-xs text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                  Creá la primera entrada para comenzar.
                </p>
              </div>
            }
          />
        </div>
      )}
    </div>
  )
}

export default function RecordDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const recordId = params.id as string

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editFields, setEditFields] = useState<FieldDef[]>([])
  const [changeReason, setChangeReason] = useState('')

  // Entries
  const [showNewEntry, setShowNewEntry] = useState(false)
  const [entryData, setEntryData] = useState<Record<string, unknown>>({})
  const [entryMeta, setEntryMeta] = useState<{ lotNumber?: string; sampleCode?: string; client?: string }>({})
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null)
  const [viewingEntry, setViewingEntry] = useState<boolean>(false)
  // Tab activo del SynEntriesTabbedCard. Lo trackeamos acá para adaptar el
  // layout (cuando el tab es 'flows', la columna izquierda con campos/cascade/
  // cumplimiento se oculta y el editor visual ocupa todo el ancho).
  const [recordTab, setRecordTab] = useState<'entries' | 'versions' | 'audit' | 'kanban' | 'flows'>('entries')

  const { data: record, isLoading } = useQuery<RecordDetail>({
    queryKey: ['record', recordId],
    queryFn: () => api.records.get(recordId) as Promise<RecordDetail>,
  })

  // Workflow engine v2: si el Record tiene un DROPDOWN con isStatus, el
  // lifecycle de las entries lo maneja ese field, no el enum DRAFT/COMPLETED.
  // Acción derivada en el form: el botón primario solo guarda (no completa)
  // y se oculta el "Guardar borrador" porque la entry siempre queda editable.
  const hasStatusField = (record?.fields ?? []).some((f) => {
    if (f.fieldType !== 'DROPDOWN') return false
    const cfg = f.comparisonConfig as { isStatus?: boolean } | null
    return cfg?.isStatus === true
  })

  // Lista de registros para el selector de acciones
  const { data: allRecords = [] } = useQuery<RecordListItem[]>({
    queryKey: ['records'],
    queryFn: () => api.records.list() as Promise<RecordListItem[]>,
  })

  interface EntryItem {
    id: string
    status: 'DRAFT' | 'COMPLETED'
    data: Record<string, unknown>
    comparisonResults: Record<string, { passed: boolean; value: unknown; description: string }> | null
    formulaResults: Record<string, number> | null
    dueDate: string | null
    completedAt: string | null
    createdAt: string
    triggeredById: string | null
    instrument?: { id: string; status: string; nextCalibrationAt: string | null } | null
    batch?: { id: string; lotNumber: string; status: string; producedQuantity: number | null; unit: string | null } | null
    sample?: { id: string; sampleCode: string; status: string; client: string | null; results: Record<string, { value: number | null; observations?: string }> | null; matrixId: string | null; matrix: { id: string; name: string; code: string | null; parameters: Array<{ id: string; name: string; unit: string | null; minValue: number | null; maxValue: number | null; order: number }> } | null } | null
  }

  const { data: entries = [] } = useQuery<EntryItem[]>({
    queryKey: ['entries', recordId],
    queryFn: () => api.entries.list(recordId) as Promise<EntryItem[]>,
  })

  // Matrices y métodos para resolver nombres en campos MATRIX_METHOD
  const hasMatrixMethodField = record?.fields.some((f) => f.fieldType === 'MATRIX_METHOD')
  const { data: matricesMap = {} } = useQuery({
    queryKey: ['matrices-map'],
    queryFn: async () => {
      const list = await api.matrices.list() as Array<{ id: string; name: string; code: string | null; parameters: Array<{ name: string; method: string | null; unit: string | null }> }>
      const map: Record<string, { name: string; code: string | null; parameters: Array<{ name: string; method: string | null; unit: string | null }> }> = {}
      for (const m of list) map[m.id] = { name: m.name, code: m.code, parameters: m.parameters }
      return map
    },
    enabled: !!hasMatrixMethodField,
  })
  const { data: methodsMap = {} } = useQuery({
    queryKey: ['methods-map'],
    queryFn: async () => {
      const list = await api.methods.search() as Array<{ id: string; code: string; parameter: string; unit: string | null }>
      const map: Record<string, { code: string; parameter: string; unit: string | null }> = {}
      for (const m of list) map[m.id] = { code: m.code, parameter: m.parameter, unit: m.unit }
      return map
    },
    enabled: !!hasMatrixMethodField,
  })
  const hasRecipeSelectField = record?.fields.some((f) => f.fieldType === 'RECIPE_SELECT')
  const { data: recipesMap = {} } = useQuery({
    queryKey: ['recipes-map'],
    queryFn: async () => {
      const list = await api.recipes.list() as Array<{ id: string; name: string; code: string | null; ingredients: Array<{ name: string; quantity: number; unit: string }>; steps: Array<{ name: string; duration: number | null }> }>
      const map: Record<string, { name: string; code: string | null; ingredients: Array<{ name: string; quantity: number; unit: string }>; steps: Array<{ name: string; duration: number | null }> }> = {}
      for (const r of list) map[r.id] = { name: r.name, code: r.code, ingredients: r.ingredients, steps: r.steps }
      return map
    },
    enabled: !!hasRecipeSelectField,
  })
  const hasCalibrationTemplateField = record?.fields.some((f) => f.fieldType === 'CALIBRATION_TEMPLATE')
  const { data: calibrationTemplatesMap = {} } = useQuery({
    queryKey: ['calibration-templates-map'],
    queryFn: async () => {
      const list = await api.calibrationTemplates.list() as Array<{ id: string; name: string; code: string | null }>
      const map: Record<string, { name: string; code: string | null }> = {}
      for (const t of list) map[t.id] = { name: t.name, code: t.code }
      return map
    },
    enabled: !!hasCalibrationTemplateField,
  })

  const createEntryMutation = useMutation({
    mutationFn: (body: { data: Record<string, unknown>; lotNumber?: string; sampleCode?: string; client?: string }) =>
      api.entries.create(recordId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entries', recordId] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      queryClient.invalidateQueries({ queryKey: ['calibrations'] })
      setShowNewEntry(false)
      setEntryData({})
      setEntryMeta({})
      toast.success('Entrada creada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Refetch entries con retry para esperar que el listener del backend cree la siguiente entry
  const refetchEntries = async () => {
    await new Promise((r) => setTimeout(r, 300))
    await queryClient.refetchQueries({ queryKey: ['entries', recordId] })
    // Segundo refetch para asegurar que el listener terminó
    await new Promise((r) => setTimeout(r, 700))
    await queryClient.refetchQueries({ queryKey: ['entries', recordId] })
  }

  // Guarda cambios en la entry pero la deja en DRAFT. Para cerrarla + disparar
  // cascades, el usuario usa el botón "Guardar y completar" que combina esta
  // mutación con completeEntryMutation.
  const updateEntryMutation = useMutation({
    mutationFn: ({ entryId, data }: { entryId: string; data: Record<string, unknown> }) =>
      api.entries.update(recordId, entryId, data),
    onSuccess: () => {
      setShowNewEntry(false)
      setEntryData({})
      setEditingEntryId(null)
      setViewingEntry(false)
      toast.success('Borrador guardado')
      refetchEntries()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const updateAndCompleteEntryMutation = useMutation({
    mutationFn: async ({ entryId, data }: { entryId: string; data: Record<string, unknown> }) => {
      await api.entries.update(recordId, entryId, data)
      await api.entries.complete(recordId, entryId)
    },
    onSuccess: () => {
      setShowNewEntry(false)
      setEntryData({})
      setEditingEntryId(null)
      setViewingEntry(false)
      toast.success('Entrada completada')
      refetchEntries()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const completeEntryMutation = useMutation({
    mutationFn: (entryId: string) => api.entries.complete(recordId, entryId),
    onSuccess: () => {
      toast.success('Entrada completada')
      refetchEntries()
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const editMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api.records.update(recordId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record', recordId] })
      queryClient.invalidateQueries({ queryKey: ['records'] })
      setEditing(false)
      setChangeReason('')
      toast.success('Registro actualizado (nueva versión)')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const archiveMutation = useMutation({
    mutationFn: () => api.records.archive(recordId),
    onSuccess: () => {
      toast.success('Registro archivado')
      router.push('/records')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // addActionMutation y deleteActionMutation viven ahora en SynCascadeCard.

  const submitForApprovalMutation = useMutation({
    mutationFn: () => api.approval.submit({ entityType: 'RECORD', entityId: recordId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['record', recordId] })
      toast.success('Registro enviado a revisión')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const startEditing = () => {
    if (!record) return
    setEditing(true)
    setEditName(record.name)
    setEditFields(record.fields.map((f) => ({ ...f })))
    setChangeReason('')
  }

  // El manejo de campos vive ahora en RecordFieldsEditor.
  // El padre solo guarda el array y lo consulta en handleSaveEdit.

  const handleSaveEdit = () => {
    if (!changeReason.trim()) return toast.error('El motivo del cambio es obligatorio')

    const activeFields = editFields.filter((f) => !f.markedForRemoval)
    if (!activeFields.some((f) => f.isIdentifier))
      return toast.error('Al menos un campo debe ser identificador')

    // Campos nuevos agregados durante esta edición.
    const newFields = editFields
      .filter((f) => f.isNew && !f.markedForRemoval)
      .map((f, i) => {
        // Para DROPDOWN/QUANTITY colapsamos dropdownOptions → comparisonConfig.{options|units}
        // (el editor guarda en dropdownOptions pero el backend espera el formato legacy).
        let comparisonConfig: Record<string, unknown> | undefined
        if (f.fieldType === 'DROPDOWN') {
          comparisonConfig = {
            options:
              (f.dropdownOptions ?? [])
                .filter((o) => o.trim())
                .map((o) => o.toUpperCase()),
          }
        } else if (f.fieldType === 'QUANTITY') {
          comparisonConfig = {
            units:
              (f.dropdownOptions ?? [])
                .filter((o) => o.trim())
                .map((o) => o.toUpperCase()),
          }
        } else if (f.comparisonConfig) {
          comparisonConfig = { ...f.comparisonConfig }
        }
        return {
          label: f.label,
          fieldType: f.fieldType,
          order: f.order ?? i,
          isIdentifier: f.isIdentifier,
          isRequired: f.isRequired,
          comparisonConfig,
          formulaConfig: f.formulaConfig || undefined,
          relatedRecordId: f.relatedRecordId || undefined,
          relatedFieldIds: f.relatedFieldIds || undefined,
        }
      })

    // Sobre campos existentes solo label/order/isRequired son editables.
    const updatedFields = editFields
      .filter((f) => !f.isNew && !f.markedForRemoval)
      .map((f, i) => ({
        id: f.id,
        label: f.label,
        order: f.order ?? i,
        isRequired: f.isRequired,
      }))

    // Los ids a remover se derivan del propio array — sin state paralelo.
    const removeIds = editFields
      .filter((f) => !f.isNew && f.markedForRemoval)
      .map((f) => f.id)

    editMutation.mutate({
      name: editName !== record?.name ? editName : undefined,
      changeReason,
      addFields: newFields.length > 0 ? newFields : undefined,
      removeFieldIds: removeIds.length > 0 ? removeIds : undefined,
      updateFields: updatedFields.length > 0 ? updatedFields : undefined,
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (!record) return null
  const type = typeConfig[record.type]

  // Título en serif: última palabra en itálica como "Verificación diaria balanza."
  const titleWords = record.name.trim().split(/\s+/)
  const titleLast = titleWords.length > 1 ? titleWords.pop() : ''
  const titleHead = titleWords.join(' ')

  const canCreateEntry = !(record.type === 'PERIODIC' && record.actionsAsTarget.length > 0)

  return (
    <div className="mx-auto max-w-[1280px] fade-in">
      {/* Hero (Synapse) */}
      <div className="syn-rec-hero">
        <div>
          <div className="kicker mb-1.5 flex items-center gap-2">
            <Link href="/records" className="flex items-center gap-1 hover:text-ink-0">
              <ArrowLeft className="h-3 w-3" /> Registros
            </Link>
            <span>·</span>
            <span>ID {recordId.slice(-8).toUpperCase()}</span>
          </div>
          <h2>
            {titleHead}{' '}
            {titleLast && <span className="italic">{titleLast}.</span>}
          </h2>
          <div className="syn-rec-hero-meta">
            <div className="m">
              <span className="mk">ESTADO</span>
              <span className="mv">
                {(() => {
                  const s = (record as Record<string, unknown>).status as string | undefined
                  if (s === 'ACTIVE') {
                    return (
                      <span className="syn-chip syn-chip-active">
                        <span className="pulse" /> ACTIVO
                      </span>
                    )
                  }
                  if (s === 'IN_REVIEW') {
                    return <span className="syn-chip syn-chip-review">EN REVISIÓN</span>
                  }
                  return <span className="syn-chip syn-chip-draft">BORRADOR</span>
                })()}
              </span>
            </div>
            <div className="m">
              <span className="mk">TIPO</span>
              <span className="mv">{type.label}</span>
            </div>
            {(record.type === 'PERIODIC' || record.type === 'INSTRUMENTAL') && record.periodicity && (
              <div className="m">
                <span className="mk">PERIODICIDAD</span>
                <span className="mv">Cada {record.periodicity} días</span>
              </div>
            )}
            {record.area && (
              <div className="m">
                <span className="mk">ÁREA</span>
                <span className="mv">{record.area.name}</span>
              </div>
            )}
            <div className="m">
              <span className="mk">VERSIÓN</span>
              <span className="mv font-mono">v{record.version}</span>
            </div>
            {(record as Record<string, unknown>).recipe && (
              <div className="m">
                <span className="mk">RECETA</span>
                <span className="mv">
                  {((record as Record<string, unknown>).recipe as { name: string }).name}
                </span>
              </div>
            )}
            {record.changeLog && (
              <div className="m">
                <span className="mk">CAMBIO</span>
                <span className="mv italic flex items-center gap-1">
                  <History className="h-3 w-3" />
                  {record.changeLog}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start">
          {editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="syn-btn syn-btn-ghost"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={editMutation.isPending}
                className="syn-btn syn-btn-primary"
              >
                {editMutation.isPending ? 'Guardando…' : 'Guardar versión'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (confirm('¿Archivar este registro? Podés restaurarlo después desde la pestaña Archivados.')) {
                    archiveMutation.mutate()
                  }
                }}
                disabled={archiveMutation.isPending}
                className="syn-btn syn-btn-ghost"
                style={{ color: 'var(--danger)' }}
              >
                <Archive className="h-3.5 w-3.5" />
                Archivar
              </button>
              <button
                type="button"
                onClick={startEditing}
                className="syn-btn syn-btn-ghost"
              >
                <Settings className="h-3.5 w-3.5" />
                Editar
              </button>
              {(record as Record<string, unknown>).status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => submitForApprovalMutation.mutate()}
                  disabled={submitForApprovalMutation.isPending}
                  className="syn-btn syn-btn-primary"
                >
                  <Send className="h-3.5 w-3.5" />
                  {submitForApprovalMutation.isPending ? 'Enviando…' : 'Enviar a revisión'}
                </button>
              )}
              {(record as Record<string, unknown>).status === 'ACTIVE' && canCreateEntry && (
                <button
                  type="button"
                  onClick={() => {
                    setShowNewEntry(true)
                    setEntryData({})
                    setEditingEntryId(null)
                    setViewingEntry(false)
                  }}
                  className="syn-btn syn-btn-primary"
                >
                  <Plus className="h-3 w-3" /> Nueva entrada
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Motivo del cambio (solo en edición) */}
      {editing && (
        <Card className="mb-5 border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Motivo del cambio *
                <span className="ml-2 font-normal text-muted-foreground">
                  (esto crea la versión {record.version + 1})
                </span>
              </label>
              <input
                type="text"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Ej: Se agrega campo de temperatura ambiente por requisito de norma..."
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info de campos obligatorios */}
      {['INSTRUMENTAL', 'BATCH', 'SAMPLE', 'STOCK'].includes(record.type) && (
        <div
          className="mb-5 rounded-[10px] border px-4 py-3 text-[12.5px]"
          style={{
            background: 'var(--info-soft)',
            borderColor: 'var(--info)',
            color: 'var(--info)',
          }}
        >
          <span className="kicker" style={{ color: 'var(--info)', marginRight: 8 }}>
            · Obligatorios
          </span>
          {record.type === 'INSTRUMENTAL' && 'CÓDIGO (identificador)'}
          {record.type === 'BATCH' && 'LOTE (identificador), RECETA (tipo Receta, opcional)'}
          {record.type === 'SAMPLE' &&
            'CÓDIGO MUESTRA (identificador), MATRIZ Y MÉTODOS (tipo Matriz y Métodos)'}
          {record.type === 'STOCK' &&
            'LOTE (identificador), PRODUCTO, TIPO MOVIMIENTO, CANTIDAD'}
        </div>
      )}

      <div
        className={
          editing
            ? 'grid gap-5 lg:grid-cols-3'
            : recordTab === 'flows'
              ? 'flex flex-col gap-5'
              : 'syn-rec-grid'
        }
      >
        {/* Left column wrapper — se oculta cuando el tab activo es 'flows'
            para que el editor visual ocupe todo el ancho disponible. */}
        {!(recordTab === 'flows' && !editing) && (
        <div className={editing ? 'space-y-5 min-w-0 lg:col-span-2' : 'space-y-5 min-w-0'}>
        {/* Campos — read-only Synapse card en non-editing */}
        {!editing && <SynFieldsReadOnlyCard record={record} />}
        {/* Campos — editor completo en editing */}
        {/* Campos — editor completo en editing */}
        {editing && (
          <section className="syn-builder-section">
            <div className="syn-bs-head">
              <span className="syn-bs-title">Campos</span>
              <span className="syn-bs-sub">
                {editFields.filter((f) => !f.markedForRemoval).length}
                {' '}
                {editFields.filter((f) => !f.markedForRemoval).length === 1 ? 'campo' : 'campos'}
                {' · los campos existentes tienen tipo y configuración bloqueados'}
              </span>
            </div>
            <RecordFieldsEditor
              fields={editFields as unknown as SharedFieldDef[]}
              onChange={(next) => setEditFields(next as unknown as FieldDef[])}
              allRecords={allRecords as unknown as SharedRecordListItem[]}
              mode="edit"
            />
          </section>
        )}

        {/* Non-editing only — Cascade summary + Compliance */}
        {!editing && <SynCascadeCard record={record} allRecords={allRecords} />}
        {!editing && <SynComplianceCard entries={entries} />}

        </div>
        )} {/* close left column wrapper / hide on flows tab */}

        {/* Right column */}
        {!editing && (
          <div className="min-w-0">
            <SynEntriesTabbedCard
              record={record}
              entries={entries}
              recipesMap={recipesMap}
              matricesMap={matricesMap}
              calibrationTemplatesMap={calibrationTemplatesMap}
              onNewEntry={() => {
                setShowNewEntry(true)
                setEntryData({})
                setEditingEntryId(null)
                setViewingEntry(false)
              }}
              onOpenEntry={(id) => {
                const e = entries.find((x) => x.id === id)
                const isDraft = e?.status === 'DRAFT'
                setEditingEntryId(id)
                // DRAFT entries abren directo en edición para que el operario
                // pueda completar los campos que quedaron pendientes.
                // COMPLETED entries abren en modo view (read-only).
                setViewingEntry(!isDraft)
                setShowNewEntry(true)
                if (e) setEntryData(e.data as Record<string, unknown>)
              }}
              onTabChange={setRecordTab}
            />
          </div>
        )}

      </div>

      {/* Modal nueva/editar/ver entrada */}
      {showNewEntry && record && (() => {
        const isViewing = viewingEntry
        const isEditing = !!editingEntryId && !isViewing
        const isCreating = !editingEntryId && !isViewing
        const mode: 'create' | 'edit' | 'view' = isViewing
          ? 'view'
          : isEditing
            ? 'edit'
            : 'create'

        const editingEntry = editingEntryId
          ? entries.find((e) => e.id === editingEntryId)
          : undefined
        const isCompletedEntry = editingEntry?.status === 'COMPLETED'

        const closeModal = () => {
          setShowNewEntry(false)
          setEntryData({})
          setEntryMeta({})
          setEditingEntryId(null)
          setViewingEntry(false)
        }

        const handleSaveDraft = () => {
          if (isEditing && editingEntryId) {
            updateEntryMutation.mutate({ entryId: editingEntryId, data: entryData })
          }
        }

        const handleSaveAndComplete = () => {
          if (isEditing && editingEntryId) {
            // Workflow engine v2: cuando el Record tiene isStatus, la entry no
            // se completa al guardar — el lifecycle vive en el DROPDOWN.
            if (hasStatusField) {
              updateEntryMutation.mutate({ entryId: editingEntryId, data: entryData })
            } else {
              updateAndCompleteEntryMutation.mutate({ entryId: editingEntryId, data: entryData })
            }
          } else {
            const identifierField = record.fields.find((f) => f.isIdentifier)
            const identifierValue = identifierField
              ? String(entryData[identifierField.id] || '')
              : ''
            const meta: Record<string, unknown> = { ...entryMeta }
            if (record.type === 'BATCH') meta.lotNumber = identifierValue
            if (record.type === 'SAMPLE') meta.sampleCode = identifierValue
            createEntryMutation.mutate({ data: entryData, ...meta })
          }
        }

        const title = isViewing
          ? 'Detalle de entrada'
          : isEditing
            ? 'Editar entrada'
            : 'Nueva entrada'

        return (
          <div
            className="fade-in fixed inset-0 z-50 flex items-stretch justify-center sm:items-center sm:p-4"
            style={{ background: 'rgba(4,7,15,0.55)', backdropFilter: 'blur(3px)' }}
          >
            <div
              className="flex w-full flex-col bg-[var(--bg-1)] shadow-[var(--shadow-lg)] sm:max-w-2xl sm:rounded-[14px]"
              style={{
                maxHeight: '100dvh',
                height: '100dvh',
                border: '1px solid var(--line)',
              }}
            >
              <div
                className="flex items-center justify-between border-b px-5 py-4 sm:px-6"
                style={{ borderColor: 'var(--line)' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="kicker">· {title}</div>
                  <div
                    className="truncate"
                    style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: 20,
                      marginTop: 2,
                      color: 'var(--ink-0)',
                    }}
                  >
                    {record.name}
                    <span
                      className="ml-2 font-mono text-[11px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      v{record.version}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg p-2 transition-colors hover:bg-[var(--bg-3)]"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" style={{ color: 'var(--ink-2)' }} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                {record.type === 'SAMPLE' && isCreating && (
                  <div
                    className="mb-4 rounded-[10px] border px-4 py-3"
                    style={{ background: 'var(--ok-soft)', borderColor: 'var(--ok)' }}
                  >
                    <div className="kicker mb-2" style={{ color: 'var(--ok)' }}>
                      · Datos de la muestra
                    </div>
                    <div className="syn-field">
                      <span className="syn-field-label">Cliente</span>
                      <input
                        className="syn-input"
                        value={entryMeta.client || ''}
                        onChange={(e) =>
                          setEntryMeta({ ...entryMeta, client: e.target.value })
                        }
                        placeholder="Nombre del cliente"
                      />
                    </div>
                  </div>
                )}

                <DynamicRecordForm
                  record={{
                    id: record.id,
                    name: record.name,
                    type: record.type,
                    version: record.version,
                    fields: record.fields,
                  }}
                  mode={mode}
                  value={entryData}
                  onChange={setEntryData}
                  isCompleted={isCompletedEntry}
                />

                {isViewing && record.type === 'SAMPLE' && editingEntryId && (() => {
                  const entry = entries.find((e) => e.id === editingEntryId)
                  const s = entry?.sample
                  if (!s?.matrix?.parameters?.length) return null
                  const sampleResults = s.results || {}
                  return (
                    <div
                      className="mt-4 rounded-[10px] border"
                      style={{ background: 'var(--info-soft)', borderColor: 'var(--info)' }}
                    >
                      <div className="flex items-center justify-between px-4 py-3">
                        <div className="kicker" style={{ color: 'var(--info)' }}>
                          · Resultados — {s.matrix.name}
                        </div>
                        <Link
                          href={`/samples/${s.id}`}
                          className="syn-btn syn-btn-ghost"
                          style={{ padding: '4px 10px' }}
                        >
                          Ver muestra
                        </Link>
                      </div>
                      <div
                        className="rounded-b-[10px] border-t"
                        style={{ borderColor: 'var(--line)', background: 'var(--bg-1)' }}
                      >
                        {s.matrix.parameters.map((p) => {
                          const r = sampleResults[p.id] as
                            | { value: number | null; observations?: string }
                            | undefined
                          const val = r?.value
                          const hasMin = p.minValue !== null && p.minValue !== undefined
                          const hasMax = p.maxValue !== null && p.maxValue !== undefined
                          let status: 'ok' | 'fail' | null = null
                          if (val !== null && val !== undefined && (hasMin || hasMax)) {
                            status =
                              (hasMin && val < p.minValue!) ||
                              (hasMax && val > p.maxValue!)
                                ? 'fail'
                                : 'ok'
                          }
                          return (
                            <div
                              key={p.id}
                              className="flex items-center justify-between border-t px-4 py-2.5 first:border-t-0 text-[13px]"
                              style={{ borderColor: 'var(--line)' }}
                            >
                              <div style={{ color: 'var(--ink-1)' }}>
                                {p.name}
                                {p.unit && (
                                  <span
                                    className="ml-1 font-mono text-[11px]"
                                    style={{ color: 'var(--ink-3)' }}
                                  >
                                    ({p.unit})
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span
                                  className="font-mono"
                                  style={{
                                    color:
                                      status === 'fail' ? 'var(--danger)' : 'var(--ink-0)',
                                  }}
                                >
                                  {val !== null && val !== undefined ? val : '—'}
                                </span>
                                {status && (
                                  <span
                                    className={
                                      status === 'ok'
                                        ? 'syn-chip syn-chip-ok'
                                        : 'syn-chip syn-chip-fail'
                                    }
                                  >
                                    {status === 'ok' ? 'CONFORME' : 'NO CONFORME'}
                                  </span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>

              <EntryActionBar
                status={
                  isViewing ? (
                    <span
                      className={
                        isCompletedEntry
                          ? 'syn-chip syn-chip-completed'
                          : 'syn-chip syn-chip-draft'
                      }
                    >
                      {isCompletedEntry ? 'COMPLETADA' : 'DRAFT'}
                    </span>
                  ) : isEditing ? (
                    <span className="syn-chip syn-chip-draft">DRAFT · editable</span>
                  ) : null
                }
                primary={
                  isViewing ? (
                    <button
                      type="button"
                      onClick={closeModal}
                      className="syn-btn syn-btn-primary"
                    >
                      Cerrar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSaveAndComplete}
                      disabled={
                        createEntryMutation.isPending ||
                        updateEntryMutation.isPending ||
                        updateAndCompleteEntryMutation.isPending
                      }
                      className="syn-btn syn-btn-primary"
                    >
                      {(createEntryMutation.isPending ||
                        updateAndCompleteEntryMutation.isPending ||
                        (hasStatusField && updateEntryMutation.isPending))
                        ? isEditing
                          ? hasStatusField
                            ? 'Guardando…'
                            : 'Completando…'
                          : 'Creando…'
                        : isEditing
                          ? hasStatusField
                            ? 'Guardar'
                            : 'Guardar y completar'
                          : 'Crear entrada'}
                    </button>
                  )
                }
                secondary={
                  // El "Guardar borrador" se oculta cuando el Record usa DROPDOWN-as-status:
                  // el botón primario ya guarda sin completar, no hay diferencia entre los dos.
                  isEditing && !hasStatusField ? (
                    <button
                      type="button"
                      onClick={handleSaveDraft}
                      disabled={
                        updateEntryMutation.isPending ||
                        updateAndCompleteEntryMutation.isPending
                      }
                      className="syn-btn syn-btn-subtle"
                    >
                      {updateEntryMutation.isPending ? 'Guardando…' : 'Guardar borrador'}
                    </button>
                  ) : null
                }
                ghost={
                  !isViewing ? (
                    <button
                      type="button"
                      onClick={closeModal}
                      className="syn-btn syn-btn-ghost"
                    >
                      Cancelar
                    </button>
                  ) : null
                }
              />
            </div>
          </div>
        )
      })()}

    </div>
  )
}
