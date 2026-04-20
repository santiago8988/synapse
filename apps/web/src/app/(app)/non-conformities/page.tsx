'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface CorrectiveAction {
  id: string
  description: string
  dueDate: string | null
  completedAt: string | null
}

interface NonConformity {
  id: string
  title: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  entryId: string | null
  assignedToId: string | null
  correctiveActions?: CorrectiveAction[]
  createdAt: string
  updatedAt: string
}

type StatusFilter = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

const statusConfig: Record<NonConformity['status'], { label: string; variant: 'destructive' | 'warning' | 'info' | 'success' }> = {
  OPEN: { label: 'Abierta', variant: 'destructive' },
  IN_PROGRESS: { label: 'En Progreso', variant: 'warning' },
  RESOLVED: { label: 'Resuelta', variant: 'info' },
  CLOSED: { label: 'Cerrada', variant: 'success' },
}

const filterTabs: { key: StatusFilter; label: string }[] = [
  { key: 'ALL', label: 'Todas' },
  { key: 'OPEN', label: 'Abiertas' },
  { key: 'IN_PROGRESS', label: 'En Progreso' },
  { key: 'RESOLVED', label: 'Resueltas' },
  { key: 'CLOSED', label: 'Cerradas' },
]

export default function NonConformitiesPage() {
  const queryClient = useQueryClient()
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('ALL')
  const [showCreate, setShowCreate] = useState(false)
  const [newNC, setNewNC] = useState({ title: '', description: '' })

  const { data: nonConformities = [], isLoading } = useQuery<NonConformity[]>({
    queryKey: ['non-conformities', activeFilter],
    queryFn: () =>
      api.nonConformities.list(
        activeFilter === 'ALL' ? undefined : { status: activeFilter },
      ) as Promise<NonConformity[]>,
  })

  const createMutation = useMutation({
    mutationFn: (data: { title: string; description: string }) =>
      api.nonConformities.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-conformities'] })
      setShowCreate(false)
      setNewNC({ title: '', description: '' })
      toast.success('No conformidad creada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleCreate = () => {
    if (!newNC.title.trim() || !newNC.description.trim()) return
    createMutation.mutate({ title: newNC.title, description: newNC.description })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">No Conformidades</h1>
          <p className="mt-1 text-muted-foreground">
            Gestión de no conformidades y acciones correctivas
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva NC
        </Button>
      </div>

      {/* Inline create form */}
      {showCreate && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="text-base">Nueva no conformidad</CardTitle>
            <CardDescription>
              Registrá una nueva no conformidad detectada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Título *</label>
              <input
                type="text"
                value={newNC.title}
                onChange={(e) => setNewNC({ ...newNC, title: e.target.value })}
                placeholder="Ej: Desviación en temperatura de estufa"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Descripción *</label>
              <textarea
                value={newNC.description}
                onChange={(e) => setNewNC({ ...newNC, description: e.target.value })}
                placeholder="Describí la no conformidad detectada..."
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreate}
                disabled={!newNC.title.trim() || !newNC.description.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? 'Creando...' : 'Crear NC'}
              </Button>
              <Button variant="outline" onClick={() => { setShowCreate(false); setNewNC({ title: '', description: '' }) }}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveFilter(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === tab.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : nonConformities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 font-medium">No hay no conformidades</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeFilter === 'ALL'
                ? 'No se registraron no conformidades todavía'
                : `No hay no conformidades con estado "${filterTabs.find((t) => t.key === activeFilter)?.label}"`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {nonConformities.map((nc) => {
            const status = statusConfig[nc.status]
            const actionsCount = nc.correctiveActions?.length ?? 0
            const completedActions = nc.correctiveActions?.filter((a) => a.completedAt !== null).length ?? 0
            return (
              <Link key={nc.id} href={`/non-conformities/${nc.id}`}>
                <Card className="transition-shadow hover:shadow-md cursor-pointer">
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/30">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{nc.title}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(nc.createdAt).toLocaleDateString('es-AR')}</span>
                        {nc.description && (
                          <>
                            <span>&middot;</span>
                            <span className="truncate">
                              {nc.description.length > 80
                                ? nc.description.slice(0, 80) + '...'
                                : nc.description}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {actionsCount > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {completedActions}/{actionsCount} acciones
                        </span>
                      )}
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
