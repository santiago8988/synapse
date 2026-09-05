'use client'

import { Search, ChevronRight, Home, Menu } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { TweaksPanel } from '@/components/tweaks/tweaks-panel'
import { useMe } from '@/lib/use-me'
import { NotificationsPanel } from '@/components/layout/notifications-panel'

const breadcrumbMap: Record<string, string> = {
  dashboard: 'Dashboard',
  documents: 'Documentos',
  records: 'Registros',
  instruments: 'Instrumental',
  calibrations: 'Calibraciones',
  'calibration-templates': 'Plantillas calib.',
  batches: 'Lotes',
  samples: 'Muestras',
  stock: 'Stock',
  recipes: 'Fórmulas',
  matrices: 'Matrices',
  methods: 'Métodos',
  'non-conformities': 'No conformidades',
  approvals: 'Aprobaciones',
  audit: 'Auditoría',
  settings: 'Configuración',
  // Pestañas de configuración: son segmentos propios desde que la pestaña
  // activa vive en la URL.
  general: 'General',
  areas: 'Áreas',
  positions: 'Puestos',
  whitelist: 'Whitelist',
  users: 'Usuarios',
  quality: 'Calidad',
  new: 'Nuevo',
}

// Topbar icon-button (>=768px)
function IcoBtn({
  children,
  onClick,
  notif,
  'aria-label': aria,
}: {
  children: React.ReactNode
  onClick?: () => void
  notif?: boolean
  'aria-label': string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={aria}
      className="relative flex h-[38px] w-[38px] items-center justify-center rounded-[10px] border border-transparent text-ink-2 transition-colors hover:bg-[var(--bg-3)] hover:text-ink-0"
    >
      {children}
      {notif && (
        <span
          className="absolute right-[10px] top-[8px] h-[7px] w-[7px] rounded-full"
          style={{ background: 'var(--danger)', border: '2px solid var(--bg-1)' }}
        />
      )}
    </button>
  )
}

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const [tweaksOpen, setTweaksOpen] = useState(false)
  const { data: me } = useMe()
  const areaText = me?.areaName ?? 'Sin área'
  const positionText = me?.positionName

  // En mobile mostramos la última hoja mapeada; si el último segmento es un id dinámico
  // (no está en el map), caemos al segmento padre para no mostrar el cuid crudo.
  const last = segments[segments.length - 1]
  const parent = segments[segments.length - 2]
  const currentLabel = !last
    ? 'Dashboard'
    : breadcrumbMap[last] ??
      (parent && breadcrumbMap[parent]
        ? `${breadcrumbMap[parent]} · Detalle`
        : last)

  return (
    <header
      className="syn-topbar flex shrink-0 items-center gap-3 border-b px-3 sm:gap-5 sm:px-7"
      style={{ background: 'var(--bg-1)', borderColor: 'var(--line)' }}
    >
      {/* Hamburger — solo mobile */}
      <button
        type="button"
        className="syn-hamburger"
        onClick={onMenuClick}
        aria-label="Abrir menú"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumbs desktop */}
      <div
        className="syn-hide-mobile flex min-w-0 flex-1 items-center gap-2 text-[13px]"
        style={{ color: 'var(--ink-2)' }}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 transition-colors hover:text-ink-0"
        >
          <Home className="h-3.5 w-3.5" />
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15 }}>
            Synapse
          </span>
        </Link>
        {segments.map((segment, i) => {
          const path = '/' + segments.slice(0, i + 1).join('/')
          const label = breadcrumbMap[segment] ?? segment
          const isLast = i === segments.length - 1
          const isNavigable = !!breadcrumbMap[segment]
          return (
            <span key={`${segment}-${i}`} className="flex items-center gap-2">
              <ChevronRight className="h-2.5 w-2.5" style={{ color: 'var(--ink-4)' }} />
              {isLast ? (
                <span className="font-medium" style={{ color: 'var(--ink-0)' }}>
                  {label}
                </span>
              ) : isNavigable ? (
                <Link href={path} className="transition-colors hover:text-ink-0">
                  {label}
                </Link>
              ) : (
                <span>{label}</span>
              )}
            </span>
          )
        })}
      </div>

      {/* Title compact — mobile only */}
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:hidden">
        <span
          style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 15 }}
        >
          Synapse
        </span>
        <ChevronRight className="h-2.5 w-2.5" style={{ color: 'var(--ink-4)' }} />
        <span className="truncate text-[13px] font-medium" style={{ color: 'var(--ink-0)' }}>
          {currentLabel}
        </span>
      </div>

      {/* Area pill — desktop */}
      <button
        type="button"
        className="area-pill syn-hide-mobile"
        title={positionText ? `${areaText} · ${positionText}` : areaText}
      >
        <span className="dot" />
        <span>
          Área: {areaText}
          {positionText && (
            <span
              className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em]"
              style={{ color: 'var(--ink-3)' }}
            >
              · {positionText}
            </span>
          )}
        </span>
        <ChevronRight className="h-3 w-3 rotate-90" style={{ color: 'var(--ink-3)' }} />
      </button>

      {/* Actions */}
      <div className="flex items-center gap-1 sm:gap-3">
        <IcoBtn aria-label="Buscar">
          <Search className="h-[18px] w-[18px]" />
        </IcoBtn>
        <NotificationsPanel />
        <button
          type="button"
          onClick={() => setTweaksOpen((o) => !o)}
          aria-label="Abrir tweaks"
          className="syn-hide-mobile flex items-center gap-2 rounded-[10px] border px-3 py-[7px] text-[12px] transition-colors hover:bg-[var(--bg-3)]"
          style={{ borderColor: 'var(--line-2)', color: 'var(--ink-1)' }}
        >
          <span className="font-mono uppercase tracking-[0.14em]" style={{ fontSize: 10 }}>
            Tweaks
          </span>
        </button>
      </div>

      <TweaksPanel open={tweaksOpen} onClose={() => setTweaksOpen(false)} />
    </header>
  )
}
