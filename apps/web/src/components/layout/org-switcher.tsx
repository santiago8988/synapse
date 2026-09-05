'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { saveSession } from '@/lib/session'
import { useMe } from '@/lib/use-me'

/**
 * Selector de organización, al tope de la sidebar.
 *
 * Hasta ahora era un botón con un chevron que no abría nada: quien estaba
 * habilitado en más de una organización no tenía forma de cambiar sin volver a
 * iniciar sesión.
 *
 * El listado es solo para mostrar. La autorización la hace el backend al
 * emitir el token nuevo (`generateToken` revalida la membresía), así que si a
 * alguien le revocan el acceso con el menú abierto, el cambio falla igual.
 */

interface Membresia {
  id: string
  name: string
  slug: string
  role: string
}

export function OrgSwitcher() {
  const { data: me } = useMe()
  const [abierto, setAbierto] = useState(false)
  const [cambiando, setCambiando] = useState<string | null>(null)
  const contenedor = useRef<HTMLDivElement>(null)

  // Solo se pide cuando el menú se abre: la enorme mayoría de los usuarios
  // pertenece a una sola organización y no tiene sentido gastar una llamada en
  // cada carga de página para eso.
  const { data: organizaciones, isLoading } = useQuery<Membresia[]>({
    queryKey: ['auth', 'my-organizations'],
    queryFn: () => api.auth.myOrganizations<Membresia[]>(),
    enabled: abierto,
    staleTime: 5 * 60 * 1000,
  })

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

  async function cambiarA(organizationId: string) {
    if (organizationId === me?.organizationId) {
      setAbierto(false)
      return
    }
    setCambiando(organizationId)
    try {
      const { token } = await api.auth.switchOrg(organizationId) as { token: string }
      saveSession(token)
      // Navegación dura y al dashboard: el JWT nuevo cambia organización, rol y
      // área, así que cualquier pantalla abierta está mostrando datos que ya no
      // corresponden. Recargar entero es más honesto que invalidar queries y
      // esperar que no quede nada colgado.
      window.location.href = '/dashboard'
    } catch (e) {
      setCambiando(null)
      toast.error(e instanceof Error ? e.message : 'No se pudo cambiar de organización')
    }
  }

  const orgName = me?.organizationName ?? '—'
  const orgInitial = orgName.slice(0, 1).toUpperCase()
  const areaText = me?.areaName ? ` · ${me.areaName}` : ''

  return (
    <div ref={contenedor} className="relative m-3">
      <button
        type="button"
        onClick={() => setAbierto((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className="flex w-full items-center gap-2.5 rounded-[10px] border border-white/10 bg-white/5 px-4 py-3.5 transition-colors hover:border-white/20 hover:bg-white/10"
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
            Multitenant{areaText}
          </div>
        </div>
        <ChevronDown
          className="h-3 w-3 shrink-0 transition-transform"
          style={{ color: '#6A7797', transform: abierto ? 'rotate(180deg)' : undefined }}
        />
      </button>

      {abierto && (
        <div
          role="menu"
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-[10px] border py-1 shadow-lg"
          style={{ background: 'var(--bg-1, #0C1324)', borderColor: 'rgba(255,255,255,0.12)' }}
        >
          {isLoading && (
            <div className="flex items-center gap-2 px-3.5 py-3 text-[12px]" style={{ color: '#6A7797' }}>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cargando…
            </div>
          )}

          {organizaciones?.map((org) => {
            const esActual = org.id === me?.organizationId
            return (
              <button
                key={org.id}
                type="button"
                role="menuitem"
                onClick={() => cambiarA(org.id)}
                disabled={cambiando !== null}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] text-[#A9B4CC] transition-colors hover:bg-white/5 hover:text-[#F3F6FC] disabled:opacity-50"
              >
                <span className="min-w-0 flex-1 truncate">{org.name}</span>
                {cambiando === org.id ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                ) : esActual ? (
                  <Check className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--brand-cian)' }} />
                ) : null}
              </button>
            )
          })}

          {organizaciones?.length === 1 && (
            // Decirlo explícitamente evita que alguien crea que el menú está roto.
            <div className="px-3.5 pb-2 pt-1 text-[11px]" style={{ color: '#4E5977' }}>
              Pertenecés a una sola organización.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
