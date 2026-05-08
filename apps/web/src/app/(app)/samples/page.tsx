'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { TestTube2, Search, ArrowRight } from 'lucide-react'
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

const statusChipCls: Record<SampleStatus, string> = {
  RECEIVED: 'syn-chip-draft',
  IN_TESTING: 'syn-chip-active',
  COMPLETED: 'syn-chip-ok',
}
const statusLabel: Record<SampleStatus, string> = {
  RECEIVED: 'Recibida',
  IN_TESTING: 'En ensayo',
  COMPLETED: 'Completada',
}
const nextStatus: Record<SampleStatus, { status: SampleStatus; label: string } | null> = {
  RECEIVED: { status: 'IN_TESTING', label: 'Iniciar' },
  IN_TESTING: { status: 'COMPLETED', label: 'Completar' },
  COMPLETED: null,
}

export default function SamplesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data: samples = [], isLoading } = useQuery<SampleItem[]>({
    queryKey: ['samples', statusFilter],
    queryFn: () =>
      api.samples.list(
        statusFilter ? { status: statusFilter } : undefined,
      ) as Promise<SampleItem[]>,
  })

  const changeStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.samples.changeStatus(id, status),
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
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Seguimiento · Muestras</div>
          <h1>
            Muestras <span className="italic">de laboratorio.</span>
          </h1>
          <p className="sub">
            Ingreso, ensayo y cierre. Cada muestra nace de una entrada en un registro tipo Muestra y lleva su matriz + métodos.
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
            placeholder="Buscar por código, cliente o registro…"
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
          <option value="RECEIVED">Recibida</option>
          <option value="IN_TESTING">En ensayo</option>
          <option value="COMPLETED">Completada</option>
        </select>
        <div
          className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--ink-3)' }}
        >
          {filtered.length} {filtered.length === 1 ? 'muestra' : 'muestras'}
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
                <th>Código</th>
                <th>Cliente</th>
                <th>Matriz</th>
                <th>Registro</th>
                <th>Recibida</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const next = nextStatus[s.status]
                return (
                  <tr key={s.id}>
                    <td data-label="Código" data-role="identifier">
                      <Link
                        href={`/samples/${s.id}`}
                        style={{ color: 'var(--ink-0)' }}
                      >
                        {s.sampleCode}
                      </Link>
                    </td>
                    <td data-label="Cliente" style={{ color: 'var(--ink-1)' }}>
                      {s.client ?? <span style={{ color: 'var(--ink-4)' }}>—</span>}
                    </td>
                    <td data-label="Matriz" style={{ color: 'var(--ink-1)' }}>
                      {s.matrix?.name ?? <span style={{ color: 'var(--ink-4)' }}>—</span>}
                    </td>
                    <td data-label="Registro" style={{ color: 'var(--ink-1)' }}>
                      {s.record.name}
                    </td>
                    <td
                      data-label="Recibida"
                      className="font-mono text-[12px]"
                      style={{ color: 'var(--ink-2)' }}
                    >
                      {new Date(s.receivedAt).toLocaleDateString('es-AR')}
                    </td>
                    <td data-label="Estado" data-role="status">
                      <span className={`syn-chip ${statusChipCls[s.status]}`}>
                        {statusLabel[s.status]}
                      </span>
                    </td>
                    <td data-label="" style={{ textAlign: 'right' }}>
                      {next ? (
                        <button
                          type="button"
                          onClick={() =>
                            changeStatusMutation.mutate({ id: s.id, status: next.status })
                          }
                          disabled={changeStatusMutation.isPending}
                          className="syn-btn syn-btn-ghost"
                        >
                          {next.label}
                        </button>
                      ) : (
                        <Link
                          href={`/samples/${s.id}`}
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
      <TestTube2 className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
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
            Aún no hay <span className="italic">muestras.</span>
          </>
        )}
      </div>
      <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
        {hasFilter
          ? 'Probá cambiar los filtros o la búsqueda.'
          : 'Creá una entrada en un registro tipo Muestra para que aparezca acá.'}
      </p>
    </div>
  )
}
