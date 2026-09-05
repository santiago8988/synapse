'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Plus,
  Search,
  ChevronRight,
  ArchiveRestore,
  ArrowRight,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface RecordItem {
  id: string
  name: string
  type:
    | 'PERIODIC'
    | 'NOT_PERIODIC'
    | 'NOT_PERIODIC_WITH_REVISION'
    | 'INSTRUMENTAL'
    | 'BATCH'
    | 'SAMPLE'
    | 'STOCK'
    | 'CALIBRATION'
  periodicity: number | null
  isActive: boolean
  areas: Array<{ area: { id: string; name: string } }>
  document: { id: string; title: string; code: string | null } | null
  fields: Array<{ id: string; label: string; fieldType: string }>
  _count: { entries: number }
  updatedAt: string
}

const typeLabel: Record<string, string> = {
  PERIODIC: 'Periódico',
  NOT_PERIODIC: 'No periódico',
  NOT_PERIODIC_WITH_REVISION: 'Con revisión',
  INSTRUMENTAL: 'Instrumental',
  BATCH: 'Lote',
  SAMPLE: 'Muestra',
  STOCK: 'Stock',
  CALIBRATION: 'Calibración',
}

const typeChipClass: Record<string, string> = {
  PERIODIC: 'syn-chip-active',
  NOT_PERIODIC: 'syn-chip-draft',
  NOT_PERIODIC_WITH_REVISION: 'syn-chip-warn',
  INSTRUMENTAL: 'syn-chip-active',
  BATCH: 'syn-chip-active',
  SAMPLE: 'syn-chip-active',
  STOCK: 'syn-chip-warn',
  CALIBRATION: 'syn-chip-ok',
}

function formatRelative(iso: string) {
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `${mins} min`
  if (hrs < 24) return `${hrs} h`
  if (days < 7) return `${days} d`
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
}

