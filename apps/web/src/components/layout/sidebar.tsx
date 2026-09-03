'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Workflow,
  Wrench,
  AlertTriangle,
  Shield,
  Settings,
  FlaskConical,
  Package,
  TestTube2,
  Microscope,
  FlaskRound,
  Warehouse,
  CheckCircle2,
  Ruler,
  ScanLine,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { BrainMark } from '@/components/brand/brain-mark'
import { useMe, initials, roleLabel } from '@/lib/use-me'
import { api } from '@/lib/api'

interface NavItem {
  href: string
  name: string
  icon: LucideIcon
  badge?: string
  warn?: boolean
}
interface NavGroup {
  label: string
  items: NavItem[]
}

function buildNavigation(counts: { ncOpen: number; approvalsPending: number }): NavGroup[] {
  const fmt = (n: number) => (n > 99 ? '99+' : String(n))
  return [
    {
      label: 'Definición',
      items: [
        { href: '/dashboard', name: 'Dashboard', icon: LayoutDashboard },
        { href: '/records', name: 'Registros', icon: ClipboardList },
        { href: '/flows', name: 'Flujos', icon: Workflow },
        { href: '/documents', name: 'Documentos', icon: FileText },
        { href: '/recipes', name: 'Fórmulas', icon: FlaskConical },
        { href: '/matrices', name: 'Matrices', icon: Microscope },
        { href: '/methods', name: 'Métodos', icon: FlaskRound },
        { href: '/calibration-templates', name: 'Plantillas calib.', icon: Ruler },
      ],
    },
    {
      label: 'Seguimiento',
      items: [
        { href: '/batches', name: 'Lotes', icon: Package },
        { href: '/samples', name: 'Muestras', icon: TestTube2 },
        { href: '/instruments', name: 'Calibración Ext.', icon: Wrench },
        { href: '/calibrations', name: 'Calibraciones', icon: ScanLine },
        { href: '/stock', name: 'Stock', icon: Warehouse },
      ],
    },
    {
      label: 'Calidad',
      items: [
        {
          href: '/non-conformities',
          name: 'No conformidades',
          icon: AlertTriangle,
          badge: counts.ncOpen > 0 ? fmt(counts.ncOpen) : undefined,
        },
        {
          href: '/approvals',
          name: 'Aprobaciones',
          icon: CheckCircle2,
          badge: counts.approvalsPending > 0 ? fmt(counts.approvalsPending) : undefined,
          warn: counts.approvalsPending > 0,
        },
        { href: '/audit', name: 'Auditoría', icon: Shield },
      ],
    },
    {
      label: 'Configuración',
      items: [{ href: '/settings', name: 'Ajustes', icon: Settings }],
    },
  ]
}

interface SidebarProps {
  open?: boolean
  onNavigate?: () => void
}

