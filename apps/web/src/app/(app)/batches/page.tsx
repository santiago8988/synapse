'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Search, Loader2, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'

type BatchStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED'

interface BatchItem {
  id: string
  lotNumber: string
  status: BatchStatus
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  record: { id: string; name: string }
  recipe: { id: string; name: string; code: string | null } | null
  entry: { id: string; data: Record<string, unknown> }
}

const statusConfig: Record<BatchStatus, { label: string; variant: 'secondary' | 'info' | 'success' | 'warning' | 'destructive' }> = {
  PLANNED: { label: 'Planificado', variant: 'secondary' },
  IN_PROGRESS: { label: 'En producción', variant: 'info' },
  COMPLETED: { label: 'Completado', variant: 'warning' },
  APPROVED: { label: 'Aprobado', variant: 'success' },
  REJECTED: { label: 'Rechazado', variant: 'destructive' },
}

const nextStatus: Record<BatchStatus, { status: BatchStatus; label: string } | null> = {
  PLANNED: { status: 'IN_PROGRESS', label: 'Iniciar producción' },
  IN_PROGRESS: { status: 'COMPLETED', label: 'Completar' },
  COMPLETED: null, // approve/reject are separate actions
  APPROVED: null,
  REJECTED: { status: 'PLANNED', label: 'Reiniciar' },
}

export default function BatchesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data: batches = [], isLoading } = useQuery({
    queryKey: ['batches', statusFilter],
    queryFn: () => api.batches.list(statusFilter ? { status: statusFilter } : undefined) as Promise<BatchItem[]>,
  })

  const changeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.batches.changeStatus(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      toast.success('Estado actualizado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = batches.filter(
    (b) =>
      b.lotNumber.toLowerCase().includes(search.toLowerCase()) ||
      b.record.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lotes de Producción</h1>
        <p className="mt-1 text-muted-foreground">Seguimiento de lotes y su estado</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por lote o registro..."
            className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todos</option>
          <option value="PLANNED">Planificado</option>
          <option value="IN_PROGRESS">En producción</option>
          <option value="COMPLETED">Completado</option>
          <option value="APPROVED">Aprobado</option>
          <option value="REJECTED">Rechazado</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {search || statusFilter ? 'No se encontraron lotes' : 'No hay lotes creados. Creá una entrada en un registro tipo Lote.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {filtered.map((batch) => {
            const st = statusConfig[batch.status]
            const next = nextStatus[batch.status]
            return (
              <div key={batch.id} className="flex items-center gap-4 px-4 py-3">
                <Link href={`/batches/${batch.id}`} className="flex flex-1 items-center gap-4 transition-colors hover:opacity-80">
                  <Package className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Lote {batch.lotNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {batch.record.name}
                      {batch.recipe && <> · Receta: {batch.recipe.name}</>}
                      {batch.startedAt && <> · Inicio: {new Date(batch.startedAt).toLocaleDateString('es-AR')}</>}
                    </p>
                  </div>
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
                {batch.status === 'COMPLETED' && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600"
                      onClick={() => changeStatusMutation.mutate({ id: batch.id, status: 'APPROVED' })}
                    >
                      Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      onClick={() => changeStatusMutation.mutate({ id: batch.id, status: 'REJECTED' })}
                    >
                      Rechazar
                    </Button>
                  </div>
                )}
                {next && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatusMutation.mutate({ id: batch.id, status: next.status })}
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