export default function RecordsPage() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const queryClient = useQueryClient()

  const { data: records = [], isLoading } = useQuery<RecordItem[]>({
    queryKey: ['records', tab],
    queryFn: () => api.records.list(tab === 'archived') as Promise<RecordItem[]>,
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.records.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] })
      toast.success('Registro restaurado')
    },
    onError: () => toast.error('Error al restaurar'),
  })

  const filtered = records.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="mx-auto max-w-[1280px]">
      {/* Page header */}
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Definición · Registros</div>
          <h1>
            Registros <span className="italic">de calidad.</span>
          </h1>
          <p className="sub">
            Templates con campos dinámicos — comparaciones, fórmulas y acciones en
            cascada. Cada template genera entradas trazables en la organización.
          </p>
        </div>
        <div className="syn-ph-actions">
          <Link href="/records/new" className="syn-btn syn-btn-primary">
            <Plus className="h-3 w-3" /> Nuevo registro
          </Link>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div
          className="inline-flex rounded-[10px] p-1"
          style={{ background: 'var(--bg-3)' }}
        >
          <TabBtn active={tab === 'active'} onClick={() => setTab('active')}>
            Activos
          </TabBtn>
          <TabBtn active={tab === 'archived'} onClick={() => setTab('archived')}>
            Archivados
          </TabBtn>
        </div>

        <div className="relative ml-auto w-full max-w-[380px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: 'var(--ink-3)' }}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre…"
            className="h-[38px] w-full rounded-[10px] border pl-10 pr-3 text-[13px] outline-none transition-colors"
            style={{
              background: 'var(--bg-1)',
              borderColor: 'var(--line-2)',
              color: 'var(--ink-0)',
            }}
          />
        </div>

        <div
          className="font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--ink-3)' }}
        >
          {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'}
        </div>
      </div>

      {/* Table */}
      <div className="syn-card">
        {isLoading ? (
          <div className="p-8" style={{ color: 'var(--ink-3)' }}>
            Cargando…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState tab={tab} onCreate="/records/new" />
        ) : (
          <div className="syn-table-wrap">
            <table className="syn-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Área</th>
                  <th style={{ textAlign: 'right' }}>Campos</th>
                  <th style={{ textAlign: 'right' }}>Entradas</th>
                  <th>Actualizado</th>
                  <th style={{ textAlign: 'right' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const chipCls = typeChipClass[r.type] ?? 'syn-chip-draft'
                  return (
                    <tr
                      key={r.id}
                      style={tab === 'archived' ? { opacity: 0.7 } : undefined}
                    >
                      <td data-label="Nombre" data-role="identifier">
                        <Link
                          href={`/records/${r.id}`}
                          className="group flex items-center gap-2"
                          style={{ color: 'var(--ink-0)', fontWeight: 500 }}
                        >
                          <span className="group-hover:underline">{r.name}</span>
                        </Link>
                        {r.document && (
                          <div
                            className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            Doc: {r.document.code || r.document.title}
                          </div>
                        )}
                      </td>
                      <td data-label="Tipo">
                        <span className={`syn-chip ${chipCls}`}>
                          {typeLabel[r.type] ?? r.type}
                        </span>
                        {r.type === 'PERIODIC' && r.periodicity && (
                          <span
                            className="ml-2 font-mono text-[10px] uppercase tracking-[0.1em]"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            c/{r.periodicity}d
                          </span>
                        )}
                      </td>
                      <td data-label="Áreas" style={{ color: 'var(--ink-1)' }}>
                        {r.areas && r.areas.length > 0 ? (
                          r.areas.map((ra) => ra.area.name).join(', ')
                        ) : (
                          <span style={{ color: 'var(--ink-4)' }}>—</span>
                        )}
                      </td>
                      <td
                        data-label="Campos"
                        className="col-mono"
                        style={{ textAlign: 'right' }}
                      >
                        {r.fields.length}
                      </td>
                      <td
                        data-label="Entradas"
                        className="col-mono"
                        style={{ textAlign: 'right' }}
                      >
                        {r._count.entries}
                      </td>
                      <td
                        data-label="Actualizado"
                        className="font-mono text-[12px]"
                        style={{ color: 'var(--ink-2)' }}
                      >
                        {formatRelative(r.updatedAt)}
                      </td>
                      <td data-label="" style={{ textAlign: 'right' }}>
                        {tab === 'archived' ? (
                          <button
                            type="button"
                            className="syn-btn syn-btn-ghost"
                            onClick={() => restoreMutation.mutate(r.id)}
                            disabled={restoreMutation.isPending}
                          >
                            <ArchiveRestore className="h-3.5 w-3.5" />
                            Restaurar
                          </button>
                        ) : (
                          <Link
                            href={`/records/${r.id}`}
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
          </div>
        )}
      </div>
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
      className="rounded-[7px] px-4 py-2 text-[13px] font-medium transition-colors"
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

function EmptyState({
  tab,
  onCreate,
}: {
  tab: 'active' | 'archived'
  onCreate: string
}) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center"
      style={{ color: 'var(--ink-2)' }}
    >
      <div
        className="kicker mb-1"
        style={{ color: 'var(--ink-3)' }}
      >
        · {tab === 'archived' ? 'Archivo' : 'Vacío'}
      </div>
      <div
        className="text-[28px]"
        style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
      >
        {tab === 'archived' ? (
          <>
            Sin <span className="italic">archivados.</span>
          </>
        ) : (
          <>
            Aún no hay <span className="italic">registros.</span>
          </>
        )}
      </div>
      <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
        {tab === 'archived'
          ? 'Los registros que desactives aparecerán acá para que los puedas restaurar.'
          : 'Creá el primer template de calidad — definí sus campos, periodicidad y acciones en cascada.'}
      </p>
      {tab === 'active' && (
        <Link href={onCreate} className="syn-btn syn-btn-primary mt-2">
          <Plus className="h-3 w-3" /> Crear registro
        </Link>
      )}
    </div>
  )
}
