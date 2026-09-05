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
  Users,
  Mail,
  GitBranch,
  type LucideIcon,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { BrainMark } from '@/components/brand/brain-mark'
import { useMe } from '@/lib/use-me'
import { UserMenu } from '@/components/layout/user-menu'
import { OrgSwitcher } from '@/components/layout/org-switcher'
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
    // Sin titulo: es un unico item, un encabezado para uno solo es ruido.
    {
      label: '',
      items: [{ href: '/dashboard', name: 'Dashboard', icon: LayoutDashboard }],
    },
    // Lo que define como funciona el sistema. Flujos va aca y no en Calidad:
    // un flujo es el cableado entre dos registros, no un evento de calidad.
    {
      label: 'Estructura',
      items: [
        { href: '/records', name: 'Registros', icon: ClipboardList },
        { href: '/flows', name: 'Flujos', icon: Workflow },
        { href: '/documents', name: 'Documentos', icon: FileText },
      ],
    },
    // Datos maestros que los registros referencian, no acciones del dia a dia.
    {
      label: 'Catálogos',
      items: [
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
    // Antes era un solo item llamado "Ajustes", que no decia que adentro viven
    // usuarios, whitelist, areas y puestos: habia que entrar para descubrirlo.
    // Ahora cada destino se ve desde aca y entra directo a su pestaña.
    {
      label: 'Organización',
      items: [
        { href: '/settings/users', name: 'Usuarios', icon: Users },
        { href: '/settings/whitelist', name: 'Whitelist', icon: Mail },
        { href: '/settings/areas', name: 'Áreas', icon: GitBranch },
        { href: '/settings/general', name: 'Ajustes', icon: Settings },
      ],
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

      <OrgSwitcher />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-0 pb-3.5 pt-2">
        {navigation.map((group) => (
          <div key={group.label || group.items[0]?.href}>
            {group.label && (
              <div
                className="px-6 pb-2 pt-[18px] text-[9.5px] uppercase tracking-[0.22em]"
                style={{ fontFamily: 'var(--font-mono)', color: '#4E5977' }}
              >
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              // `/settings` a secas muestra General, asi que resalta el mismo
              // item que `/settings/general`.
              const rutaActual = pathname === '/settings' ? '/settings/general' : pathname
              const isActive =
                rutaActual === item.href || rutaActual.startsWith(item.href + '/')
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

      <UserMenu />
    </aside>
  )
}
