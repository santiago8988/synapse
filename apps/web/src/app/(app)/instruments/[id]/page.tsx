'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import {
  Wrench,
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Settings,
  CalendarClock,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InstrumentStatus = 'ACTIVE' | 'IN_CALIBRATION' | 'IN_REPAIR' | 'DECOMMISSIONED'

interface RecordField {
  id: string
  label: string
  fieldType: string
  isIdentifier: boolean
}

interface StatusLog {
  id: string
  fromStatus: InstrumentStatus | null
  toStatus: InstrumentStatus
  reason: string | null
  changedById: string
  changedAt: string
}

interface Instrument {
  id: string
  organizationId: string
  entryId: string
  recordId: string
  status: InstrumentStatus
  nextCalibrationAt: string | null
  createdAt: string
  entry: {
    id: string
    data: Record<string, unknown>
    status: string
    createdAt: string
  }
  record: {
    id: string
    name: string
    periodicity: number | null
    notifyDaysBefore: number | null
    fields: RecordField[]
  }
  statusLogs?: StatusLog[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusConfig: Record<
  InstrumentStatus,
  { label: string; variant: 'success' | 'info' | 'warning' | 'secondary'; icon: typeof CheckCircle2 }
> = {
  ACTIVE: { label: 'Activo', variant: 'success', icon: CheckCircle2 },
  IN_CALIBRATION: { label: 'En Calibración', variant: 'info', icon: Settings },
  IN_REPAIR: { label: 'En Reparación', variant: 'warning', icon: AlertTriangle },
  DECOMMISSIONED: { label: 'Dado de Baja', variant: 'secondary', icon: XCircle },
}

const allStatuses: InstrumentStatus[] = ['ACTIVE', 'IN_CALIBRATION', 'IN_REPAIR', 'DECOMMISSIONED']

function getIdentifier(inst: Instrument): string {
  const identifierField = inst.record.fields.find((f) => f.isIdentifier)
  if (identifierField) {
    const val = inst.entry.data[identifierField.id]
    if (val !== undefined && val !== null && val !== '') return String(val)
  }
  for (const f of inst.record.fields) {
    const val = inst.entry.data[f.id]
    if (val !== undefined && val !== null && val !== '') return String(val)
  }
  return 'Sin identificador'
}

type CalibrationIndicator = 'green' | 'amber' | 'red' | null

function getCalibrationIndicator(
  nextCalibrationAt: string | null,
  notifyDaysBefore: number | null,
): CalibrationIndicator {
  if (!nextCalibrationAt) return null
  const now = new Date()
  const next = new Date(nextCalibrationAt)
  const diffMs = next.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'red'
  if (notifyDaysBefore != null && diffDays <= notifyDaysBefore) return 'amber'
  return 'green'
}

const calibrationBadge: Record<string, { label: string; variant: 'success' | 'warning' | 'destructive' }> = {
  green: { label: 'Vigente', variant: 'success' },
  amber: { label: 'Próxima', variant: 'warning' },
  red: { label: 'Vencida', variant: 'destructive' },
}

function formatFieldValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'number') return String(value)
  return String(value)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InstrumentDetailPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const id = params.id as string

  const [newStatus, setNewStatus] = useState<InstrumentStatus | ''>('')
  const [statusReason, setStatusReason] = useState('')

  const { data: instrument, isLoading, error } = useQuery<Instrument>({
    queryKey: ['instruments', id],
    queryFn: () => api.instruments.get(id) as Promise<Instrument>,
  })

