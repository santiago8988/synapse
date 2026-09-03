'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ScanLine, Search, CalendarClock, AlertTriangle, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'

type CalibrationStatus = 'IN_PROGRESS' | 'COMPLETED' | 'APPROVED' | 'REJECTED'

interface CalibrationItem {
  id: string
  status: CalibrationStatus
  results: Record<string, unknown> | null
  dueDate: string | null
  createdAt: string
  completedAt: string | null
  entry: {
    id: string
    data: Record<string, unknown>
    record: { id: string; name: string }
    instrument: { id: string; status: string } | null
  }
  template: { id: string; name: string; code: string | null } | null
}

const statusChipCls: Record<CalibrationStatus | 'PENDING', string> = {
  IN_PROGRESS: 'syn-chip-active',
  // COMPLETED es el estado final exitoso del flujo nuevo (no requiere
  // aprobación adicional). APPROVED queda solo para data legacy.
  COMPLETED: 'syn-chip-ok',
  APPROVED: 'syn-chip-ok',
  REJECTED: 'syn-chip-fail',
  PENDING: 'syn-chip-draft',
}
const statusLabel: Record<CalibrationStatus | 'PENDING', string> = {
  IN_PROGRESS: 'En progreso',
  COMPLETED: 'Completada',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  PENDING: 'Pendiente',
}
export default function CalibrationsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const { data: calibrations = [], isLoading } = useQuery<CalibrationItem[]>({
    queryKey: ['calibrations', statusFilter],
    queryFn: () =>
      api.calibrations.list(
        statusFilter ? { status: statusFilter } : undefined,
      ) as Promise<CalibrationItem[]>,
  })

  const filtered = calibrations.filter((c) => {
    const codigo = Object.values(c.entry?.data || {}).find((v) => typeof v === 'string') || ''
    const templateName = c.template?.name || ''
    const s = search.toLowerCase()
    return (
      String(codigo).toLowerCase().includes(s) ||
      templateName.toLowerCase().includes(s) ||
      c.entry.record.name.toLowerCase().includes(s)
    )
  })

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Seguimiento · Calibraciones</div>
          <h1>
            Verificaciones <span className="italic">internas.</span>
          </h1>
          <p className="sub">
            Ciclos de calibración por instrumento. Cada ejecución sigue la plantilla: pruebas → puntos → lecturas, y cierra en aprobada o rechazada.
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
            placeholder="Buscar por código, plantilla o registro…"
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
          <option value="IN_PROGRESS">En progreso</option>
          <option value="COMPLETED">Completada</option>
          <option value="APPROVED">Aprobada</option>
          <option value="REJECTED">Rechazada</option>
        </select>
        <div
          className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--ink-3)' }}
        >
          {filtered.length} {filtered.length === 1 ? 'calibración' : 'calibraciones'}
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
                <th>Registro</th>
                <th>Plantilla</th>
                <th>Vence</th>
                <th>Estado</th>
                <th style={{ textAlign: 'right' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const codigo =
                  Object.values(c.entry?.data || {}).find((v) => typeof v === 'string') || '—'
                const hasResults = c.results && Object.keys(c.results).length > 0
                const effectiveKey: CalibrationStatus | 'PENDING' =
                  c.status === 'IN_PROGRESS' && !hasResults ? 'PENDING' : c.status

                const dueDate = c.dueDate ? new Date(c.dueDate) : null
                const isOverdue =
                  !!dueDate &&
                  dueDate.getTime() < Date.now() &&
                  c.status !== 'APPROVED' &&
                  c.status !== 'REJECTED'
                const daysUntilDue = dueDate
                  ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  : null

                return (
                  <tr key={c.id}>
                    <td data-label="Código" data-role="identifier">
                      <Link
                        href={`/calibrations/${c.id}`}
                        style={{ color: 'var(--ink-0)' }}
                      >
                        {String(codigo)}
                      </Link>
                    </td>
                    <td data-label="Registro" style={{ color: 'var(--ink-1)' }}>
                      {c.entry.record.name}
                    </td>
                    <td data-label="Plantilla" style={{ color: 'var(--ink-1)' }}>
                      {c.template?.name ?? <span style={{ color: 'var(--ink-4)' }}>—</span>}
                    </td>
                    <td data-label="Vence">
                      {dueDate ? (
                        <span
                          className="inline-flex items-center gap-1.5 font-mono text-[12px]"
                          style={{
                            color: isOverdue
                              ? 'var(--danger)'
                              : daysUntilDue !== null && daysUntilDue <= 7
                                ? 'var(--warn)'
                                : 'var(--ink-2)',
                            fontWeight: isOverdue ? 500 : 400,
                          }}
                        >
                          {isOverdue ? (
                            <AlertTriangle className="h-3.5 w-3.5" />
                          ) : (
                            <CalendarClock className="h-3.5 w-3.5" />
                          )}
                          {dueDate.toLocaleDateString('es-AR')}
                          {daysUntilDue !== null && (
                            <span style={{ opacity: 0.75 }}>
                              (
                              {isOverdue ? `${Math.abs(daysUntilDue)}d venc` : `en ${daysUntilDue}d`}
                              )
                            </span>
                          )}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-4)' }}>—</span>
                      )}
                    </td>
                    <td data-label="Estado" data-role="status">
                      <span className={`syn-chip ${statusChipCls[effectiveKey]}`}>
                        {statusLabel[effectiveKey]}
                      </span>
                    </td>
                    <td data-label="" style={{ textAlign: 'right' }}>
                      <Link
                        href={`/calibrations/${c.id}`}
                        className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em]"
                        style={{ color: 'var(--primary-hex)' }}
                      >
                        Abrir <ArrowRight className="h-3 w-3" />
                      </Link>
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
      <ScanLine className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
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
            Aún no hay <span className="italic">calibraciones.</span>
          </>
        )}
      </div>
      <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
        {hasFilter
          ? 'Probá cambiar los filtros o la búsqueda.'
          : 'Creá una entrada en un registro tipo Calibración para iniciar una verificación interna.'}
      </p>
    </div>
  )
}
