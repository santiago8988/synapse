'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, LogOut } from 'lucide-react'
import { useOrganizationStore } from '@/store/organization.store'
import { useMe, initials, roleLabel } from '@/lib/use-me'

/**
 * Bloque de usuario al pie de la sidebar, con el menú para cerrar sesión.
 *
 * Hasta ahora este bloque mostraba un `ChevronDown` que no abría nada y la
 * única forma de cerrar sesión era que la API devolviera un 401. En una tablet
 * de planta que se pasa de turno en turno eso no es un detalle: es la sesión de
 * otra persona quedando abierta.
 */

/** Techo para el borrado de cachés. Ver `cerrarSesion`. */
const TIMEOUT_BORRADO_MS = 1500

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export function UserMenu() {
  const { data: me } = useMe()
  const clearAuth = useOrganizationStore((s) => s.clearAuth)
  const queryClient = useQueryClient()
  const [abierto, setAbierto] = useState(false)
  const [saliendo, setSaliendo] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  // Cerrar al hacer click afuera o con Escape.
  useEffect(() => {
    if (!abierto) return
    const onClick = (e: MouseEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [abierto])

  async function cerrarSesion() {
    setSaliendo(true)

    // TanStack Query guarda en memoria lo que vio el usuario anterior. La
    // navegación dura de abajo la tira igual, pero si algo la demora no quiere
    // haber datos de otra persona en pantalla mientras tanto.
    queryClient.clear()

    // Se espera el borrado de las cachés del service worker antes de navegar:
    // `window.location` descarga la página y cortaría la promesa por la mitad.
    // El techo existe porque quedar atrapado sin poder salir es peor que dejar
    // una caché sin borrar.
    await Promise.race([clearAuth(), esperar(TIMEOUT_BORRADO_MS)])

    // Navegación dura y no `router.push`: una navegación de cliente no vuelve a
    // pasar por el middleware y no vería que la cookie ya no está.
    window.location.href = '/login'
  }

  const nombre = me?.name ?? '—'
  const subtitulo = me?.positionName ?? (me?.role ? roleLabel[me.role] : '—')

  return (
    <div ref={contenedor} className="relative border-t border-white/5">
      {abierto && (
        <div
          role="menu"
          className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-[10px] border py-1 shadow-lg"
          style={{ background: 'var(--bg-1, #0C1324)', borderColor: 'rgba(255,255,255,0.12)' }}
        >
          <div className="px-3.5 pb-2 pt-2">
            <div className="truncate text-[12px]" style={{ color: '#F3F6FC' }}>
              {nombre}
            </div>
            <div className="truncate text-[11px]" style={{ color: '#6A7797' }}>
              {me?.email ?? ''}
            </div>
          </div>
          <div className="my-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
          <button
            type="button"
            role="menuitem"
            onClick={cerrarSesion}
            disabled={saliendo}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-[#A9B4CC] transition-colors hover:bg-white/5 hover:text-[#F3F6FC] disabled:opacity-50"
          >
            <LogOut className="h-[15px] w-[15px] shrink-0" />
            {saliendo ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setAbierto((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Menú de usuario"
        className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left transition-colors hover:bg-white/5"
      >
        {me?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={me.avatarUrl}
            alt={nombre}
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
            {initials(me?.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px]" style={{ color: '#F3F6FC' }}>
            {nombre}
          </div>
          <div
            className="mt-0.5 truncate text-[9px] uppercase tracking-[0.14em]"
            style={{ fontFamily: 'var(--font-mono)', color: '#6A7797' }}
          >
            {subtitulo}
          </div>
        </div>
        <ChevronDown
          className="h-3 w-3 shrink-0 transition-transform"
          style={{ color: '#6A7797', transform: abierto ? 'rotate(180deg)' : undefined }}
        />
      </button>
    </div>
  )
}
