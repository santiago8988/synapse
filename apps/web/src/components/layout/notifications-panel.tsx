'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, Check, Loader2 } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

/**
 * Campanita del header. Hasta ahora era decorativa: la acción NOTIFY del motor
 * de flujos era un stub, así que no había nada que mostrar.
 *
 * El contador se consulta aparte del listado para que el número aparezca sin
 * tener que traer las notificaciones enteras en cada carga de página.
 */

interface Notification {
  id: string
  title: string
  body: string | null
  link: string | null
  readAt: string | null
  createdAt: string
}

function tiempoRelativo(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (minutos < 1) return 'recién'
  if (minutos < 60) return `hace ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'ayer'
  if (dias < 30) return `hace ${dias} días`
  return new Date(iso).toLocaleDateString('es-AR')
}

export function NotificationsPanel() {
  const [open, setOpen] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)
  const queryClient = useQueryClient()

  const { data: contador } = useQuery<{ count: number }>({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.notifications.unreadCount<{ count: number }>(),
    // Refresco moderado: un aviso que llega un minuto tarde no cambia nada, y
    // consultarlo seguido multiplica requests por usuario conectado.
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const { data: items = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['notifications', 'list'],
    queryFn: () => api.notifications.list<Notification[]>(),
    // Solo se traen al abrir el panel.
    enabled: open,
  })

  const marcarLeida = useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const marcarTodas = useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Cerrar al hacer click afuera.
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const sinLeer = contador?.count ?? 0

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={sinLeer > 0 ? `Notificaciones, ${sinLeer} sin leer` : 'Notificaciones'}
        className="relative flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border transition-colors hover:bg-[var(--bg-3)]"
        style={{ borderColor: 'var(--line-2)', color: 'var(--ink-1)' }}
      >
        <Bell className="h-[18px] w-[18px]" />
        {sinLeer > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full px-1 font-mono text-[9px] font-semibold"
            style={{ background: 'var(--danger)', color: 'white' }}
          >
            {sinLeer > 9 ? '9+' : sinLeer}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[42px] z-50 w-[340px] overflow-hidden rounded-[12px] border shadow-lg"
          style={{ background: 'var(--bg-1)', borderColor: 'var(--line-2)' }}
        >
          <div
            className="flex items-center justify-between border-b px-4 py-2.5"
            style={{ borderColor: 'var(--line)' }}
          >
            <span
              className="font-mono text-[9.5px] uppercase tracking-[0.14em]"
              style={{ color: 'var(--ink-3)' }}
            >
              Notificaciones
            </span>
            {sinLeer > 0 && (
              <button
                type="button"
                onClick={() => marcarTodas.mutate()}
                disabled={marcarTodas.isPending}
                className="text-[11.5px] hover:underline"
                style={{ color: 'var(--primary-hex)' }}
              >
                Marcar todas
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {isLoading ? (
              <div
                className="flex items-center justify-center gap-2 py-8 text-[12.5px]"
                style={{ color: 'var(--ink-3)' }}
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Cargando…
              </div>
            ) : items.length === 0 ? (
              <p
                className="px-4 py-8 text-center text-[12.5px]"
                style={{ color: 'var(--ink-3)' }}
              >
                No tenés notificaciones.
              </p>
            ) : (
              items.map((n) => {
                const contenido = (
                  <>
                    <div className="flex items-start gap-2">
                      {!n.readAt && (
                        <span
                          className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: 'var(--primary-hex)' }}
                        />
                      )}
                      <div className={`min-w-0 flex-1 ${n.readAt ? 'pl-[14px]' : ''}`}>
                        <div
                          className="truncate text-[12.5px] font-medium"
                          style={{ color: 'var(--ink-0)' }}
                        >
                          {n.title}
                        </div>
                        {n.body && (
                          <div className="mt-0.5 text-[12px]" style={{ color: 'var(--ink-2)' }}>
                            {n.body}
                          </div>
                        )}
                        <div
                          className="mt-1 font-mono text-[9px] uppercase tracking-[0.1em]"
                          style={{ color: 'var(--ink-3)' }}
                        >
                          {tiempoRelativo(n.createdAt)}
                        </div>
                      </div>
                      {!n.readAt && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            marcarLeida.mutate(n.id)
                          }}
                          aria-label="Marcar como leída"
                          className="shrink-0 rounded p-1 hover:bg-[var(--bg-3)]"
                          style={{ color: 'var(--ink-3)' }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                )

                const clases = 'block border-b px-4 py-3 transition-colors hover:bg-[var(--bg-2)]'
                const estilo = {
                  borderColor: 'var(--line)',
                  background: n.readAt ? 'transparent' : 'var(--bg-2)',
                }

                return n.link ? (
                  <Link
                    key={n.id}
                    href={n.link}
                    className={clases}
                    style={estilo}
                    onClick={() => {
                      if (!n.readAt) marcarLeida.mutate(n.id)
                      setOpen(false)
                    }}
                  >
                    {contenido}
                  </Link>
                ) : (
                  <div key={n.id} className={clases} style={estilo}>
                    {contenido}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
