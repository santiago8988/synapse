'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, Shield, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'

/**
 * Historia de un registro: sus propios cambios y los de sus entradas.
 *
 * El backend devuelve una vista reducida —sin IP y sin los payloads crudos—
 * con los campos que cambiaron ya resueltos a sus etiquetas. Es lo que permite
 * mostrarla acá a QUALITY_MANAGER, cuando el listado global de /audit está
 * limitado a ADMIN y AUDITOR.
 */

interface Cambio {
  field: string
  from: unknown
  to: unknown
}

interface EventoAuditoria {
  id: string
  action: string
  entityType: string
  entityId: string
  createdAt: string
  user: { id: string; name: string | null; email: string } | null
  changes: Cambio[]
}

const verboLabel: Record<string, string> = {
  created: 'Creó',
  updated: 'Modificó',
  deleted: 'Eliminó',
  completed: 'Completó',
  status_changed: 'Cambió el estado de',
  approved: 'Aprobó',
}

const entidadLabel: Record<string, string> = {
  RECORDS: 'el registro',
  ENTRIES: 'una entrada',
}

const verboColor: Record<string, string> = {
  created: 'var(--ok)',
  updated: 'var(--info)',
  deleted: 'var(--danger)',
  completed: 'var(--ok)',
  status_changed: 'var(--warn)',
}

function verboDe(action: string): string {
  return action.includes('.') ? action.split('.').pop()! : action
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Los valores pueden ser objetos: QUANTITY guarda { value, unit }. */
function mostrarValor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    if ('value' in o) return `${o.value ?? '—'}${o.unit ? ` ${o.unit}` : ''}`
    return JSON.stringify(v)
  }
  return String(v)
}

export function AuditTimeline({ recordId }: { recordId: string }) {
  const { data, isLoading, isError, error } = useQuery<EventoAuditoria[]>({
    queryKey: ['record-audit', recordId],
    queryFn: () => api.audit.forRecord<EventoAuditoria[]>(recordId),
  })

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-12 text-[13px]"
        style={{ color: 'var(--ink-3)' }}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando historia…
      </div>
    )
  }

  if (isError) {
    // El caso esperable es 403: un TECHNICIAN no tiene acceso a la auditoría.
    const mensaje = error instanceof Error ? error.message : 'No se pudo cargar'
    return (
      <div className="py-12 text-center text-[13px]" style={{ color: 'var(--ink-2)' }}>
        {mensaje}
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-center">
        <Shield className="h-7 w-7" style={{ color: 'var(--ink-4)' }} />
        <p className="text-[13px]" style={{ color: 'var(--ink-2)' }}>
          Todavía no hay cambios registrados.
        </p>
      </div>
    )
  }

  return (
    <div className="px-5 py-4">
      <div className="flex flex-col">
        {data.map((evento, i) => {
          const verbo = verboDe(evento.action)
          const color = verboColor[verbo] ?? 'var(--ink-3)'
          const esUltimo = i === data.length - 1

          return (
            <div key={evento.id} className="flex gap-3">
              {/* Riel del timeline */}
              <div className="flex flex-col items-center">
                <span
                  className="mt-[6px] h-2 w-2 shrink-0 rounded-full"
                  style={{ background: color }}
                />
                {!esUltimo && (
                  <span
                    className="w-px flex-1"
                    style={{ background: 'var(--line)', minHeight: 18 }}
                  />
                )}
              </div>

              <div className={`min-w-0 flex-1 ${esUltimo ? '' : 'pb-4'}`}>
                <div className="flex flex-wrap items-baseline gap-x-1.5 text-[12.5px]">
                  <span style={{ color: 'var(--ink-0)', fontWeight: 500 }}>
                    {evento.user?.name || evento.user?.email || 'Usuario eliminado'}
                  </span>
                  <span style={{ color: 'var(--ink-2)' }}>
                    {verboLabel[verbo] ?? evento.action}{' '}
                    {entidadLabel[evento.entityType] ?? evento.entityType}
                  </span>
                  <span
                    className="ml-auto shrink-0 font-mono text-[10px] uppercase tracking-[0.1em]"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    {formatearFecha(evento.createdAt)}
                  </span>
                </div>

                {evento.changes.length > 0 && (
                  <div
                    className="mt-1.5 flex flex-col gap-1 rounded-[8px] border px-3 py-2"
                    style={{ borderColor: 'var(--line)', background: 'var(--bg-2)' }}
                  >
                    {evento.changes.map((c) => (
                      <div
                        key={c.field}
                        className="flex flex-wrap items-center gap-1.5 text-[11.5px]"
                      >
                        <span
                          className="font-mono uppercase tracking-[0.08em]"
                          style={{ color: 'var(--ink-3)' }}
                        >
                          {c.field}
                        </span>
                        <span style={{ color: 'var(--ink-3)' }}>
                          {mostrarValor(c.from)}
                        </span>
                        <ArrowRight className="h-3 w-3" style={{ color: 'var(--ink-4)' }} />
                        <span style={{ color: 'var(--ink-0)', fontWeight: 500 }}>
                          {mostrarValor(c.to)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p
        className="mt-4 border-t pt-3 text-[10.5px]"
        style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}
      >
        Registro append-only: los eventos no se editan ni se borran. Se omiten la
        IP y los datos crudos; para el detalle completo, la sección Auditoría.
      </p>
    </div>
  )
}
