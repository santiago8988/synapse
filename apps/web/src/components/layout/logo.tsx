'use client'

import { cn } from '@/lib/utils'
import { BrainMark } from '@/components/brand/brain-mark'

interface LogoProps {
  collapsed?: boolean
  className?: string
  dark?: boolean
}

/**
 * Wrapper de compatibilidad — envuelve BrainMark + wordmark "Synapse by NosisHub".
 * Usado por pantallas de auth / select-org heredadas.
 */
export function Logo({ collapsed = false, className, dark = false }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <BrainMark size={36} animated />
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span
            className="text-[22px] tracking-tight"
            style={{
              fontFamily: 'var(--font-serif)',
              color: dark ? '#F3F6FC' : 'var(--ink-0)',
            }}
          >
            Synap
            <em className="italic" style={{ color: 'var(--accent-live)' }}>
              se
            </em>
          </span>
          <span
            className="mt-1 text-[9px] uppercase tracking-[0.22em]"
            style={{
              fontFamily: 'var(--font-mono)',
              color: dark ? '#6A7797' : 'var(--ink-3)',
            }}
          >
            by · NosisHub
          </span>
        </div>
      )}
    </div>
  )
}
