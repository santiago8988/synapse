'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wrench, Search, X, CalendarClock, Info, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'

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
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const statusChipCls: Record<InstrumentStatus, string> = {
  ACTIVE: 'syn-chip-ok',
  IN_CALIBRATION: 'syn-chip-active',
  IN_REPAIR: 'syn-chip-warn',
  DECOMMISSIONED: 'syn-chip-draft',
}
const statusLabel: Record<InstrumentStatus, string> = {
  ACTIVE: 'Activo',
  IN_CALIBRATION: 'En calibración',
  IN_REPAIR: 'En reparación',
  DECOMMISSIONED: 'Dado de baja',
}

const statusFilters: Array<{ value: string | undefined; label: string }> = [
  { value: undefined, label: 'Todos' },
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'IN_CALIBRATION', label: 'En calibración' },
  { value: 'IN_REPAIR', label: 'En reparación' },
  { value: 'DECOMMISSIONED', label: 'Baja' },
]

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

function getFieldSummary(inst: Instrument): string {
  return inst.record.fields
    .filter((f) => !f.isIdentifier)
    .map((f) => {
      const val = inst.entry.data[f.id]
      return val !== undefined && val !== null && val !== '' ? String(val) : null
    })
    .filter(Boolean)
    .join(' · ')
}

type CalibrationIndicator = 'green' | 'amber' | 'red' | null

