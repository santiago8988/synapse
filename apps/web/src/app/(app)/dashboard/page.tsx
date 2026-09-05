'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { Plus, ArrowRight, Check, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useMe, firstName, greeting, initials } from '@/lib/use-me'

interface DashboardStats {
  activeRecords: number
  overdueEntries: number
  nonConformities: { open: number; inProgress: number; total: number }
  instruments: Record<string, number>
  recentEntries: Array<{
    id: string
    recordName: string
    status: string
    createdAt: string
    dueDate: string | null
  }>
  upcomingEntries: Array<{
    id: string
    recordName: string
    status: string
    dueDate: string
  }>
}

function todayDateLabel() {
  return new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  })
    .format(new Date())
    .replace(/^\w/, (c) => c.toUpperCase())
}

function formatDueRelative(dateStr: string) {
  const d = new Date(dateStr)
  const now = new Date()
  const days = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()) /
      86400000,
  )
  if (days < 0) return { label: `VENC ${Math.abs(days)}D`, urgent: true }
  if (days === 0) return { label: 'HOY', urgent: true }
  if (days === 1) return { label: 'MAÑANA', urgent: true }
  if (days <= 7) return { label: `${days} DÍAS`, urgent: true }
  return { label: `${days} DÍAS`, urgent: false }
}

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: 'var(--bg-3)' }}
    />
  )
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.dashboard.stats() as Promise<DashboardStats>,
  })
  const { data: me } = useMe()
  const firstNameText = firstName(me?.name) || 'vos'
  const orgNameText = me?.organizationName ?? 'tu organización'
  const greetingText = greeting()

  const totalInstruments = data
    ? Object.values(data.instruments).reduce((a, b) => a + b, 0)
    : 0
  const calibratingCount =
    data?.instruments?.CALIBRATING ?? data?.instruments?.IN_CALIBRATION ?? 0
  const inRepairCount = data?.instruments?.IN_REPAIR ?? 0
  const activePct = totalInstruments
    ? Math.round(((calibratingCount + inRepairCount) / totalInstruments) * 1000) / 10
    : 0

  return (
    <div className="mx-auto max-w-[1280px]">
      {/* Page header */}
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· {todayDateLabel()} · {orgNameText}</div>
          <h1>
            {greetingText}, <span className="italic">{firstNameText}.</span>
          </h1>
          <p className="sub">
            {data
              ? `${data.activeRecords} registros activos · ${data.overdueEntries} entradas vencidas · ${data.nonConformities.total} no conformidades abiertas.`
              : 'Resumen diario del estado de calidad — entradas, instrumental, no conformidades y documentos activos.'}
          </p>
        </div>
        <div className="syn-ph-actions">
          <Link href="/records/new" className="syn-btn syn-btn-ghost">
            Nuevo registro
          </Link>
          <button type="button" className="syn-btn syn-btn-primary">
            <Plus className="h-3 w-3" /> Nueva entrada
          </button>
        </div>
      </div>

      {/* KPI grid */}
      {/*
        El orden importa. Antes era `isLoading ? ... : isError ? ... : data!`,
        que no cubre el estado en que la query esta entre reintentos: ahi
        isLoading es false, isError todavia false y data undefined, y el `!`
        afirmaba lo contrario. Alcanzaba con que la API tuviera un hipo para
        tirar la pagina entera con un TypeError.

        Preguntando por `!data` en vez de por isLoading, el esqueleto cubre
        cualquier estado sin datos y TypeScript puede angostar el tipo solo en
        la ultima rama.
      */}
      {isError ? (
        <div className="syn-card mb-6">
          <div className="syn-card-body" style={{ color: 'var(--danger)' }}>
            Error al cargar las estadísticas del dashboard.
          </div>
        </div>
      ) : !data ? (
        <div className="syn-kpi-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="syn-kpi">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-12 w-16" />
              <Skeleton className="mt-4 h-3 w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="syn-kpi-grid">
          <div className="syn-kpi accent">
            <div className="klabel">Vencen en 7 días</div>
            <div className="kval">
              {data.overdueEntries || data.upcomingEntries?.length || 0}
            </div>
            <div className="kfoot">
              <span>requieren atención</span>
              <Link
                href="/records"
                className="font-mono text-[11px]"
                style={{ color: 'var(--primary-hex)' }}
              >
                VER TODAS →
              </Link>
            </div>
          </div>

          <div className="syn-kpi">
            <div className="klabel">Instrumentos calibrando</div>
            <div className="kval">
              <span className="italic">{calibratingCount}</span>
            </div>
            {calibratingCount > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="syn-chip syn-chip-active">
                  <span className="pulse" /> en proceso
                </span>
              </div>
            )}
            <div className="kfoot">
              <span>De {totalInstruments} activos</span>
              <span
                className="font-mono text-[11px]"
                style={{ color: 'var(--ink-3)' }}
              >
                {activePct}%
              </span>
            </div>
          </div>

          <div className="syn-kpi">
            <div className="klabel">NCs abiertas</div>
            <div className="kval">{data.nonConformities.total}</div>
            <div className="kfoot">
              <span>
                {data.nonConformities.inProgress} en progreso ·{' '}
                {data.nonConformities.open} por asignar
              </span>
              <Link
                href="/non-conformities"
                className="font-mono text-[11px]"
                style={{ color: 'var(--warn)' }}
              >
                VER →
              </Link>
            </div>
          </div>

          <div className="syn-kpi">
            <div className="klabel">Registros activos</div>
            <div className="kval">{data.activeRecords}</div>
            <div
              className="mt-3 text-[12px]"
              style={{ color: 'var(--ink-2)' }}
            >
              Templates publicados
            </div>
            <div className="kfoot">
              <span>Organización</span>
              <Link href="/records" className="syn-chip syn-chip-draft">
                VER TODOS
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Tasks + activity */}
      <div className="syn-dash-grid">
        {/* Tasks (recent + upcoming entries) */}
        <div className="syn-card">
          <div className="syn-card-head">
            <div>
              <div className="eyebrow">· 01 Mis tareas</div>
              <h3 style={{ marginTop: 6 }}>Para hoy y esta semana</h3>
            </div>
            <Link href="/records" className="syn-btn syn-btn-subtle">
              Ver todas <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex flex-col">
            {isLoading ? (
              <div className="p-6">
                <Skeleton className="mb-3 h-12 w-full" />
                <Skeleton className="mb-3 h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <>
                {data?.upcomingEntries?.length ? (
                  <>
                    <div className="syn-task-group">📅 Próximas a vencer</div>
                    {data.upcomingEntries.slice(0, 4).map((item) => {
                      const due = formatDueRelative(item.dueDate)
                      return (
                        <Link
                          href={`/records`}
                          key={item.id}
                          className={`syn-task ${due.urgent ? 'fail' : ''}`}
                        >
                          <div className="syn-task-check">
                            {due.urgent ? (
                              <X className="h-2.5 w-2.5" />
                            ) : (
                              <Check className="h-2.5 w-2.5" />
                            )}
                          </div>
                          <div>
                            <div className="syn-task-name">{item.recordName}</div>
                            <div className="syn-task-meta">ID {item.id.slice(-6)}</div>
                          </div>
                          <span
                            className={
                              'syn-chip ' +
                              (due.urgent ? 'syn-chip-warn' : 'syn-chip-draft')
                            }
                          >
                            {due.label}
                          </span>
                          <span className="syn-task-meta">
                            {new Date(item.dueDate).toLocaleDateString('es-AR', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>
                        </Link>
                      )
                    })}
                  </>
                ) : null}

                {data?.recentEntries?.length ? (
                  <>
                    <div className="syn-task-group">📅 Recientes</div>
                    {data.recentEntries.slice(0, 4).map((entry) => (
                      <Link
                        href={`/records`}
                        key={entry.id}
                        className="syn-task done"
                      >
                        <div className="syn-task-check">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                        <div>
                          <div className="syn-task-name">{entry.recordName}</div>
                          <div className="syn-task-meta">
                            {new Date(entry.createdAt).toLocaleString('es-AR', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                        </div>
                        <span className="syn-chip syn-chip-completed">
                          {entry.status}
                        </span>
                        <span className="syn-task-meta">—</span>
                      </Link>
                    ))}
                  </>
                ) : null}

                {!data?.upcomingEntries?.length && !data?.recentEntries?.length && (
                  <div
                    className="px-6 py-10 text-center text-[13px]"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    Sin entradas aún — creá un registro para empezar.
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Activity feed — placeholder visual hasta que haya endpoint dedicado */}
        <div className="syn-card">
          <div className="syn-card-head">
            <div>
              <div className="eyebrow">· 02 Actividad</div>
              <h3 style={{ marginTop: 6 }}>En el hub</h3>
            </div>
          </div>
          <div>
            <div className="syn-feed">
              <div className="av">{initials(me?.name)}</div>
              <div>
                <div className="text">
                  <b>{firstNameText}</b> revisó {data?.nonConformities.total ?? 0} NCs abiertas
                </div>
                <div className="time">hace un momento</div>
              </div>
            </div>
            {data?.recentEntries?.slice(0, 3).map((e) => (
              <div className="syn-feed" key={e.id}>
                <div
                  className="av"
                  style={{ background: 'linear-gradient(135deg,#7AB8FF,#0891B2)' }}
                >
                  {e.recordName?.slice(0, 2).toUpperCase() || 'EN'}
                </div>
                <div>
                  <div className="text">
                    Entrada{' '}
                    <code
                      className="font-mono text-[11px]"
                      style={{ color: 'var(--primary-hex)' }}
                    >
                      {e.id.slice(-6).toUpperCase()}
                    </code>{' '}
                    marcada como <b>{e.status}</b>
                  </div>
                  <div className="time">
                    {new Date(e.createdAt).toLocaleString('es-AR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
            {calibratingCount > 0 && (
              <div className="syn-feed">
                <div
                  className="av"
                  style={{ background: 'linear-gradient(135deg,#B45309,#FFB86B)' }}
                >
                  !
                </div>
                <div>
                  <div className="text">
                    {calibratingCount} instrumento(s) actualmente{' '}
                    <span className="syn-chip syn-chip-active" style={{ fontSize: 9 }}>
                      <span className="pulse" /> IN_CALIBRATION
                    </span>
                  </div>
                  <div className="time">monitoreo continuo</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row: instrument mix (full width) */}
      <div>
        <div className="syn-card">
          <div className="syn-card-head">
            <div>
              <div className="eyebrow">· 03 Estado instrumental</div>
              <h3 style={{ marginTop: 6 }}>
                Distribución por <span className="italic">estado.</span>
              </h3>
            </div>
            <Link href="/instruments" className="syn-btn syn-btn-subtle">
              Ver todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="syn-card-body">
            {isLoading || !data ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              Object.entries(data.instruments).map(([status, count]) => {
                const pct = totalInstruments ? (count / totalInstruments) * 100 : 0
                const color =
                  status === 'ACTIVE'
                    ? 'var(--ok)'
                    : status === 'IN_CALIBRATION' || status === 'CALIBRATING'
                      ? 'var(--info)'
                      : status === 'IN_REPAIR'
                        ? 'var(--warn)'
                        : 'var(--ink-3)'
                return (
                  <div key={status} className="mb-4">
                    <div className="mb-1.5 flex items-center justify-between text-[13px]">
                      <span style={{ color: 'var(--ink-0)', fontWeight: 500 }}>
                        {status.replace('_', ' ')}
                      </span>
                      <span
                        className="font-mono text-[12px]"
                        style={{ color: 'var(--ink-2)' }}
                      >
                        {count} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="syn-progress">
                      <span style={{ width: pct + '%', background: color }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
