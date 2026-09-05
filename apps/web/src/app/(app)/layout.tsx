'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'
import { OfflineBanner } from '@/components/layout/offline-banner'
import { cn } from '@/lib/utils'

/**
 * Rutas que renderizan edge-to-edge: el componente maneja su propio layout y
 * su propio scroll, en dos columnas que ocupan el alto de la ventana.
 *
 * **Eso vale solo en pantallas grandes.** En mobile esas páginas se apilan en
 * una sola columna larga, y si el `main` sigue con `overflow-hidden` la parte
 * de abajo queda inalcanzable: se puede bajar hasta donde llega el alto de la
 * ventana y nada más. Pasó con el Record Builder, que quedaba cortado en la
 * sección Campos.
 */
const edgeToEdgePatterns = [/^\/records\/new$/, /^\/records\/[^/]+\/edit$/]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? ''
  const isEdgeToEdge = edgeToEdgePatterns.some((p) => p.test(pathname))
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Lock body scroll when drawer is open (mobile)
  useEffect(() => {
    document.body.classList.toggle('syn-drawer-open', drawerOpen)
    return () => document.body.classList.remove('syn-drawer-open')
  }, [drawerOpen])

  // Close drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  return (
    <div className="synapse-shell">
      <Sidebar open={drawerOpen} onNavigate={() => setDrawerOpen(false)} />
      <div className={cn('synapse-backdrop', drawerOpen && 'open')} onClick={() => setDrawerOpen(false)} aria-hidden />
      <div className="flex min-w-0 flex-col overflow-hidden">
        <OfflineBanner />
        <Header onMenuClick={() => setDrawerOpen(true)} />
        <main
          id="main-content"
          className={
            'fade-in relative flex-1 min-h-0' +
            // El edge-to-edge recién a partir de lg: abajo de eso el contenido
            // se apila y necesita el scroll del main.
            (isEdgeToEdge
              ? ' overflow-y-auto lg:overflow-hidden'
              : ' overflow-y-auto px-4 sm:px-8 pb-20 pt-6 sm:pt-7')
          }
        >
          {children}
        </main>
      </div>
    </div>
  )
}
