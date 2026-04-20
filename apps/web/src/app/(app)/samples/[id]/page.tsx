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
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'

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
  } | null
  effectiveParameters: EffectiveParam[]
}

const statusConfig: Record<SampleStatus, { label: string; variant: 'secondary' | 'info' | 'success' }> = {
  RECEIVED: { label: 'Recibida', variant: 'secondary' },
  IN_TESTING: { label: 'En ensayo', variant: 'info' },
  COMPLETED: { label: 'Completada', variant: 'success' },
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

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!sample) return null

  const st = statusConfig[sample.status]
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/samples')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Muestra {sample.sampleCode}</h1>
            <Badge variant={st.variant}>{st.label}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {sample.record.name}
            {sample.client && <> &middot; Cliente: {sample.client}</>}
            {sample.matrix && <> &middot; Matriz: {sample.matrix.name}</>}
            {sample.methodIds.length > 0 && <> &middot; {sample.methodIds.length} metodos</>}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Columna principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Datos de la entrada */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos de la muestra</CardTitle>
              <CardDescription>Valores registrados al crear la muestra</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y rounded-lg border">
                {sample.record.fields
                  .filter((f) => f.fieldType !== 'MATRIX_METHOD')
                  .map((field) => {
                    const value = sample.entry.data[field.id]
                    return (
                      <div key={field.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">{field.label}</span>
                        <span className="font-mono">{value !== null && value !== undefined ? String(value) : '—'}</span>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Condiciones de muestreo */}
          {matrixConditions.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Condiciones de muestreo
                  </CardTitle>
                  <CardDescription>Condiciones al momento de la toma de muestra</CardDescription>
                </div>
                {isEditable && dirtyConditions && (
                  <Button
                    size="sm"
                    onClick={() => saveConditionsMutation.mutate()}
                    disabled={saveConditionsMutation.isPending}
                  >
                    {saveConditionsMutation.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                    Guardar
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="divide-y rounded-lg border">
                  {matrixConditions.map((cond) => {
                    const value = conditions[cond.id] as string | number | undefined
                    return (
                      <div key={cond.id} className="flex items-center justify-between px-4 py-2.5 text-sm gap-4">
                        <span className="text-muted-foreground whitespace-nowrap">
                          {cond.label}
                          {cond.unit && <span className="ml-1 text-xs">({cond.unit})</span>}
                        </span>
                        {isEditable ? (
                          cond.fieldType === 'DROPDOWN' ? (
                            <select
                              value={(value as string) || ''}
                              onChange={(e) => {
                                setConditions({ ...conditions, [cond.id]: e.target.value })
                                setDirtyConditions(true)
                              }}
                              className="w-48 rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                            >
                              <option value="">Seleccionar...</option>
                              {cond.options.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={cond.fieldType === 'NUMBER' ? 'number' : cond.fieldType === 'DATE' ? 'date' : 'text'}
                              value={(value as string) ?? ''}
                              onChange={(e) => {
                                const val = cond.fieldType === 'NUMBER' ? (e.target.value ? parseFloat(e.target.value) : '') : e.target.value
                                setConditions({ ...conditions, [cond.id]: val })
                                setDirtyConditions(true)
                              }}
                              className="w-48 rounded-md border border-input bg-background px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                          )
                        ) : (
                          <span className="font-mono">{value !== undefined && value !== '' ? String(value) : '—'}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Resultados de laboratorio */}
          {parameters.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Microscope className="h-4 w-4" />
                    Resultados de laboratorio
                  </CardTitle>
                  <CardDescription>
                    {sample.matrix ? `Matriz: ${sample.matrix.name}` : ''}
                    {sample.methodIds.length > 0 ? ` — ${sample.methodIds.length} metodos seleccionados` : ''}
                  </CardDescription>
                </div>
                {isEditable && dirtyResults && (
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
                <div className="rounded-lg border">
                  <div className="grid grid-cols-[1fr_8rem_5rem_5rem_5rem_6rem] gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground bg-muted/30 border-b">
                    <span>Parametro</span>
                    <span>Resultado</span>
                    <span>Unidad</span>
                    <span>Min</span>
                    <span>Max</span>
                    <span>Estado</span>
                  </div>
                  <div className="divide-y">
                    {parameters.map((param) => {
                      const result = results[param.id]
                      const value = result?.value ?? null
                      const resultStatus = getResultStatus(param, value)

                      return (
                        <div key={param.id} className="space-y-0">
                          <div className="grid grid-cols-[1fr_8rem_5rem_5rem_5rem_6rem] gap-2 px-4 py-2.5 items-center text-sm">
                            <div>
                              <span className="font-medium">{param.name}</span>
                              {param.method && (
                                <span className="ml-2 text-xs text-muted-foreground">{param.method}</span>
                              )}
                            </div>
                            <div>
                              {isEditable ? (
                                <input
                                  type="number"
                                  step="any"
                                  value={value ?? ''}
                                  onChange={(e) => {
                                    const newVal = e.target.value ? parseFloat(e.target.value) : null
                                    setResults({
                                      ...results,
                                      [param.id]: { ...results[param.id], value: newVal },
                                    })
                                    setDirtyResults(true)
                                  }}
                                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                              ) : (
                                <span className="font-mono">{value !== null ? value : '—'}</span>
                              )}
                            </div>
                            <span className="text-muted-foreground">{param.unit || '—'}</span>
                            <span className="text-muted-foreground font-mono">{param.minValue != null ? param.minValue : '—'}</span>
                            <span className="text-muted-foreground font-mono">{param.maxValue != null ? param.maxValue : '—'}</span>
                            <div>
                              {resultStatus === 'pass' && (
                                <Badge variant="success" className="text-xs">Conforme</Badge>
                              )}
                              {resultStatus === 'fail' && (
                                <Badge variant="destructive" className="text-xs">No conforme</Badge>
                              )}
                              {resultStatus === null && value !== null && (
                                <Badge variant="secondary" className="text-xs">Sin limite</Badge>
                              )}
                            </div>
                          </div>
                          {isEditable && (
                            <div className="px-4 pb-2.5">
                              <input
                                value={result?.observations || ''}
                                onChange={(e) => {
                                  setResults({
                                    ...results,
                                    [param.id]: { ...results[param.id], value: result?.value ?? null, observations: e.target.value },
                                  })
                                  setDirtyResults(true)
                                }}
                                placeholder="Observaciones..."
                                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                              />
                            </div>
                          )}
                          {!isEditable && result?.observations && (
                            <div className="px-4 pb-2.5">
                              <p className="text-xs text-muted-foreground">Obs: {result.observations}</p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sin matriz ni metodos */}
          {parameters.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Microscope className="mb-3 h-10 w-10 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  Esta muestra no tiene matriz ni metodos asignados. Asignalos antes de iniciar ensayos.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informacion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estado</span>
                <Badge variant={st.variant}>{st.label}</Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registro</span>
                <Link href={`/records/${sample.record.id}`} className="text-primary hover:underline">
                  {sample.record.name}
                </Link>
              </div>
              {sample.client && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cliente</span>
                  <span>{sample.client}</span>
                </div>
              )}
              {sample.matrix && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Matriz</span>
                  <span>{sample.matrix.name}</span>
                </div>
              )}
              {sample.methodIds.length > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Metodos</span>
                  <span>{sample.methodIds.length} seleccionados</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Recibida</span>
                <span>{new Date(sample.receivedAt).toLocaleDateString('es-AR')}</span>
              </div>
              {sample.completedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completada</span>
                  <span>{new Date(sample.completedAt).toLocaleDateString('es-AR')}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Acciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {sample.status === 'RECEIVED' && (
                <Button
                  className="w-full"
                  onClick={() => changeStatusMutation.mutate('IN_TESTING')}
                  disabled={changeStatusMutation.isPending}
                >
                  <TestTube2 className="mr-2 h-4 w-4" />
                  Iniciar ensayos
                </Button>
              )}

              {sample.status === 'IN_TESTING' && (
                <>
                  {(dirtyResults || dirtyConditions) && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        if (dirtyResults) saveResultsMutation.mutate()
                        if (dirtyConditions) saveConditionsMutation.mutate()
                      }}
                      disabled={saveResultsMutation.isPending || saveConditionsMutation.isPending}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Guardar cambios
                    </Button>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => {
                      if (dirtyResults || dirtyConditions) {
                        toast.error('Guarda los cambios antes de completar')
                        return
                      }
                      changeStatusMutation.mutate('COMPLETED')
                    }}
                    disabled={changeStatusMutation.isPending}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Completar muestra
                  </Button>
                </>
              )}

              {sample.status === 'COMPLETED' && (
                <p className="text-xs text-center text-muted-foreground">
                  Muestra completada — sin acciones disponibles
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
