'use client'

import { Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Logo } from '@/components/layout/logo'
import { Building2, ArrowRight } from 'lucide-react'

function SelectOrgContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const userId = searchParams.get('userId')
  const orgs = searchParams.get('orgs')?.split(',') || []

  const handleSelect = async (orgId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/switch-org`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, organizationId: orgId }),
      })
      const data = await res.json()
      localStorage.setItem('synapse_token', data.token)
      router.replace('/dashboard')
    } catch {
      router.replace('/login')
    }
  }

  return (
    <div className="space-y-3">
      {orgs.map((orgId) => (
        <button
          key={orgId}
          onClick={() => handleSelect(orgId)}
          className="group flex w-full items-center gap-4 rounded-xl border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Organización</p>
            <p className="text-xs text-muted-foreground">{orgId}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
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
