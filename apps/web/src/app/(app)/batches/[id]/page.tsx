'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Loader2,
  FlaskConical,
  Ruler,
  X,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import { computeConditionChip } from '@/lib/instrument-condition'

type BatchStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED'

interface BatchDetail {
  id: string
  lotNumber: string
  status: BatchStatus
  producedQuantity: number | null
  unit: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  record: { id: string; name: string; fields: Array<{ id: string; label: string; fieldType: string }> }
  recipe: {
    id: string
    name: string
    code: string | null
    ingredients: Array<{ name: string; quantity: number; unit: string; order: number; fromStock: boolean; stockRecipeId: string | null; stockRecipe: { id: string; name: string } | null }>
    steps: Array<{ order: number; name: string; description: string | null; duration: number | null; controls: string | null }>
    requiredInstruments?: Array<{ id: string; label: string; order: number }>
  } | null
  entry: { id: string; data: Record<string, unknown>; recordVersion: number }
  statusLogs: Array<{
    id: string
    fromStatus: string
    toStatus: string
    reason: string | null
    changedById: string
    changedAt: string
  }>
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
}

const statusConfig: Record<BatchStatus, { label: string; variant: 'secondary' | 'info' | 'success' | 'warning' | 'destructive' }> = {
  PLANNED: { label: 'Planificado', variant: 'secondary' },
  IN_PROGRESS: { label: 'En producción', variant: 'info' },
  COMPLETED: { label: 'Completado', variant: 'warning' },
  APPROVED: { label: 'Aprobado', variant: 'success' },
  REJECTED: { label: 'Rechazado', variant: 'destructive' },
}

