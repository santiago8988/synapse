'use client'

import { useEffect, useRef, useState } from 'react'
import { Columns3, Check } from 'lucide-react'
import type { ColumnPreferences } from './use-column-preferences'

interface Campo {
  id: string
  label: string
  isIdentifier: boolean
}

/**
 * Selector de columnas de la tabla de entradas.
 *
 * Arranca mostrando todo, igual que antes de que existiera: quitar columnas de
 * entrada sería cambiarle la pantalla a alguien que no pidió nada. El atajo
 * "Solo identificadores" deja el alivio a un click para los registros con
 * muchos campos, que era el problema a resolver.
 */
export function ColumnPicker({
  fields,
  prefs,
}: {
  fields: Campo[]
  prefs: ColumnPreferences
}) {
  const [open, setOpen] = useState(false)
  const contenedor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const ocultas = fields.filter((f) => prefs.isHidden(f.id)).length
  const identificadores = fields.filter((f) => f.isIdentifier).map((f) => f.id)
  const todos = fields.map((f) => f.id)

  return (
    <div className="relative" ref={contenedor}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="syn-btn syn-btn-subtle"
        style={{ padding: '6px 10px' }}
        aria-label="Elegir columnas"
      >
        <Columns3 className="h-3.5 w-3.5" />
        Columnas
        {ocultas > 0 && (
          <span
            className="ml-1 font-mono text-[10px]"
            style={{ color: 'var(--ink-3)' }}
          >
            ·{fields.length - ocultas}/{fields.length}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-[38px] z-50 w-[260px] overflow-hidden rounded-[12px] border shadow-lg"
          style={{ background: 'var(--bg-1)', borderColor: 'var(--line-2)' }}
        >
          <div
            className="flex items-center justify-between gap-2 border-b px-3 py-2"
            style={{ borderColor: 'var(--line)' }}
          >
            <span
              className="font-mono text-[9.5px] uppercase tracking-[0.14em]"
              style={{ color: 'var(--ink-3)' }}
            >
              Columnas
            </span>
            <div className="flex gap-2">
              {identificadores.length > 0 && (
                <button
                  type="button"
                  onClick={() => prefs.showOnly(identificadores, todos)}
                  className="text-[11px] hover:underline"
                  style={{ color: 'var(--primary-hex)' }}
                >
                  Solo identificadores
                </button>
              )}
              {ocultas > 0 && (
                <button
                  type="button"
                  onClick={prefs.reset}
                  className="text-[11px] hover:underline"
                  style={{ color: 'var(--ink-2)' }}
                >
                  Todas
                </button>
              )}
            </div>
          </div>

          <div className="max-h-[300px] overflow-y-auto py-1">
            {fields.map((f) => {
              const visible = !prefs.isHidden(f.id)
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => prefs.toggle(f.id)}
                  className="flex w-full items-center gap-2 px-3 py-[7px] text-left text-[12.5px] transition-colors hover:bg-[var(--bg-2)]"
                  style={{ color: 'var(--ink-0)' }}
                >
                  <span
                    className="flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[4px] border"
                    style={{
                      borderColor: visible ? 'var(--primary-hex)' : 'var(--line-strong)',
                      background: visible ? 'var(--primary-hex)' : 'transparent',
                    }}
                  >
                    {visible && <Check className="h-2.5 w-2.5" style={{ color: 'white' }} />}
                  </span>
                  <span className="flex-1 truncate">{f.label}</span>
                  {f.isIdentifier && (
                    <span
                      className="font-mono text-[8.5px] uppercase tracking-[0.1em]"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      ID
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <p
            className="border-t px-3 py-2 text-[10.5px]"
            style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}
          >
            Se guarda en este dispositivo, para tu usuario.
          </p>
        </div>
      )}
    </div>
  )
}
