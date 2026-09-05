'use client'

import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  GraduationCap,
  RefreshCw,
  Ruler,
  type LucideIcon,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useMe, firstName, greeting } from '@/lib/use-me'

/**
 * Dashboard.
 *
 * La pregunta que tiene que contestar es **qué requiere atención hoy**, no
 * cuánto hay cargado en el sistema. Todo lo que se muestra acá tiene que ser
 * algo sobre lo que alguien pueda actuar, y tiene que llevar a donde se actúa.
 *
 * Dos cosas que estaban y se sacaron, por si alguien las extraña:
 *
 * - **El feed "En el hub" era inventado.** La primera línea decía que el
 *   usuario había revisado N no conformidades "hace un momento" — un evento que
 *   nunca ocurrió, armado en el render. Las siguientes decían "entrada marcada
 *   como COMPLETED" mostrando la fecha de *creación*, así que el texto y la
 *   hora no hablaban del mismo hecho, y para una entrada en borrador afirmaba
 *   "marcada como DRAFT", que no es un evento. En un sistema de calidad,
 *   actividad inventada al lado de datos reales es peor que no tener actividad:
 *   alguien la puede leer como registro de auditoría.
 *
 * - **Los botones de crear.** Crear un registro o una entrada se hace desde el
 *   registro correspondiente, con el contexto a la vista. Desde acá eran dos
 *   atajos a formularios en blanco.
 */

interface EntryRef {
  id: string
  recordId: string
  recordName: string
}

interface DashboardStats {
  activeRecords: number
  overdueEntries: number
  overdueEntriesList: Array<EntryRef & { dueDate: string }>
  nonConformities: { open: number; inProgress: number; total: number }
  instruments: Record<string, number>
  upcomingEntries: Array<EntryRef & { status: string; dueDate: string }>
  upcomingRevisions: Array<EntryRef & { revisionDate: string; notifyDaysBefore: number | null }>
  instrumentsDueCalibration: Array<{
    id: string
    recordName: string
    nextCalibrationAt: string
  }>
  pendingApprovals: number
  expiringTrainings: Array<{
    id: string
    name: string
    userName: string
    expiresAt: string
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

/** Días calendario entre hoy y una fecha. Negativo = ya pasó. */
function diasHasta(dateStr: string): number {
  const d = new Date(dateStr)
  const hoy = new Date()
  return Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) /
      86400000,
  )
}

