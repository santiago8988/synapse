'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, XCircle, Loader2, Clock, FileText, ClipboardList, FlaskConical, MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

const statusConfig: Record<string, { label: string; variant: 'secondary' | 'info' | 'success' | 'destructive' | 'warning' }> = {
  PENDING_REVIEW: { label: 'Pendiente de revisión', variant: 'warning' },
  PENDING_APPROVAL: { label: 'Pendiente de aprobación', variant: 'info' },
  APPROVED: { label: 'Aprobada', variant: 'success' },
  REJECTED: { label: 'Rechazada', variant: 'destructive' },
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
    mutationFn: ({ requestId, decision, comments }: { requestId: string; decision: string; comments?: string }) =>
      api.approval.decide(requestId, { decision, comments }),
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Aprobaciones</h1>
        <p className="mt-1 text-muted-foreground">
          Circuito de revisión y aprobación ISO
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => setTab('pending')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'pending' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Mis pendientes
          {pendingRequests.length > 0 && (
            <Badge variant="default" className="ml-2">{pendingRequests.length}</Badge>
          )}
        </button>
        <button
          onClick={() => setTab('all')}
          className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'all' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Todas
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {tab === 'pending' ? 'No tenés solicitudes pendientes' : 'No hay solicitudes de aprobación'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const st = statusConfig[req.status] || statusConfig.PENDING_REVIEW
            const EntityIcon = entityIcons[req.entityType] || FileText
            const isPending = req.status === 'PENDING_REVIEW' || req.status === 'PENDING_APPROVAL'
            const isDeciding = decidingId === req.id

            return (
              <Card key={req.id}>
                <div className="flex items-start gap-4 p-4">
                  <EntityIcon className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{entityLabels[req.entityType]}</Badge>
                      <Badge variant={st.variant}>{st.label}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Enviada por {req.submittedBy.user.name} el {new Date(req.submittedAt).toLocaleDateString('es-AR')}
                      </span>
                    </div>

                    {/* Decisiones previas */}
                    {req.decisions.length > 0 && (
                      <div className="space-y-1 mt-2">
                        {req.decisions.map((d) => (
                          <div key={d.id} className="flex items-center gap-2 text-xs">
                            {d.decision === 'APPROVED' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 text-red-500" />
                            )}
                            <span className="font-medium">{d.decidedBy.user.name}</span>
                            <span className="text-muted-foreground">
                              {d.stage === 'REVIEWER' ? 'revisó' : 'aprobó'} — {d.decision === 'APPROVED' ? 'aprobado' : 'rechazado'}
                            </span>
                            {d.comments && (
                              <span className="text-muted-foreground italic">"{d.comments}"</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Acciones */}
                    {isPending && tab === 'pending' && !isDeciding && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => decideMutation.mutate({ requestId: req.id, decision: 'APPROVED' })}
                          disabled={decideMutation.isPending}
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Aprobar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600"
                          onClick={() => setDecidingId(req.id)}
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Rechazar
                        </Button>
                      </div>
                    )}

                    {/* Form de rechazo con comentarios */}
                    {isDeciding && (
                      <div className="mt-3 space-y-2 rounded-lg border bg-red-50/50 dark:bg-red-950/20 p-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-red-600">
                          <MessageSquare className="h-4 w-4" />
                          Motivo del rechazo
                        </div>
                        <textarea
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          placeholder="Explicá qué debe corregirse..."
                          rows={2}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => decideMutation.mutate({ requestId: req.id, decision: 'REJECTED', comments: comments || undefined })}
                            disabled={decideMutation.isPending}
                          >
                            Confirmar rechazo
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setDecidingId(null); setComments('') }}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
