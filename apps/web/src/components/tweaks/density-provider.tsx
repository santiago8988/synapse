'use client'

import * as React from 'react'

export type Density = 'dense' | 'normal' | 'cozy'

interface DensityCtx {
  density: Density
  setDensity: (d: Density) => void
}

const Ctx = React.createContext<DensityCtx | null>(null)

const STORAGE_KEY = 'synapse.density'

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const [density, setDensityState] = React.useState<Density>('normal')

  React.useEffect(() => {
    const saved = (typeof window !== 'undefined'
      ? (localStorage.getItem(STORAGE_KEY) as Density | null)
      : null)
    if (saved === 'dense' || saved === 'normal' || saved === 'cozy') {
      setDensityState(saved)
    }
  }, [])

  React.useEffect(() => {
    document.documentElement.setAttribute('data-density', density)
    try {
      localStorage.setItem(STORAGE_KEY, density)
    } catch {}
  }, [density])

  const value = React.useMemo<DensityCtx>(
    () => ({ density, setDensity: setDensityState }),
    [density],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDensity() {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error('useDensity must be used inside DensityProvider')
  return ctx
}
