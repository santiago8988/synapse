'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Logo } from '@/components/layout/logo'
import { Building2, ArrowRight, Loader2 } from 'lucide-react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

interface OrgOption {
  id: string
  name: string
  slug: string
  role: string
}

/**
 * Selección de organización cuando el email está habilitado en más de una.
 *
 * Antes esta pantalla recibía `?userId=...&orgs=...` y llamaba a
 * `POST /auth/switch-org` sin credencial. Ese endpoint exige JWT, así que
 * devolvía 401 y el flujo multi-organización simplemente no funcionaba.
 *
 * Ahora recibe el mismo código de un solo uso que el callback: se pide con él
 * la lista de organizaciones (que el backend cruza contra las membresías
 * activas) y se canjea por el JWT al elegir una.
 */
function SelectOrgContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const code = searchParams.get('code')

  const [orgs, setOrgs] = useState<OrgOption[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    if (!code) {
      router.replace('/login')
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/auth/exchange/organizations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.message || 'No se pudieron cargar las organizaciones')
        }
        const data: OrgOption[] = await res.json()
        if (!cancelled) setOrgs(data)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'No se pudo continuar')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, router])

  const handleSelect = useCallback(
    async (organizationId: string) => {
      if (!code) return
      setPendingId(organizationId)
      setError(null)
      try {
        const res = await fetch(`${API_URL}/auth/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, organizationId }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.message || 'No se pudo completar el ingreso')
        }
        const { token } = await res.json()
        localStorage.setItem('synapse_token', token)
        router.replace('/dashboard')
      } catch (err) {
        setPendingId(null)
        setError(err instanceof Error ? err.message : 'No se pudo completar el ingreso')
      }
    },
    [code, router],
  )

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm font-medium">{error}</p>
        <p className="text-xs text-muted-foreground">
          Los enlaces de ingreso vencen a los 2 minutos y se usan una sola vez.
        </p>
        <a href="/login" className="syn-btn syn-btn-primary">
          Volver a iniciar sesión
        </a>
      </div>
    )
  }

  if (!orgs) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando organizaciones…
      </div>
    )
  }

  if (orgs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Tu cuenta ya no tiene acceso activo a ninguna organización. Pedile al
        administrador que te habilite.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {orgs.map((org) => (
        <button
          key={org.id}
          onClick={() => handleSelect(org.id)}
          disabled={pendingId !== null}
          className="group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md disabled:opacity-60"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">{org.name}</p>
            <p className="truncate text-xs text-muted-foreground">{org.role}</p>
          </div>
          {pendingId === org.id ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
          )}
        </button>
      ))}
    </div>
  )
}

export default function SelectOrgPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="flex flex-col items-center gap-4">
          <Logo />
          <div className="text-center">
            <h1 className="text-xl font-bold">Seleccioná tu organización</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tu cuenta tiene acceso a múltiples organizaciones
            </p>
          </div>
        </div>
        <Suspense>
          <SelectOrgContent />
        </Suspense>
      </div>
    </div>
  )
}
