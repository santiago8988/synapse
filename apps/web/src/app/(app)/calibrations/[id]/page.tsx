'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ScanLine,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/calibrations')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Calibración {String(codigo)}</h1>
            <Badge variant={displayVariant}>{displayLabel}</Badge>
            {isOverdue && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" />
                Vencida
              </Badge>
            )}
            {overallResult !== null && (
              <Badge variant={overallResult ? 'success' : 'destructive'}>
                {overallResult ? 'APTA' : 'NO APTA'}
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {calibration.entry.record.name}
            {calibration.template && <> &middot; Plantilla: {calibration.template.name}</>}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos de la entrada */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos de la calibración</CardTitle>
              <CardDescription>Valores registrados al crear la calibración</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y rounded-lg border">
                {calibration.entry.record.fields
                  .filter((f) => f.fieldType !== 'CALIBRATION_TEMPLATE')
                  .map((field) => {
                    const value = calibration.entry.data[field.id]
                    return (
                      <div key={field.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">{field.label}</span>
                        <span className="font-mono">
                          {value !== null && value !== undefined
                            ? (typeof value === 'object'
                              ? `${(value as { value?: number }).value ?? ''} ${(value as { unit?: string }).unit || ''}`.trim()
                              : String(value))
                            : '—'}
                        </span>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Ensayos de calibración */}
          {tests.map((test) => {
            const testResult = getTestResult(test)
            const testResults = results[test.id] || {}

            return (
              <Card key={test.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Ruler className="h-4 w-4" />
                      {test.name}
                      {testResult !== null && (
                        <Badge variant={testResult ? 'success' : 'destructive'} className="text-xs">
                          {testResult ? 'Conforme' : 'No conforme'}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      Tolerancia: {test.tolerance} {test.toleranceUnit} &middot; {test.readingsPerPoint} lecturas/punto &middot; Criterio: |Error| {test.criteriaOperator === 'LTE' ? '≤' : test.criteriaOperator === 'LT' ? '<' : test.criteriaOperator === 'GTE' ? '≥' : test.criteriaOperator === 'GT' ? '>' : '='} {test.tolerance}
                      {test.formulaError && <> &middot; Error = {test.formulaError}</>}
                      {test.description && <> &middot; {test.description}</>}
                    </CardDescription>
                  </div>
                  {isEditable && dirty && (
                    <Button
                      size="sm"
                      onClick={() => saveResultsMutation.mutate()}
                      disabled={saveResultsMutation.isPending}
                    >
                      {saveResultsMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                      Guardar
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg border overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/30">
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Punto</th>
                          <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Carga</th>
                          {Array.from({ length: test.readingsPerPoint }, (_, i) => (
                            <th key={i} className="px-3 py-2.5 text-center font-medium text-muted-foreground">
                              L{i + 1}
                            </th>
                          ))}
                          <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Promedio</th>
                          <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Error</th>
                          <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {test.points.map((point) => {
                          const pointResult = testResults[point.id] || { readings: Array(test.readingsPerPoint).fill(0), average: 0, error: 0, passed: false }
                          const readings = pointResult.readings.length >= test.readingsPerPoint
                            ? pointResult.readings
                            : [...pointResult.readings, ...Array(test.readingsPerPoint - pointResult.readings.length).fill(0)]
                          const hasValues = readings.some((r) => r !== 0 && !isNaN(r))

                          return (
                            <tr key={point.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-2.5 font-medium">{point.name}</td>
                              <td className="px-3 py-2.5 text-right font-mono">{point.load} {point.unit}</td>
                              {readings.map((reading, ri) => (
                                <td key={ri} className="px-3 py-2.5 text-center">
                                  {isEditable ? (
                                    <input
                                      type="number"
                                      step="any"
                                      value={reading ?? ''}
                                      onChange={(e) => {
                                        const newReadings = [...readings]
                                        newReadings[ri] = e.target.value !== '' ? parseFloat(e.target.value) : 0
                                        recalculate(test.id, point.id, newReadings, test, point)
                                      }}
                                      className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm font-mono text-center focus:outline-none focus:ring-1 focus:ring-ring"
                                    />
                                  ) : (
                                    <span className="font-mono">{reading || '—'}</span>
                                  )}
                                </td>
                              ))}
                              <td className="px-3 py-2.5 text-right font-mono">
                                {hasValues ? pointResult.average.toFixed(4) : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono">
                                {hasValues ? `${pointResult.error.toFixed(4)} ${test.toleranceUnit}` : '—'}
                              </td>
                              <td className="px-3 py-2.5 text-center">
                                {hasValues ? (
                                  pointResult.passed ? (
                                    <Badge variant="success" className="text-xs">OK</Badge>
                                  ) : (
                                    <Badge variant="destructive" className="text-xs">FALLO</Badge>
                                  )
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {test.notes && (
                    <p className="mt-2 text-xs text-muted-foreground">Notas: {test.notes}</p>
                  )}
                </CardContent>
              </Card>
            )
          })}

          {tests.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Ruler className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Esta calibración no tiene plantilla asignada o la plantilla no tiene ensayos.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Resultado general */}
          {tests.length > 0 && (
            <Card>
              <CardContent className="py-6">
                <div className="flex items-center justify-center gap-3">
                  {overallResult === null ? (
                    <>
                      <ClipboardList className="h-6 w-6 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Complete todos los ensayos para ver el resultado general</span>
                    </>
                  ) : overallResult ? (
                    <>
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                      <span className="text-lg font-bold text-emerald-600">CALIBRACIÓN APTA</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-6 w-6 text-red-600" />
                      <span className="text-lg font-bold text-red-600">CALIBRACIÓN NO APTA</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Patrones utilizados */}
          {(() => {
            const statusBadge: Record<InstrumentStatus, { label: string; variant: 'success' | 'info' | 'destructive' | 'secondary' }> = {
              ACTIVE: { label: 'Activo', variant: 'success' },
              IN_CALIBRATION: { label: 'En calibracion', variant: 'info' },
              OUT_OF_SERVICE: { label: 'Fuera de servicio', variant: 'destructive' },
              DECOMMISSIONED: { label: 'De baja', variant: 'secondary' },
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
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Ruler className="h-4 w-4" />
                    Patrones utilizados
                    {calibration.patterns.length > 0 && (
                      <span className="text-xs font-normal text-muted-foreground">({calibration.patterns.length})</span>
                    )}
                  </CardTitle>
                  <CardDescription>Patrones de referencia usados en esta calibracion</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {calibration.patterns.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">Sin patrones agregados</p>
                  )}

                  {calibration.patterns.map((cp) => {
                    const inst = cp.pattern.instrument
                    const pCodigo = getCodigo(cp.pattern.data, cp.pattern.id.slice(0, 8))
                    const pNext = inst?.nextCalibrationAt ? new Date(inst.nextCalibrationAt) : null
                    const pOverdue = !!pNext && pNext.getTime() < Date.now()
                    const pDays = pNext ? Math.ceil((pNext.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
                    const sb = inst ? statusBadge[inst.status] : null

                    return (
                      <div
                        key={cp.id}
                        className={`rounded-md border p-3 text-xs space-y-2 ${pOverdue ? 'border-red-200 bg-red-50/50' : 'bg-muted/30'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-foreground truncate">{pCodigo}</p>
                            <p className="text-muted-foreground truncate">{cp.pattern.record.name}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {sb && <Badge variant={sb.variant} className="text-[10px]">{sb.label}</Badge>}
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => removePatternMutation.mutate(cp.id)}
                                disabled={removePatternMutation.isPending}
                                className="rounded p-1 text-muted-foreground hover:bg-background hover:text-destructive"
                                title="Quitar patron"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {inst && (
                          <Link
                            href={`/instruments/${inst.id}`}
                            className="block text-primary hover:underline"
                          >
                            Ver instrumento →
                          </Link>
                        )}

                        {pNext && (
                          <div
                            className={`flex items-center gap-1.5 ${
                              pOverdue
                                ? 'text-red-600 font-medium'
                                : pDays !== null && pDays <= 30
                                ? 'text-amber-600 font-medium'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {pOverdue ? (
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span>
                              Proxima cal: {pNext.toLocaleDateString('es-AR')}
                              {pDays !== null && (
                                <span className="ml-1 opacity-80">
                                  ({pOverdue ? `${Math.abs(pDays)} d vencido` : `en ${pDays} d`})
                                </span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {anyOverdue && (
                    <div className="flex items-start gap-1.5 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                      <span>Hay al menos un patron con su calibracion vencida. La trazabilidad de esta medicion puede no ser valida.</span>
                    </div>
                  )}

                  {!isLocked && (
                    <>
                      {!pickerOpen ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => setPickerOpen(true)}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" />
                          Agregar patron
                        </Button>
                      ) : (
                        <div className="rounded-md border bg-background p-2 space-y-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <input
                              autoFocus
                              type="text"
                              placeholder="Buscar por codigo o registro..."
                              value={pickerSearch}
                              onChange={(e) => setPickerSearch(e.target.value)}
                              className="flex h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          </div>
                          <div className="max-h-60 overflow-y-auto rounded border divide-y">
                            {filteredAvailable.length === 0 ? (
                              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                                {patterns.length === 0
                                  ? 'No hay patrones cargados en el sistema'
                                  : usedIds.size === patterns.length
                                  ? 'Todos los patrones ya estan agregados'
                                  : 'No hay coincidencias'}
                              </p>
                            ) : (
                              filteredAvailable.map((p) => {
                                const codigo = getCodigo(p.entry.data, p.entry.id.slice(0, 8))
                                const pNext = p.nextCalibrationAt ? new Date(p.nextCalibrationAt) : null
                                const pOverdue = !!pNext && pNext.getTime() < Date.now()
                                return (
                                  <button
                                    key={p.entry.id}
                                    type="button"
                                    onClick={() => addPatternMutation.mutate(p.entry.id)}
                                    disabled={addPatternMutation.isPending}
                                    className="flex w-full items-center justify-between gap-2 px-2 py-1.5 text-left text-xs hover:bg-muted disabled:opacity-50"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-medium truncate">{codigo}</p>
                                      <p className="text-[10px] text-muted-foreground truncate">{p.record.name}</p>
                                    </div>
                                    {pOverdue && (
                                      <Badge variant="destructive" className="text-[9px] shrink-0">VENCIDO</Badge>
                                    )}
                                  </button>
                                )
                              })
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              setPickerOpen(false)
                              setPickerSearch('')
                            }}
                          >
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            )
          })()}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informacion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado</span>
                <Badge variant={displayVariant}>{displayLabel}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registro</span>
                <Link href={`/records/${calibration.entry.record.id}`} className="text-primary hover:underline">
                  {calibration.entry.record.name}
                </Link>
              </div>
              {calibration.template && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plantilla</span>
                  <span>{calibration.template.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creada</span>
                <span>{new Date(calibration.createdAt).toLocaleDateString('es-AR')}</span>
              </div>
              {dueDate && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <CalendarClock className="h-3.5 w-3.5" />
                    Vencimiento
                  </span>
                  <span className={isOverdue ? 'font-medium text-red-600' : daysUntilDue !== null && daysUntilDue <= 7 ? 'font-medium text-amber-600' : ''}>
                    {dueDate.toLocaleDateString('es-AR')}
                    {daysUntilDue !== null && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({isOverdue ? `${Math.abs(daysUntilDue)} d vencida` : `en ${daysUntilDue} d`})
                      </span>
                    )}
                  </span>
                </div>
              )}
              {calibration.completedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completada</span>
                  <span>{new Date(calibration.completedAt).toLocaleDateString('es-AR')}</span>
                </div>
              )}
              {overallResult !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resultado</span>
                  <Badge variant={overallResult ? 'success' : 'destructive'}>
                    {overallResult ? 'Apta' : 'No apta'}
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {calibration.status === 'IN_PROGRESS' && (
                <>
                  {dirty && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => saveResultsMutation.mutate()}
                      disabled={saveResultsMutation.isPending}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Guardar resultados
                    </Button>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (dirty) {
                        toast.error('Guarda los resultados antes de completar')
                        return
                      }
                      changeStatusMutation.mutate('COMPLETED')
                    }}
                    disabled={changeStatusMutation.isPending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Completar calibración
                  </Button>
                </>
              )}

              {calibration.status === 'COMPLETED' && (
                <>
                  <Button
                    className="w-full"
                    onClick={() => changeStatusMutation.mutate('APPROVED')}
                    disabled={changeStatusMutation.isPending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Aprobar
                  </Button>
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={() => changeStatusMutation.mutate('REJECTED')}
                    disabled={changeStatusMutation.isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rechazar
                  </Button>
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => changeStatusMutation.mutate('IN_PROGRESS')}
                    disabled={changeStatusMutation.isPending}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reiniciar
                  </Button>
                </>
              )}

              {calibration.status === 'APPROVED' && (
                <p className="text-xs text-center text-muted-foreground">
                  Calibración aprobada — sin acciones disponibles
                </p>
              )}

              {calibration.status === 'REJECTED' && (
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => changeStatusMutation.mutate('IN_PROGRESS')}
                  disabled={changeStatusMutation.isPending}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reiniciar
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
