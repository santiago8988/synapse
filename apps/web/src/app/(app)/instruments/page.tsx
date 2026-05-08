'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Wrench, ArrowRight } from 'lucide-react'
import { api } from '@/lib/api'

interface RecordRow {
  id: string
  name: string
  type: string
  isSystem: boolean
}

/**
 * Records-as-Lists post-collapse: la tabla `Instrument` ya no existe. El
 * "instrumento" es una Entry de un Record `type=INSTRUMENTAL`. Esta página
 * busca el Record sistema "Instrumentos" creado por el seed y redirige al
 * detalle del record (donde vive la pestaña Kanban + tabla de entries).
 */
export default function InstrumentsPage() {
  const router = useRouter()
  const { data, isLoading, isError } = useQuery<RecordRow[]>({
    queryKey: ['records-instrumental'],
    queryFn: async () => {
      const all = (await api.records.list()) as RecordRow[]
      return all.filter((r) => r.type === 'INSTRUMENTAL')
    },
  })

  const target = data?.find((r) => r.isSystem) ?? data?.[0] ?? null

  useEffect(() => {
    if (target?.id) {
      router.replace(`/records/${target.id}`)
    }
  }, [target?.id, router])

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="syn-ph">
        <div>
          <div className="kicker mb-2">· Instrumental</div>
          <h1>
            Instrumentos <span className="italic">de la organización.</span>
          </h1>
          <p className="sub">
            Esta vista se reemplazó por el Record sistema. Te llevamos al detalle del registro
            INSTRUMENTAL para usar Kanban y la tabla unificada.
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="syn-card">
          <div className="syn-card-body">Cargando registros INSTRUMENTAL…</div>
        </div>
      )}

      {!isLoading && isError && (
        <div className="syn-card">
          <div className="syn-card-body" style={{ color: 'var(--danger)' }}>
            No se pudo cargar la lista de registros.
          </div>
        </div>
      )}

      {!isLoading && !isError && !target && (
        <div className="syn-card">
          <div className="syn-card-body">
            <div className="mb-3 flex items-center gap-2 text-[14px]" style={{ color: 'var(--ink-1)' }}>
              <Wrench className="h-4 w-4" />
              No encontramos ningún Record de tipo INSTRUMENTAL.
            </div>
            <Link href="/records/new" className="syn-btn syn-btn-primary">
              Crear registro INSTRUMENTAL <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {!isLoading && !isError && data && data.length > 1 && !target?.isSystem && (
        <div className="syn-card">
          <div className="syn-card-head">
            <h3>Elegí qué Record INSTRUMENTAL ver</h3>
          </div>
          <div className="syn-card-body">
            <ul className="flex flex-col gap-2">
              {data.map((r) => (
                <li key={r.id}>
                  <Link href={`/records/${r.id}`} className="syn-btn syn-btn-subtle">
                    {r.name} <ArrowRight className="h-3 w-3" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
