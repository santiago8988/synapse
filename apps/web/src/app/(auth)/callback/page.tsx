'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { saveSession } from '@/lib/session'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

function CallbackHandler({ onError }: { onError: (msg: string) => void }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  // El código se canjea una sola vez, así que el efecto tiene que dispararse
  // una sola vez. En desarrollo React monta los efectos dos veces (StrictMode)
  // y sin esta guarda el segundo intento encuentra el código ya consumido y
  // muestra "el código venció", aunque el login haya salido bien.
  // El ref sobrevive al desmontaje simulado de StrictMode; un booleano común no.
  const exchangeStarted = useRef(false)

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code) {
      router.replace('/login')
      return
    }
    if (exchangeStarted.current) return
    exchangeStarted.current = true

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

        // El middleware guarda en `next` la página que el usuario quiso abrir.
        // Se acepta solo una ruta interna: sin esta validación, un `next`
        // apuntando a otro dominio convertiría el login en un redirector
        // abierto, útil para phishing.
        const solicitado = searchParams.get('next')
        const destino =
          solicitado && solicitado.startsWith('/') && !solicitado.startsWith('//')
            ? solicitado
            : '/dashboard'

        // Se guarda sin condicionar a que el componente siga montado: el código
        // ya se consumió y no hay segunda oportunidad de obtener este token.
        saveSession(token)
        // replace() no basta: el middleware necesita ver la cookie recién
        // escrita, y una navegación de cliente no vuelve a pasar por él.
        window.location.replace(destino)
      } catch (err) {
        onError(err instanceof Error ? err.message : 'No se pudo completar el ingreso')
      }
    })()
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
