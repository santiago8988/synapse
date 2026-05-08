'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronLeft, ChevronRight, Shield } from 'lucide-react'
import { api } from '@/lib/api'

interface AuditLog {
  id: string
  userId: string
  userName?: string
  action: string
  entityType: string
  entityId: string
  createdAt: string
  metadata?: Record<string, unknown>
}

interface AuditResponse {
  data: AuditLog[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

const actionChipCls: Record<string, string> = {
  CREATE: 'syn-chip-ok',
  UPDATE: 'syn-chip-active',
  DELETE: 'syn-chip-fail',
  STATUS_CHANGE: 'syn-chip-warn',
  COMPLETE: 'syn-chip-ok',
  APPROVE: 'syn-chip-active',
}
const actionLabel: Record<string, string> = {
  CREATE: 'Creado',
  UPDATE: 'Actualizado',
  DELETE: 'Eliminado',
  STATUS_CHANGE: 'Cambio estado',
  COMPLETE: 'Completado',
  APPROVE: 'Aprobado',
}

const entityTypeLabels: Record<string, string> = {
  RECORD: 'Registro',
  ENTRY: 'Entrada',
  DOCUMENT: 'Documento',
  INSTRUMENT: 'Instrumento',
  NON_CONFORMITY: 'No conformidad',
  ORGANIZATION: 'Organización',
  USER: 'Usuario',
  AREA: 'Área',
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AuditPage() {
  const [page, setPage] = useState(1)
  const [entityType, setEntityType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [userId, setUserId] = useState('')

  const filters: Record<string, string | number | undefined> = {
    page,
    pageSize: 20,
    ...(entityType ? { entityType } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(userId ? { userId } : {}),
  }

  const { data, isLoading, isError } = useQuery<AuditResponse>({
    queryKey: ['audit-logs', page, entityType, dateFrom, dateTo, userId],
    queryFn: () => api.audit.list(filters) as Promise<AuditResponse>,
  })

  const handleFilter = () => setPage(1)
  const handleClearFilters = () => {
    setEntityType('')
    setDateFrom('')
    setDateTo('')
    setUserId('')
    setPage(1)
  }

  const pagination = data?.pagination
  const logs = data?.data ?? []
  const hasActiveFilters = entityType || dateFrom || dateTo || userId

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Calidad · Auditoría</div>
          <h1>
            Registro <span className="italic">inmutable.</span>
          </h1>
          <p className="sub">
            Historial de todas las acciones realizadas en la organización. Append-only — ningún evento puede modificarse ni eliminarse.
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="syn-card mb-5">
        <div className="syn-card-head">
          <div>
            <div className="eyebrow">· Filtros</div>
            <h3 style={{ marginTop: 6 }}>Acotar la búsqueda</h3>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="syn-btn syn-btn-subtle"
              style={{ padding: '6px 12px' }}
            >
              Limpiar
            </button>
          )}
        </div>
        <div style={{ padding: '14px 20px 18px' }}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="syn-field">
              <span className="syn-field-label">Tipo de entidad</span>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="syn-select"
              >
                <option value="">Todos</option>
                <option value="RECORD">Registro</option>
                <option value="ENTRY">Entrada</option>
                <option value="DOCUMENT">Documento</option>
                <option value="INSTRUMENT">Instrumento</option>
                <option value="NON_CONFORMITY">No conformidad</option>
                <option value="ORGANIZATION">Organización</option>
                <option value="USER">Usuario</option>
                <option value="AREA">Área</option>
              </select>
            </div>
            <div className="syn-field">
              <span className="syn-field-label">Desde</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="syn-input"
              />
            </div>
            <div className="syn-field">
              <span className="syn-field-label">Hasta</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="syn-input"
              />
            </div>
            <div className="syn-field">
              <span className="syn-field-label">ID usuario</span>
              <input
                type="text"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="cmnxyz…"
                className="syn-input font-mono"
                style={{ fontSize: 12 }}
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleFilter}
                className="syn-btn syn-btn-primary w-full justify-center"
              >
                <Search className="h-3.5 w-3.5" /> Filtrar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="syn-card">
        {isLoading ? (
          <table className="syn-table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Tipo</th>
                <th>ID entidad</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  <td>
                    <div
                      className="h-4 w-32 animate-pulse rounded"
                      style={{ background: 'var(--bg-3)' }}
                    />
                  </td>
                  <td>
                    <div
                      className="h-4 w-24 animate-pulse rounded"
                      style={{ background: 'var(--bg-3)' }}
                    />
                  </td>
                  <td>
                    <div
                      className="h-5 w-20 animate-pulse rounded-full"
                      style={{ background: 'var(--bg-3)' }}
                    />
                  </td>
                  <td>
                    <div
                      className="h-4 w-20 animate-pulse rounded"
                      style={{ background: 'var(--bg-3)' }}
                    />
                  </td>
                  <td>
                    <div
                      className="h-4 w-16 animate-pulse rounded"
                      style={{ background: 'var(--bg-3)' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : isError ? (
          <div
            className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"
            style={{ color: 'var(--ink-2)' }}
          >
            <Shield className="h-8 w-8" style={{ color: 'var(--danger)' }} />
            <p className="text-[13px]">Error al cargar los registros de auditoría.</p>
          </div>
        ) : logs.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"
            style={{ color: 'var(--ink-2)' }}
          >
            <Shield className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
            <div
              className="text-[24px]"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
            >
              Sin <span className="italic">eventos.</span>
            </div>
            <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
              {hasActiveFilters
                ? 'Probá cambiar los filtros para ver otros eventos.'
                : 'Cuando haya actividad en la organización se va a registrar acá.'}
            </p>
          </div>
        ) : (
          <>
            <table className="syn-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Acción</th>
                  <th>Tipo</th>
                  <th>ID entidad</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const chipCls = actionChipCls[log.action] ?? 'syn-chip-draft'
                  const label = actionLabel[log.action] ?? log.action
                  const entityLabel =
                    entityTypeLabels[log.entityType] ?? log.entityType
                  return (
                    <tr key={log.id}>
                      <td
                        data-label="Fecha"
                        data-role="identifier"
                        className="font-mono"
                        style={{ color: 'var(--ink-0)', whiteSpace: 'nowrap' }}
                      >
                        {formatDate(log.createdAt)}
                      </td>
                      <td data-label="Usuario" style={{ color: 'var(--ink-1)' }}>
                        {log.userName ?? (
                          <span
                            className="font-mono text-[11px]"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            {log.userId.slice(0, 8)}…
                          </span>
                        )}
                      </td>
                      <td data-label="Acción" data-role="status">
                        <span className={`syn-chip ${chipCls}`}>{label}</span>
                      </td>
                      <td data-label="Tipo" style={{ color: 'var(--ink-2)' }}>
                        {entityLabel}
                      </td>
                      <td data-label="ID entidad">
                        <code
                          className="rounded px-1.5 py-0.5 font-mono text-[11px]"
                          style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
                        >
                          {log.entityId.slice(0, 8)}…
                        </code>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {pagination && pagination.totalPages > 0 && (
              <div
                className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3"
                style={{ borderColor: 'var(--line)' }}
              >
                <p
                  className="font-mono text-[11px] uppercase tracking-[0.14em]"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {(pagination.page - 1) * pagination.pageSize + 1}–
                  {Math.min(
                    pagination.page * pagination.pageSize,
                    pagination.total,
                  )}{' '}
                  de {pagination.total}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={pagination.page <= 1}
                    className="syn-btn syn-btn-ghost"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" /> Anterior
                  </button>
                  <span
                    className="font-mono text-[12px]"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    {pagination.page} / {pagination.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setPage((p) => Math.min(pagination.totalPages, p + 1))
                    }
                    disabled={pagination.page >= pagination.totalPages}
                    className="syn-btn syn-btn-ghost"
                  >
                    Siguiente <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
