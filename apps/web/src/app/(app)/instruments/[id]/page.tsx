'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { api } from '@/lib/api'

interface InstrumentResponse {
  id: string
  recordId: string
  status: string | null
  nextCalibrationAt: string | null
  data: Record<string, unknown>
  record: { id: string; name: string }
}

/**
 * Records-as-Lists post-collapse: el "instrumento" es una Entry de un Record
 * INSTRUMENTAL. Redirigimos al detalle del Record dueño donde el usuario
 * encuentra Kanban + tabla + el detalle de la entry específica.
 *
 * Mantenemos el endpoint legacy `api.instruments.get(id)` (wrapper sobre
 * EntriesService) porque resuelve el `recordId` para nosotros.
 */
export default function InstrumentDetailRedirectPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { data, isLoading, isError, error } = useQuery<InstrumentResponse>({
    queryKey: ['instrument', params.id],
    queryFn: () => api.instruments.get(params.id) as Promise<InstrumentResponse>,
    enabled: Boolean(params.id),
  })

  useEffect(() => {
    if (data?.recordId) {
      router.replace(`/records/${data.recordId}`)
    }
  }, [data?.recordId, router])

  return (
    <div className="mx-auto max-w-[800px]">
      <div className="syn-ph">
        <div>
          <Link
            href="/instruments"
            className="syn-btn syn-btn-ghost mb-3"
            style={{ color: 'var(--ink-2)' }}
          >
            <ArrowLeft className="h-3 w-3" /> Volver
          </Link>
          <h1>
            Detalle de <span className="italic">instrumento.</span>
          </h1>
          <p className="sub">
            Te llevamos al Record correspondiente. Si no se redirige automáticamente,
            usá el link debajo.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="syn-card">
          <div className="syn-card-body">Cargando…</div>
        </div>
      )}

      {isError && (
        <div className="syn-card">
          <div className="syn-card-body" style={{ color: 'var(--danger)' }}>
            No se encontró el instrumento ({String((error as Error)?.message ?? 'error desconocido')}).
          </div>
        </div>
      )}

      {data?.recordId && (
        <div className="syn-card">
          <div className="syn-card-body">
            <Link href={`/records/${data.recordId}`} className="syn-btn syn-btn-primary">
              Ir al registro {data.record?.name ?? ''}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