export function Sidebar({ open = false, onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const { data: me } = useMe()

  // Dashboard stats: ya cachea contador de NCs abiertas (incluye OPEN + IN_PROGRESS).
  const { data: dashStats } = useQuery<{
    nonConformities: { open: number; inProgress: number; total: number }
  }>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.dashboard.stats() as Promise<{
      nonConformities: { open: number; inProgress: number; total: number }
    }>,
    staleTime: 60 * 1000,
  })

  // Pendientes de aprobación/revisión del usuario actual.
  const { data: pendingApprovals } = useQuery<unknown[]>({
    queryKey: ['approval', 'pending'],
    queryFn: () => api.approval.getPending() as Promise<unknown[]>,
    staleTime: 60 * 1000,
  })

  const navigation = buildNavigation({
    ncOpen: dashStats?.nonConformities.total ?? 0,
    approvalsPending: pendingApprovals?.length ?? 0,
  })

  const orgName = me?.organizationName ?? '—'
  const orgInitial = (orgName ?? '·').slice(0, 1).toUpperCase()
  const userName = me?.name ?? '—'
  const userInitials = initials(me?.name)
  const userRoleText = me?.role ? roleLabel[me.role] : '—'
  const userAreaText = me?.areaName ? ` · ${me.areaName}` : ''

  return (
    <aside
      className={cn(
        'synapse-sidebar flex h-screen flex-col border-r',
        open && 'open',
      )}
      style={{ width: 'var(--sidebar-w)', borderColor: 'rgba(255,255,255,0.05)' }}
    >
      {/* Brand */}
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="flex items-center gap-3 border-b border-white/5 px-5 pb-[22px] pt-5"
      >
        <BrainMark size={36} animated />
        <div className="flex flex-col leading-none">
          <span
            className="text-[22px] tracking-tight"
            style={{ fontFamily: 'var(--font-serif)', color: '#F3F6FC' }}
          >
            Synap<em className="italic" style={{ color: 'var(--brand-cian)' }}>se</em>
          </span>
          <span
            className="mt-1 text-[9px] uppercase tracking-[0.22em]"
            style={{ fontFamily: 'var(--font-mono)', color: '#6A7797' }}
          >
            by · NosisHub
          </span>
        </div>
      </Link>

      {/* Org selector */}
      <button
        type="button"
        className="m-3 flex items-center gap-2.5 rounded-[10px] border border-white/10 bg-white/5 px-4 py-3.5 transition-colors hover:border-white/20 hover:bg-white/10"
      >
        <div
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg border"
          style={{
            background: 'linear-gradient(135deg, var(--brand-prusia), #0C1E5C)',
            borderColor: 'rgba(94,234,254,0.25)',
            color: 'var(--brand-cian)',
            fontFamily: 'var(--font-serif)',
            fontSize: 15,
          }}
        >
          {orgInitial}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <div className="truncate text-[13px] font-medium" style={{ color: '#F3F6FC' }}>
            {orgName}
          </div>
          <div
            className="mt-0.5 truncate text-[9px] uppercase tracking-[0.14em]"
            style={{ fontFamily: 'var(--font-mono)', color: '#6A7797' }}
          >
            Multitenant{userAreaText}
          </div>
        </div>
        <ChevronDown className="h-3 w-3 shrink-0" style={{ color: '#6A7797' }} />
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-0 pb-3.5 pt-2">
        {navigation.map((group) => (
          <div key={group.label}>
            <div
              className="px-6 pb-2 pt-[18px] text-[9.5px] uppercase tracking-[0.22em]"
              style={{ fontFamily: 'var(--font-mono)', color: '#4E5977' }}
            >
              {group.label}
            </div>
            {group.items.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'relative mx-2.5 flex items-center gap-3 rounded-[8px] py-[9px] pl-6 pr-4 text-[13.5px] transition-colors',
                    'text-[#A9B4CC] hover:bg-white/5 hover:text-[#F3F6FC]',
                    isActive && 'sb-item-active',
                  )}
                >
                  <Icon
                    className="h-[17px] w-[17px] shrink-0"
                    style={{ opacity: isActive ? 1 : 0.75 }}
                  />
                  <span className="flex-1">{item.name}</span>
                  {item.badge && (
                    <span className={cn('sb-badge ml-auto', item.warn && 'sb-badge-warn')}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="flex items-center gap-2.5 border-t border-white/5 px-4 py-3.5">
        {me?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={me.avatarUrl}
            alt={userName}
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-medium"
            style={{
              background: 'linear-gradient(135deg, #7AB8FF, #1E3A8A)',
              color: '#F3F6FC',
            }}
          >
            {userInitials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px]" style={{ color: '#F3F6FC' }}>
            {userName}
          </div>
          <div
            className="mt-0.5 truncate text-[9px] uppercase tracking-[0.14em]"
            style={{ fontFamily: 'var(--font-mono)', color: '#6A7797' }}
          >
            {me?.positionName ?? userRoleText}
          </div>
        </div>
        <ChevronDown className="h-3 w-3 shrink-0" style={{ color: '#6A7797' }} />
      </div>
    </aside>
  )
}
