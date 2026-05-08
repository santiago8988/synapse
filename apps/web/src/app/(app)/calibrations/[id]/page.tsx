'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Ruler,
  CheckCircle2,
  XCircle,
  Loader2,
  Save,
  ClipboardList,
  RotateCcw,
  CalendarClock,
  AlertTriangle,
  Plus,
  X,
  Search,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

type CalibrationStatus = 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED'

interface CalibrationPoint {
  id: string
  name: string
  order: number
  load: number
  unit: string
}

interface CalibrationTest {
  id: string
  name: string
  description?: string
  order: number
  tolerance: number
  toleranceUnit: string
  readingsPerPoint: number
  formulaError: string
  criteriaOperator: string
  notes?: string
  points: CalibrationPoint[]
}

type InstrumentStatus = 'ACTIVE' | 'IN_CALIBRATION' | 'OUT_OF_SERVICE' | 'DECOMMISSIONED'

interface PatternRef {
  id: string // CalibrationPattern.id (join row id)
  pattern: {
    id: string // Entry.id
    data: Record<string, unknown>
    record: { id: string; name: string }
    instrument: {
      id: string
      status: InstrumentStatus
      nextCalibrationAt: string | null
    } | null
  }
}

interface CalibrationDetail {
  id: string
  status: CalibrationStatus
  results: Record<string, Record<string, { readings: number[]; average: number; error: number; passed: boolean }>> | null
  dueDate: string | null
  createdAt: string
  completedAt: string | null
  patterns: PatternRef[]
  entry: {
    id: string
    data: Record<string, unknown>
    record: {
      id: string
      name: string
      fields: Array<{ id: string; label: string; fieldType: string }>
    }
    instrument: { id: string; status: string } | null
  }
  template: {
    id: string
    name: string
    code: string | null
    unitMain: string
    unitTolerance: string
    tests: CalibrationTest[]
  } | null
}

const statusConfig: Record<CalibrationStatus, { label: string; variant: 'secondary' | 'info' | 'success' | 'destructive' }> = {
  IN_PROGRESS: { label: 'En progreso', variant: 'info' },
  COMPLETED: { label: 'Completada', variant: 'secondary' },
  APPROVED: { label: 'Aprobada', variant: 'success' },
  REJECTED: { label: 'Rechazada', variant: 'destructive' },
}

function calculateError(formulaError: string, average: number, load: number): number {
  try {
    if (!formulaError) return average - load
    const expr = formulaError.toUpperCase()
      .replace(/PROMEDIO/g, String(average))
      .replace(/AVERAGE/g, String(average))
      .replace(/VALOR_PATRON/g, String(load))
      .replace(/VALOR PATRON/g, String(load))
      .replace(/PATRON/g, String(load))
      .replace(/LOAD/g, String(load))
      .replace(/LECTURA/g, String(average))
    const sanitized = expr.replace(/[^0-9+\-*/().  ]/g, '')
    if (!sanitized.trim()) return average - load
    const result = Function(`"use strict"; return (${sanitized})`)()
    return typeof result === 'number' && isFinite(result) ? result : 0
  } catch {
    return average - load
  }
}

function checkPassed(error: number, tolerance: number, criteriaOperator: string): boolean {
  const absError = Math.abs(error)
  switch (criteriaOperator) {
    case 'LTE': return absError <= tolerance
    case 'LT': return absError < tolerance
    case 'GTE': return absError >= tolerance
    case 'GT': return absError > tolerance
    case 'EQ': return absError === tolerance
    default: return absError <= tolerance
  }
}

