'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { TestTube2, Search, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'

type SampleStatus = 'RECEIVED' | 'IN_TESTING' | 'COMPLETED'

interface SampleItem {
  id: string
  sampleCode: string
  client: string | null
  matrixId: string | null
  matrix: { id: string; name: string; code: string | null } | null
  status: SampleStatus
  receivedAt: string
  completedAt: string | null
  record: { id: string; name: string }
  entry: { id: string; data: Record<string, unknown> }
}

const statusConfig: Record<SampleStatus, { label: string; variant: 'secondary' | 'info' | 'success' }> = {
  RECEIVED: { label: 'Recibida', variant: 'secondary' },
  IN_TESTING: { label: 'En ensayo', variant: 'info' },
  COMPLETED: { label: 'Completada', variant: 'success' },
}

const nextStatus: Record<SampleStatus, { status: SampleStatus; label: string } | null> = {
  RECEIVED: { status: 'IN_TESTING', label: 'Iniciar ensayos' },
  IN_TESTING: { status: 'COMPLETED', label: 'Completar' },
  COMPLETED: null,
}

export default function SamplesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data: samples = [], isLoading } = useQuery({
    queryKey: ['samples', statusFilter],
    queryFn: () => api.samples.list(statusFilter ? { status: statusFilter } : undefined) as Promise<SampleItem[]>,
  })

  const changeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => api.samples.changeStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['samples'] })
      toast.success('Estado actualizado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = samples.filter(
    (s) =>
      s.sampleCode.toLowerCase().includes(search.toLowerCase()) ||
      (s.client && s.client.toLowerCase().includes(search.toLowerCase())) ||
      s.record.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Muestras</h1>
        <p className="mt-1 text-muted-foreground">Seguimiento de muestras de laboratorio</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, cliente o registro..."
            className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">Todas</option>
          <option value="RECEIVED">Recibida</option>
          <option value="IN_TESTING">En ensayo</option>
          <option value="COMPLETED">Completada</option>
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <TestTube2 className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {search || statusFilter ? 'No se encontraron muestras' : 'No hay muestras. Creá una entrada en un registro tipo Muestra.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y rounded-lg border bg-card">
          {filtered.map((sample) => {
            const st = statusConfig[sample.status]
            const next = nextStatus[sample.status]
            return (
              <div key={sample.id} className="flex items-center gap-4 px-4 py-3">
                <Link href={`/samples/${sample.id}`} className="flex flex-1 items-center gap-4 transition-colors hover:opacity-80">
                  <TestTube2 className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{sample.sampleCode}</p>
                    <p className="text-xs text-muted-foreground">
                      {sample.record.name}
                      {sample.client && <> · Cliente: {sample.client}</>}
                      {sample.matrix && <> · Matriz: {sample.matrix.name}</>}
                      <> · Recibida: {new Date(sample.receivedAt).toLocaleDateString('es-AR')}</>
                    </p>
                  </div>
                </Link>
                <Badge variant={st.variant}>{st.label}</Badge>
                {next && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => changeStatusMutation.mutate({ id: sample.id, status: next.status })}
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
