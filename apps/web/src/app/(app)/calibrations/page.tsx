'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { ScanLine, Search, Loader2, CalendarClock, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'

type CalibrationStatus = 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED'

interface CalibrationItem {
  id: string
  status: CalibrationStatus
  results: Record<string, unknown> | null
  dueDate: string | null
  createdAt: string
  completedAt: string | null
  entry: {
    id: string
    data: Record<string, unknown>
    record: { id: string; name: string }
    instrument: { id: string; status: string } | null
  }
  template: { id: string; name: string; code: string | null } | null
}

const statusConfig: Record<CalibrationStatus, { label: string; variant: 'secondary' | 'info' | 'success' | 'destructive' }> = {
  IN_PROGRESS: { label: 'En progreso', variant: 'info' },
  COMPLETED: { label: 'Completada', variant: 'secondary' },
  APPROVED: { label: 'Aprobada', variant: 'success' },
  REJECTED: { label: 'Rechazada', variant: 'destructive' },
}

const nextStatus: Record<CalibrationStatus, { status: CalibrationStatus; label: string } | null> = {
  IN_PROGRESS: { status: 'COMPLETED', label: 'Completar' },
  COMPLETED: { status: 'APPROVED', label: 'Aprobar' },
  APPROVED: null,
  REJECTED: null,
}

export default function CalibrationsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data: calibrations = [], isLoading } = useQuery({
    queryKey: ['calibrations', statusFilter],
    queryFn: () => api.calibrations.list(statusFilter ? { status: statusFilter } : undefined) as Promise<CalibrationItem[]>,
  })

  const changeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.calibrations.changeStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calibrations'] })
      toast.success('Estado actualizado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = calibrations.filter((c) => {
    const codigo = Object.values(c.entry?.data || {}).find((v) => typeof v === 'string') || ''
    const templateName = c.template?.name || ''
    const searchLower = search.toLowerCase()
    return (
      String(codigo).toLowerCase().includes(searchLower) ||
      templateName.toLowerCase().includes(searchLower) ||
      c.entry.record.name.toLowerCase().includes(searchLower)
    )
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Calibraciones</h1>
        <p className="mt-1 text-muted-foreground">Seguimiento de verificaciones internas de equipos</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, plantilla o registro..."
            className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas</option>
          <option value="IN_PROGRESS">En progreso</option>
          <option value="COMPLETED">Completada</option>
          <option value="APPROVED">Aprobada</option>
          <option value="REJECTED">Rechazada</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ScanLine className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {search || statusFilter ? 'No se encontraron calibraciones' : 'No hay calibraciones. Crea una entrada en un registro tipo Calibración.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {filtered.map((calibration) => {
            const st = statusConfig[calibration.status]
            const next = nextStatus[calibration.status]
            const codigo = Object.values(calibration.entry?.data || {}).find((v) => typeof v === 'string') || '—'

            const hasResults = calibration.results && Object.keys(calibration.results).length > 0
            const isPending = calibration.status === 'IN_PROGRESS' && !hasResults
            const displayLabel = isPending ? 'Pendiente' : st.label
            const displayVariant = isPending ? 'secondary' : st.variant

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
              <div key={calibration.id} className="flex items-center gap-4 px-4 py-3">
                <Link href={`/calibrations/${calibration.id}`} className="flex flex-1 items-center gap-4 transition-colors hover:opacity-80">
                  <ScanLine className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{String(codigo)}</p>
                    <p className="text-xs text-muted-foreground">
                      {calibration.entry.record.name}
                      {calibration.template && <> &middot; Plantilla: {calibration.template.name}</>}
                      <> &middot; Creada: {new Date(calibration.createdAt).toLocaleDateString('es-AR')}</>
                    </p>
                  </div>
                </Link>
                {dueDate && (
                  <div className={`flex items-center gap-1.5 text-xs ${isOverdue ? 'text-red-600 font-medium' : daysUntilDue !== null && daysUntilDue <= 7 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
                    {isOverdue ? <AlertTriangle className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
                    <span>
                      {dueDate.toLocaleDateString('es-AR')}
                      {daysUntilDue !== null && (
                        <span className="ml-1 opacity-80">
                          ({isOverdue ? `${Math.abs(daysUntilDue)} d vencida` : `en ${daysUntilDue} d`})
                        </span>
                      )}
                    </span>
                  </div>
                )}
                <Badge variant={displayVariant}>{displayLabel}</Badge>
                {next && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatusMutation.mutate({ id: calibration.id, status: next.status })}
                    disabled={changeStatusMutation.isPending}
                  >
                    {next.label}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
