'use client'

import { useRef, useState } from 'react'
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
  FileText,
  Upload,
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

// Para fechas "solo día" (calibrationDate, nextCalibrationAt) que se guardan
// como UTC midnight: renderizamos en UTC para evitar el shift del huso local
// (sin esto, en Argentina UTC-3 una fecha 8/5 se ve como 7/5).
function formatDateUTC(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('es-AR', { timeZone: 'UTC' })
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
                  {formatDateUTC(instrument.nextCalibrationAt)}
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
                      {formatDateUTC(instrument.nextCalibrationAt)}
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

          {/* Certificados de calibración externa */}
          <CertificatesSection instrumentId={instrument.id} />

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

// ───────────────────────────────────────────────────────────────────────────
// Certificados de calibración externa — append-only
// ───────────────────────────────────────────────────────────────────────────

const CERT_PDF_MAX_BYTES = 10 * 1024 * 1024
const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

type CertificateResult = 'PASSED' | 'FAILED'

interface Certificate {
  id: string
  pdfUrl: string
  pdfName: string
  pdfSize: number
  result: CertificateResult
  calibrationDate: string | null
  notes: string | null
  uploadedAt: string
  uploadedBy: { id: string; name: string; email: string } | null
}

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function CertificatesSection({ instrumentId }: { instrumentId: string }) {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [result, setResult] = useState<CertificateResult | null>(null)
  const [calibrationDate, setCalibrationDate] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: certificates = [], isLoading } = useQuery<Certificate[]>({
    queryKey: ['instruments', instrumentId, 'certificates'],
    queryFn: () =>
      api.instruments.listCertificates(instrumentId) as Promise<Certificate[]>,
  })

  function handleFile(file: File) {
    setError(null)
    if (file.type !== 'application/pdf') {
      setError('Solo se permiten archivos PDF.')
      return
    }
    if (file.size > CERT_PDF_MAX_BYTES) {
      setError('El archivo supera el tamaño máximo (10 MB).')
      return
    }
    setPendingFile(file)
  }

  async function handleUpload() {
    if (!pendingFile) return
    if (!result) {
      setError('Indicá si el certificado es conforme o no conforme.')
      return
    }
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', pendingFile)
      formData.append('result', result)
      if (calibrationDate) formData.append('calibrationDate', calibrationDate)
      if (notes.trim()) formData.append('notes', notes.trim())
      const token =
        typeof window !== 'undefined' ? localStorage.getItem('synapse_token') : null
      const res = await fetch(
        `${apiBase}/instruments/${instrumentId}/certificates`,
        {
          method: 'POST',
          body: formData,
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Error al subir' }))
        throw new Error(body.message || `Error ${res.status}`)
      }
      queryClient.invalidateQueries({
        queryKey: ['instruments', instrumentId, 'certificates'],
      })
      // El servicio puede haber recalculado nextCalibrationAt → refrescar el instrumento.
      queryClient.invalidateQueries({ queryKey: ['instruments', instrumentId] })
      queryClient.invalidateQueries({ queryKey: ['instruments'] })
      toast.success(
        result === 'FAILED'
          ? 'Certificado registrado · revisá el estado del equipo'
          : 'Certificado registrado',
      )
      setPendingFile(null)
      setResult(null)
      setCalibrationDate('')
      setNotes('')
      if (inputRef.current) inputRef.current.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir')
    } finally {
      setUploading(false)
    }
  }

  function handleCancelPending() {
    setPendingFile(null)
    setResult('PASSED')
    setCalibrationDate('')
    setNotes('')
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="syn-card">
      <div className="syn-card-head">
        <div>
          <div className="eyebrow">
            · Certificados · {certificates.length}
          </div>
          <h3 style={{ marginTop: 6 }}>
            Calibración <span className="italic">externa.</span>
          </h3>
        </div>
      </div>

      <div style={{ padding: '14px 20px 16px' }} className="space-y-3">
        {/* Upload */}
        {pendingFile ? (
          <div
            className="rounded-[10px] border p-3 space-y-3"
            style={{ borderColor: 'var(--line)', background: 'var(--bg-1)' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px]"
                style={{ background: 'var(--info-soft)', color: 'var(--info)' }}
              >
                <FileText className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="truncate text-[13px]"
                  style={{ color: 'var(--ink-0)', fontWeight: 500 }}
                >
                  {pendingFile.name}
                </div>
                <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {formatBytes(pendingFile.size)}
                </div>
              </div>
            </div>
            <div className="syn-field">
              <span className="syn-field-label">
                Resultado <span style={{ color: 'var(--danger)' }}>*</span>
              </span>
              <div
                className="inline-flex rounded-[8px] p-1"
                style={{ background: 'var(--bg-3)' }}
              >
                <button
                  type="button"
                  onClick={() => setResult('PASSED')}
                  className="rounded-[6px] px-3 py-1.5 text-[12px] font-medium transition-colors"
                  style={{
                    background: result === 'PASSED' ? 'var(--bg-1)' : 'transparent',
                    boxShadow: result === 'PASSED' ? 'var(--shadow-xs)' : undefined,
                    color: result === 'PASSED' ? 'var(--ok)' : 'var(--ink-2)',
                  }}
                >
                  Conforme
                </button>
                <button
                  type="button"
                  onClick={() => setResult('FAILED')}
                  className="rounded-[6px] px-3 py-1.5 text-[12px] font-medium transition-colors"
                  style={{
                    background: result === 'FAILED' ? 'var(--bg-1)' : 'transparent',
                    boxShadow: result === 'FAILED' ? 'var(--shadow-xs)' : undefined,
                    color: result === 'FAILED' ? 'var(--danger)' : 'var(--ink-2)',
                  }}
                >
                  No conforme
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className="syn-field">
                <span className="syn-field-label">
                  Fecha de calibración{' '}
                  <span className="hint">
                    {result === 'PASSED'
                      ? 'Recalcula próxima'
                      : result === 'FAILED'
                        ? 'Opcional'
                        : 'Opcional'}
                  </span>
                </span>
                <input
                  type="date"
                  value={calibrationDate}
                  onChange={(e) => setCalibrationDate(e.target.value)}
                  className="syn-input"
                />
              </label>
              <label className="syn-field">
                <span className="syn-field-label">
                  Notas <span className="hint">Opcional</span>
                </span>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Lab. INTI · OK en todos los puntos"
                  className="syn-input"
                />
              </label>
            </div>

            {result === 'FAILED' && (
              <div
                className="rounded-[8px] border px-3 py-2 text-[12px]"
                style={{
                  background: 'var(--warn-soft, rgba(245, 158, 11, 0.08))',
                  borderColor: 'var(--warn)',
                  color: 'var(--warn)',
                }}
              >
                Al guardar un certificado <strong>no conforme</strong>, no se
                recalcula la próxima calibración. Cambiá el estado del equipo a
                <em> En reparación</em> o <em>Dado de baja</em> según
                corresponda.
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <button
                type="button"
                onClick={handleCancelPending}
                disabled={uploading}
                className="syn-btn syn-btn-ghost"
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || !result}
                className="syn-btn syn-btn-primary"
                style={{ padding: '6px 12px', fontSize: 12 }}
                title={!result ? 'Indicá el resultado del certificado' : undefined}
              >
                {uploading ? 'Subiendo…' : 'Registrar certificado'}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-[10px] border-2 border-dashed px-3 py-4 text-[12.5px] transition w-full text-left flex items-center gap-2"
            style={{
              borderColor: 'var(--line)',
              background: 'var(--bg-1)',
              color: 'var(--ink-2)',
            }}
          >
            <Upload className="h-4 w-4 shrink-0" />
            <span>Subir certificado de calibración (PDF, máx. 10 MB)</span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFile(f)
          }}
        />
        {error && (
          <div className="text-[11.5px]" style={{ color: 'var(--danger)' }}>
            {error}
          </div>
        )}

        {/* Historial */}
        {isLoading ? (
          <div
            className="text-[12.5px]"
            style={{ color: 'var(--ink-3)' }}
          >
            Cargando…
          </div>
        ) : certificates.length === 0 ? (
          <div
            className="flex flex-col items-center gap-2 py-6 text-center"
            style={{ color: 'var(--ink-3)' }}
          >
            <FileText className="h-6 w-6" style={{ color: 'var(--ink-4)' }} />
            <p className="text-[12.5px]">
              Aún no hay certificados registrados.
            </p>
            <p
              className="text-[11px]"
              style={{ color: 'var(--ink-4)' }}
            >
              El historial es append-only — los certificados no se borran.
            </p>
          </div>
        ) : (
          <div
            className="rounded-[10px] border overflow-hidden"
            style={{ borderColor: 'var(--line)' }}
          >
            {certificates.map((cert, i) => (
              <div
                key={cert.id}
                className="flex items-center gap-3 px-3 py-2.5"
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px]"
                  style={{
                    background:
                      cert.result === 'FAILED'
                        ? 'var(--danger-soft, rgba(239,68,68,0.1))'
                        : 'var(--info-soft)',
                    color:
                      cert.result === 'FAILED' ? 'var(--danger)' : 'var(--info)',
                  }}
                >
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="truncate text-[13px]"
                      style={{ color: 'var(--ink-0)', fontWeight: 500 }}
                    >
                      {cert.pdfName}
                    </span>
                    <span
                      className={`syn-chip ${
                        cert.result === 'FAILED'
                          ? 'syn-chip-danger'
                          : 'syn-chip-ok'
                      }`}
                    >
                      {cert.result === 'FAILED' ? 'No conforme' : 'Conforme'}
                    </span>
                  </div>
                  <div
                    className="mt-0.5 font-mono text-[11px]"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    {cert.calibrationDate
                      ? `Calibrado ${formatDateUTC(cert.calibrationDate)} · `
                      : ''}
                    Subido{' '}
                    {new Date(cert.uploadedAt).toLocaleDateString('es-AR')}
                    {cert.uploadedBy?.name ? ` · ${cert.uploadedBy.name}` : ''}
                    {' · '}
                    {formatBytes(cert.pdfSize)}
                  </div>
                  {cert.notes && (
                    <div
                      className="mt-0.5 text-[12px]"
                      style={{ color: 'var(--ink-2)' }}
                    >
                      {cert.notes}
                    </div>
                  )}
                </div>
                <a
                  href={`${apiBase}${cert.pdfUrl.replace(/^\/api/, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="syn-btn syn-btn-subtle"
                  style={{ padding: '4px 10px', fontSize: 12 }}
                >
                  Ver
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
