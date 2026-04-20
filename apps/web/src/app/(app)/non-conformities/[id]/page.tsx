'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Plus,
} from 'lucide-react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface CorrectiveAction {
  id: string
  description: string
  dueDate: string | null
  completedAt: string | null
  createdAt: string
}

interface NonConformity {
  id: string
  title: string
  description: string
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  entryId: string | null
  assignedToId: string | null
  correctiveActions: CorrectiveAction[]
  createdAt: string
  updatedAt: string
  entry?: {
    id: string
    record?: {
      id: string
      name: string
    }
  } | null
}

const statusConfig: Record<NonConformity['status'], { label: string; variant: 'destructive' | 'warning' | 'info' | 'success' }> = {
  OPEN: { label: 'Abierta', variant: 'destructive' },
  IN_PROGRESS: { label: 'En Progreso', variant: 'warning' },
  RESOLVED: { label: 'Resuelta', variant: 'info' },
  CLOSED: { label: 'Cerrada', variant: 'success' },
}

export default function NonConformityDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const id = params.id as string

  const [showAddAction, setShowAddAction] = useState(false)
  const [newAction, setNewAction] = useState({ description: '', dueDate: '' })

  const { data: nc, isLoading } = useQuery<NonConformity>({
    queryKey: ['non-conformity', id],
    queryFn: () => api.nonConformities.get(id) as Promise<NonConformity>,
  })

  const statusMutation = useMutation({
    mutationFn: (status: string) => api.nonConformities.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-conformity', id] })
      queryClient.invalidateQueries({ queryKey: ['non-conformities'] })
      toast.success('Estado actualizado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const addActionMutation = useMutation({
    mutationFn: (data: { description: string; dueDate?: string }) =>
      api.nonConformities.addCorrectiveAction(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-conformity', id] })
      setShowAddAction(false)
      setNewAction({ description: '', dueDate: '' })
      toast.success('Acción correctiva agregada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const completeActionMutation = useMutation({
    mutationFn: (actionId: string) =>
      api.nonConformities.completeCorrectiveAction(id, actionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-conformity', id] })
      toast.success('Acción completada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleAddAction = () => {
    if (!newAction.description.trim()) return
    addActionMutation.mutate({
      description: newAction.description,
      dueDate: newAction.dueDate || undefined,
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-60 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (!nc) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <AlertTriangle className="h-12 w-12 text-muted-foreground/30" />
        <p className="mt-4 font-medium">No conformidad no encontrada</p>
        <Link href="/non-conformities" className="mt-2 text-sm text-primary hover:underline">
          Volver al listado
        </Link>
      </div>
    )
  }

  const status = statusConfig[nc.status]
  const completedActions = nc.correctiveActions.filter((a) => a.completedAt !== null)
  const hasCompletedActions = completedActions.length > 0
  const canResolve = nc.status === 'IN_PROGRESS' && hasCompletedActions

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="mt-0.5 h-8 w-8 shrink-0"
            onClick={() => router.push('/non-conformities')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{nc.title}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              <span>Detectada el {new Date(nc.createdAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              {nc.entry && (
                <>
                  <span>&middot;</span>
                  <span>
                    Vinculada a registro{' '}
                    {nc.entry.record?.name ? (
                      <span className="font-medium text-foreground">{nc.entry.record.name}</span>
                    ) : (
                      <span className="font-medium text-foreground">{nc.entryId}</span>
                    )}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <Badge variant={status.variant} className="text-sm px-3 py-1">
          {status.label}
        </Badge>
      </div>

      {/* Description + Status actions */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Descripción
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{nc.description}</p>

          <Separator className="my-6" />

          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Cambiar estado
          </h2>
          <div className="flex items-center gap-2">
            {nc.status === 'OPEN' && (
              <Button
                onClick={() => statusMutation.mutate('IN_PROGRESS')}
                disabled={statusMutation.isPending}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {statusMutation.isPending ? 'Actualizando...' : 'Iniciar'}
              </Button>
            )}
            {nc.status === 'IN_PROGRESS' && (
              <div className="flex items-center gap-3">
                <Button
                  onClick={() => statusMutation.mutate('RESOLVED')}
                  disabled={!canResolve || statusMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {statusMutation.isPending ? 'Actualizando...' : 'Resolver'}
                </Button>
                {!canResolve && (
                  <span className="text-xs text-muted-foreground">
                    Se requiere al menos una acción correctiva completada
                  </span>
                )}
              </div>
            )}
            {nc.status === 'RESOLVED' && (
              <Button
                onClick={() => statusMutation.mutate('CLOSED')}
                disabled={statusMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {statusMutation.isPending ? 'Actualizando...' : 'Cerrar'}
              </Button>
            )}
            {nc.status === 'CLOSED' && (
              <p className="text-sm text-muted-foreground">
                Esta no conformidad está cerrada.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Corrective Actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">
            Acciones correctivas
            {nc.correctiveActions.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({completedActions.length}/{nc.correctiveActions.length} completadas)
              </span>
            )}
          </CardTitle>
          {nc.status !== 'CLOSED' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddAction(true)}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Agregar acción correctiva
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add action form */}
          {showAddAction && (
            <div className="rounded-lg border border-primary/20 bg-muted/30 p-4 space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Descripción *</label>
                <textarea
                  value={newAction.description}
                  onChange={(e) => setNewAction({ ...newAction, description: e.target.value })}
                  placeholder="Describí la acción correctiva a implementar..."
                  rows={2}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Fecha límite <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <input
                  type="date"
                  value={newAction.dueDate}
                  onChange={(e) => setNewAction({ ...newAction, dueDate: e.target.value })}
                  className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleAddAction}
                  disabled={!newAction.description.trim() || addActionMutation.isPending}
                >
                  {addActionMutation.isPending ? 'Agregando...' : 'Agregar'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowAddAction(false); setNewAction({ description: '', dueDate: '' }) }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Actions list */}
          {nc.correctiveActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Circle className="h-8 w-8 text-muted-foreground/20" />
              <p className="mt-2 text-sm text-muted-foreground">
                No hay acciones correctivas registradas
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {nc.correctiveActions.map((action) => {
                const isCompleted = action.completedAt !== null
                const isOverdue =
                  !isCompleted &&
                  action.dueDate &&
                  new Date(action.dueDate) < new Date()
                return (
                  <div
                    key={action.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/20'
                        : isOverdue
                          ? 'border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20'
                          : ''
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm ${
                          isCompleted ? 'text-muted-foreground line-through' : ''
                        }`}
                      >
                        {action.description}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>
                          Creada el{' '}
                          {new Date(action.createdAt).toLocaleDateString('es-AR')}
                        </span>
                        {action.dueDate && (
                          <>
                            <span>&middot;</span>
                            <span
                              className={`flex items-center gap-1 ${
                                isOverdue ? 'text-red-600 font-medium' : ''
                              }`}
                            >
                              <Clock className="h-3 w-3" />
                              Vence{' '}
                              {new Date(action.dueDate).toLocaleDateString('es-AR')}
                              {isOverdue && ' (vencida)'}
                            </span>
                          </>
                        )}
                        {isCompleted && action.completedAt && (
                          <>
                            <span>&middot;</span>
                            <span className="text-emerald-600">
                              Completada el{' '}
                              {new Date(action.completedAt).toLocaleDateString('es-AR')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {!isCompleted && nc.status !== 'CLOSED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        onClick={() => completeActionMutation.mutate(action.id)}
                        disabled={completeActionMutation.isPending}
                      >
                        Completar
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