export default function CalibrationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: calibration, isLoading } = useQuery({
    queryKey: ['calibration', id],
    queryFn: () => api.calibrations.get(id) as Promise<CalibrationDetail>,
  })

  const { data: patterns = [] } = useQuery({
    queryKey: ['instrument-patterns'],
    queryFn: () => api.instruments.patterns() as Promise<Array<{
      id: string
      status: InstrumentStatus
      nextCalibrationAt: string | null
      entry: { id: string; data: Record<string, unknown> }
      record: { id: string; name: string }
    }>>,
  })

  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

  const addPatternMutation = useMutation({
    mutationFn: (patternEntryId: string) => api.calibrations.addPattern(id, patternEntryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration', id] })
      setPickerOpen(false)
      setPickerSearch('')
      toast.success('Patron agregado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const removePatternMutation = useMutation({
    mutationFn: (calibrationPatternId: string) => api.calibrations.removePattern(id, calibrationPatternId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration', id] })
      toast.success('Patron eliminado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  type ResultsMap = Record<string, Record<string, { readings: number[]; average: number; error: number; passed: boolean }>>

  const [results, setResults] = useState<ResultsMap>({})
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (calibration?.results) {
      setResults(calibration.results)
    }
  }, [calibration])

  const saveResultsMutation = useMutation({
    mutationFn: () => api.calibrations.saveResults(id, results),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration', id] })
      setDirty(false)
      toast.success('Resultados guardados')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const changeStatusMutation = useMutation({
    mutationFn: (status: string) => api.calibrations.changeStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibration', id] })
      queryClient.invalidateQueries({ queryKey: ['calibrations'] })
      toast.success('Estado actualizado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Recalculate derived values when readings change
  const recalculate = (
    testId: string,
    pointId: string,
    readings: number[],
    test: CalibrationTest,
    point: CalibrationPoint,
  ) => {
    const validReadings = readings.filter((r) => !isNaN(r))
    const average = validReadings.length > 0 ? validReadings.reduce((a, b) => a + b, 0) / validReadings.length : 0
    const error = validReadings.length > 0 ? calculateError(test.formulaError || '', average, point.load ?? 0) : 0
    const passed = validReadings.length > 0 ? checkPassed(error, test.tolerance, test.criteriaOperator) : false

    setResults((prev) => ({
      ...prev,
      [testId]: {
        ...prev[testId],
        [pointId]: { readings, average, error, passed },
      },
    }))
    setDirty(true)
  }

  // Overall test result
  const getTestResult = (test: CalibrationTest): boolean | null => {
    const testResults = results[test.id]
    if (!testResults) return null
    const allPointsHaveReadings = test.points.every((p) => {
      const pr = testResults[p.id]
      return pr && pr.readings.some((r) => !isNaN(r) && r !== 0)
    })
    if (!allPointsHaveReadings) return null
    return test.points.every((p) => testResults[p.id]?.passed)
  }

  // Overall calibration result
  const overallResult = useMemo(() => {
    if (!calibration?.template?.tests?.length) return null
    const testResults = calibration.template.tests.map((t) => getTestResult(t))
    if (testResults.some((r) => r === null)) return null
    return testResults.every((r) => r === true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, calibration])

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--ink-3)' }} />
      </div>
    )
  }

  if (!calibration) return null

  const st = statusConfig[calibration.status]
  const isEditable = calibration.status === 'IN_PROGRESS'
  const tests = calibration.template?.tests || []
  const codigo = calibration.entry?.data?.CODIGO || calibration.entry?.data?.codigo || '—'

  // Pendiente "visual": IN_PROGRESS sin ninguna lectura cargada
  const hasResults = calibration.results && Object.keys(calibration.results).length > 0
  const isPending = calibration.status === 'IN_PROGRESS' && !hasResults
  const displayLabel = isPending ? 'Pendiente' : st.label
  const displayVariant: 'secondary' | 'info' | 'success' | 'destructive' = isPending ? 'secondary' : st.variant

  // Vencimiento
  const dueDate = calibration.dueDate ? new Date(calibration.dueDate) : null
  const isOverdue =
    !!dueDate &&
    dueDate.getTime() < Date.now() &&
    calibration.status !== 'APPROVED' &&
    calibration.status !== 'REJECTED'
  const daysUntilDue = dueDate
    ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const statusChipCls = isPending
    ? 'syn-chip-draft'
    : calibration.status === 'IN_PROGRESS'
      ? 'syn-chip-active'
      : calibration.status === 'COMPLETED'
        ? 'syn-chip-warn'
        : calibration.status === 'APPROVED'
          ? 'syn-chip-ok'
          : 'syn-chip-fail'

  return (
    <div className="mx-auto max-w-[1280px] fade-in">
      {/* Hero */}
      <div className="syn-rec-hero">
        <div>
          <div className="kicker mb-1.5 flex items-center gap-2">
            <Link
              href="/calibrations"
              className="flex items-center gap-1 hover:text-ink-0"
              onClick={(e) => {
                e.preventDefault()
                router.push('/calibrations')
              }}
            >
              <ArrowLeft className="h-3 w-3" /> Calibraciones
            </Link>
            <span>·</span>
            <span>{String(codigo)}</span>
          </div>
          <h2>
            Calibración <span className="italic">{String(codigo)}.</span>
          </h2>
          <div className="syn-rec-hero-meta">
            <div className="m">
              <span className="mk">ESTADO</span>
              <span className="mv">
                <span className={`syn-chip ${statusChipCls}`}>{displayLabel}</span>
              </span>
            </div>
            {overallResult !== null && (
              <div className="m">
                <span className="mk">RESULTADO</span>
                <span className="mv">
                  <span
                    className={
                      overallResult ? 'syn-chip syn-chip-ok' : 'syn-chip syn-chip-fail'
                    }
                  >
                    {overallResult ? 'APTA' : 'NO APTA'}
                  </span>
                </span>
              </div>
            )}
            {isOverdue && (
              <div className="m">
                <span className="mk">VENCIDA</span>
                <span className="mv">
                  <span className="syn-chip syn-chip-fail">
                    <AlertTriangle className="h-3 w-3" /> Vencida
                  </span>
                </span>
              </div>
            )}
            <div className="m">
              <span className="mk">REGISTRO</span>
              <span className="mv">{calibration.entry.record.name}</span>
            </div>
            {calibration.template && (
              <div className="m">
                <span className="mk">PLANTILLA</span>
                <span className="mv">{calibration.template.name}</span>
              </div>
            )}
            {dueDate && (
              <div className="m">
                <span className="mk">VENCE</span>
                <span
                  className="mv font-mono"
                  style={{
                    color: isOverdue
                      ? 'var(--danger)'
                      : daysUntilDue !== null && daysUntilDue <= 7
                        ? 'var(--warn)'
                        : 'var(--ink-1)',
                  }}
                >
                  {dueDate.toLocaleDateString('es-AR')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        {/* Left wide — datos + ensayos + resultado */}
        <div className="min-w-0 space-y-5">
          {/* Datos de la entrada */}
          <div className="syn-card">
            <div className="syn-card-head">
              <div>
                <div className="eyebrow">· Datos de la calibración</div>
                <h3 style={{ marginTop: 6 }}>
                  Valores <span className="italic">registrados.</span>
                </h3>
              </div>
            </div>
            <div>
              {calibration.entry.record.fields
                .filter((f) => f.fieldType !== 'CALIBRATION_TEMPLATE')
                .map((field, i) => {
                  const value = calibration.entry.data[field.id]
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
                        {value !== null && value !== undefined
                          ? typeof value === 'object'
                            ? `${(value as { value?: number }).value ?? ''} ${
                                (value as { unit?: string }).unit || ''
                              }`.trim()
                            : String(value)
                          : '—'}
                      </span>
                    </div>
                  )
                })}
            </div>
          </div>

          {/* Ensayos */}
          {tests.map((test) => {
            const testResult = getTestResult(test)
            const testResults = results[test.id] || {}
            const opSymbol =
              test.criteriaOperator === 'LTE'
                ? '≤'
                : test.criteriaOperator === 'LT'
                  ? '<'
                  : test.criteriaOperator === 'GTE'
                    ? '≥'
                    : test.criteriaOperator === 'GT'
                      ? '>'
                      : '='

            return (
              <div key={test.id} className="syn-card">
                <div className="syn-card-head">
                  <div style={{ minWidth: 0 }}>
                    <div className="eyebrow flex items-center gap-1.5">
                      <Ruler className="h-3 w-3" /> Ensayo
                      {testResult !== null && (
                        <span
                          className={
                            testResult
                              ? 'syn-chip syn-chip-ok'
                              : 'syn-chip syn-chip-fail'
                          }
                          style={{ marginLeft: 6 }}
                        >
                          {testResult ? 'Conforme' : 'No conforme'}
                        </span>
                      )}
                    </div>
                    <h3 style={{ marginTop: 6 }}>{test.name}</h3>
                    <div
                      className="mt-1 text-[12px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      Tolerancia{' '}
                      <span className="font-mono" style={{ color: 'var(--ink-1)' }}>
                        {test.tolerance} {test.toleranceUnit}
                      </span>{' '}
                      · {test.readingsPerPoint} lecturas/punto · |Error| {opSymbol}{' '}
                      <span className="font-mono">{test.tolerance}</span>
                      {test.formulaError && <> · Error = {test.formulaError}</>}
                    </div>
                    {test.description && (
                      <p
                        className="mt-1 text-[12px]"
                        style={{ color: 'var(--ink-2)' }}
                      >
                        {test.description}
                      </p>
                    )}
                  </div>
                  {isEditable && dirty && (
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
                        <th>Punto</th>
                        <th style={{ textAlign: 'right' }}>Carga</th>
                        {Array.from({ length: test.readingsPerPoint }, (_, i) => (
                          <th key={i} style={{ textAlign: 'center' }}>
                            L{i + 1}
                          </th>
                        ))}
                        <th style={{ textAlign: 'right' }}>Promedio</th>
                        <th style={{ textAlign: 'right' }}>Error</th>
                        <th style={{ textAlign: 'center' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {test.points.map((point) => {
                        const pointResult = testResults[point.id] || {
                          readings: Array(test.readingsPerPoint).fill(0),
                          average: 0,
                          error: 0,
                          passed: false,
                        }
                        const readings =
                          pointResult.readings.length >= test.readingsPerPoint
                            ? pointResult.readings
                            : [
                                ...pointResult.readings,
                                ...Array(
                                  test.readingsPerPoint - pointResult.readings.length,
                                ).fill(0),
                              ]
                        const hasValues = readings.some((r) => r !== 0 && !isNaN(r))

                        return (
                          <tr key={point.id}>
                            <td data-label="Punto" data-role="identifier">
                              <span style={{ color: 'var(--ink-0)', fontWeight: 500 }}>
                                {point.name}
                              </span>
                            </td>
                            <td
                              data-label="Carga"
                              className="font-mono"
                              style={{ textAlign: 'right', color: 'var(--ink-1)' }}
                            >
                              {point.load} {point.unit}
                            </td>
                            {readings.map((reading, ri) => (
                              <td
                                key={ri}
                                data-label={`L${ri + 1}`}
                                style={{ textAlign: 'center' }}
                              >
                                {isEditable ? (
                                  <input
                                    type="number"
                                    inputMode="decimal"
                                    step="any"
                                    value={reading ?? ''}
                                    onChange={(e) => {
                                      const newReadings = [...readings]
                                      newReadings[ri] =
                                        e.target.value !== ''
                                          ? parseFloat(e.target.value)
                                          : 0
                                      recalculate(test.id, point.id, newReadings, test, point)
                                    }}
                                    className="syn-input font-mono"
                                    style={{
                                      width: 78,
                                      minHeight: 32,
                                      padding: '4px 8px',
                                      textAlign: 'center',
                                      fontSize: 12,
                                    }}
                                  />
                                ) : (
                                  <span className="font-mono">{reading || '—'}</span>
                                )}
                              </td>
                            ))}
                            <td
                              data-label="Promedio"
                              className="font-mono"
                              style={{ textAlign: 'right', color: 'var(--ink-1)' }}
                            >
                              {hasValues ? pointResult.average.toFixed(4) : '—'}
                            </td>
                            <td
                              data-label="Error"
                              className="font-mono"
                              style={{
                                textAlign: 'right',
                                color: hasValues && !pointResult.passed
                                  ? 'var(--danger)'
                                  : 'var(--ink-1)',
                              }}
                            >
                              {hasValues
                                ? `${pointResult.error.toFixed(4)} ${test.toleranceUnit}`
                                : '—'}
                            </td>
                            <td
                              data-label="Estado"
                              data-role="status"
                              style={{ textAlign: 'center' }}
                            >
                              {hasValues ? (
                                pointResult.passed ? (
                                  <span className="syn-chip syn-chip-ok">OK</span>
                                ) : (
                                  <span className="syn-chip syn-chip-fail">FALLO</span>
                                )
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
                {test.notes && (
                  <p
                    className="mt-1 px-5 pb-3 text-[12px]"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    Notas: {test.notes}
                  </p>
                )}
              </div>
            )
          })}

          {tests.length === 0 && (
            <div className="syn-card">
              <div
                className="flex flex-col items-center gap-2 px-6 py-14 text-center"
                style={{ color: 'var(--ink-2)' }}
              >
                <Ruler className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
                <div
                  className="text-[20px]"
                  style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
                >
                  Sin <span className="italic">plantilla asignada.</span>
                </div>
                <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
                  Esta calibración no tiene plantilla o la plantilla no tiene ensayos configurados.
                </p>
              </div>
            </div>
          )}

          {/* Resultado general */}
          {tests.length > 0 && (
            <div
              className="rounded-[14px] border px-6 py-5 text-center"
              style={{
                background:
                  overallResult === null
                    ? 'var(--bg-1)'
                    : overallResult
                      ? 'var(--ok-soft)'
                      : 'var(--danger-soft)',
                borderColor:
                  overallResult === null
                    ? 'var(--line)'
                    : overallResult
                      ? 'var(--ok)'
                      : 'var(--danger)',
              }}
            >
              {overallResult === null ? (
                <div
                  className="flex items-center justify-center gap-3 text-[13px]"
                  style={{ color: 'var(--ink-2)' }}
                >
                  <ClipboardList className="h-4 w-4" />
                  Completá todos los ensayos para ver el resultado general
                </div>
              ) : (
                <div className="flex items-center justify-center gap-3">
                  {overallResult ? (
                    <CheckCircle2 className="h-6 w-6" style={{ color: 'var(--ok)' }} />
                  ) : (
                    <XCircle className="h-6 w-6" style={{ color: 'var(--danger)' }} />
                  )}
                  <span
                    className="text-[22px]"
                    style={{
                      fontFamily: 'var(--font-serif)',
                      color: overallResult ? 'var(--ok)' : 'var(--danger)',
                    }}
                  >
                    Calibración{' '}
                    <span className="italic">{overallResult ? 'apta.' : 'no apta.'}</span>
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right narrow — patrones + info + acciones */}
        <div className="space-y-5 min-w-0">
          {/* Patrones utilizados */}
          {(() => {
            const instStatusChip: Record<InstrumentStatus, string> = {
              ACTIVE: 'syn-chip-ok',
              IN_CALIBRATION: 'syn-chip-active',
              OUT_OF_SERVICE: 'syn-chip-fail',
              DECOMMISSIONED: 'syn-chip-draft',
            }
            const instStatusLabel: Record<InstrumentStatus, string> = {
              ACTIVE: 'Activo',
              IN_CALIBRATION: 'En calibración',
              OUT_OF_SERVICE: 'Fuera de servicio',
              DECOMMISSIONED: 'De baja',
            }
            const isLocked = calibration.status === 'APPROVED'
            const usedIds = new Set(calibration.patterns.map((cp) => cp.pattern.id))

            const getCodigo = (data: Record<string, unknown>, fallback: string) =>
              String(Object.values(data || {}).find((v) => typeof v === 'string') || fallback)

            const filteredAvailable = patterns
              .filter((p) => !usedIds.has(p.entry.id))
              .filter((p) => {
                if (!pickerSearch.trim()) return true
                const q = pickerSearch.toLowerCase()
                const codigo = getCodigo(p.entry.data, p.entry.id).toLowerCase()
                return codigo.includes(q) || p.record.name.toLowerCase().includes(q)
              })

            const anyOverdue = calibration.patterns.some((cp) => {
              const next = cp.pattern.instrument?.nextCalibrationAt
              return next && new Date(next).getTime() < Date.now()
            })

            return (
              <div className="syn-card">
                <div className="syn-card-head">
                  <div>
                    <div className="eyebrow flex items-center gap-1.5">
                      <Ruler className="h-3 w-3" /> Patrones · {calibration.patterns.length}
                    </div>
                    <h3 style={{ marginTop: 6 }}>Referencia</h3>
                  </div>
                </div>
                <div style={{ padding: '12px 16px 14px' }} className="space-y-3">
                  {calibration.patterns.length === 0 && (
                    <p
                      className="text-[12.5px] italic"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      Sin patrones agregados
                    </p>
                  )}

                  {calibration.patterns.map((cp) => {
                    const inst = cp.pattern.instrument
                    const pCodigo = getCodigo(cp.pattern.data, cp.pattern.id.slice(0, 8))
                    const pNext = inst?.nextCalibrationAt
                      ? new Date(inst.nextCalibrationAt)
                      : null
                    const pOverdue = !!pNext && pNext.getTime() < Date.now()
                    const pDays = pNext
                      ? Math.ceil((pNext.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                      : null

                    return (
                      <div
                        key={cp.id}
                        className="space-y-2 rounded-[8px] border p-2.5 text-[12px]"
                        style={{
                          background: pOverdue ? 'var(--danger-soft)' : 'var(--bg-2)',
                          borderColor: pOverdue ? 'var(--danger)' : 'var(--line)',
                        }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate text-[13px] font-medium"
                              style={{ color: 'var(--ink-0)' }}
                            >
                              {pCodigo}
                            </p>
                            <p
                              className="truncate text-[11px]"
                              style={{ color: 'var(--ink-3)' }}
                            >
                              {cp.pattern.record.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {inst && (
                              <span
                                className={`syn-chip ${instStatusChip[inst.status]}`}
                                style={{ fontSize: 9 }}
                              >
                                {instStatusLabel[inst.status]}
                              </span>
                            )}
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => removePatternMutation.mutate(cp.id)}
                                disabled={removePatternMutation.isPending}
                                className="rounded p-1 transition-colors"
                                style={{ color: 'var(--ink-3)' }}
                                title="Quitar patrón"
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = 'var(--danger)'
                                  e.currentTarget.style.background = 'var(--bg-3)'
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = 'var(--ink-3)'
                                  e.currentTarget.style.background = 'transparent'
                                }}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {inst && (
                          <Link
                            href={`/instruments/${inst.id}`}
                            className="block font-mono text-[11px] uppercase tracking-[0.14em]"
                            style={{ color: 'var(--primary-hex)' }}
                          >
                            Ver instrumento →
                          </Link>
                        )}

                        {pNext && (
                          <div
                            className="flex items-center gap-1.5 font-mono text-[11px]"
                            style={{
                              color: pOverdue
                                ? 'var(--danger)'
                                : pDays !== null && pDays <= 30
                                  ? 'var(--warn)'
                                  : 'var(--ink-3)',
                              fontWeight: pOverdue ? 500 : 400,
                            }}
                          >
                            {pOverdue ? (
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                            ) : (
                              <CalendarClock className="h-3 w-3 shrink-0" />
                            )}
                            <span>
                              Cal: {pNext.toLocaleDateString('es-AR')}
                              {pDays !== null && (
                                <span className="ml-1 opacity-80">
                                  (
                                  {pOverdue ? `${Math.abs(pDays)}d venc` : `en ${pDays}d`}
                                  )
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {anyOverdue && (
                    <div
                      className="flex items-start gap-1.5 rounded-[8px] border p-2 text-[11.5px]"
                      style={{
                        background: 'var(--danger-soft)',
                        borderColor: 'var(--danger)',
                        color: 'var(--danger)',
                      }}
                    >
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      <span>
                        Hay patrones con calibración vencida. La trazabilidad puede no ser válida.
                      </span>
                    </div>
                  )}

                  {!isLocked && (
                    <>
                      {!pickerOpen ? (
                        <button
                          type="button"
                          onClick={() => setPickerOpen(true)}
                          className="syn-btn syn-btn-ghost w-full justify-center"
                          style={{ padding: '6px 10px', fontSize: 12 }}
                        >
                          <Plus className="h-3 w-3" /> Agregar patrón
                        </button>
                      ) : (
                        <div
                          className="space-y-2 rounded-[8px] border p-2"
                          style={{
                            background: 'var(--bg-1)',
                            borderColor: 'var(--line)',
                          }}
                        >
                          <div className="relative">
                            <Search
                              className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2"
                              style={{ color: 'var(--ink-3)' }}
                            />
                            <input
                              autoFocus
                              type="search"
                              placeholder="Buscar por código o registro…"
                              value={pickerSearch}
                              onChange={(e) => setPickerSearch(e.target.value)}
                              className="syn-input"
                              style={{
                                minHeight: 30,
                                padding: '4px 8px 4px 24px',
                                fontSize: 12,
                              }}
                            />
                          </div>
                          <div
                            className="max-h-60 overflow-y-auto rounded-[6px] border"
                            style={{ borderColor: 'var(--line)' }}
                          >
                            {filteredAvailable.length === 0 ? (
                              <p
                                className="px-2 py-3 text-center text-[11px]"
                                style={{ color: 'var(--ink-3)' }}
                              >
                                {patterns.length === 0
                                  ? 'No hay patrones cargados'
                                  : usedIds.size === patterns.length
                                    ? 'Todos ya agregados'
                                    : 'Sin coincidencias'}
                              </p>
                            ) : (
                              filteredAvailable.map((p, i) => {
                                const codigo = getCodigo(p.entry.data, p.entry.id.slice(0, 8))
                                const pNext = p.nextCalibrationAt
                                  ? new Date(p.nextCalibrationAt)
                                  : null
                                const pOverdue = !!pNext && pNext.getTime() < Date.now()
                                return (
                                  <button
                                    key={p.entry.id}
                                    type="button"
                                    onClick={() => addPatternMutation.mutate(p.entry.id)}
                                    disabled={addPatternMutation.isPending}
                                    className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-[12px] transition-colors disabled:opacity-50"
                                    style={{
                                      borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                                      color: 'var(--ink-1)',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = 'var(--bg-3)'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent'
                                    }}
                                  >
                                    <div className="min-w-0">
                                      <p
                                        className="truncate font-medium"
                                        style={{ color: 'var(--ink-0)' }}
                                      >
                                        {codigo}
                                      </p>
                                      <p
                                        className="truncate text-[10px]"
                                        style={{ color: 'var(--ink-3)' }}
                                      >
                                        {p.record.name}
                                      </p>
                                    </div>
                                    {pOverdue && (
                                      <span
                                        className="syn-chip syn-chip-fail shrink-0"
                                        style={{ fontSize: 9 }}
                                      >
                                        VENCIDO
                                      </span>
                                    )}
                                  </button>
                                )
                              })
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setPickerOpen(false)
                              setPickerSearch('')
                            }}
                            className="syn-btn syn-btn-subtle w-full justify-center"
                            style={{ padding: '4px 10px', fontSize: 12 }}
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Información */}
          <div className="syn-card">
            <div className="syn-card-head">
              <div>
                <div className="eyebrow">· Información</div>
                <h3 style={{ marginTop: 6 }}>Datos clave</h3>
              </div>
            </div>
            <div>
              <InfoRow
                label="Estado"
                value={<span className={`syn-chip ${statusChipCls}`}>{displayLabel}</span>}
              />
              <InfoRow
                label="Registro"
                value={
                  <Link
                    href={`/records/${calibration.entry.record.id}`}
                    className="underline-offset-2 hover:underline"
                    style={{ color: 'var(--primary-hex)' }}
                  >
                    {calibration.entry.record.name}
                  </Link>
                }
              />
              {calibration.template && (
                <InfoRow label="Plantilla" value={calibration.template.name} />
              )}
              <InfoRow
                label="Creada"
                value={
                  <span className="font-mono">
                    {new Date(calibration.createdAt).toLocaleDateString('es-AR')}
                  </span>
                }
              />
              {dueDate && (
                <InfoRow
                  label="Vence"
                  value={
                    <span
                      className="font-mono"
                      style={{
                        color: isOverdue
                          ? 'var(--danger)'
                          : daysUntilDue !== null && daysUntilDue <= 7
                            ? 'var(--warn)'
                            : 'var(--ink-0)',
                        fontWeight: isOverdue ? 500 : 400,
                      }}
                    >
                      {dueDate.toLocaleDateString('es-AR')}
                    </span>
                  }
                />
              )}
              {calibration.completedAt && (
                <InfoRow
                  label="Completada"
                  value={
                    <span className="font-mono">
                      {new Date(calibration.completedAt).toLocaleDateString('es-AR')}
                    </span>
                  }
                />
              )}
              {overallResult !== null && (
                <InfoRow
                  label="Resultado"
                  value={
                    <span
                      className={
                        overallResult
                          ? 'syn-chip syn-chip-ok'
                          : 'syn-chip syn-chip-fail'
                      }
                    >
                      {overallResult ? 'Apta' : 'No apta'}
                    </span>
                  }
                />
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="syn-card">
            <div className="syn-card-head">
              <div>
                <div className="eyebrow">· Acciones</div>
                <h3 style={{ marginTop: 6 }}>
                  Ciclo de <span className="italic">calibración.</span>
                </h3>
              </div>
            </div>
            <div style={{ padding: '14px 16px 16px' }} className="space-y-2">
              {calibration.status === 'IN_PROGRESS' && (
                <>
                  {dirty && (
                    <button
                      type="button"
                      onClick={() => saveResultsMutation.mutate()}
                      disabled={saveResultsMutation.isPending}
                      className="syn-btn syn-btn-ghost w-full justify-center"
                    >
                      <Save className="h-3.5 w-3.5" /> Guardar resultados
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (dirty) {
                        toast.error('Guardá los resultados antes de completar')
                        return
                      }
                      changeStatusMutation.mutate('COMPLETED')
                    }}
                    disabled={changeStatusMutation.isPending}
                    className="syn-btn syn-btn-primary w-full justify-center"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Completar
                  </button>
                </>
              )}

              {calibration.status === 'COMPLETED' && (
                <>
                  <button
                    type="button"
                    onClick={() => changeStatusMutation.mutate('APPROVED')}
                    disabled={changeStatusMutation.isPending}
                    className="syn-btn syn-btn-primary w-full justify-center"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
                  </button>
                  <button
                    type="button"
                    onClick={() => changeStatusMutation.mutate('REJECTED')}
                    disabled={changeStatusMutation.isPending}
                    className="syn-btn syn-btn-ghost w-full justify-center"
                    style={{ color: 'var(--danger)' }}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Rechazar
                  </button>
                  <button
                    type="button"
                    onClick={() => changeStatusMutation.mutate('IN_PROGRESS')}
                    disabled={changeStatusMutation.isPending}
                    className="syn-btn syn-btn-ghost w-full justify-center"
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reiniciar
                  </button>
                </>
              )}

              {calibration.status === 'APPROVED' && (
                <p
                  className="text-center text-[12px]"
                  style={{ color: 'var(--ink-3)' }}
                >
                  Calibración aprobada — sin acciones.
                </p>
              )}

              {calibration.status === 'REJECTED' && (
                <button
                  type="button"
                  onClick={() => changeStatusMutation.mutate('IN_PROGRESS')}
                  disabled={changeStatusMutation.isPending}
                  className="syn-btn syn-btn-ghost w-full justify-center"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reiniciar
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-2.5 text-[13px]"
      style={{ borderTop: '1px solid var(--line)' }}
    >
      <span style={{ color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ color: 'var(--ink-0)' }}>{value}</span>
    </div>
  )
}
