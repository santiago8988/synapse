'use client'

import { useTheme } from 'next-themes'
import { X, Sun, Moon } from 'lucide-react'
import { useDensity, type Density } from './density-provider'
import { cn } from '@/lib/utils'

interface TweaksPanelProps {
  open: boolean
  onClose: () => void
}

const densityOptions: { value: Density; label: string }[] = [
  { value: 'dense', label: 'Densa' },
  { value: 'normal', label: 'Normal' },
  { value: 'cozy', label: 'Cómoda' },
]

export function TweaksPanel({ open, onClose }: TweaksPanelProps) {
  const { theme, setTheme } = useTheme()
  const { density, setDensity } = useDensity()

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <aside
        className="fade-in fixed right-6 top-20 z-50 w-[280px] rounded-[14px] border p-5 shadow-lg"
        style={{
          background: 'var(--bg-1)',
          borderColor: 'var(--line-2)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div
              className="text-[10px] uppercase tracking-[0.22em]"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}
            >
              · Tweaks
            </div>
            <div
              className="mt-1"
              style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22 }}
            >
              Ajustá tu vista.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar tweaks"
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[var(--bg-3)]"
          >
            <X className="h-4 w-4" style={{ color: 'var(--ink-2)' }} />
          </button>
        </div>

        {/* Theme */}
        <div className="mb-5">
          <div
            className="mb-2 text-[10px] uppercase tracking-[0.22em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}
          >
            Tema
          </div>
          <div
            className="grid grid-cols-2 gap-1 rounded-[10px] p-1"
            style={{ background: 'var(--bg-3)' }}
          >
            <SegmentBtn active={theme === 'light'} onClick={() => setTheme('light')}>
              <Sun className="h-3.5 w-3.5" /> Claro
            </SegmentBtn>
            <SegmentBtn active={theme === 'dark'} onClick={() => setTheme('dark')}>
              <Moon className="h-3.5 w-3.5" /> Oscuro
            </SegmentBtn>
          </div>
        </div>

        {/* Density */}
        <div>
          <div
            className="mb-2 text-[10px] uppercase tracking-[0.22em]"
            style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-3)' }}
          >
            Densidad
          </div>
          <div
            className="grid grid-cols-3 gap-1 rounded-[10px] p-1"
            style={{ background: 'var(--bg-3)' }}
          >
            {densityOptions.map((o) => (
              <SegmentBtn
                key={o.value}
                active={density === o.value}
                onClick={() => setDensity(o.value)}
              >
                {o.label}
              </SegmentBtn>
            ))}
          </div>
        </div>

        <p
          className="mt-5 border-t pt-4 text-[11px]"
          style={{ borderColor: 'var(--line)', color: 'var(--ink-3)' }}
        >
          Las preferencias se guardan en este dispositivo.
        </p>
      </aside>
    </>
  )
}

function SegmentBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center justify-center gap-1.5 rounded-[7px] py-2 text-[12px] transition-colors',
        active ? 'bg-white shadow-sm' : 'text-ink-2 hover:bg-white/50',
      )}
      style={active ? { color: 'var(--ink-0)', boxShadow: 'var(--shadow-xs)' } : undefined}
    >
      {children}
    </button>
  )
}
