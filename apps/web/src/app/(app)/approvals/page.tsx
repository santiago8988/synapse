'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  XCircle,
  FileText,
  ClipboardList,
  FlaskConical,
  MessageSquare,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface ApprovalRequest {
  id: string
  entityType: 'DOCUMENT' | 'RECORD' | 'RECIPE'
  entityId: string
  status: 'PENDING_REVIEW' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'
  submittedAt: string
  completedAt: string | null
  submittedBy: {
    id: string
    user: { name: string; email: string }
  }
  decisions: Array<{
    id: string
    stage: string
    decision: string
    comments: string | null
    decidedAt: string
    decidedBy: {
      id: string
      user: { name: string; email: string }
    }
  }>
}

const statusChipCls: Record<string, string> = {
  PENDING_REVIEW: 'syn-chip-warn',
  PENDING_APPROVAL: 'syn-chip-active',
  APPROVED: 'syn-chip-ok',
  REJECTED: 'syn-chip-fail',
}
const statusLabel: Record<string, string> = {
  PENDING_REVIEW: 'Pendiente revisión',
  PENDING_APPROVAL: 'Pendiente aprobación',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
}

const entityIcons: Record<string, typeof FileText> = {
  DOCUMENT: FileText,
  RECORD: ClipboardList,
  RECIPE: FlaskConical,
}
const entityLabels: Record<string, string> = {
  DOCUMENT: 'Documento',
  RECORD: 'Registro',
  RECIPE: 'Receta',
}