function getCalibrationIndicator(
  nextCalibrationAt: string | null,
  notifyDaysBefore: number | null,
): CalibrationIndicator {
  if (!nextCalibrationAt) return null
  const diffDays =
    (new Date(nextCalibrationAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'red'
  if (notifyDaysBefore != null && diffDays <= notifyDaysBefore) return 'amber'
  return 'green'
}

const calibrationColorVar: Record<Exclude<CalibrationIndicator, null>, string> = {
  green: 'var(--ok)',
  amber: 'var(--warn)',
  red: 'var(--danger)',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InstrumentsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined)

  const { data: instruments = [], isLoading } = useQuery<Instrument[]>({
    queryKey: ['instruments', statusFilter],
    queryFn: () =>
      api.instruments.list(
        statusFilter ? { status: statusFilter } : undefined,
      ) as Promise<Instrument[]>,
  })

  const grouped = useMemo(() => {
    const lowerSearch = search.toLowerCase()
    const filtered = instruments.filter((inst) => {
      if (!lowerSearch) return true
      return (
        getIdentifier(inst).toLowerCase().includes(lowerSearch) ||
        getFieldSummary(inst).toLowerCase().includes(lowerSearch) ||
        inst.record.name.toLowerCase().includes(lowerSearch)
      )
    })
    const groups: Record<string, Instrument[]> = {}
    for (const inst of filtered) {
      if (!groups[inst.record.name]) groups[inst.record.name] = []
      groups[inst.record.name].push(inst)
    }
    return groups
  }, [instruments, search])

  const totalCount = Object.values(grouped).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Seguimiento · Instrumental</div>
          <h1>
            Equipos e <span className="italic">instrumental.</span>
          </h1>
          <p className="sub">
            Estado operativo y próxima calibración de cada equipo. Se agrupan por el registro tipo Instrumental que les dio de alta.
          </p>
        </div>
      </div>

      <div
        className="mb-4 flex items-start gap-2 rounded-[10px] border px-4 py-3 text-[12.5px]"
        style={{
          background: 'var(--info-soft)',
          borderColor: 'var(--info)',
          color: 'var(--info)',
        }}
      >
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Para dar de alta nuevo instrumental, creá una entrada en un{' '}
          <Link
            href="/records"
            style={{ textDecoration: 'underline', fontWeight: 500 }}
          >
            registro tipo Instrumental
          </Link>
          .
        </span>
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
            placeholder="Buscar por identificador, datos o tipo de registro…"
            className="h-[38px] w-full rounded-[10px] border pl-10 pr-10 text-[13px] outline-none"
            style={{
              background: 'var(--bg-1)',
              borderColor: 'var(--line-2)',
              color: 'var(--ink-0)',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--ink-3)' }}
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div
          className="ml-auto font-mono text-[11px] uppercase tracking-[0.14em]"
          style={{ color: 'var(--ink-3)' }}
        >
          {totalCount} {totalCount === 1 ? 'instrumento' : 'instrumentos'}
        </div>
      </div>

      <div
        className="inline-flex rounded-[10px] p-1 mb-5"
        style={{ background: 'var(--bg-3)' }}
      >
        {statusFilters.map((f) => (
          <button
            type="button"
            key={f.label}
            onClick={() => setStatusFilter(f.value)}
            className="rounded-[7px] px-3 py-1.5 text-[12px] font-medium transition-colors"
            style={{
              background: statusFilter === f.value ? 'var(--bg-1)' : 'transparent',
              boxShadow: statusFilter === f.value ? 'var(--shadow-xs)' : undefined,
              color: statusFilter === f.value ? 'var(--ink-0)' : 'var(--ink-2)',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div
          className="rounded-[14px] border p-8"
          style={{
            background: 'var(--bg-1)',
            borderColor: 'var(--line)',
            color: 'var(--ink-3)',
          }}
        >
          Cargando…
        </div>
      ) : totalCount === 0 ? (
        <div className="syn-card">
          <EmptyState
            hasFilter={!!search || !!statusFilter}
            cta={!search && !statusFilter}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([recordName, items]) => (
            <div key={recordName} className="syn-card">
              <div className="syn-card-head">
                <div>
                  <div className="eyebrow">· Registro · {items.length}</div>
                  <h3 style={{ marginTop: 6 }}>{recordName}</h3>
                </div>
              </div>
              <table className="syn-table">
                <thead>
                  <tr>
                    <th>Identificador</th>
                    <th>Datos</th>
                    <th>Próxima calibración</th>
                    <th>Estado</th>
                    <th style={{ textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((inst) => {
                    const identifier = getIdentifier(inst)
                    const summary = getFieldSummary(inst)
                    const isDecommissioned = inst.status === 'DECOMMISSIONED'
                    const calInd = getCalibrationIndicator(
                      inst.nextCalibrationAt,
                      inst.record.notifyDaysBefore,
                    )
                    return (
                      <tr
                        key={inst.id}
                        style={isDecommissioned ? { opacity: 0.65 } : undefined}
                      >
                        <td data-label="Identificador" data-role="identifier">
                          <Link
                            href={`/instruments/${inst.id}`}
                            style={{ color: 'var(--ink-0)' }}
                          >
                            {identifier}
                          </Link>
                        </td>
                        <td
                          data-label="Datos"
                          style={{ color: 'var(--ink-2)', fontSize: 12.5 }}
                        >
                          {summary || <span style={{ color: 'var(--ink-4)' }}>—</span>}
                        </td>
                        <td data-label="Próxima calibración">
                          {inst.nextCalibrationAt && calInd ? (
                            <span
                              className="inline-flex items-center gap-1 font-mono text-[12px]"
                              style={{ color: calibrationColorVar[calInd] }}
                              title={new Date(
                                inst.nextCalibrationAt,
                              ).toLocaleString('es-AR')}
                            >
                              <CalendarClock className="h-3 w-3" />
                              {new Date(inst.nextCalibrationAt).toLocaleDateString(
                                'es-AR',
                              )}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--ink-4)' }}>—</span>
                          )}
                        </td>
                        <td data-label="Estado" data-role="status">
                          <span className={`syn-chip ${statusChipCls[inst.status]}`}>
                            {statusLabel[inst.status]}
                          </span>
                        </td>
                        <td data-label="" style={{ textAlign: 'right' }}>
                          <Link
                            href={`/instruments/${inst.id}`}
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyState({ hasFilter, cta }: { hasFilter: boolean; cta?: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"
      style={{ color: 'var(--ink-2)' }}
    >
      <Wrench className="h-8 w-8" style={{ color: 'var(--ink-4)' }} />
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
            Aún no hay <span className="italic">instrumental.</span>
          </>
        )}
      </div>
      <p className="max-w-sm text-[13px]" style={{ color: 'var(--ink-2)' }}>
        {hasFilter
          ? 'Probá cambiar los filtros o la búsqueda.'
          : 'Creá entradas en registros tipo Instrumental para que aparezcan acá.'}
      </p>
      {cta && (
        <Link href="/records" className="syn-btn syn-btn-primary mt-2">
          Ir a Registros
        </Link>
      )}
    </div>
  )
}
