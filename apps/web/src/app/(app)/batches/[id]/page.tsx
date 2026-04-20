'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  FlaskConical,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'

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
  const [showStockConsumption, setShowStockConsumption] = useState(false)
  const [consumptions, setConsumptions] = useState<Array<{ ingredientName: string; product: string; lotNumber: string; quantity: number; unit: string }>>([])

  const { data: batch, isLoading } = useQuery({
    queryKey: ['batch', id],
    queryFn: () => api.batches.get(id) as Promise<BatchDetail>,
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!batch) return null

  const st = statusConfig[batch.status]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/batches')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Lote {batch.lotNumber}</h1>
            <Badge variant={st.variant}>{st.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {batch.record.name}
            {batch.recipe && <> · Receta: {batch.recipe.name}</>}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos de la entrada */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos de producción</CardTitle>
              <CardDescription>Valores registrados al crear el lote</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y rounded-lg border">
                {batch.record.fields.map((field) => {
                  const value = batch.entry.data[field.id]
                  return (
                    <div key={field.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="text-muted-foreground">{field.label}</span>
                      <span className="font-mono">{value !== null && value !== undefined ? String(value) : '—'}</span>
                    </div>
                  )
                })}
                {batch.producedQuantity !== null && (
                  <div className="flex items-center justify-between px-4 py-2.5 text-sm bg-green-50/50 dark:bg-green-950/20">
                    <span className="font-medium text-green-700 dark:text-green-400">Cantidad producida</span>
                    <span className="font-mono font-medium">{batch.producedQuantity} {batch.unit || ''}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Receta */}
          {batch.recipe && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="h-4 w-4" />
                  Receta: {batch.recipe.name}
                  {batch.recipe.code && <span className="text-muted-foreground font-normal">({batch.recipe.code})</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {batch.recipe.ingredients.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Ingredientes</h4>
                    <div className="divide-y rounded-lg border">
                      {batch.recipe.ingredients.map((ing, i) => (
                        <div key={i} className="flex items-center gap-4 px-3 py-2 text-sm">
                          <span className="w-6 text-xs text-muted-foreground">{ing.order}</span>
                          <span className="flex-1">{ing.name}</span>
                          <span className="font-mono">{ing.quantity} {ing.unit}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {batch.recipe.steps.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-semibold">Pasos</h4>
                    <div className="divide-y rounded-lg border">
                      {batch.recipe.steps.map((step, i) => (
                        <div key={i} className="px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{step.order}</span>
                            <span className="font-medium">{step.name}</span>
                            {step.duration && <span className="text-xs text-muted-foreground">{step.duration} min</span>}
                          </div>
                          {step.description && <p className="mt-1 ml-7 text-xs text-muted-foreground">{step.description}</p>}
                          {step.controls && <p className="mt-1 ml-7 text-xs text-blue-600">Control: {step.controls}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Historial de estados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial</CardTitle>
            </CardHeader>
            <CardContent>
              {batch.statusLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin cambios de estado registrados</p>
              ) : (
                <div className="space-y-3">
                  {batch.statusLogs.map((log) => {
                    const toSt = statusConfig[log.toStatus as BatchStatus]
                    return (
                      <div key={log.id} className="flex items-start gap-3 text-sm">
                        <Clock className="mt-0.5 h-4 w-4 text-muted-foreground" />
                        <div>
                          <p>
                            <span className="text-muted-foreground">{statusConfig[log.fromStatus as BatchStatus]?.label}</span>
                            {' → '}
                            <Badge variant={toSt?.variant || 'secondary'} className="text-xs">{toSt?.label}</Badge>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(log.changedAt).toLocaleString('es-AR')}
                            {log.reason && <> · {log.reason}</>}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado</span>
                <Badge variant={st.variant}>{st.label}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registro</span>
                <Link href={`/records/${batch.record.id}`} className="text-primary hover:underline">
                  {batch.record.name}
                </Link>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creado</span>
                <span>{new Date(batch.createdAt).toLocaleDateString('es-AR')}</span>
              </div>
              {batch.startedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inicio</span>
                  <span>{new Date(batch.startedAt).toLocaleString('es-AR')}</span>
                </div>
              )}
              {batch.completedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fin</span>
                  <span>{new Date(batch.completedAt).toLocaleString('es-AR')}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Acciones */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {batch.status === 'PLANNED' && !showStockConsumption && (() => {
                const stockIngredients = batch.recipe?.ingredients.filter((i) => i.fromStock && i.stockRecipeId) || []
                const hasStockIngredients = stockIngredients.length > 0

                return hasStockIngredients ? (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setConsumptions(stockIngredients.map((i) => ({
                        ingredientName: i.name,
                        product: (i.stockRecipe?.name || i.name).toUpperCase(),
                        lotNumber: '',
                        quantity: i.quantity,
                        unit: i.unit,
                      })))
                      setShowStockConsumption(true)
                    }}
                  >
                    Iniciar producción
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => changeStatusMutation.mutate({ status: 'IN_PROGRESS' })}
                    disabled={changeStatusMutation.isPending}
                  >
                    Iniciar producción
                  </Button>
                )
              })()}

              {showStockConsumption && (
                <StockConsumptionForm
                  consumptions={consumptions}
                  setConsumptions={setConsumptions}
                  onConfirm={() => consumeStockMutation.mutate()}
                  onCancel={() => setShowStockConsumption(false)}
                  isPending={consumeStockMutation.isPending}
                />
              )}

              {batch.status === 'IN_PROGRESS' && !showCompleteForm && (
                <Button
                  className="w-full"
                  onClick={() => setShowCompleteForm(true)}
                >
                  Completar producción
                </Button>
              )}

              {showCompleteForm && (
                <div className="space-y-3 rounded-lg border p-3">
                  <p className="text-xs font-semibold">Datos de cierre</p>
                  <div className="grid gap-2 grid-cols-2">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Cantidad producida</label>
                      <input
                        type="number"
                        value={producedQuantity}
                        onChange={(e) => setProducedQuantity(e.target.value)}
                        placeholder="Ej: 45.5"
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground">Unidad</label>
                      <select
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
                  <Button
                    className="w-full"
                    onClick={() => changeStatusMutation.mutate({
                      status: 'COMPLETED',
                      producedQuantity: producedQuantity ? parseFloat(producedQuantity) : undefined,
                      unit: unit || undefined,
                    })}
                    disabled={changeStatusMutation.isPending}
                  >
                    {changeStatusMutation.isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
                    Completar
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={() => setShowCompleteForm(false)}>
                    Cancelar
                  </Button>
                </div>
              )}

              {batch.status === 'COMPLETED' && (
                <div className="space-y-2">
                  <Button
                    className="w-full"
                    onClick={() => changeStatusMutation.mutate({ status: 'APPROVED' })}
                    disabled={changeStatusMutation.isPending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Aprobar lote
                  </Button>
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => changeStatusMutation.mutate({ status: 'REJECTED' })}
                    disabled={changeStatusMutation.isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Rechazar lote
                  </Button>
                </div>
              )}

              {batch.status === 'REJECTED' && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => changeStatusMutation.mutate({ status: 'PLANNED' })}
                  disabled={changeStatusMutation.isPending}
                >
                  Reiniciar lote
                </Button>
              )}

              {(batch.status === 'APPROVED' || batch.status === 'REJECTED') && (
                <p className="text-xs text-center text-muted-foreground">
                  Lote {batch.status === 'APPROVED' ? 'aprobado' : 'rechazado'} — sin acciones disponibles
                </p>
              )}
            </CardContent>
          </Card>
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
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-xs font-semibold">Consumo de materiales del stock</p>
      <div className="space-y-3">
        {consumptions.map((c, i) => {
          const lotsData = allLots[c.product] || []
          return (
            <div key={i} className="space-y-1.5 rounded-lg bg-muted/30 p-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{c.ingredientName}</span>
                <span className="text-xs text-muted-foreground">{c.quantity} {c.unit} requeridos</span>
              </div>
              <div className="grid gap-2 grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Lote</label>
                  <select
                    value={c.lotNumber}
                    onChange={(e) => {
                      const updated = [...consumptions]
                      updated[i] = { ...updated[i], lotNumber: e.target.value }
                      setConsumptions(updated)
                    }}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="">Seleccionar lote...</option>
                    {lotsData.map((lot) => (
                      <option key={lot.lotNumber} value={lot.lotNumber}>
                        {lot.lotNumber} ({lot.balance} {lot.unit || c.unit} disp.)
                      </option>
                    ))}
                  </select>
                  {lotsData.length === 0 && (
                    <p className="text-[10px] text-amber-600">Sin stock disponible</p>
                  )}
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Cantidad a consumir</label>
                  <input
                    type="number"
                    step="any"
                    value={c.quantity}
                    onChange={(e) => {
                      const updated = [...consumptions]
                      updated[i] = { ...updated[i], quantity: parseFloat(e.target.value) || 0 }
                      setConsumptions(updated)
                    }}
                    className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          size="sm"
          onClick={onConfirm}
          disabled={isPending || !allReady}
        >
          {isPending ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
          Confirmar e iniciar
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
