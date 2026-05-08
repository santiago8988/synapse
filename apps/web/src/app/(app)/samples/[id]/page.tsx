'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  TestTube2,
  Microscope,
  CheckCircle2,
  Loader2,
  Save,
  ClipboardList,
  Ruler,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { computeConditionChip } from '@/lib/instrument-condition'

type SampleStatus = 'RECEIVED' | 'IN_TESTING' | 'COMPLETED'

interface EffectiveParam {
  id: string
  name: string
  method: string | null
  unit: string | null
  minValue: number | null
  maxValue: number | null
}

interface MatrixConditionDef {
  id: string
  label: string
  fieldType: string
  unit: string | null
  options: string[]
  order: number
}

interface SampleDetail {
  id: string
  sampleCode: string
  client: string | null
  methodIds: string[]
  status: SampleStatus
  results: Record<string, { value: number | null; observations?: string }> | null
  conditions: Record<string, unknown> | null
  receivedAt: string
  completedAt: string | null
  createdAt: string
  record: {
    id: string
    name: string
    fields: Array<{ id: string; label: string; fieldType: string }>
  }
  entry: { id: string; data: Record<string, unknown>; recordVersion: number }
  matrix: {
    id: string
    name: string
    code: string | null
    parameters: Array<{ id: string; name: string; unit: string | null; minValue: number | null; maxValue: number | null }>
    conditions: MatrixConditionDef[]
    requiredInstruments?: Array<{ id: string; label: string; order: number }>
  } | null
  instrumentAssignments: Array<{
    id: string
    label: string
    order: number
    instrumentId: string
    assignedAt: string
    instrument: {
      id: string
      status: string
      nextCalibrationAt: string | null
      entry: { id: string; data: Record<string, unknown> }
      record: { id: string; name: string }
    }
  }>
  effectiveParameters: EffectiveParam[]
}

const statusLabel: Record<SampleStatus, string> = {
  RECEIVED: 'Recibida',
  IN_TESTING: 'En ensayo',
  COMPLETED: 'Completada',
}

