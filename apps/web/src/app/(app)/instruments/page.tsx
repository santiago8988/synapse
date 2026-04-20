'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Wrench, Search, ChevronRight, X, CalendarClock, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
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

const statusConfig: Record<
  InstrumentStatus,
  { label: string; variant: 'success' | 'info' | 'warning' | 'secondary' }
> = {
  ACTIVE: { label: 'Activo', variant: 'success' },
  IN_CALIBRATION: { label: 'En Calibración', variant: 'info' },
  IN_REPAIR: { label: 'En Reparación', variant: 'warning' },
  DECOMMISSIONED: { label: 'Dado de Baja', variant: 'secondary' },
}

const statusFilters: Array<{ value: string | undefined; label: string }> = [
  { value: undefined, label: 'Todos' },
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'IN_CALIBRATION', label: 'En Calibración' },
  { value: 'IN_REPAIR', label: 'En Reparación' },
  { value: 'DECOMMISSIONED', label: 'Dados de Baja' },
]

/** Return a display name for the instrument based on the identifier field. */
function getIdentifier(inst: Instrument): string {
  const identifierField = inst.record.fields.find((f) => f.isIdentifier)
  if (identifierField) {
    const val = inst.entry.data[identifierField.id]
    if (val !== undefined && val !== null && val !== '') return String(val)
  }
  // Fallback: first non-empty value or generic label
  for (const f of inst.record.fields) {
    const val = inst.entry.data[f.id]
    if (val !== undefined && val !== null && val !== '') return String(val)
  }
  return 'Sin identificador'
}

/** Get a summary of OWN field values (non-identifier) for the subtitle line. */
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
  const now = new Date()
  const next = new Date(nextCalibrationAt)
  const diffMs = next.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 0) return 'red'
  if (notifyDaysBefore != null && diffDays <= notifyDaysBefore) return 'amber'
  return 'green'
}

const calibrationColors: Record<string, string> = {
  green: 'text-emerald-600 dark:text-emerald-400',
  amber: 'text-amber-600 dark:text-amber-400',
  red: 'text-red-600 dark:text-red-400',
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
      api.instruments.list(statusFilter ? { status: statusFilter } : undefined) as Promise<Instrument[]>,
  })

  // Grouped by record name, filtered by search
  const grouped = useMemo(() => {
    const lowerSearch = search.toLowerCase()
    const filtered = instruments.filter((inst) => {
      if (!lowerSearch) return true
      const identifier = getIdentifier(inst).toLowerCase()
      const summary = getFieldSummary(inst).toLowerCase()
      const recordName = inst.record.name.toLowerCase()
      return (
        identifier.includes(lowerSearch) ||
        summary.includes(lowerSearch) ||
        recordName.includes(lowerSearch)
      )
    })

    const groups: Record<string, Instrument[]> = {}
    for (const inst of filtered) {
      const key = inst.record.name
      if (!groups[key]) groups[key] = []
      groups[key].push(inst)
    }
    return groups
  }, [instruments, search])

  const totalCount = Object.values(grouped).reduce((s, arr) => s + arr.length, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Instrumentos</h1>
        <p className="mt-1 text-muted-foreground">
          Gestión de equipos e instrumentos del laboratorio
        </p>
      </div>

      {/* Hint */}
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Para dar de alta instrumental, creá una entrada en un registro de tipo Instrumental desde
          la sección{' '}
          <Link href="/records" className="font-medium underline underline-offset-2">
            Registros
          </Link>
          .
        </span>
      </div>

      {/* Search and filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por identificador, datos o tipo de registro..."
            className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {statusFilters.map((filter) => (
            <Button
              key={filter.label}
              variant={statusFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Instrument list grouped by record */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Wrench className="h-12 w-12 text-muted-foreground/30" />
            <p className="mt-4 font-medium">No hay instrumentos</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search || statusFilter
                ? 'No se encontraron instrumentos con los filtros aplicados'
                : 'Creá entradas en registros de tipo Instrumental para que aparezcan acá'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([recordName, items]) => (
            <section key={recordName}>
              <h2 className="mb-3 text-lg font-semibold">{recordName}</h2>
              <div className="space-y-2">
                {items.map((inst) => {
                  const identifier = getIdentifier(inst)
                  const summary = getFieldSummary(inst)
                  const status = statusConfig[inst.status]
                  const isDecommissioned = inst.status === 'DECOMMISSIONED'
                  const calInd = getCalibrationIndicator(
                    inst.nextCalibrationAt,
                    inst.record.notifyDaysBefore,
                  )

                  return (
                    <Link key={inst.id} href={`/instruments/${inst.id}`}>
                      <Card
                        className={`transition-shadow hover:shadow-md cursor-pointer ${
                          isDecommissioned ? 'opacity-60' : ''
                        }`}
                      >
                        <CardContent className="flex items-center gap-4 p-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-950/30">
                            <Wrench className="h-5 w-5 text-violet-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium">{identifier}</p>
                            {summary && (
                              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                {summary}
                              </p>
                            )}
                          </div>

                          {/* Calibration indicator */}
                          {calInd && inst.nextCalibrationAt && (
                            <div
                              className={`flex items-center gap-1 text-xs shrink-0 ${calibrationColors[calInd]}`}
                              title={`Próxima calibración: ${new Date(inst.nextCalibrationAt).toLocaleDateString('es-AR')}`}
                            >
                              <CalendarClock className="h-3.5 w-3.5" />
                              <span>
                                {new Date(inst.nextCalibrationAt).toLocaleDateString('es-AR')}
                              </span>
                            </div>
                          )}

                          <Badge variant={status.variant}>{status.label}</Badge>
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
