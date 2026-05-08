'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Package, Search, ArrowRight } from 'lucide-react'
import Link from 'next/link'
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

const statusChipCls: Record<BatchStatus, string> = {
  PLANNED: 'syn-chip-draft',
  IN_PROGRESS: 'syn-chip-active',
  COMPLETED: 'syn-chip-warn',
  APPROVED: 'syn-chip-ok',
  REJECTED: 'syn-chip-fail',
}
const statusLabel: Record<BatchStatus, string> = {
  PLANNED: 'Planificado',
  IN_PROGRESS: 'En producción',
  COMPLETED: 'Completado',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
}
const nextStatus: Record<BatchStatus, { status: BatchStatus; label: string } | null> = {
  PLANNED: { status: 'IN_PROGRESS', label: 'Iniciar' },
  IN_PROGRESS: { status: 'COMPLETED', label: 'Completar' },
  COMPLETED: null,
  APPROVED: null,
  REJECTED: { status: 'PLANNED', label: 'Reiniciar' },
}

export default function BatchesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data: batches = [], isLoading } = useQuery<BatchItem[]>({
    queryKey: ['batches', statusFilter],
    queryFn: () =>
      api.batches.list(
        statusFilter ? { status: statusFilter } : undefined,
      ) as Promise<BatchItem[]>,
  })

  const changeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.batches.changeStatus(id, { status }),
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
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Seguimiento · Lotes</div>
          <h1>
            Lotes de <span className="italic">producción.</span>
          </h1>
          <p className="sub">
            Cada lote nace de una entrada en un registro tipo Lote. Seguí su ciclo: planificado → en producción → completado → aprobado / rechazado.
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-[420px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--ink-3)' }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por lote o registro…"
            className="h-[38px] w-full rounded-[10px] border pl-10 pr-3 text-[13px] outline-none"
            style={{
              background: 'var(--bg-1)',
              borderColor: 'var(--line-2)',
              color: 'var(--ink-0)',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="syn-select"
          style={{ maxWidth: 200 }}
        >
          <option value="">Todos los estados</option>
          <option value="PLANNED">Planificado</option>
          <option value="IN_PROGRESS">En producción</option>
          <option value="COMPLETED">Completado</option>
          <option value="APPROVED">Aprobado</option>
          <option value="REJECTED">Rechazado</option>
        </select>
        <div
          className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--ink-3)' }}
        >
          {filtered.length} {filtered.length === 1 ? 'lote' : 'lotes'}
        </div>
      </div>

      <div className="syn-card">
        {isLoading ? (
          <div className="p-8" style={{ color: 'var(--ink-3)' }}>
            Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState hasFilter={!!search || !!statusFilter} />
        ) : (
          <table className="syn-table">
            <thead>
              <tr>
                <th>Lote</th>
                <th>Registro</th>
                <th>Receta</th>
                <th>Inicio</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const next = nextStatus[b.status]
                const isReviewable = b.status === 'COMPLETED'
                return (
                  <tr key={b.id}>
                    <td data-label="Lote" data-role="identifier">
                      <Link
                        href={`/batches/${b.id}`}
                        style={{ color: 'var(--ink-0)' }}
                      >
                        {b.lotNumber}
                      </Link>
                    </td>
                    <td data-label="Registro" style={{ color: 'var(--ink-1)' }}>
                      {b.record.name}
                    </td>
                    <td data-label="Receta" style={{ color: 'var(--ink-1)' }}>
                      {b.recipe?.name ?? <span style={{ color: 'var(--ink-4)' }}>—</span>}
                    </td>
                    <td
                      data-label="Inicio"
                      className="font-mono text-[12px]"
                      style={{ color: 'var(--ink-2)' }}
                    >
                      {b.startedAt ? (
                        new Date(b.startedAt).toLocaleDateString('es-AR')
                      ) : (
                        <span style={{ color: 'var(--ink-4)' }}>—</span>
                      )}
                    </td>
                    <td data-label="Estado" data-role="status">
                      <span className={`syn-chip ${statusChipCls[b.status]}`}>
                        {statusLabel[b.status]}
                      </span>
                    </td>
                    <td data-label="" style={{ textAlign: 'right' }}>
                      {isReviewable ? (
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              changeStatusMutation.mutate({ id: b.id, status: 'REJECTED' })
                            }
                            disabled={changeStatusMutation.isPending}
                            className="syn-btn syn-btn-ghost"
                            style={{ color: 'var(--danger)' }}
                          >
                            Rechazar
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              changeStatusMutation.mutate({ id: b.id, status: 'APPROVED' })
                            }
                            disabled={changeStatusMutation.isPending}
                            className="syn-btn syn-btn-primary"
                          >
                            Aprobar
                          </button>
                        </div>
                      ) : next ? (
                        <button
                          type="button"
                          onClick={() =>
                            changeStatusMutation.mutate({ id: b.id, status: next.status })
                          }
                          disabled={changeStatusMutation.isPending}
                          className="syn-btn syn-btn-ghost"
                        >
                          {next.label}
                        </button>
                      ) : (
                        <Link
                          href={`/batches/${b.id}`}
                          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em]"
                          style={{ color: 'var(--primary-hex)' }}
                        >
                          Abrir <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"
      style={{ color: 'var(--ink-2)' }}
    >
      <Package className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
      <div
        className="text-[24px]"
        style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
      >
        {hasFilter ? (
          <>
            Sin <span className="italic">coincidencias.</span>
          </>
        ) : (
          <>
            Aún no hay <span className="italic">lotes.</span>
          </>
        )}
      </div>
      <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
        {hasFilter
          ? 'Probá cambiar los filtros o la búsqueda.'
          : 'Creá una entrada en un registro tipo Lote para arrancar un ciclo de producción.'}
      </p>
    </div>
  )
}
