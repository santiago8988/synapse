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
  X,
} from 'lucide-react'
import Link from 'next/link'
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

const statusChipCls: Record<NonConformity['status'], string> = {
  OPEN: 'syn-chip-fail',
  IN_PROGRESS: 'syn-chip-warn',
  RESOLVED: 'syn-chip-active',
  CLOSED: 'syn-chip-ok',
}
const statusLabel: Record<NonConformity['status'], string> = {
  OPEN: 'Abierta',
  IN_PROGRESS: 'En progreso',
  RESOLVED: 'Resuelta',
  CLOSED: 'Cerrada',
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
      <div className="mx-auto max-w-[1280px] space-y-5">
        <div
          className="h-32 animate-pulse rounded-[14px]"
          style={{ background: 'var(--bg-3)' }}
        />
        <div
          className="h-48 animate-pulse rounded-[14px]"
          style={{ background: 'var(--bg-3)' }}
        />
      </div>
    )
  }

  if (!nc) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <Link
          href="/non-conformities"
          className="syn-btn syn-btn-ghost mb-4 inline-flex"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a NCs
        </Link>
        <div className="syn-card">
          <div
            className="flex flex-col items-center gap-2 px-6 py-14 text-center"
            style={{ color: 'var(--ink-2)' }}
          >
            <AlertTriangle className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
            <div
              className="text-[20px]"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
            >
              No conformidad <span className="italic">no encontrada.</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const completedActions = nc.correctiveActions.filter(
    (a) => a.completedAt !== null,
  )
  const hasCompletedActions = completedActions.length > 0
  const canResolve = nc.status === 'IN_PROGRESS' && hasCompletedActions
  const chipCls = statusChipCls[nc.status]

  return (
    <div className="mx-auto max-w-[1280px] fade-in">
      {/* Hero */}
      <div className="syn-rec-hero">
        <div>
          <div className="kicker mb-1.5 flex items-center gap-2">
            <Link
              href="/non-conformities"
              className="flex items-center gap-1 hover:text-ink-0"
              onClick={(e) => {
                e.preventDefault()
                router.push('/non-conformities')
              }}
            >
              <ArrowLeft className="h-3 w-3" /> No conformidades
            </Link>
            <span>·</span>
            <span>#{nc.id.slice(-6).toUpperCase()}</span>
          </div>
          <h2>
            {nc.title}
          </h2>
          <div className="syn-rec-hero-meta">
            <div className="m">
              <span className="mk">ESTADO</span>
              <span className="mv">
                <span className={`syn-chip ${chipCls}`}>{statusLabel[nc.status]}</span>
              </span>
            </div>
            <div className="m">
              <span className="mk">DETECTADA</span>
              <span className="mv font-mono">
                {new Date(nc.createdAt).toLocaleDateString('es-AR')}
              </span>
            </div>
            <div className="m">
              <span className="mk">ACCIONES</span>
              <span className="mv font-mono">
                {completedActions.length}/{nc.correctiveActions.length}
              </span>
            </div>
            {nc.entry && (
              <div className="m">
                <span className="mk">REGISTRO</span>
                <span className="mv">
                  {nc.entry.record?.name ?? nc.entryId}
                </span>
              </div>
            )}
          </div>
        </div>
        {/* Status actions */}
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-start">
          {nc.status === 'OPEN' && (
            <button
              type="button"
              onClick={() => statusMutation.mutate('IN_PROGRESS')}
              disabled={statusMutation.isPending}
              className="syn-btn syn-btn-primary"
            >
              {statusMutation.isPending ? 'Actualizando…' : 'Iniciar tratamiento'}
            </button>
          )}
          {nc.status === 'IN_PROGRESS' && (
            <button
              type="button"
              onClick={() => statusMutation.mutate('RESOLVED')}
              disabled={!canResolve || statusMutation.isPending}
              title={
                !canResolve
                  ? 'Requiere al menos una acción correctiva completada'
                  : undefined
              }
              className="syn-btn syn-btn-primary"
            >
              {statusMutation.isPending ? 'Actualizando…' : 'Resolver'}
            </button>
          )}
          {nc.status === 'RESOLVED' && (
            <button
              type="button"
              onClick={() => statusMutation.mutate('CLOSED')}
              disabled={statusMutation.isPending}
              className="syn-btn syn-btn-primary"
            >
              {statusMutation.isPending ? 'Actualizando…' : 'Cerrar'}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {/* Descripción */}
        <div className="syn-card">
          <div className="syn-card-head">
            <div>
              <div className="eyebrow">· Descripción</div>
              <h3 style={{ marginTop: 6 }}>
                Qué <span className="italic">pasó.</span>
              </h3>
            </div>
          </div>
          <div style={{ padding: '16px 20px 18px' }}>
            <p
              className="text-[13.5px] leading-relaxed"
              style={{ color: 'var(--ink-1)', whiteSpace: 'pre-wrap' }}
            >
              {nc.description}
            </p>
            {nc.status === 'IN_PROGRESS' && !canResolve && (
              <p
                className="mt-3 text-[12px]"
                style={{ color: 'var(--ink-3)' }}
              >
                Agregá al menos una acción correctiva completada para poder resolver.
              </p>
            )}
            {nc.status === 'CLOSED' && (
              <p
                className="mt-3 text-[12px]"
                style={{ color: 'var(--ink-3)' }}
              >
                Esta no conformidad está cerrada.
              </p>
            )}
          </div>
        </div>

        {/* Acciones correctivas */}
        <div className="syn-card">
          <div className="syn-card-head">
            <div>
              <div className="eyebrow">
                · Acciones correctivas ·{' '}
                {nc.correctiveActions.length > 0
                  ? `${completedActions.length}/${nc.correctiveActions.length} completadas`
                  : 'ninguna'}
              </div>
              <h3 style={{ marginTop: 6 }}>
                Pasos para <span className="italic">resolver.</span>
              </h3>
            </div>
            {nc.status !== 'CLOSED' && !showAddAction && (
              <button
                type="button"
                onClick={() => setShowAddAction(true)}
                className="syn-btn syn-btn-ghost"
                style={{ padding: '6px 12px' }}
              >
                <Plus className="h-3 w-3" /> Agregar acción
              </button>
            )}
          </div>
          <div style={{ padding: '14px 20px 18px' }} className="space-y-3">
            {/* Form */}
            {showAddAction && (
              <div
                className="space-y-3 rounded-[10px] border p-3"
                style={{
                  borderColor: 'var(--line)',
                  background: 'var(--bg-2)',
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="kicker">· Nueva acción</div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddAction(false)
                      setNewAction({ description: '', dueDate: '' })
                    }}
                    aria-label="Cerrar"
                    className="rounded p-1"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="syn-field">
                  <span className="syn-field-label">
                    Descripción <span className="req">*</span>
                  </span>
                  <textarea
                    value={newAction.description}
                    onChange={(e) =>
                      setNewAction({ ...newAction, description: e.target.value })
                    }
                    placeholder="Describí la acción correctiva a implementar…"
                    rows={2}
                    className="syn-textarea"
                  />
                </div>
                <div className="syn-field">
                  <span className="syn-field-label">
                    Fecha límite <span className="hint">Opcional</span>
                  </span>
                  <input
                    type="date"
                    value={newAction.dueDate}
                    onChange={(e) =>
                      setNewAction({ ...newAction, dueDate: e.target.value })
                    }
                    className="syn-input"
                    style={{ maxWidth: 240 }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddAction}
                    disabled={
                      !newAction.description.trim() || addActionMutation.isPending
                    }
                    className="syn-btn syn-btn-primary"
                  >
                    {addActionMutation.isPending ? 'Agregando…' : 'Agregar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddAction(false)
                      setNewAction({ description: '', dueDate: '' })
                    }}
                    className="syn-btn syn-btn-ghost"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Lista */}
            {nc.correctiveActions.length === 0 ? (
              <div
                className="flex flex-col items-center gap-2 py-8 text-center"
                style={{ color: 'var(--ink-3)' }}
              >
                <Circle className="h-6 w-6" style={{ color: 'var(--ink-4)' }} />
                <p className="text-[13px]">No hay acciones correctivas registradas.</p>
              </div>
            ) : (
              nc.correctiveActions.map((action) => {
                const isCompleted = action.completedAt !== null
                const isOverdue =
                  !isCompleted &&
                  action.dueDate &&
                  new Date(action.dueDate) < new Date()
                return (
                  <div
                    key={action.id}
                    className="flex items-start gap-3 rounded-[10px] border p-3"
                    style={{
                      borderColor: isCompleted
                        ? 'var(--ok)'
                        : isOverdue
                          ? 'var(--danger)'
                          : 'var(--line)',
                      background: isCompleted
                        ? 'var(--ok-soft)'
                        : isOverdue
                          ? 'var(--danger-soft)'
                          : 'var(--bg-1)',
                    }}
                  >
                    {isCompleted ? (
                      <CheckCircle2
                        className="mt-0.5 h-5 w-5 shrink-0"
                        style={{ color: 'var(--ok)' }}
                      />
                    ) : (
                      <Circle
                        className="mt-0.5 h-5 w-5 shrink-0"
                        style={{ color: 'var(--ink-3)' }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[13.5px]"
                        style={{
                          color: isCompleted ? 'var(--ink-3)' : 'var(--ink-0)',
                          textDecoration: isCompleted ? 'line-through' : undefined,
                        }}
                      >
                        {action.description}
                      </p>
                      <div
                        className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-[11px]"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        <span>
                          Creada{' '}
                          {new Date(action.createdAt).toLocaleDateString('es-AR')}
                        </span>
                        {action.dueDate && (
                          <>
                            <span style={{ color: 'var(--ink-4)' }}>·</span>
                            <span
                              className="inline-flex items-center gap-1"
                              style={{
                                color: isOverdue ? 'var(--danger)' : 'var(--ink-3)',
                                fontWeight: isOverdue ? 500 : 400,
                              }}
                            >
                              <Clock className="h-3 w-3" />
                              Vence{' '}
                              {new Date(action.dueDate).toLocaleDateString('es-AR')}
                              {isOverdue && ' (venc)'}
                            </span>
                          </>
                        )}
                        {isCompleted && action.completedAt && (
                          <>
                            <span style={{ color: 'var(--ink-4)' }}>·</span>
                            <span style={{ color: 'var(--ok)' }}>
                              Completada{' '}
                              {new Date(action.completedAt).toLocaleDateString('es-AR')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {!isCompleted && nc.status !== 'CLOSED' && (
                      <button
                        type="button"
                        onClick={() => completeActionMutation.mutate(action.id)}
                        disabled={completeActionMutation.isPending}
                        className="syn-btn syn-btn-ghost shrink-0"
                        style={{ padding: '6px 12px' }}
                      >
                        Completar
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