  const statusMutation = useMutation({
    mutationFn: (data: { status: string; reason?: string }) =>
      api.instruments.changeStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instruments', id] })
      queryClient.invalidateQueries({ queryKey: ['instruments'] })
      setNewStatus('')
      setStatusReason('')
      toast.success('Estado actualizado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleStatusChange = () => {
    if (!newStatus) return
    statusMutation.mutate({
      status: newStatus,
      reason: statusReason || undefined,
    })
  }

  const inputClass =
    'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
        <div className="h-48 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  // ---- Error / not found ----
  if (error || !instrument) {
    return (
      <div className="space-y-6">
        <Link href="/instruments">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a instrumentos
          </Button>
        </Link>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 font-medium">Instrumento no encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">
              El instrumento solicitado no existe o fue eliminado.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const currentStatus = statusConfig[instrument.status]
  const StatusIcon = currentStatus.icon
  const availableStatuses = allStatuses.filter((s) => s !== instrument.status)
  const identifier = getIdentifier(instrument)
  const calInd = getCalibrationIndicator(
    instrument.nextCalibrationAt,
    instrument.record.notifyDaysBefore,
  )

  return (
    <div className="space-y-6">
      {/* Back button and header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/instruments">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Instrumentos
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/30">
              <Wrench className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">{identifier}</h1>
              <p className="text-sm text-muted-foreground">{instrument.record.name}</p>
            </div>
          </div>
        </div>
        <Badge variant={currentStatus.variant} className="text-sm px-3 py-1">
          <StatusIcon className="mr-1.5 h-3.5 w-3.5" />
          {currentStatus.label}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Dynamic OWN fields */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Datos del instrumento</CardTitle>
              <CardDescription>
                Campos propios del registro &ldquo;{instrument.record.name}&rdquo;
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {instrument.record.fields.map((field) => (
                  <div key={field.id}>
                    <p className="text-sm text-muted-foreground">
                      {field.label}
                      {field.isIdentifier && (
                        <span className="ml-1.5 text-xs font-medium text-violet-600 dark:text-violet-400">
                          (Identificador)
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 font-medium">
                      {formatFieldValue(instrument.entry.data[field.id])}
                    </p>
                  </div>
                ))}

                {/* Calibration info */}
                {instrument.nextCalibrationAt && (
                  <div>
                    <p className="text-sm text-muted-foreground">Próxima calibración</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <CalendarClock className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {new Date(instrument.nextCalibrationAt).toLocaleDateString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </span>
                      {calInd && (
                        <Badge variant={calibrationBadge[calInd].variant} className="text-xs">
                          {calibrationBadge[calInd].label}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-sm text-muted-foreground">Fecha de alta</p>
                  <p className="mt-0.5 font-medium">
                    {new Date(instrument.createdAt).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              {/* Link to record */}
              <div className="mt-6">
                <Link
                  href={`/records/${instrument.recordId}`}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-600 hover:underline dark:text-violet-400"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ver registro: {instrument.record.name}
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Status history timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historial de estados</CardTitle>
              <CardDescription>
                Registro de todos los cambios de estado del instrumento
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!instrument.statusLogs || instrument.statusLogs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Clock className="h-10 w-10 text-muted-foreground/30" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    No hay cambios de estado registrados
                  </p>
                </div>
              ) : (
                <div className="relative space-y-0">
                  {/* Vertical line */}
                  <div className="absolute left-[17px] top-2 bottom-2 w-px bg-border" />

                  {instrument.statusLogs.map((log) => {
                    const toConfig = statusConfig[log.toStatus]
                    const fromConfig = log.fromStatus ? statusConfig[log.fromStatus] : null
                    const LogIcon = toConfig.icon

                    return (
                      <div key={log.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {/* Timeline dot */}
                        <div className="relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted">
                          <LogIcon className="h-4 w-4 text-muted-foreground" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 pt-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {fromConfig && (
                              <>
                                <Badge variant={fromConfig.variant} className="text-xs">
                                  {fromConfig.label}
                                </Badge>
                                <span className="text-xs text-muted-foreground">&rarr;</span>
                              </>
                            )}
                            <Badge variant={toConfig.variant} className="text-xs">
                              {toConfig.label}
                            </Badge>
                          </div>
                          {log.reason && (
                            <p className="mt-1 text-sm text-foreground">{log.reason}</p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {new Date(log.changedAt).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
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
          {/* Status change */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Cambiar estado</CardTitle>
              <CardDescription>
                Actualizá el estado operativo del instrumento
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nuevo estado</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as InstrumentStatus | '')}
                  className={inputClass}
                >
                  <option value="">Seleccionar estado...</option>
                  {availableStatuses.map((s) => (
                    <option key={s} value={s}>
                      {statusConfig[s].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Motivo{' '}
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Ej: Enviado a calibración externa en laboratorio XYZ"
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button
                onClick={handleStatusChange}
                disabled={!newStatus || statusMutation.isPending}
                className="w-full"
              >
                {statusMutation.isPending ? 'Actualizando...' : 'Cambiar estado'}
              </Button>
            </CardContent>
          </Card>

          {/* Summary card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estado actual</span>
                <Badge variant={currentStatus.variant}>{currentStatus.label}</Badge>
              </div>
              <Separator />
              {instrument.nextCalibrationAt && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Próxima calibración</span>
                    <span className="font-medium">
                      {new Date(instrument.nextCalibrationAt).toLocaleDateString('es-AR')}
                    </span>
                  </div>
                  <Separator />
                </>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tipo de registro</span>
                <span className="font-medium">{instrument.record.name}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Cambios de estado</span>
                <span className="font-medium">{instrument.statusLogs?.length || 0}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Alta</span>
                <span className="font-medium">
                  {new Date(instrument.createdAt).toLocaleDateString('es-AR')}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