function plazo(dateStr: string): { label: string; urgente: boolean } {
  const dias = diasHasta(dateStr)
  if (dias < 0) return { label: `VENCIÓ HACE ${Math.abs(dias)} D`, urgente: true }
  if (dias === 0) return { label: 'HOY', urgente: true }
  if (dias === 1) return { label: 'MAÑANA', urgente: true }
  if (dias <= 7) return { label: `EN ${dias} DÍAS`, urgente: true }
  return { label: `EN ${dias} DÍAS`, urgente: false }
}

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded ${className}`} style={{ background: 'var(--bg-3)' }} />
  )
}

/**
 * Tarjeta de indicador. Siempre lleva a algún lado: un número del que no se
 * puede salir obliga a ir a buscar a mano lo que el número resume.
 */
function Kpi({
  label,
  value,
  detail,
  href,
  linkLabel,
  alerta,
}: {
  label: string
  value: number
  detail: string
  href: string
  linkLabel: string
  alerta?: boolean
}) {
  return (
    <div className={'syn-kpi' + (alerta && value > 0 ? ' accent' : '')}>
      <div className="klabel">{label}</div>
      <div className="kval">
        {alerta && value > 0 ? <span className="italic">{value}</span> : value}
      </div>
      <div className="mt-3 text-[12px]" style={{ color: 'var(--ink-2)' }}>
        {detail}
      </div>
      <div className="kfoot">
        <span />
        <Link href={href} className="syn-chip syn-chip-draft">
          {linkLabel}
        </Link>
      </div>
    </div>
  )
}

/** Una línea de trabajo pendiente. */
function Pendiente({
  icon: Icon,
  href,
  titulo,
  detalle,
  chip,
  urgente,
}: {
  icon: LucideIcon
  href: string
  titulo: string
  detalle: string
  chip: string
  urgente?: boolean
}) {
  return (
    <Link href={href} className={'syn-task' + (urgente ? ' fail' : '')}>
      <div className="syn-task-check">
        <Icon className="h-2.5 w-2.5" />
      </div>
      <div className="min-w-0">
        <div className="syn-task-name truncate">{titulo}</div>
        <div className="syn-task-meta">{detalle}</div>
      </div>
      <span className={'syn-chip ' + (urgente ? 'syn-chip-warn' : 'syn-chip-draft')}>{chip}</span>
    </Link>
  )
}

function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 py-10 text-center text-[13px]" style={{ color: 'var(--ink-3)' }}>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.dashboard.stats() as Promise<DashboardStats>,
  })
  const { data: me } = useMe()

  const nombre = firstName(me?.name) || 'vos'
  const organizacion = me?.organizationName ?? 'tu organización'

  // ADMIN y AUDITOR ven la organización entera; el resto, su área y las que
  // cuelgan de ella. Quien no tiene área asignada solo ve lo no clasificado, y
  // conviene que lo sepa antes de concluir que no hay nada que hacer.
  const veTodo = me?.role === 'ADMIN' || me?.role === 'AUDITOR'
  const alcanceTexto = !me
    ? null
    : veTodo
      ? null
      : me.areaName
        ? `Alcance: ${me.areaName} y las áreas que dependen de ella.`
        : 'No tenés un área asignada, así que solo ves lo que no está clasificado. Pedile a un administrador que te asigne una.'

  const calibracionesVencidas =
    data?.instrumentsDueCalibration.filter((i) => diasHasta(i.nextCalibrationAt) < 0).length ?? 0

  // Trabajo con fecha: lo vencido primero, después lo que viene.
  const pendientes = [
    ...(data?.overdueEntriesList ?? []).map((e) => ({ ...e, vencida: true })),
    ...(data?.upcomingEntries ?? []).map((e) => ({ ...e, vencida: false })),
  ]

  // Todo lo que vence sin ser una entrada: revisiones, calibraciones,
  // capacitaciones. Estaba calculado en el backend y no se mostraba en ningún
  // lado, que es la peor combinación: el sistema lo sabe y nadie se entera.
  const vencimientos = [
    ...(data?.upcomingRevisions ?? []).map((r) => ({
      key: `rev-${r.id}`,
      icon: RefreshCw,
      href: `/records/${r.recordId}`,
      titulo: r.recordName,
      detalle: 'Revisión programada',
      fecha: r.revisionDate,
    })),
    ...(data?.instrumentsDueCalibration ?? []).map((i) => ({
      key: `cal-${i.id}`,
      icon: Ruler,
      href: `/instruments/${i.id}`,
      titulo: i.recordName,
      detalle: 'Calibración del instrumento',
      fecha: i.nextCalibrationAt,
    })),
    ...(data?.expiringTrainings ?? []).map((t) => ({
      key: `cap-${t.id}`,
      icon: GraduationCap,
      href: '/settings/users',
      titulo: t.name,
      detalle: t.userName,
      fecha: t.expiresAt,
    })),
  ].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime())

  const todoEnOrden =
    !isLoading &&
    !isError &&
    pendientes.length === 0 &&
    vencimientos.length === 0 &&
    (data?.nonConformities.total ?? 0) === 0 &&
    (data?.pendingApprovals ?? 0) === 0

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">
            · {todayDateLabel()} · {organizacion}
          </div>
          <h1>
            {greeting()}, <span className="italic">{nombre}.</span>
          </h1>
          <p className="sub">
            {isLoading
              ? 'Buscando lo que necesita atención…'
              : todoEnOrden
                ? 'Nada vencido ni por vencer. No hay no conformidades ni aprobaciones esperando.'
                : 'Esto es lo que necesita atención hoy.'}
          </p>
          {/* Decir el alcance evita la lectura peligrosa: que un tablero
              tranquilo signifique que la organización entera está tranquila,
              cuando en realidad muestra un área. */}
          {alcanceTexto && (
            <p className="mt-1 text-[12px]" style={{ color: 'var(--ink-3)' }}>
              {alcanceTexto}
            </p>
          )}
        </div>
      </div>

      {isError && (
        <div
          className="mb-6 rounded-[12px] border px-4 py-3 text-[13px]"
          style={{ borderColor: 'var(--line-2)', color: 'var(--ink-2)' }}
        >
          No se pudo cargar el resumen. Los módulos siguen accesibles desde el menú.
        </div>
      )}

      {isLoading ? (
        <div className="syn-kpi-grid">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[168px] w-full" />
          ))}
        </div>
      ) : (
        data && (
          <div className="syn-kpi-grid">
            <Kpi
              label="Entradas vencidas"
              value={data.overdueEntries}
              detail={
                data.overdueEntries === 0
                  ? 'Ninguna pasada de fecha'
                  : 'Pasaron su fecha sin completarse'
              }
              href="/records"
              linkLabel="VER REGISTROS"
              alerta
            />
            <Kpi
              label="Calibraciones"
              value={data.instrumentsDueCalibration.length}
              detail={
                calibracionesVencidas > 0
                  ? `${calibracionesVencidas} ya vencidas`
                  : 'Vencen en los próximos 30 días'
              }
              href="/instruments"
              linkLabel="VER INSTRUMENTAL"
              alerta
            />
            <Kpi
              label="No conformidades"
              value={data.nonConformities.total}
              detail={`${data.nonConformities.open} abiertas · ${data.nonConformities.inProgress} en progreso`}
              href="/non-conformities"
              linkLabel="VER"
              alerta
            />
            <Kpi
              label="Aprobaciones que te tocan"
              value={data.pendingApprovals}
              detail={
                data.pendingApprovals === 0
                  ? 'Nada esperando tu firma'
                  : 'Esperan que revises o apruebes'
              }
              href="/approvals"
              linkLabel="VER CIRCUITO"
              alerta
            />
          </div>
        )
      )}

      <div className="syn-dash-grid">
        {/* Entradas con fecha */}
        <div className="syn-card">
          <div className="syn-card-head">
            <div>
              <div className="eyebrow">· 01 Entradas</div>
              <h3 style={{ marginTop: 6 }}>Vencidas y por vencer</h3>
            </div>
            <Link href="/records" className="syn-btn syn-btn-subtle">
              Ver registros <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex flex-col">
            {isLoading ? (
              <div className="p-6">
                <Skeleton className="mb-3 h-12 w-full" />
                <Skeleton className="mb-3 h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : pendientes.length === 0 ? (
              <Vacio>
                Ninguna entrada vencida ni con fecha en los próximos 7 días.
              </Vacio>
            ) : (
              pendientes.slice(0, 6).map((e) => {
                const p = plazo(e.dueDate)
                return (
                  <Pendiente
                    key={e.id}
                    icon={e.vencida ? AlertTriangle : ClipboardList}
                    // Lleva al registro, que es donde se completa la entrada.
                    href={`/records/${e.recordId}`}
                    titulo={e.recordName}
                    detalle={new Date(e.dueDate).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                    chip={p.label}
                    urgente={p.urgente}
                  />
                )
              })
            )}
          </div>
        </div>

        {/* Todo lo demás que vence */}
        <div className="syn-card">
          <div className="syn-card-head">
            <div>
              <div className="eyebrow">· 02 Vencimientos</div>
              <h3 style={{ marginTop: 6 }}>Revisiones, calibraciones y capacitaciones</h3>
            </div>
          </div>

          <div className="flex flex-col">
            {isLoading ? (
              <div className="p-6">
                <Skeleton className="mb-3 h-12 w-full" />
                <Skeleton className="mb-3 h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : vencimientos.length === 0 ? (
              <Vacio>Nada vence en los próximos 30 días.</Vacio>
            ) : (
              vencimientos.slice(0, 6).map((v) => {
                const p = plazo(v.fecha)
                return (
                  <Pendiente
                    key={v.key}
                    icon={v.icon}
                    href={v.href}
                    titulo={v.titulo}
                    detalle={v.detalle}
                    chip={p.label}
                    urgente={p.urgente}
                  />
                )
              })
            )}
          </div>
        </div>
      </div>

      {todoEnOrden && (
        <div
          className="mt-6 flex items-center justify-center gap-2 rounded-[12px] border px-4 py-6 text-[13px]"
          style={{ borderColor: 'var(--line-2)', color: 'var(--ink-2)' }}
        >
          <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--ok)' }} />
          Al día. Nada pendiente de tu lado.
        </div>
      )}
    </div>
  )
}