export default function SampleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: sample, isLoading } = useQuery({
    queryKey: ['sample', id],
    queryFn: () => api.samples.get(id) as Promise<SampleDetail>,
  })

  const [results, setResults] = useState<Record<string, { value: number | null; observations?: string }>>({})
  const [conditions, setConditions] = useState<Record<string, unknown>>({})
  const [dirtyResults, setDirtyResults] = useState(false)
  const [dirtyConditions, setDirtyConditions] = useState(false)

  useEffect(() => {
    if (sample?.results) setResults(sample.results)
    if (sample?.conditions) setConditions(sample.conditions)
  }, [sample])

  const saveResultsMutation = useMutation({
    mutationFn: () => api.samples.saveResults(id, results),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample', id] })
      setDirtyResults(false)
      toast.success('Resultados guardados')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const saveConditionsMutation = useMutation({
    mutationFn: () => api.samples.saveConditions(id, conditions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample', id] })
      setDirtyConditions(false)
      toast.success('Condiciones guardadas')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const changeStatusMutation = useMutation({
    mutationFn: (status: string) => api.samples.changeStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample', id] })
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      toast.success('Estado actualizado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Instrumentos reales disponibles para asignar (solo se fetchan si la matriz
  // de la sample declara al menos un instrumento requerido)
  const hasRequiredInstruments = (sample?.matrix?.requiredInstruments?.length ?? 0) > 0
  const { data: realInstruments = [] } = useQuery({
    queryKey: ['instruments-real'],
    queryFn: () =>
      api.instruments.real() as Promise<Array<{
        id: string
        status: string
        nextCalibrationAt: string | null
        entry: { id: string; data: Record<string, unknown> }
        record: { id: string; name: string }
      }>>,
    enabled: hasRequiredInstruments,
  })

  const [pickerLabel, setPickerLabel] = useState<string | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')

  const assignInstrumentMutation = useMutation({
    mutationFn: (data: { label: string; instrumentId: string; order: number }) =>
      api.samples.assignInstrument(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample', id] })
      setPickerLabel(null)
      setPickerSearch('')
      toast.success('Instrumento asignado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const unassignInstrumentMutation = useMutation({
    mutationFn: (assignmentId: string) => api.samples.unassignInstrument(id, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sample', id] })
      toast.success('Instrumento removido')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ink-3)' }} />
      </div>
    )
  }

  if (!sample) return null

  const statusChipCls =
    sample.status === 'RECEIVED'
      ? 'syn-chip-draft'
      : sample.status === 'IN_TESTING'
        ? 'syn-chip-active'
        : 'syn-chip-ok'
  const isEditable = sample.status !== 'COMPLETED'
  const parameters = sample.effectiveParameters || []
  const matrixConditions = sample.matrix?.conditions || []

  const getResultStatus = (param: EffectiveParam, value: number | null) => {
    if (value === null || value === undefined) return null
    const hasMin = param.minValue !== null && param.minValue !== undefined
    const hasMax = param.maxValue !== null && param.maxValue !== undefined
    if (!hasMin && !hasMax) return null
    if (hasMin && value < param.minValue!) return 'fail'
    if (hasMax && value > param.maxValue!) return 'fail'
    return 'pass'
  }

  return (
    <div className="mx-auto max-w-[1280px] fade-in">
      {/* Hero */}
      <div className="syn-rec-hero">
        <div>
          <div className="kicker mb-1.5 flex items-center gap-2">
            <Link
              href="/samples"
              className="flex items-center gap-1 hover:text-ink-0"
              onClick={(e) => {
                e.preventDefault()
                router.push('/samples')
              }}
            >
              <ArrowLeft className="h-3 w-3" /> Muestras
            </Link>
            <span>·</span>
            <span>{sample.sampleCode}</span>
          </div>
          <h2>
            Muestra <span className="italic">{sample.sampleCode}.</span>
          </h2>
          <div className="syn-rec-hero-meta">
            <div className="m">
              <span className="mk">ESTADO</span>
              <span className="mv">
                <span className={`syn-chip ${statusChipCls}`}>{statusLabel[sample.status]}</span>
              </span>
            </div>
            <div className="m">
              <span className="mk">REGISTRO</span>
              <span className="mv">
                <Link href={`/records/${sample.record.id}`} className="hover:underline">
                  {sample.record.name}
                </Link>
              </span>
            </div>
            {sample.client && (
              <div className="m">
                <span className="mk">CLIENTE</span>
                <span className="mv">{sample.client}</span>
              </div>
            )}
            {sample.matrix && (
              <div className="m">
                <span className="mk">MATRIZ</span>
                <span className="mv">{sample.matrix.name}</span>
              </div>
            )}
            {sample.methodIds.length > 0 && (
              <div className="m">
                <span className="mk">MÉTODOS</span>
                <span className="mv font-mono">{sample.methodIds.length}</span>
              </div>
            )}
            <div className="m">
              <span className="mk">RECIBIDA</span>
              <span className="mv font-mono">
                {new Date(sample.receivedAt).toLocaleDateString('es-AR')}
              </span>
            </div>
          </div>
        </div>
        {/* Main actions */}
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start">
          {sample.status === 'RECEIVED' && (
            <button
              type="button"
              onClick={() => changeStatusMutation.mutate('IN_TESTING')}
              disabled={changeStatusMutation.isPending}
              className="syn-btn syn-btn-primary"
            >
              <TestTube2 className="h-3.5 w-3.5" /> Iniciar ensayos
            </button>
          )}
          {sample.status === 'IN_TESTING' && (
            <>
              {(dirtyResults || dirtyConditions) && (
                <button
                  type="button"
                  onClick={() => {
                    if (dirtyResults) saveResultsMutation.mutate()
                    if (dirtyConditions) saveConditionsMutation.mutate()
                  }}
                  disabled={saveResultsMutation.isPending || saveConditionsMutation.isPending}
                  className="syn-btn syn-btn-ghost"
                >
                  <Save className="h-3.5 w-3.5" /> Guardar
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (dirtyResults || dirtyConditions) {
                    toast.error('Guardá los cambios antes de completar')
                    return
                  }
                  changeStatusMutation.mutate('COMPLETED')
                }}
                disabled={changeStatusMutation.isPending}
                className="syn-btn syn-btn-primary"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Completar
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {/* Datos de la muestra */}
        <div className="syn-card">
          <div className="syn-card-head">
            <div>
              <div className="eyebrow">· Datos de la muestra</div>
              <h3 style={{ marginTop: 6 }}>
                Valores <span className="italic">registrados.</span>
              </h3>
            </div>
          </div>
          <div>
            {sample.record.fields
              .filter((f) => f.fieldType !== 'MATRIX_METHOD')
              .map((field, i) => {
                const value = sample.entry.data[field.id]
                const formatted = (() => {
                  if (value === null || value === undefined || value === '') return '—'
                  if (field.fieldType === 'QUANTITY' && typeof value === 'object') {
                    const q = value as { value?: number | string | null; unit?: string | null }
                    if (q.value === null || q.value === undefined || q.value === '') return '—'
                    return `${q.value}${q.unit ? ' ' + q.unit : ''}`
                  }
                  if (field.fieldType === 'DATE' && typeof value === 'string') {
                    return new Date(value).toLocaleDateString('es-AR')
                  }
                  if (typeof value === 'object') return '—'
                  return String(value)
                })()
                return (
                  <div
                    key={field.id}
                    className="flex items-center justify-between px-5 py-3 text-[13px]"
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                    }}
                  >
                    <span style={{ color: 'var(--ink-3)' }}>{field.label}</span>
                    <span className="font-mono" style={{ color: 'var(--ink-0)' }}>
                      {formatted}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Equipos asignados — traceability de instrumentos requeridos por la matriz */}
        {hasRequiredInstruments && (
          <div className="syn-card">
            <div className="syn-card-head">
              <div>
                <div className="eyebrow flex items-center gap-1.5">
                  <Ruler className="h-3 w-3" /> Equipos asignados
                </div>
                <h3 style={{ marginTop: 6 }}>
                  Instrumentos <span className="italic">requeridos.</span>
                </h3>
              </div>
            </div>
            <div style={{ padding: '12px 20px 16px' }} className="space-y-2">
              {(sample.matrix?.requiredInstruments ?? []).map((req) => {
                const assigned = sample.instrumentAssignments.find((a) => a.label === req.label)
                const chip = assigned ? computeConditionChip(assigned.instrument) : null
                const instCode = assigned
                  ? String(Object.values(assigned.instrument.entry.data)[0] ?? assigned.instrument.id.slice(0, 8))
                  : ''
                const isPickerOpen = pickerLabel === req.label
                const usedIds = new Set(
                  sample.instrumentAssignments
                    .filter((a) => a.label !== req.label)
                    .map((a) => a.instrument.id),
                )
                const filteredAvail = realInstruments
                  .filter((i) => !usedIds.has(i.id))
                  .filter((i) => {
                    if (!pickerSearch.trim()) return true
                    const q = pickerSearch.toLowerCase()
                    const codigo = String(Object.values(i.entry.data)[0] ?? '').toLowerCase()
                    return codigo.includes(q) || i.record.name.toLowerCase().includes(q)
                  })
                return (
                  <div
                    key={req.id}
                    className="rounded-[8px] border p-3"
                    style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium" style={{ color: 'var(--ink-0)' }}>
                          {req.label}
                        </div>
                        {assigned ? (
                          <div className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-2)' }}>
                            <Link
                              href={`/instruments/${assigned.instrument.id}`}
                              className="font-mono hover:underline"
                            >
                              {instCode}
                            </Link>
                            <span className="ml-1.5" style={{ color: 'var(--ink-3)' }}>
                              · {assigned.instrument.record.name}
                            </span>
                          </div>
                        ) : (
                          <div className="mt-0.5 text-[12px] italic" style={{ color: 'var(--ink-3)' }}>
                            Sin asignar
                          </div>
                        )}
                      </div>
                      {chip && (
                        <span className={`syn-chip ${chip.cls}`}>{chip.label}</span>
                      )}
                      {isEditable && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (isPickerOpen) {
                                setPickerLabel(null)
                                setPickerSearch('')
                              } else {
                                setPickerLabel(req.label)
                                setPickerSearch('')
                              }
                            }}
                            className="syn-btn syn-btn-subtle"
                            style={{ padding: '6px 10px' }}
                          >
                            {assigned ? 'Cambiar' : 'Asignar'}
                          </button>
                          {assigned && (
                            <button
                              type="button"
                              onClick={() => unassignInstrumentMutation.mutate(assigned.id)}
                              className="syn-btn syn-btn-ghost"
                              style={{ padding: '4px 8px', color: 'var(--danger)' }}
                              aria-label="Quitar"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {isPickerOpen && (
                      <div className="mt-3 space-y-2">
                        <input
                          autoFocus
                          value={pickerSearch}
                          onChange={(e) => setPickerSearch(e.target.value)}
                          placeholder="Buscar por código o registro…"
                          className="syn-input"
                        />
                        <div
                          className="max-h-64 overflow-y-auto rounded-[8px] border"
                          style={{ borderColor: 'var(--line)', background: 'var(--bg-1)' }}
                        >
                          {filteredAvail.length === 0 ? (
                            <div
                              className="px-3 py-6 text-center text-[12px] italic"
                              style={{ color: 'var(--ink-3)' }}
                            >
                              Sin instrumentos disponibles
                            </div>
                          ) : (
                            filteredAvail.map((inst) => {
                              const cchip = computeConditionChip(inst)
                              const code = String(Object.values(inst.entry.data)[0] ?? inst.id.slice(0, 8))
                              return (
                                <button
                                  key={inst.id}
                                  type="button"
                                  onClick={() =>
                                    assignInstrumentMutation.mutate({
                                      label: req.label,
                                      instrumentId: inst.id,
                                      order: req.order,
                                    })
                                  }
                                  disabled={assignInstrumentMutation.isPending}
                                  className="flex w-full items-center gap-2 border-b px-3 py-2 text-left text-[13px] transition-colors last:border-0 hover:bg-[var(--bg-2)]"
                                  style={{ borderColor: 'var(--line)' }}
                                >
                                  <span className="font-mono" style={{ color: 'var(--ink-0)' }}>
                                    {code}
                                  </span>
                                  <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                                    · {inst.record.name}
                                  </span>
                                  <span className={`syn-chip ${cchip.cls} ml-auto`}>{cchip.label}</span>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Condiciones de muestreo */}
        {matrixConditions.length > 0 && (
          <div className="syn-card">
            <div className="syn-card-head">
              <div>
                <div className="eyebrow flex items-center gap-1.5">
                  <ClipboardList className="h-3 w-3" /> Condiciones de muestreo
                </div>
                <h3 style={{ marginTop: 6 }}>
                  Al momento de la <span className="italic">toma.</span>
                </h3>
              </div>
              {isEditable && dirtyConditions && (
                <button
                  type="button"
                  onClick={() => saveConditionsMutation.mutate()}
                  disabled={saveConditionsMutation.isPending}
                  className="syn-btn syn-btn-primary"
                  style={{ padding: '6px 12px' }}
                >
                  {saveConditionsMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Guardar
                </button>
              )}
            </div>
            <div>
              {matrixConditions.map((cond, i) => {
                const value = conditions[cond.id] as string | number | undefined
                return (
                  <div
                    key={cond.id}
                    className="flex items-center justify-between gap-4 px-5 py-3 text-[13px]"
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                    }}
                  >
                    <span style={{ color: 'var(--ink-3)' }}>
                      {cond.label}
                      {cond.unit && (
                        <span
                          className="ml-1 font-mono text-[11px]"
                          style={{ color: 'var(--ink-4)' }}
                        >
                          ({cond.unit})
                        </span>
                      )}
                    </span>
                    {isEditable ? (
                      cond.fieldType === 'DROPDOWN' ? (
                        <select
                          value={(value as string) || ''}
                          onChange={(e) => {
                            setConditions({ ...conditions, [cond.id]: e.target.value })
                            setDirtyConditions(true)
                          }}
                          className="syn-select"
                          style={{ maxWidth: 220 }}
                        >
                          <option value="">Seleccionar…</option>
                          {cond.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={
                            cond.fieldType === 'NUMBER'
                              ? 'number'
                              : cond.fieldType === 'DATE'
                                ? 'date'
                                : 'text'
                          }
                          inputMode={
                            cond.fieldType === 'NUMBER' ? 'decimal' : undefined
                          }
                          value={(value as string) ?? ''}
                          onChange={(e) => {
                            const val =
                              cond.fieldType === 'NUMBER'
                                ? e.target.value
                                  ? parseFloat(e.target.value)
                                  : ''
                                : e.target.value
                            setConditions({ ...conditions, [cond.id]: val })
                            setDirtyConditions(true)
                          }}
                          className="syn-input font-mono"
                          style={{ maxWidth: 220 }}
                        />
                      )
                    ) : (
                      <span className="font-mono" style={{ color: 'var(--ink-0)' }}>
                        {value !== undefined && value !== '' ? String(value) : '—'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Resultados de laboratorio */}
        {parameters.length > 0 ? (
          <div className="syn-card">
            <div className="syn-card-head">
              <div>
                <div className="eyebrow flex items-center gap-1.5">
                  <Microscope className="h-3 w-3" /> Resultados de laboratorio
                </div>
                <h3 style={{ marginTop: 6 }}>
                  {sample.matrix ? sample.matrix.name : 'Sin matriz'}
                  {sample.methodIds.length > 0 && (
                    <span
                      className="ml-2 font-mono text-[13px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      · {sample.methodIds.length} métodos
                    </span>
                  )}
                </h3>
              </div>
              {isEditable && dirtyResults && (
                <button
                  type="button"
                  onClick={() => saveResultsMutation.mutate()}
                  disabled={saveResultsMutation.isPending}
                  className="syn-btn syn-btn-primary"
                  style={{ padding: '6px 12px' }}
                >
                  {saveResultsMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Guardar
                </button>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="syn-table">
                <thead>
                  <tr>
                    <th>Parámetro</th>
                    <th>Resultado</th>
                    <th>Unidad</th>
                    <th style={{ textAlign: 'right' }}>Min</th>
                    <th style={{ textAlign: 'right' }}>Max</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {parameters.map((param) => {
                    const result = results[param.id]
                    const value = result?.value ?? null
                    const resultStatus = getResultStatus(param, value)
                    return (
                      <tr key={param.id}>
                        <td data-label="Parámetro" data-role="identifier">
                          <span style={{ color: 'var(--ink-0)', fontWeight: 500 }}>
                            {param.name}
                          </span>
                          {param.method && (
                            <div
                              className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                              style={{ color: 'var(--ink-3)' }}
                            >
                              {param.method}
                            </div>
                          )}
                          {(isEditable || result?.observations) && (
                            <div className="mt-2">
                              {isEditable ? (
                                <input
                                  value={result?.observations || ''}
                                  onChange={(e) => {
                                    setResults({
                                      ...results,
                                      [param.id]: {
                                        ...results[param.id],
                                        value: result?.value ?? null,
                                        observations: e.target.value,
                                      },
                                    })
                                    setDirtyResults(true)
                                  }}
                                  placeholder="Observaciones…"
                                  className="syn-input"
                                  style={{ fontSize: 12, minHeight: 32, padding: '6px 10px' }}
                                />
                              ) : (
                                <p
                                  className="text-[11.5px]"
                                  style={{ color: 'var(--ink-3)' }}
                                >
                                  Obs: {result?.observations}
                                </p>
                              )}
                            </div>
                          )}
                        </td>
                        <td data-label="Resultado">
                          {isEditable ? (
                            <input
                              type="number"
                              inputMode="decimal"
                              step="any"
                              value={value ?? ''}
                              onChange={(e) => {
                                const v = e.target.value ? parseFloat(e.target.value) : null
                                setResults({
                                  ...results,
                                  [param.id]: { ...results[param.id], value: v },
                                })
                                setDirtyResults(true)
                              }}
                              className="syn-input font-mono"
                              style={{ maxWidth: 140, minHeight: 32, padding: '6px 10px' }}
                            />
                          ) : (
                            <span
                              className="font-mono"
                              style={{
                                color:
                                  resultStatus === 'fail'
                                    ? 'var(--danger)'
                                    : 'var(--ink-0)',
                              }}
                            >
                              {value !== null ? value : '—'}
                            </span>
                          )}
                        </td>
                        <td data-label="Unidad" style={{ color: 'var(--ink-2)' }}>
                          {param.unit || '—'}
                        </td>
                        <td
                          data-label="Min"
                          className="font-mono"
                          style={{ textAlign: 'right', color: 'var(--ink-2)' }}
                        >
                          {param.minValue != null ? param.minValue : '—'}
                        </td>
                        <td
                          data-label="Max"
                          className="font-mono"
                          style={{ textAlign: 'right', color: 'var(--ink-2)' }}
                        >
                          {param.maxValue != null ? param.maxValue : '—'}
                        </td>
                        <td data-label="Estado" data-role="status">
                          {resultStatus === 'pass' ? (
                            <span className="syn-chip syn-chip-ok">Conforme</span>
                          ) : resultStatus === 'fail' ? (
                            <span className="syn-chip syn-chip-fail">No conforme</span>
                          ) : value !== null ? (
                            <span className="syn-chip syn-chip-draft">Sin límite</span>
                          ) : (
                            <span style={{ color: 'var(--ink-4)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="syn-card">
            <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
              <Microscope className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
              <div
                className="text-[20px]"
                style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
              >
                Sin matriz ni <span className="italic">métodos.</span>
              </div>
              <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
                Asigná la matriz y los métodos desde el registro antes de iniciar los ensayos.
              </p>
            </div>
          </div>
        )}

        {/* Footer completado */}
        {sample.status === 'COMPLETED' && (
          <div
            className="rounded-[10px] border px-4 py-3 text-center text-[12.5px]"
            style={{
              background: 'var(--ok-soft)',
              borderColor: 'var(--ok)',
              color: 'var(--ok)',
            }}
          >
            <span
              className="kicker mr-2"
              style={{ color: 'var(--ok)' }}
            >
              · Completada
            </span>
            {sample.completedAt &&
              `el ${new Date(sample.completedAt).toLocaleDateString('es-AR')}`}
            {' — sin acciones disponibles.'}
          </div>
        )}
      </div>
    </div>
  )
}
