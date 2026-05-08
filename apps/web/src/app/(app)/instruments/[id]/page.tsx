'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Settings,
  ExternalLink,
} from 'lucide-react'
import { api } from '@/lib/api'
import { toast } from 'sonner'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type InstrumentStatus = 'ACTIVE' | 'IN_CALIBRATION' | 'IN_REPAIR' | 'DECOMMISSIONED'

interface RecordField {
  id: string
  label: string
  fieldType: string
  isIdentifier: boolean
}

interface StatusLog {
  id: string
  fromStatus: InstrumentStatus | null
  toStatus: InstrumentStatus
  reason: string | null
  changedById: string
  changedAt: string
}

interface Instrument {
  id: string
  organizationId: string
  entryId: string
  recordId: string
  status: InstrumentStatus
  nextCalibrationAt: string | null
  createdAt: string
  entry: {
    id: string
    data: Record<string, unknown>
    status: string
    createdAt: string
  }
  record: {
    id: string
    name: string
    periodicity: number | null
    notifyDaysBefore: number | null
    fields: RecordField[]
  }
  statusLogs?: StatusLog[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusConfig: Record<
  InstrumentStatus,
  { label: string; variant: 'success' | 'info' | 'warning' | 'secondary'; icon: typeof CheckCircle2 }
> = {
  ACTIVE: { label: 'Activo', variant: 'success', icon: CheckCircle2 },
  IN_CALIBRATION: { label: 'En Calibración', variant: 'info', icon: Settings },
  IN_REPAIR: { label: 'En Reparación', variant: 'warning', icon: AlertTriangle },
  DECOMMISSIONED: { label: 'Dado de Baja', variant: 'secondary', icon: XCircle },
}

const allStatuses: InstrumentStatus[] = ['ACTIVE', 'IN_CALIBRATION', 'IN_REPAIR', 'DECOMMISSIONED']

function getIdentifier(inst: Instrument): string {
  const identifierField = inst.record.fields.find((f) => f.isIdentifier)
  if (identifierField) {
    const val = inst.entry.data[identifierField.id]
    if (val !== undefined && val !== null && val !== '') return String(val)
  }
  for (const f of inst.record.fields) {
    const val = inst.entry.data[f.id]
    if (val !== undefined && val !== null && val !== '') return String(val)
  }
  return 'Sin identificador'
}

type CalibrationIndicator = 'green' | 'amber' | 'red' | null

function getCalibrationIndicator(
  nextCalibrationAt: string | null,
  notifyDaysBefore: number | null,
): CalibrationIndicator {
  if (!nextCalibrationAt) return null
  const now = new Date()
  const next = new Date(nextCalibrationAt)
  const diffMs = next.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'red'
  if (notifyDaysBefore != null && diffDays <= notifyDaysBefore) return 'amber'
  return 'green'
}

function formatFieldValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sí' : 'No'
  if (typeof value === 'number') return String(value)
  return String(value)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InstrumentDetailPage() {
  const params = useParams()
  const queryClient = useQueryClient()
  const id = params.id as string

  const [newStatus, setNewStatus] = useState<InstrumentStatus | ''>('')
  const [statusReason, setStatusReason] = useState('')

  const { data: instrument, isLoading, error } = useQuery<Instrument>({
    queryKey: ['instruments', id],
    queryFn: () => api.instruments.get(id) as Promise<Instrument>,
  })

  const statusMutation = useMutation({
    mutationFn: (data: { status: string; reason?: string }) =>
      api.instruments.changeStatus(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instruments', id] })
      queryClient.invalidateQueries({ queryKey: ['instruments'] })
      setNewStatus('')
      setStatusReason('')
      toast.success('Estado actualizado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const handleStatusChange = () => {
    if (!newStatus) return
    statusMutation.mutate({
      status: newStatus,
      reason: statusReason || undefined,
    })
  }

  // ---- Loading state ----
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

  // ---- Error / not found ----
  if (error || !instrument) {
    return (
      <div className="mx-auto max-w-[1280px]">
        <Link
          href="/instruments"
          className="syn-btn syn-btn-ghost mb-4 inline-flex"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver a instrumental
        </Link>
        <div className="syn-card">
          <div
            className="flex flex-col items-center gap-2 px-6 py-14 text-center"
            style={{ color: 'var(--ink-2)' }}
          >
            <XCircle className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
            <div
              className="text-[20px]"
              style={{ fontFamily: 'var(--font-serif)', color: 'var(--ink-0)' }}
            >
              Instrumento <span className="italic">no encontrado.</span>
            </div>
            <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
              El instrumento solicitado no existe o fue eliminado.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const currentStatus = statusConfig[instrument.status]
  const statusChipCls: Record<InstrumentStatus, string> = {
    ACTIVE: 'syn-chip-ok',
    IN_CALIBRATION: 'syn-chip-active',
    IN_REPAIR: 'syn-chip-warn',
    DECOMMISSIONED: 'syn-chip-draft',
  }
  const availableStatuses = allStatuses.filter((s) => s !== instrument.status)
  const identifier = getIdentifier(instrument)
  const calInd = getCalibrationIndicator(
    instrument.nextCalibrationAt,
    instrument.record.notifyDaysBefore,
  )
  const calColor: Record<string, string> = {
    green: 'var(--ok)',
    amber: 'var(--warn)',
    red: 'var(--danger)',
  }

  return (
    <div className="mx-auto max-w-[1280px] fade-in">
      {/* Hero */}
      <div className="syn-rec-hero">
        <div>
          <div className="kicker mb-1.5 flex items-center gap-2">
            <Link href="/instruments" className="flex items-center gap-1 hover:text-ink-0">
              <ArrowLeft className="h-3 w-3" /> Instrumental
            </Link>
            <span>·</span>
            <span>{identifier}</span>
          </div>
          <h2>
            Instrumento <span className="italic">{identifier}.</span>
          </h2>
          <div className="syn-rec-hero-meta">
            <div className="m">
              <span className="mk">ESTADO</span>
              <span className="mv">
                <span className={`syn-chip ${statusChipCls[instrument.status]}`}>
                  {currentStatus.label}
                </span>
              </span>
            </div>
            <div className="m">
              <span className="mk">REGISTRO</span>
              <span className="mv">{instrument.record.name}</span>
            </div>
            {instrument.record.periodicity && (
              <div className="m">
                <span className="mk">PERIODICIDAD</span>
                <span className="mv">Cada {instrument.record.periodicity} días</span>
              </div>
            )}
            {instrument.nextCalibrationAt && (
              <div className="m">
                <span className="mk">PRÓXIMA CAL.</span>
                <span
                  className="mv font-mono"
                  style={{
                    color: calInd ? calColor[calInd] : 'var(--ink-1)',
                  }}
                >
                  {new Date(instrument.nextCalibrationAt).toLocaleDateString('es-AR')}
                </span>
              </div>
            )}
            <div className="m">
              <span className="mk">ALTA</span>
              <span className="mv font-mono">
                {new Date(instrument.createdAt).toLocaleDateString('es-AR')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="syn-rec-grid">
        {/* Left — cambiar estado */}
        <div className="space-y-5 min-w-0">
          <div className="syn-card">
            <div className="syn-card-head">
              <div>
                <div className="eyebrow">· Cambiar estado</div>
                <h3 style={{ marginTop: 6 }}>
                  Actualizá el <span className="italic">operativo.</span>
                </h3>
              </div>
            </div>
            <div style={{ padding: '14px 20px 16px' }} className="space-y-3">
              <div className="syn-field">
                <span className="syn-field-label">Nuevo estado</span>
                <select
                  value={newStatus}
                  onChange={(e) =>
                    setNewStatus(e.target.value as InstrumentStatus | '')
                  }
                  className="syn-select"
                >
                  <option value="">Seleccionar estado…</option>
                  {availableStatuses.map((s) => (
                    <option key={s} value={s}>
                      {statusConfig[s].label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="syn-field">
                <span className="syn-field-label">
                  Motivo <span className="hint">Opcional</span>
                </span>
                <textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Ej: Enviado a calibración externa…"
                  rows={3}
                  className="syn-textarea"
                />
              </div>
              <button
                type="button"
                onClick={handleStatusChange}
                disabled={!newStatus || statusMutation.isPending}
                className="syn-btn syn-btn-primary w-full justify-center"
              >
                {statusMutation.isPending ? 'Actualizando…' : 'Cambiar estado'}
              </button>
            </div>
          </div>

          {/* Resumen */}
          <div className="syn-card">
            <div className="syn-card-head">
              <div>
                <div className="eyebrow">· Resumen</div>
                <h3 style={{ marginTop: 6 }}>Datos clave</h3>
              </div>
            </div>
            <div>
              <InfoRow
                label="Estado"
                value={
                  <span className={`syn-chip ${statusChipCls[instrument.status]}`}>
                    {currentStatus.label}
                  </span>
                }
              />
              {instrument.nextCalibrationAt && (
                <InfoRow
                  label="Próxima calibración"
                  value={
                    <span
                      className="font-mono"
                      style={{
                        color: calInd ? calColor[calInd] : 'var(--ink-0)',
                      }}
                    >
                      {new Date(instrument.nextCalibrationAt).toLocaleDateString(
                        'es-AR',
                      )}
                    </span>
                  }
                />
              )}
              <InfoRow label="Tipo de registro" value={instrument.record.name} />
              <InfoRow
                label="Cambios de estado"
                value={
                  <span className="font-mono">
                    {instrument.statusLogs?.length || 0}
                  </span>
                }
              />
              <InfoRow
                label="Alta"
                value={
                  <span className="font-mono">
                    {new Date(instrument.createdAt).toLocaleDateString('es-AR')}
                  </span>
                }
              />
            </div>
          </div>
        </div>

        {/* Right — OWN fields + historial */}
        <div className="space-y-5 min-w-0">
          {/* Datos del instrumento */}
          <div className="syn-card">
            <div className="syn-card-head">
              <div>
                <div className="eyebrow">· Datos del instrumento</div>
                <h3 style={{ marginTop: 6 }}>
                  Campos del <span className="italic">{instrument.record.name}.</span>
                </h3>
              </div>
              <Link
                href={`/records/${instrument.recordId}`}
                className="syn-btn syn-btn-ghost"
                style={{ padding: '6px 10px' }}
              >
                <ExternalLink className="h-3 w-3" /> Registro
              </Link>
            </div>
            <div>
              {instrument.record.fields.map((field, i) => (
                <div
                  key={field.id}
                  className="flex items-start justify-between gap-4 px-5 py-3 text-[13px]"
                  style={{
                    borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span style={{ color: 'var(--ink-3)' }}>{field.label}</span>
                    {field.isIdentifier && (
                      <span
                        className="font-mono text-[9px] uppercase tracking-[0.14em]"
                        style={{
                          background: 'var(--primary-soft)',
                          color: 'var(--primary-hex)',
                          padding: '2px 6px',
                          borderRadius: 4,
                        }}
                      >
                        ID
                      </span>
                    )}
                  </div>
                  <span
                    className="font-mono"
                    style={{ color: 'var(--ink-0)', textAlign: 'right' }}
                  >
                    {formatFieldValue(instrument.entry.data[field.id])}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Historial de estados */}
          <div className="syn-card">
            <div className="syn-card-head">
              <div>
                <div className="eyebrow">
                  · Historial · {instrument.statusLogs?.length || 0}
                </div>
                <h3 style={{ marginTop: 6 }}>Cambios de estado</h3>
              </div>
            </div>
            <div style={{ padding: '12px 20px 16px' }}>
              {!instrument.statusLogs || instrument.statusLogs.length === 0 ? (
                <div
                  className="flex flex-col items-center gap-2 py-8 text-center"
                  style={{ color: 'var(--ink-3)' }}
                >
                  <Clock className="h-6 w-6" style={{ color: 'var(--ink-4)' }} />
                  <p className="text-[13px]">No hay cambios registrados.</p>
                </div>
              ) : (
                <div className="relative space-y-0">
                  <div
                    className="absolute top-2 bottom-2 w-px"
                    style={{ left: 13, background: 'var(--line)' }}
                  />
                  {instrument.statusLogs.map((log) => {
                    const toConfig = statusConfig[log.toStatus]
                    const fromConfig = log.fromStatus ? statusConfig[log.fromStatus] : null
                    const toChipCls = statusChipCls[log.toStatus]
                    return (
                      <div key={log.id} className="relative flex gap-3 pb-5 last:pb-0">
                        <div
                          className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2"
                          style={{
                            background: 'var(--bg-1)',
                            borderColor: 'var(--line-2)',
                          }}
                        >
                          <Clock
                            className="h-3 w-3"
                            style={{ color: 'var(--ink-3)' }}
                          />
                        </div>
                        <div className="flex-1 pt-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {fromConfig && (
                              <>
                                <span
                                  className={`syn-chip ${statusChipCls[log.fromStatus!]}`}
                                >
                                  {fromConfig.label}
                                </span>
                                <span
                                  style={{
                                    color: 'var(--ink-4)',
                                    fontSize: 11,
                                  }}
                                >
                                  →
                                </span>
                              </>
                            )}
                            <span className={`syn-chip ${toChipCls}`}>
                              {toConfig.label}
                            </span>
                          </div>
                          {log.reason && (
                            <p
                              className="mt-1 text-[12.5px]"
                              style={{ color: 'var(--ink-1)' }}
                            >
                              {log.reason}
                            </p>
                          )}
                          <p
                            className="mt-1 font-mono text-[11px]"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            {new Date(log.changedAt).toLocaleString('es-AR')}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function InfoRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-2.5 text-[13px]"
      style={{ borderTop: '1px solid var(--line)' }}
    >
      <span style={{ color: 'var(--ink-3)' }}>{label}</span>
      <span style={{ color: 'var(--ink-0)' }}>{value}</span>
    </div>
  )
}
