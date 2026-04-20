'use client'

import { Bell, Search, ChevronRight, Home } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { TweaksPanel } from '@/components/tweaks/tweaks-panel'

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
  recipes: 'Recetas',
  matrices: 'Matrices',
  methods: 'Métodos',
  'non-conformities': 'No conformidades',
  approvals: 'Aprobaciones',
  audit: 'Auditoría',
  settings: 'Ajustes',
  new: 'Nuevo',
}

// Topbar icon-button
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

export function Header() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const [tweaksOpen, setTweaksOpen] = useState(false)

  return (
    <header
      className="flex h-[60px] shrink-0 items-center gap-5 border-b px-7"
      style={{ background: 'var(--bg-1)', borderColor: 'var(--line)' }}
    >
      {/* Breadcrumbs */}
      <div className="flex min-w-0 flex-1 items-center gap-2 text-[13px]" style={{ color: 'var(--ink-2)' }}>
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

      {/* Area pill */}
      <button type="button" className="area-pill">
        <span className="dot" />
        <span>Área: Microbiología</span>
        <ChevronRight className="h-3 w-3 rotate-90" style={{ color: 'var(--ink-3)' }} />
      </button>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <IcoBtn aria-label="Buscar">
          <Search className="h-[18px] w-[18px]" />
        </IcoBtn>
        <IcoBtn aria-label="Notificaciones" notif>
          <Bell className="h-[18px] w-[18px]" />
        </IcoBtn>
        <button
          type="button"
          onClick={() => setTweaksOpen((o) => !o)}
          aria-label="Abrir tweaks"
          className="flex items-center gap-2 rounded-[10px] border px-3 py-[7px] text-[12px] transition-colors hover:bg-[var(--bg-3)]"
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
