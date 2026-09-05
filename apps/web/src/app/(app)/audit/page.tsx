'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ChevronLeft, ChevronRight, Shield, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'

interface AuditLog {
  id: string
  userId: string
  /** null si el usuario ya no existe: el log es historico. */
  user: { id: string; name: string | null; email: string } | null
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

// El backend registra la accion como "<entidad>.<verbo>" (records.updated).
// Antes estos mapas se indexaban con la accion completa y con claves viejas
// tipo CREATE, asi que nunca matcheaban: todo salia con el chip gris y el
// texto crudo. Se indexa por el verbo, que es la parte estable.
const actionChipCls: Record<string, string> = {
  created: 'syn-chip-ok',
  updated: 'syn-chip-active',
  deleted: 'syn-chip-fail',
  status_changed: 'syn-chip-warn',
  completed: 'syn-chip-ok',
  approved: 'syn-chip-active',
}
const actionLabel: Record<string, string> = {
  created: 'Creado',
  updated: 'Actualizado',
  deleted: 'Eliminado',
  status_changed: 'Cambio de estado',
  completed: 'Completado',
  approved: 'Aprobado',
}

/** Verbo de la accion: "records.updated" -> "updated". */
function actionVerb(action: string): string {
  return action.includes('.') ? action.split('.').pop()! : action
}

// Las claves van en plural porque el interceptor deriva entityType del nombre
// del controller (RecordsController -> RECORDS). Antes estaban en singular y no
// matcheaba ninguna, por eso se veia "RECORDS" crudo en la tabla.
const entityTypeLabels: Record<string, string> = {
  RECORDS: 'Registro',
  ENTRIES: 'Entrada',
  DOCUMENTS: 'Documento',
  INSTRUMENTS: 'Instrumento',
  NON_CONFORMITIES: 'No conformidad',
  ORGANIZATIONS: 'Organización',
  AREAS: 'Área',
  BATCHES: 'Lote',
  SAMPLES: 'Muestra',
  RECIPES: 'Fórmula',
  MATRICES: 'Matriz',
  METHODS: 'Método',
  CALIBRATIONS: 'Calibración',
  CALIBRATION_TEMPLATES: 'Plantilla de calibración',
  STOCK: 'Stock',
  APPROVAL: 'Aprobación',
}

// Solo estas entidades tienen pagina de detalle. Para el resto se muestra el id
// como texto: es preferible a un enlace que lleve a un 404.
const entityDetailRoute: Record<string, string> = {
  RECORDS: '/records',
  INSTRUMENTS: '/instruments',
  BATCHES: '/batches',
  SAMPLES: '/samples',
  NON_CONFORMITIES: '/non-conformities',
  CALIBRATIONS: '/calibrations',
}

function entityHref(entityType: string, entityId: string): string | null {
  const base = entityDetailRoute[entityType]
  if (!base || !entityId || entityId === 'unknown') return null
  return `${base}/${entityId}`
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
          <div className="syn-table-wrap">
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
          </div>
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
            <div className="syn-table-wrap">
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
                    const verb = actionVerb(log.action)
                    const chipCls = actionChipCls[verb] ?? 'syn-chip-draft'
                    const label = actionLabel[verb] ?? log.action
                    const entityLabel =
                      entityTypeLabels[log.entityType] ?? log.entityType
                    const href = entityHref(log.entityType, log.entityId)
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
                          {log.user ? (
                            <span title={log.user.email}>
                              {log.user.name || log.user.email}
                            </span>
                          ) : (
                            // Usuario eliminado: queda el id, que es lo unico que
                            // guarda el log.
                            <span
                              className="font-mono text-[11px]"
                              style={{ color: 'var(--ink-3)' }}
                              title={log.userId}
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
                          {href ? (
                            <Link
                              href={href}
                              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px] hover:underline"
                              style={{
                                background: 'var(--bg-3)',
                                color: 'var(--primary-hex)',
                              }}
                              title={`Abrir ${entityLabel} ${log.entityId}`}
                            >
                              {log.entityId.slice(0, 8)}…
                              <ArrowUpRight className="h-3 w-3" />
                            </Link>
                          ) : (
                            <code
                              className="rounded px-1.5 py-0.5 font-mono text-[11px]"
                              style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}
                              title={log.entityId}
                            >
                              {log.entityId.slice(0, 8)}…
                            </code>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
