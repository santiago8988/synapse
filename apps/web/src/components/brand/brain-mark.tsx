'use client'

import { cn } from '@/lib/utils'

interface BrainMarkProps {
  size?: number
  variant?: 'filled' | 'outline'
  animated?: boolean
  className?: string
}

/**
 * Marca Synapse — cerebro lateral, minimalista. Portado del prototipo Claude Design.
 */
export function BrainMark({
  size = 36,
  variant = 'filled',
  animated = false,
  className,
}: BrainMarkProps) {
  const stroke = variant === 'outline' ? '#1E3A8A' : 'rgba(94,234,254,0.65)'
  const fill = variant === 'outline' ? 'none' : 'url(#synapse-hemi)'

  return (
    <svg
      width={size}
      height={size}
      viewBox="-260 -260 520 520"
      className={cn('shrink-0', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="synapse-hemi" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0C1E5C" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
        <filter id="synapse-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <path
        d="M -200 -40 C -210 -90, -180 -150, -130 -180 C -70 -210, 10 -218, 80 -200 C 145 -184, 195 -148, 215 -90 C 230 -40, 232 10, 215 60 C 205 95, 180 115, 145 120 C 175 130, 195 155, 195 175 L 100 175 C 90 165, 70 158, 45 158 C 25 158, 5 168, -5 175 L -60 175 C -75 168, -90 152, -100 130 C -115 95, -135 80, -160 70 C -190 55, -210 25, -212 -5 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="8"
      />
      <path
        d="M -160 50 C -100 35, -20 30, 60 40 C 110 48, 150 60, 180 70"
        stroke={stroke}
        strokeWidth="5"
        fill="none"
        opacity="0.8"
      />
      <path
        d="M 0 -180 C -10 -130, -10 -70, 0 -10"
        stroke={stroke}
        strokeWidth="5"
        fill="none"
        opacity="0.8"
      />

      <circle
        cx="-90"
        cy="-50"
        r="14"
        fill="#5EEAFE"
        filter={animated ? 'url(#synapse-glow)' : undefined}
        className={animated ? 'synapse-pulse' : undefined}
      />
      <circle
        cx="60"
        cy="-60"
        r="14"
        fill="#5EEAFE"
        filter={animated ? 'url(#synapse-glow)' : undefined}
        className={animated ? 'synapse-pulse-2' : undefined}
      />
      <circle
        cx="130"
        cy="-30"
        r="12"
        fill="#5EEAFE"
        filter={animated ? 'url(#synapse-glow)' : undefined}
        className={animated ? 'synapse-pulse-3' : undefined}
      />
    </svg>
  )
}