export default function ApprovalsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'pending' | 'all'>('pending')
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [comments, setComments] = useState('')

  const { data: pendingRequests = [], isLoading: loadingPending } = useQuery({
    queryKey: ['approval', 'pending'],
    queryFn: () => api.approval.getPending() as Promise<ApprovalRequest[]>,
  })

  const { data: allRequests = [], isLoading: loadingAll } = useQuery({
    queryKey: ['approval', 'requests'],
    queryFn: () => api.approval.getRequests() as Promise<ApprovalRequest[]>,
    enabled: tab === 'all',
  })

  const decideMutation = useMutation({
    mutationFn: ({
      requestId,
      decision,
      comments,
    }: {
      requestId: string
      decision: string
      comments?: string
    }) => api.approval.decide(requestId, { decision, comments }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approval'] })
      queryClient.invalidateQueries({ queryKey: ['recipes'] })
      queryClient.invalidateQueries({ queryKey: ['records'] })
      queryClient.invalidateQueries({ queryKey: ['record'] })
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      setDecidingId(null)
      setComments('')
      toast.success('Decisión registrada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const requests = tab === 'pending' ? pendingRequests : allRequests
  const isLoading = tab === 'pending' ? loadingPending : loadingAll

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Calidad · Aprobaciones</div>
          <h1>
            Circuito de <span className="italic">revisión.</span>
          </h1>
          <p className="sub">
            Documentos, registros y recetas que esperan tu revisión o aprobación. La aprobación sigue el flujo ISO de dos etapas: revisor → aprobador.
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-[10px] p-1"
          style={{ background: 'var(--bg-3)' }}
        >
          <TabBtn active={tab === 'pending'} onClick={() => setTab('pending')}>
            Mis pendientes
            {pendingRequests.length > 0 && (
              <span
                className="ml-2 rounded-full px-1.5 py-0.5 font-mono text-[10px]"
                style={{
                  background: tab === 'pending' ? 'var(--primary-hex)' : 'var(--bg-3)',
                  color: tab === 'pending' ? '#fff' : 'var(--ink-2)',
                }}
              >
                {pendingRequests.length}
              </span>
            )}
          </TabBtn>
          <TabBtn active={tab === 'all'} onClick={() => setTab('all')}>
            Todas
          </TabBtn>
        </div>
        <div
          className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--ink-3)' }}
        >
          {requests.length} {requests.length === 1 ? 'solicitud' : 'solicitudes'}
        </div>
      </div>

      {isLoading ? (
        <div
          className="rounded-[14px] border p-8"
          style={{
            background: 'var(--bg-1)',
            borderColor: 'var(--line)',
            color: 'var(--ink-3)',
          }}
        >
          Cargando…
        </div>
      ) : requests.length === 0 ? (
        <div className="syn-card">
          <div
            className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"
            style={{ color: 'var(--ink-2)' }}
          >
            <CheckCircle2 className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
            <div
              className="text-[24px]"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
            >
              {tab === 'pending' ? (
                <>
                  Sin <span className="italic">pendientes.</span>
                </>
              ) : (
                <>
                  Sin <span className="italic">solicitudes.</span>
                </>
              )}
            </div>
            <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
              {tab === 'pending'
                ? 'Cuando alguien envíe algo a revisión te va a aparecer acá.'
                : 'Aún no se generaron solicitudes de aprobación en la organización.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const chipCls = statusChipCls[req.status] ?? 'syn-chip-draft'
            const EntityIcon = entityIcons[req.entityType] ?? FileText
            const isPending =
              req.status === 'PENDING_REVIEW' || req.status === 'PENDING_APPROVAL'
            const isDeciding = decidingId === req.id

            return (
              <div key={req.id} className="syn-card">
                <div className="flex items-start gap-4 p-5">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px]"
                    style={{ background: 'var(--bg-3)' }}
                  >
                    <EntityIcon className="h-4 w-4" style={{ color: 'var(--ink-2)' }} />
                  </div>
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="syn-chip syn-chip-draft">
                        {entityLabels[req.entityType]}
                      </span>
                      <span className={`syn-chip ${chipCls}`}>
                        {statusLabel[req.status]}
                      </span>
                      <span
                        className="font-mono text-[11px]"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        Enviada por {req.submittedBy.user.name} ·{' '}
                        {new Date(req.submittedAt).toLocaleDateString('es-AR')}
                      </span>
                    </div>

                    {/* Decisiones previas */}
                    {req.decisions.length > 0 && (
                      <div className="space-y-1.5 mt-2">
                        {req.decisions.map((d) => (
                          <div
                            key={d.id}
                            className="flex flex-wrap items-center gap-2 text-[12px]"
                          >
                            {d.decision === 'APPROVED' ? (
                              <CheckCircle2
                                className="h-3.5 w-3.5 shrink-0"
                                style={{ color: 'var(--ok)' }}
                              />
                            ) : (
                              <XCircle
                                className="h-3.5 w-3.5 shrink-0"
                                style={{ color: 'var(--danger)' }}
                              />
                            )}
                            <span
                              style={{ color: 'var(--ink-0)', fontWeight: 500 }}
                            >
                              {d.decidedBy.user.name}
                            </span>
                            <span style={{ color: 'var(--ink-3)' }}>
                              {d.stage === 'REVIEWER' ? 'revisó' : 'aprobó'} —{' '}
                              {d.decision === 'APPROVED' ? 'aprobado' : 'rechazado'}
                            </span>
                            {d.comments && (
                              <span
                                className="italic"
                                style={{ color: 'var(--ink-2)' }}
                              >
                                &ldquo;{d.comments}&rdquo;
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Acciones */}
                    {isPending && tab === 'pending' && !isDeciding && (
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            decideMutation.mutate({
                              requestId: req.id,
                              decision: 'APPROVED',
                            })
                          }
                          disabled={decideMutation.isPending}
                          className="syn-btn syn-btn-primary"
                        >
                          <CheckCircle2 className="h-3 w-3" /> Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecidingId(req.id)}
                          className="syn-btn syn-btn-ghost"
                          style={{ color: 'var(--danger)' }}
                        >
                          <XCircle className="h-3 w-3" /> Rechazar
                        </button>
                      </div>
                    )}

                    {/* Form de rechazo */}
                    {isDeciding && (
                      <div
                        className="mt-3 space-y-2 rounded-[10px] border p-3"
                        style={{
                          background: 'var(--danger-soft)',
                          borderColor: 'var(--danger)',
                        }}
                      >
                        <div
                          className="flex items-center gap-2 text-[13px] font-medium"
                          style={{ color: 'var(--danger)' }}
                        >
                          <MessageSquare className="h-4 w-4" />
                          Motivo del rechazo
                        </div>
                        <textarea
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          placeholder="Explicá qué debe corregirse…"
                          rows={2}
                          className="syn-textarea"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              decideMutation.mutate({
                                requestId: req.id,
                                decision: 'REJECTED',
                                comments: comments || undefined,
                              })
                            }
                            disabled={decideMutation.isPending}
                            className="syn-btn syn-btn-primary"
                            style={{
                              background: 'var(--danger)',
                              boxShadow: 'none',
                            }}
                          >
                            Confirmar rechazo
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDecidingId(null)
                              setComments('')
                            }}
                            className="syn-btn syn-btn-subtle"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center rounded-[7px] px-4 py-2 text-[13px] font-medium transition-colors"
      style={{
        background: active ? 'var(--bg-1)' : 'transparent',
        boxShadow: active ? 'var(--shadow-xs)' : undefined,
        color: active ? 'var(--ink-0)' : 'var(--ink-2)',
      }}
    >
      {children}
    </button>
  )
}
