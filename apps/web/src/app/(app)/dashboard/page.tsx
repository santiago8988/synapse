'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  ClipboardList,
  AlertTriangle,
  Wrench,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowUpRight,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

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

const statusConfig: Record<string, { label: string; variant: 'success' | 'secondary' | 'warning' | 'info' }> = {
  DRAFT: { label: 'Borrador', variant: 'secondary' },
  COMPLETED: { label: 'Completada', variant: 'success' },
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Hace un momento'
  if (diffMins < 60) return `Hace ${diffMins} min`
  if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`
  if (diffDays < 7) return `Hace ${diffDays} ${diffDays === 1 ? 'día' : 'días'}`
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((dateStart.getTime() - todayStart.getTime()) / 86400000)

  if (diffDays < 0) return `Vencido hace ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'día' : 'días'}`
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Mañana'
  return `En ${diffDays} días`
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ''}`} />
}

function StatsLoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-10 w-10 rounded-lg" />
            </div>
            <div className="mt-4">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-2 h-4 w-28" />
            </div>
            <Skeleton className="mt-2 h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function EntriesLoadingSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg px-3 py-3">
          <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      ))}
    </div>
  )
}

function UpcomingLoadingSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
          <Skeleton className="mt-0.5 h-2 w-2 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.dashboard.stats() as Promise<DashboardStats>,
  })

  const totalInstruments = data
    ? Object.values(data.instruments).reduce((sum, n) => sum + n, 0)
    : 0

  const calibratingCount = data?.instruments?.CALIBRATING ?? data?.instruments?.IN_CALIBRATION ?? 0

  const stats = data
    ? [
        {
          label: 'Registros activos',
          value: String(data.activeRecords),
          change: '',
          trend: 'up' as const,
          icon: ClipboardList,
          color: 'text-blue-600',
          bg: 'bg-blue-50 dark:bg-blue-950/30',
        },
        {
          label: 'Entradas vencidas',
          value: String(data.overdueEntries),
          change: data.overdueEntries > 0 ? 'Requieren atención' : 'Sin vencimientos',
          trend: 'warning' as const,
          icon: Clock,
          color: 'text-amber-600',
          bg: 'bg-amber-50 dark:bg-amber-950/30',
        },
        {
          label: 'No conformidades',
          value: String(data.nonConformities.total),
          change: `${data.nonConformities.open} abiertas, ${data.nonConformities.inProgress} en progreso`,
          trend: 'down' as const,
          icon: AlertTriangle,
          color: 'text-red-600',
          bg: 'bg-red-50 dark:bg-red-950/30',
        },
        {
          label: 'Instrumentos',
          value: String(totalInstruments),
          change: calibratingCount > 0 ? `${calibratingCount} en calibración` : 'Todos operativos',
          trend: 'neutral' as const,
          icon: Wrench,
          color: 'text-emerald-600',
          bg: 'bg-emerald-50 dark:bg-emerald-950/30',
        },
      ]
    : []

  return (
    <div className="mx-auto max-w-[1240px] space-y-10">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="kicker mb-2">· Dashboard · Laboratorio Alfa</div>
          <h1
            className="text-[40px] leading-[1.08] tracking-tight"
            style={{ color: 'var(--ink-0)' }}
          >
            Buenos días,{' '}
            <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', color: 'var(--primary-hex)' }}>
              Sofía.
            </span>
          </h1>
          <p className="mt-2 max-w-[52ch] text-[14px]" style={{ color: 'var(--ink-2)' }}>
            Resumen del estado de calidad de tu organización — entradas, instrumental, no conformidades y documentos activos.
          </p>
        </div>
        <Button>
          <FileText className="mr-2 h-4 w-4" />
          Nueva entrada
        </Button>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <StatsLoadingSkeleton />
      ) : isError ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Error al cargar las estadísticas del dashboard
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="relative overflow-hidden">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  {stat.trend === 'up' && (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
                </div>
                {stat.change && (
                  <p className="mt-2 text-xs text-muted-foreground">{stat.change}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Entradas recientes */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Entradas recientes</CardTitle>
              <CardDescription>Últimas entradas realizadas en la organización</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-primary">
              Ver todas
              <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <EntriesLoadingSkeleton />
            ) : isError ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Error al cargar las entradas recientes
              </p>
            ) : !data?.recentEntries?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay entradas recientes
              </p>
            ) : (
              <div className="space-y-1">
                {data.recentEntries.map((entry) => {
                  const config = statusConfig[entry.status] ?? {
                    label: entry.status,
                    variant: 'secondary' as const,
                  }
                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 rounded-lg px-3 py-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{entry.recordName}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeDate(entry.createdAt)}
                          {entry.dueDate && (
                            <> &middot; Vence: {formatDueDate(entry.dueDate)}</>
                          )}
                        </p>
                      </div>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Próximas a vencer */}
        <Card>
          <CardHeader>
            <CardTitle>Próximas a vencer</CardTitle>
            <CardDescription>Entradas periódicas que requieren atención</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <UpcomingLoadingSkeleton />
            ) : isError ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Error al cargar las entradas próximas
              </p>
            ) : !data?.upcomingEntries?.length ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay entradas próximas a vencer
              </p>
            ) : (
              <div className="space-y-3">
                {data.upcomingEntries.map((item) => {
                  const dueLabel = formatDueDate(item.dueDate)
                  const isUrgent = dueLabel === 'Hoy' || dueLabel.startsWith('Vencido')
                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <div
                        className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${
                          isUrgent ? 'bg-red-500' : 'bg-amber-400'
                        }`}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium leading-snug">{item.recordName}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Vence: {dueLabel}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <Button variant="outline" className="mt-4 w-full" size="sm">
              Ver todas las pendientes
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
