'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileText,
  FlaskConical,
  ListChecks,
  Menu,
  Microscope,
  Package,
  Ruler,
  Search,
  Shield,
  TestTube2,
  Users,
  Warehouse,
  WifiOff,
  Workflow,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import { docGroups } from '@/content/docs'
import { cn } from '@/lib/utils'

/**
 * Índice lateral de la guía, con buscador.
 *
 * Es lo único que necesita ser cliente en `/docs`: el contenido lo renderiza el
 * servidor, así que el markdown y la librería que lo procesa no llegan al
 * navegador.
 *
 * En mobile el índice arranca plegado. La versión anterior tenía una columna
 * fija de 224px que aplastaba el contenido justamente en el dispositivo donde
 * más se consulta la ayuda: la tablet de planta.
 */

const iconosDocs: Record<string, LucideIcon> = {
  building: Building2,
  users: Users,
  file: FileText,
  clipboard: ClipboardList,
  list: ListChecks,
  workflow: Workflow,
  flask: FlaskConical,
  package: Package,
  tube: TestTube2,
  wrench: Wrench,
  ruler: Ruler,
  microscope: Microscope,
  warehouse: Warehouse,
  check: CheckCircle2,
  alert: AlertTriangle,
  shield: Shield,
  bell: Bell,
  wifi: WifiOff,
}

/** Sin acentos ni mayúsculas: buscar "calibracion" tiene que encontrar "calibración". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function DocNav({ activeSlug }: { activeSlug: string }) {
  const [busqueda, setBusqueda] = useState('')
  const [abiertoEnMobile, setAbiertoEnMobile] = useState(false)

  const grupos = useMemo(() => {
    const q = normalizar(busqueda.trim())
    if (!q) return docGroups
    return docGroups
      .map((g) => ({
        ...g,
        sections: g.sections.filter(
          (s) => normalizar(s.title).includes(q) || normalizar(s.summary).includes(q),
        ),
      }))
      .filter((g) => g.sections.length > 0)
  }, [busqueda])

  return (
    <div className="lg:w-64 lg:shrink-0">
      <button
        type="button"
        onClick={() => setAbiertoEnMobile((o) => !o)}
        aria-expanded={abiertoEnMobile}
        className="mb-3 flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium lg:hidden"
      >
        <Menu className="h-4 w-4" />
        Índice de la guía
      </button>

      <div className={cn('lg:block', abiertoEnMobile ? 'block' : 'hidden')}>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en la guía"
            aria-label="Buscar en la guía"
            className="w-full rounded-lg border bg-transparent py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>

        <nav className="space-y-4">
          {grupos.map((grupo) => (
            <div key={grupo.label}>
              <div className="px-3 pb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
                {grupo.label}
              </div>
              {grupo.sections.map((section) => {
                const Icon = iconosDocs[section.icon] ?? FileText
                const activa = section.slug === activeSlug
                return (
                  <Link
                    key={section.slug}
                    href={`/docs/${section.slug}`}
                    onClick={() => setAbiertoEnMobile(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      activa
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1">{section.title}</span>
                  </Link>
                )
              })}
            </div>
          ))}

          {grupos.length === 0 && (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              Nada coincide con “{busqueda}”.
            </p>
          )}
        </nav>
      </div>
    </div>
  )
}