export default function BatchDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [producedQuantity, setProducedQuantity] = useState<string>('')
  const [unit, setUnit] = useState<string>('')
  const [showCompleteForm, setShowCompleteForm] = useState(false)
  const [showStartCheck, setShowStartCheck] = useState(false)
  const [completeConsumptions, setCompleteConsumptions] = useState<Array<{ ingredientName: string; product: string; lotNumber: string; quantity: number; unit: string }>>([])
  // Legacy (PLANNED→IN_PROGRESS con stockRecipeId) — ya no se usa pero se deja por compat
  const [showStockConsumption, setShowStockConsumption] = useState(false)
  const [consumptions, setConsumptions] = useState<Array<{ ingredientName: string; product: string; lotNumber: string; quantity: number; unit: string }>>([])

  const { data: batch, isLoading } = useQuery({
    queryKey: ['batch', id],
    queryFn: () => api.batches.get(id) as Promise<BatchDetail>,
  })

  // Mapa de matrices (para resolver MATRIX_METHOD). Solo se carga cuando el
  // record tiene al menos un campo de ese tipo.
  const hasMatrixMethodField = batch?.record.fields.some((f) => f.fieldType === 'MATRIX_METHOD')
  const { data: matricesMap = {} } = useQuery({
    queryKey: ['matrices-map'],
    queryFn: async () => {
      const list = (await api.matrices.list()) as Array<{ id: string; name: string; code: string | null }>
      const map: Record<string, { name: string; code: string | null }> = {}
      for (const m of list) map[m.id] = { name: m.name, code: m.code }
      return map
    },
    enabled: !!hasMatrixMethodField,
  })

  const hasCalibrationTemplateField = batch?.record.fields.some(
    (f) => f.fieldType === 'CALIBRATION_TEMPLATE',
  )
  const { data: calibrationTemplatesMap = {} } = useQuery({
    queryKey: ['calibration-templates-map'],
    queryFn: async () => {
      const list = (await api.calibrationTemplates.list()) as Array<{ id: string; name: string; code: string | null }>
      const map: Record<string, { name: string; code: string | null }> = {}
      for (const t of list) map[t.id] = { name: t.name, code: t.code }
      return map
    },
    enabled: !!hasCalibrationTemplateField,
  })

  const changeStatusMutation = useMutation({
    mutationFn: (data: { status: string; producedQuantity?: number; unit?: string }) =>
      api.batches.changeStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', id] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] })
      setShowCompleteForm(false)
      toast.success('Estado actualizado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const consumeStockMutation = useMutation({
    mutationFn: () => api.batches.consumeStock(id, consumptions),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', id] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] })
      setShowStockConsumption(false)
      toast.success('Stock consumido — producción iniciada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // Chequeo pre-flight de stock (PLANNED → IN_PROGRESS)
  interface StockCheckResult {
    allSufficient: boolean
    ingredients: Array<{
      ingredientName: string
      product: string
      recipeQuantity: number
      unit: string
      totalBalance: number
      lots: Array<{ lotNumber: string; balance: number; unit: string | null }>
      sufficient: boolean
    }>
  }
  const { data: stockCheck, isFetching: stockCheckLoading } = useQuery<StockCheckResult>({
    queryKey: ['batch-stock-check', id],
    queryFn: () => api.batches.checkStock(id) as Promise<StockCheckResult>,
    enabled: showStartCheck,
  })

  const startProductionMutation = useMutation({
    mutationFn: () => api.batches.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', id] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      setShowStartCheck(false)
      toast.success('Producción iniciada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const completeProductionMutation = useMutation({
    mutationFn: (data: { producedQuantity: number; unit: string; consumptions: Array<{ product: string; lotNumber: string; quantity: number; unit: string }> }) =>
      api.batches.complete(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', id] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] })
      setShowCompleteForm(false)
      setCompleteConsumptions([])
      setProducedQuantity('')
      setUnit('')
      toast.success('Lote completado — EGRESOs registrados')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  // ── Traceability: instrumentos reales + assign/unassign ──
  const hasRequiredInstruments = (batch?.recipe?.requiredInstruments?.length ?? 0) > 0
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
      api.batches.assignInstrument(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', id] })
      setPickerLabel(null)
      setPickerSearch('')
      toast.success('Instrumento asignado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const unassignInstrumentMutation = useMutation({
    mutationFn: (assignmentId: string) => api.batches.unassignInstrument(id, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batch', id] })
      toast.success('Instrumento removido')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!batch) return null

  /** Renderiza el valor crudo de entry.data según el tipo del campo. */
  const formatFieldValue = (fieldType: string, value: unknown): string => {
    if (value === null || value === undefined || value === '') return '—'
    if (fieldType === 'DATE' && typeof value === 'string') {
      return new Date(value).toLocaleDateString('es-AR')
    }
    if (fieldType === 'QUANTITY' && typeof value === 'object') {
      const q = value as { value?: number | string | null; unit?: string | null }
      if (q.value === null || q.value === undefined || q.value === '') return '—'
      return `${q.value}${q.unit ? ' ' + q.unit : ''}`
    }
    if (fieldType === 'RECIPE_SELECT' && typeof value === 'string') {
      // Para BATCH records, batch.recipe ya viene cargado desde el backend.
      if (batch.recipe && batch.recipe.id === value) {
        return batch.recipe.code
          ? `${batch.recipe.code} · ${batch.recipe.name}`
          : batch.recipe.name
      }
      return value.slice(-8).toUpperCase()
    }
    if (fieldType === 'MATRIX_METHOD' && typeof value === 'object') {
      const mm = value as { matrixId?: string; methodIds?: string[] }
      if (!mm.matrixId) return '—'
      const matrix = matricesMap[mm.matrixId]
      const matrixLabel = matrix
        ? (matrix.code ? `${matrix.code} · ${matrix.name}` : matrix.name)
        : mm.matrixId.slice(-8).toUpperCase()
      const methodCount = mm.methodIds?.length ?? 0
      return methodCount > 0
        ? `${matrixLabel} · ${methodCount} método${methodCount === 1 ? '' : 's'}`
        : matrixLabel
    }
    if (fieldType === 'CALIBRATION_TEMPLATE' && typeof value === 'string') {
      const tpl = calibrationTemplatesMap[value]
      if (tpl) return tpl.code ? `${tpl.code} · ${tpl.name}` : tpl.name
      return value.slice(-8).toUpperCase()
    }
    if (typeof value === 'object') return JSON.stringify(value)
    return String(value)
  }

  const st = statusConfig[batch.status]
  const statusChipCls =
    batch.status === 'PLANNED'
      ? 'syn-chip-draft'
      : batch.status === 'IN_PROGRESS'
        ? 'syn-chip-active'
        : batch.status === 'COMPLETED'
          ? 'syn-chip-warn'
          : batch.status === 'APPROVED'
            ? 'syn-chip-ok'
            : 'syn-chip-fail'

  return (
    <div className="mx-auto max-w-[1280px] fade-in">
      {/* Hero */}
      <div className="syn-rec-hero">
        <div>
          <div className="kicker mb-1.5 flex items-center gap-2">
            <Link
              href="/batches"
              className="flex items-center gap-1 hover:text-ink-0"
              onClick={(e) => {
                e.preventDefault()
                router.push('/batches')
              }}
            >
              <ArrowLeft className="h-3 w-3" /> Lotes
            </Link>
            <span>·</span>
            <span>{batch.lotNumber}</span>
          </div>
          <h2>
            Lote <span className="italic">{batch.lotNumber}.</span>
          </h2>
          <div className="syn-rec-hero-meta">
            <div className="m">
              <span className="mk">ESTADO</span>
              <span className="mv">
                <span className={`syn-chip ${statusChipCls}`}>{st.label}</span>
              </span>
            </div>
            <div className="m">
              <span className="mk">REGISTRO</span>
              <span className="mv">
                <Link
                  href={`/records/${batch.record.id}`}
                  className="inline-flex items-center gap-1 hover:text-ink-0"
                  style={{ color: 'var(--primary-hex)' }}
                >
                  {batch.record.name}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </span>
            </div>
            {batch.recipe && (
              <div className="m">
                <span className="mk">FÓRMULA</span>
                <span className="mv">{batch.recipe.name}</span>
              </div>
            )}
            {batch.startedAt && (
              <div className="m">
                <span className="mk">INICIO</span>
                <span className="mv font-mono">
                  {new Date(batch.startedAt).toLocaleDateString('es-AR')}
                </span>
              </div>
            )}
            {batch.completedAt && (
              <div className="m">
                <span className="mk">COMPLETADO</span>
                <span className="mv font-mono">
                  {new Date(batch.completedAt).toLocaleDateString('es-AR')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="syn-rec-grid">
        {/* Left — actions + status timeline */}
        <div className="space-y-5 min-w-0">
          {/* Acciones */}
          <div className="syn-card">
            <div className="syn-card-head">
              <div>
                <div className="eyebrow">· Acciones</div>
                <h3 style={{ marginTop: 6 }}>
                  Ciclo de <span className="italic">producción.</span>
                </h3>
              </div>
            </div>
            <div className="space-y-2" style={{ padding: '16px 20px' }}>
              {batch.status === 'PLANNED' && !showStartCheck && (
                <button
                  type="button"
                  className="syn-btn syn-btn-primary w-full justify-center"
                  onClick={() => setShowStartCheck(true)}
                >
                  Verificar e iniciar
                </button>
              )}

              {batch.status === 'PLANNED' && showStartCheck && (
                <StartCheckPanel
                  loading={stockCheckLoading}
                  check={stockCheck}
                  onStart={() => startProductionMutation.mutate()}
                  onCancel={() => setShowStartCheck(false)}
                  isPending={startProductionMutation.isPending}
                />
              )}

              {batch.status === 'IN_PROGRESS' && !showCompleteForm && (
                <button
                  type="button"
                  className="syn-btn syn-btn-primary w-full justify-center"
                  onClick={() => {
                    const stockIngredients =
                      batch.recipe?.ingredients.filter((i) => i.fromStock) || []
                    setCompleteConsumptions(
                      stockIngredients.map((i) => ({
                        ingredientName: i.name,
                        product: i.name.toUpperCase(),
                        lotNumber: '',
                        quantity: i.quantity,
                        unit: i.unit,
                      })),
                    )
                    setShowCompleteForm(true)
                  }}
                >
                  Completar producción
                </button>
              )}

              {showCompleteForm && (
                <CompleteProductionForm
                  producedQuantity={producedQuantity}
                  setProducedQuantity={setProducedQuantity}
                  unit={unit}
                  setUnit={setUnit}
                  consumptions={completeConsumptions}
                  setConsumptions={setCompleteConsumptions}
                  onConfirm={() => {
                    if (!producedQuantity) {
                      toast.error('Ingresá la cantidad producida')
                      return
                    }
                    if (!unit) {
                      toast.error('Elegí la unidad de la cantidad producida')
                      return
                    }
                    if (completeConsumptions.some((c) => !c.lotNumber)) {
                      toast.error('Seleccioná lote para cada ingrediente de stock')
                      return
                    }
                    completeProductionMutation.mutate({
                      producedQuantity: parseFloat(producedQuantity),
                      unit,
                      consumptions: completeConsumptions.map((c) => ({
                        product: c.product,
                        lotNumber: c.lotNumber,
                        quantity: c.quantity,
                        unit: c.unit,
                      })),
                    })
                  }}
                  onCancel={() => setShowCompleteForm(false)}
                  isPending={completeProductionMutation.isPending}
                />
              )}

              {batch.status === 'COMPLETED' && (
                <>
                  <button
                    type="button"
                    className="syn-btn syn-btn-primary w-full justify-center"
                    onClick={() => changeStatusMutation.mutate({ status: 'APPROVED' })}
                    disabled={changeStatusMutation.isPending}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar lote
                  </button>
                  <button
                    type="button"
                    className="syn-btn syn-btn-ghost w-full justify-center"
                    onClick={() => changeStatusMutation.mutate({ status: 'REJECTED' })}
                    disabled={changeStatusMutation.isPending}
                    style={{ color: 'var(--danger)' }}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Rechazar lote
                  </button>
                </>
              )}

              {batch.status === 'REJECTED' && (
                <button
                  type="button"
                  className="syn-btn syn-btn-ghost w-full justify-center"
                  onClick={() => changeStatusMutation.mutate({ status: 'PLANNED' })}
                  disabled={changeStatusMutation.isPending}
                >
                  Reiniciar lote
                </button>
              )}

              {(batch.status === 'APPROVED' || batch.status === 'REJECTED') && (
                <p
                  className="text-center text-[12px]"
                  style={{ color: 'var(--ink-3)' }}
                >
                  Lote {batch.status === 'APPROVED' ? 'aprobado' : 'rechazado'} — sin acciones.
                </p>
              )}
            </div>
          </div>

          {/* Historial */}
          <div className="syn-card">
            <div className="syn-card-head">
              <div>
                <div className="eyebrow">· Historial · {batch.statusLogs.length}</div>
                <h3 style={{ marginTop: 6 }}>Cambios de estado</h3>
              </div>
            </div>
            <div style={{ padding: '12px 20px 16px' }}>
              {batch.statusLogs.length === 0 ? (
                <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
                  Sin cambios registrados.
                </p>
              ) : (
                <div className="space-y-3">
                  {batch.statusLogs.map((log) => {
                    const toLabel = statusConfig[log.toStatus as BatchStatus]?.label
                    const toChipCls =
                      log.toStatus === 'PLANNED'
                        ? 'syn-chip-draft'
                        : log.toStatus === 'IN_PROGRESS'
                          ? 'syn-chip-active'
                          : log.toStatus === 'COMPLETED'
                            ? 'syn-chip-warn'
                            : log.toStatus === 'APPROVED'
                              ? 'syn-chip-ok'
                              : 'syn-chip-fail'
                    return (
                      <div key={log.id} className="flex items-start gap-3 text-[13px]">
                        <Clock
                          className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          style={{ color: 'var(--ink-3)' }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span style={{ color: 'var(--ink-3)' }}>
                              {statusConfig[log.fromStatus as BatchStatus]?.label ?? '—'}
                            </span>
                            <span style={{ color: 'var(--ink-4)' }}>→</span>
                            <span className={`syn-chip ${toChipCls}`}>{toLabel}</span>
                          </div>
                          <div
                            className="mt-1 font-mono text-[11px]"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            {new Date(log.changedAt).toLocaleString('es-AR')}
                            {log.reason && <> · {log.reason}</>}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — datos producción + fórmula */}
        <div className="space-y-5 min-w-0">
          {/* Datos de producción */}
          <div className="syn-card">
            <div className="syn-card-head">
              <div>
                <div className="eyebrow">· Datos de producción</div>
                <h3 style={{ marginTop: 6 }}>
                  Valores <span className="italic">registrados.</span>
                </h3>
              </div>
            </div>
            <div>
              {batch.record.fields.map((field, i) => {
                const value = batch.entry.data[field.id]
                const isMono =
                  field.fieldType === 'NUMBER' ||
                  field.fieldType === 'QUANTITY' ||
                  field.fieldType === 'FORMULA' ||
                  field.fieldType === 'DATE'
                return (
                  <div
                    key={field.id}
                    className="flex items-center justify-between px-5 py-3 text-[13px]"
                    style={{
                      borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                    }}
                  >
                    <span style={{ color: 'var(--ink-3)' }}>{field.label}</span>
                    <span
                      className={isMono ? 'font-mono' : ''}
                      style={{ color: 'var(--ink-0)' }}
                    >
                      {formatFieldValue(field.fieldType, value)}
                    </span>
                  </div>
                )
              })}
              {batch.producedQuantity !== null && (
                <div
                  className="flex items-center justify-between px-5 py-3 text-[13px]"
                  style={{
                    borderTop: '1px solid var(--line)',
                    background: 'var(--ok-soft)',
                  }}
                >
                  <span style={{ color: 'var(--ok)', fontWeight: 500 }}>
                    Cantidad Producida
                  </span>
                  <span
                    className="font-mono"
                    style={{ color: 'var(--ok)', fontWeight: 500 }}
                  >
                    {batch.producedQuantity} {batch.unit || ''}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Equipos asignados — traceability */}
          {hasRequiredInstruments && (() => {
            const isEditable = batch.status !== 'APPROVED' && batch.status !== 'REJECTED'
            return (
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
                  {(batch.recipe?.requiredInstruments ?? []).map((req) => {
                    const assigned = batch.instrumentAssignments.find((a) => a.label === req.label)
                    const chip = assigned ? computeConditionChip(assigned.instrument) : null
                    const instCode = assigned
                      ? String(Object.values(assigned.instrument.entry.data)[0] ?? assigned.instrument.id.slice(0, 8))
                      : ''
                    const isPickerOpen = pickerLabel === req.label
                    const usedIds = new Set(
                      batch.instrumentAssignments
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
            )
          })()}

          {/* Fórmula */}
          {batch.recipe && (
            <div className="syn-card">
              <div className="syn-card-head">
                <div>
                  <div className="eyebrow flex items-center gap-1.5">
                    <FlaskConical className="h-3 w-3" /> Fórmula{' '}
                    {batch.recipe.code && (
                      <span className="font-mono" style={{ color: 'var(--ink-4)' }}>
                        ({batch.recipe.code})
                      </span>
                    )}
                  </div>
                  <h3 style={{ marginTop: 6 }}>{batch.recipe.name}</h3>
                </div>
              </div>
              <div style={{ padding: '12px 20px 16px' }} className="space-y-4">
                {batch.recipe.ingredients.length > 0 && (
                  <div>
                    <div className="kicker mb-2">· Ingredientes</div>
                    <div
                      className="rounded-[8px] border"
                      style={{ borderColor: 'var(--line)' }}
                    >
                      {batch.recipe.ingredients.map((ing, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 px-3 py-2 text-[13px]"
                          style={{
                            borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                          }}
                        >
                          <span
                            className="w-6 font-mono text-[11px]"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            {ing.order}
                          </span>
                          <span className="flex-1" style={{ color: 'var(--ink-0)' }}>
                            {ing.name}
                          </span>
                          <span className="font-mono" style={{ color: 'var(--ink-1)' }}>
                            {ing.quantity} {ing.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Pasos del proceso (PDF) — el operador lo abre durante la
                    producción para seguir las instrucciones de la fórmula. */}
                {(batch.recipe as unknown as { stepsPdfUrl?: string | null }).stepsPdfUrl && (
                  <div>
                    <div className="kicker mb-2">· Pasos del proceso</div>
                    <a
                      href={(batch.recipe as unknown as { stepsPdfUrl: string }).stepsPdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-[8px] border px-3 py-2.5 flex items-center gap-3 transition hover:bg-[var(--bg-3)]"
                      style={{ borderColor: 'var(--line)' }}
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px]"
                        style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
                      >
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-[13px]" style={{ color: 'var(--ink-0)', fontWeight: 500 }}>
                          {(batch.recipe as unknown as { stepsPdfName?: string | null }).stepsPdfName || 'Pasos del proceso.pdf'}
                        </div>
                        <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                          Abrir PDF en nueva pestaña
                        </div>
                      </div>
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Formulario de consumo de stock ---

function StockConsumptionForm({
  consumptions,
  setConsumptions,
  onConfirm,
  onCancel,
  isPending,
}: {
  consumptions: Array<{ ingredientName: string; product: string; lotNumber: string; quantity: number; unit: string }>
  setConsumptions: (c: typeof consumptions) => void
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  // Fetch available lots for all unique products
  const productNames = [...new Set(consumptions.map((c) => c.product))]
  const { data: allLots = {} } = useQuery({
    queryKey: ['stock-available-batch', productNames.join(',')],
    queryFn: async () => {
      const result: Record<string, Array<{ lotNumber: string; balance: number; unit: string | null }>> = {}
      for (const p of productNames) {
        result[p] = await api.stock.available(p) as Array<{ lotNumber: string; balance: number; unit: string | null }>
      }
      return result
    },
  })

  const allReady = consumptions.every((c) => c.lotNumber && c.quantity > 0)

  return (
    <div
      className="space-y-3 rounded-[10px] border p-3"
      style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
    >
      <div className="kicker">· Consumo de stock</div>
      <div className="space-y-3">
        {consumptions.map((c, i) => {
          const lotsData = allLots[c.product] || []
          return (
            <div
              key={i}
              className="space-y-2 rounded-[8px] p-2.5"
              style={{ background: 'var(--bg-1)', border: '1px solid var(--line)' }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[13px] font-medium"
                  style={{ color: 'var(--ink-0)' }}
                >
                  {c.ingredientName}
                </span>
                <span
                  className="font-mono text-[11px]"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {c.quantity} {c.unit} requeridos
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="syn-field">
                  <span className="syn-field-label" style={{ fontSize: 10 }}>
                    Lote
                  </span>
                  <select
                    value={c.lotNumber}
                    onChange={(e) => {
                      const updated = [...consumptions]
                      updated[i] = { ...updated[i], lotNumber: e.target.value }
                      setConsumptions(updated)
                    }}
                    className="syn-select"
                    style={{ minHeight: 32, padding: '6px 24px 6px 10px', fontSize: 12 }}
                  >
                    <option value="">Seleccionar lote…</option>
                    {lotsData.map((lot) => (
                      <option key={lot.lotNumber} value={lot.lotNumber}>
                        {lot.lotNumber} ({lot.balance} {lot.unit || c.unit} disp.)
                      </option>
                    ))}
                  </select>
                  {lotsData.length === 0 && (
                    <p
                      className="font-mono text-[10px]"
                      style={{ color: 'var(--warn)' }}
                    >
                      Sin stock disponible
                    </p>
                  )}
                </div>
                <div className="syn-field">
                  <span className="syn-field-label" style={{ fontSize: 10 }}>
                    Cantidad a consumir
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={c.quantity}
                    onChange={(e) => {
                      const updated = [...consumptions]
                      updated[i] = {
                        ...updated[i],
                        quantity: parseFloat(e.target.value) || 0,
                      }
                      setConsumptions(updated)
                    }}
                    className="syn-input font-mono"
                    style={{ minHeight: 32, padding: '6px 10px', fontSize: 12 }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          className="syn-btn syn-btn-primary flex-1 justify-center"
          onClick={onConfirm}
          disabled={isPending || !allReady}
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Confirmar
        </button>
        <button type="button" className="syn-btn syn-btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// --- Pre-flight de stock al iniciar producción ---

function StartCheckPanel({
  loading,
  check,
  onStart,
  onCancel,
  isPending,
}: {
  loading: boolean
  check:
    | {
        allSufficient: boolean
        ingredients: Array<{
          ingredientName: string
          product: string
          recipeQuantity: number
          unit: string
          totalBalance: number
          lots: Array<{ lotNumber: string; balance: number; unit: string | null }>
          sufficient: boolean
        }>
      }
    | undefined
  onStart: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div
      className="space-y-3 rounded-[10px] border p-3"
      style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
    >
      <div className="kicker">· Verificación de stock</div>
      {loading && (
        <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--ink-3)' }}>
          <Loader2 className="h-3 w-3 animate-spin" /> Consultando saldos…
        </div>
      )}
      {!loading && check && check.ingredients.length === 0 && (
        <div className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
          Esta fórmula no tiene ingredientes de stock. Podés iniciar la producción sin restricciones.
        </div>
      )}
      {!loading && check && check.ingredients.length > 0 && (
        <div className="space-y-2">
          {check.ingredients.map((ing) => (
            <div
              key={ing.product}
              className="rounded-[8px] p-2.5"
              style={{
                background: 'var(--bg-1)',
                border: `1px solid ${ing.sufficient ? 'var(--line)' : 'var(--danger)'}`,
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className="text-[13px] font-medium"
                  style={{ color: 'var(--ink-0)' }}
                >
                  {ing.sufficient ? '✓' : '✗'} {ing.ingredientName}
                </span>
                <span
                  className="font-mono text-[11px]"
                  style={{ color: ing.sufficient ? 'var(--ink-3)' : 'var(--danger)' }}
                >
                  requiere {ing.recipeQuantity} {ing.unit} · disponible {ing.totalBalance}
                </span>
              </div>
              {ing.lots.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {ing.lots.map((l) => (
                    <span
                      key={l.lotNumber}
                      className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]"
                      style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
                    >
                      {l.lotNumber}: {l.balance}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="syn-btn syn-btn-primary flex-1 justify-center"
          onClick={onStart}
          disabled={isPending || loading || !check?.allSufficient}
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Iniciar producción
        </button>
        <button type="button" className="syn-btn syn-btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}

// --- Formulario combinado de cierre (cantidad producida + EGRESOs) ---

function CompleteProductionForm({
  producedQuantity,
  setProducedQuantity,
  unit,
  setUnit,
  consumptions,
  setConsumptions,
  onConfirm,
  onCancel,
  isPending,
}: {
  producedQuantity: string
  setProducedQuantity: (v: string) => void
  unit: string
  setUnit: (v: string) => void
  consumptions: Array<{ ingredientName: string; product: string; lotNumber: string; quantity: number; unit: string }>
  setConsumptions: (c: typeof consumptions) => void
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}) {
  const productNames = [...new Set(consumptions.map((c) => c.product))]
  const { data: allLots = {} } = useQuery({
    queryKey: ['stock-available-complete', productNames.join(',')],
    queryFn: async () => {
      const result: Record<string, Array<{ lotNumber: string; balance: number; unit: string | null }>> = {}
      for (const p of productNames) {
        result[p] = await api.stock.available(p) as Array<{ lotNumber: string; balance: number; unit: string | null }>
      }
      return result
    },
    enabled: productNames.length > 0,
  })

  return (
    <div
      className="space-y-3 rounded-[10px] border p-3"
      style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
    >
      <div className="kicker">· Datos de cierre</div>
      <div className="grid grid-cols-2 gap-2">
        <div className="syn-field">
          <span className="syn-field-label">Cantidad Producida</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={producedQuantity}
            onChange={(e) => setProducedQuantity(e.target.value)}
            placeholder="Ej: 45.5"
            className="syn-input"
          />
        </div>
        <div className="syn-field">
          <span className="syn-field-label">Unidad</span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="syn-select"
          >
            <option value="">—</option>
            <option value="kg">kg</option>
            <option value="g">g</option>
            <option value="L">L</option>
            <option value="mL">mL</option>
            <option value="u">u</option>
          </select>
        </div>
      </div>

      {consumptions.length > 0 && (
        <>
          <div className="kicker" style={{ marginTop: 4 }}>· Consumos de stock</div>
          <div className="space-y-2">
            {consumptions.map((c, i) => {
              const lotsData = allLots[c.product] || []
              const selectedLot = lotsData.find((l) => l.lotNumber === c.lotNumber)
              const exceedsBalance = selectedLot ? c.quantity > selectedLot.balance : false
              return (
                <div
                  key={i}
                  className="space-y-2 rounded-[8px] p-2.5"
                  style={{
                    background: 'var(--bg-1)',
                    border: `1px solid ${exceedsBalance ? 'var(--danger)' : 'var(--line)'}`,
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="text-[13px] font-medium"
                      style={{ color: 'var(--ink-0)' }}
                    >
                      {c.ingredientName}
                    </span>
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      fórmula: {c.quantity} {c.unit}
                    </span>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <div className="syn-field">
                      <span className="syn-field-label" style={{ fontSize: 10 }}>
                        Lote
                      </span>
                      <select
                        value={c.lotNumber}
                        onChange={(e) => {
                          const updated = [...consumptions]
                          updated[i] = { ...updated[i], lotNumber: e.target.value }
                          setConsumptions(updated)
                        }}
                        className="syn-select"
                        style={{ minHeight: 32, padding: '6px 10px', fontSize: 12 }}
                      >
                        <option value="">— Seleccionar —</option>
                        {lotsData.map((l) => (
                          <option key={l.lotNumber} value={l.lotNumber}>
                            {l.lotNumber} ({l.balance} disp.)
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="syn-field" style={{ width: 110 }}>
                      <span className="syn-field-label" style={{ fontSize: 10 }}>
                        Cantidad
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        value={c.quantity}
                        onChange={(e) => {
                          const updated = [...consumptions]
                          updated[i] = { ...updated[i], quantity: parseFloat(e.target.value) || 0 }
                          setConsumptions(updated)
                        }}
                        className="syn-input font-mono"
                        style={{ minHeight: 32, padding: '6px 10px', fontSize: 12 }}
                      />
                    </div>
                  </div>
                  {exceedsBalance && (
                    <div className="text-[11px]" style={{ color: 'var(--danger)' }}>
                      Excede el saldo del lote ({selectedLot!.balance} {selectedLot!.unit || ''})
                    </div>
                  )}
                  {c.lotNumber === '' && lotsData.length === 0 && (
                    <div className="text-[11px]" style={{ color: 'var(--danger)' }}>
                      No hay lotes con saldo para {c.product}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className="syn-btn syn-btn-primary flex-1 justify-center"
          onClick={onConfirm}
          disabled={isPending}
        >
          {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
          Confirmar y completar
        </button>
        <button type="button" className="syn-btn syn-btn-ghost" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  )
}
