'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function CallbackHandler() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    if (token) {
      localStorage.setItem('synapse_token', token)
      router.replace('/dashboard')
    } else {
      router.replace('/login')
    }
  }, [router, searchParams])

  return null
}

export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Autenticando...</p>
      </div>
      <Suspense>
        <CallbackHandler />
      </Suspense>
    </div>
  )
}
