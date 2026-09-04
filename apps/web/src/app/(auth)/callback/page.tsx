'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function CallbackHandler({ onError }: { onError: (msg: string) => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    // La URL trae un código de un solo uso, no el JWT: el token se pide por
    // POST para que no quede en logs de servidor ni en el historial.
    const code = searchParams.get('code')
    if (!code) {
      router.replace('/login')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`${API_URL}/auth/exchange`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.message || 'No se pudo completar el ingreso')
        }
        const { token } = await res.json()
        if (cancelled) return
        localStorage.setItem('synapse_token', token)
        router.replace('/dashboard')
      } catch (err) {
        if (cancelled) return
        onError(err instanceof Error ? err.message : 'No se pudo completar el ingreso')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [router, searchParams, onError])

  return null
}

export default function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      {error ? (
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium">{error}</p>
          <p className="text-xs text-muted-foreground">
            Los enlaces de ingreso vencen a los 2 minutos y se usan una sola vez.
          </p>
          <a href="/login" className="syn-btn syn-btn-primary">
            Volver a iniciar sesión
          </a>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Autenticando…</p>
        </div>
      )}
      <Suspense>
        <CallbackHandler onError={setError} />
      </Suspense>
    </div>
  )
}
