'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ClipboardList,
  Plus,
  Search,
  ChevronRight,
  Calendar,
  Layers,
  Hash,
  Archive,
  ArchiveRestore,
  Package,
  TestTube2,
  Warehouse,
  ScanLine,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface RecordItem {
  id: string
  name: string
  type: 'PERIODIC' | 'NOT_PERIODIC' | 'NOT_PERIODIC_WITH_REVISION' | 'INSTRUMENTAL'
  periodicity: number | null
  isActive: boolean
  area: { id: string; name: string } | null
  document: { id: string; title: string; code: string | null } | null
  fields: Array<{ id: string; label: string; fieldType: string }>
  _count: { entries: number }
  updatedAt: string
}

const typeConfig: Record<string, { label: string; variant: 'info' | 'secondary' | 'warning' | 'default'; icon: typeof Calendar }> = {
  PERIODIC: { label: 'Periódico', variant: 'info', icon: Calendar },
  NOT_PERIODIC: { label: 'No periódico', variant: 'secondary', icon: ClipboardList },
  NOT_PERIODIC_WITH_REVISION: { label: 'Con revisión', variant: 'warning', icon: Layers },
  INSTRUMENTAL: { label: 'Instrumental', variant: 'default', icon: Hash },
  BATCH: { label: 'Lote/Producción', variant: 'info', icon: Package },
  SAMPLE: { label: 'Muestra', variant: 'info', icon: TestTube2 },
  STOCK: { label: 'Stock', variant: 'warning', icon: Warehouse },
}

export default function RecordsPage() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const queryClient = useQueryClient()

  const { data: records = [], isLoading } = useQuery<RecordItem[]>({
    queryKey: ['records', tab],
    queryFn: () => api.records.list(tab === 'archived') as Promise<RecordItem[]>,
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.records.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['records'] })
      toast.success('Registro restaurado')
    },
    onError: () => toast.error('Error al restaurar'),
  })

  const filtered = records.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Registros</h1>
          <p className="mt-1 text-muted-foreground">
            Templates de registros de calidad con campos configurables
          </p>
        </div>
        <Link href="/records/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo registro
          </Button>
        </Link>
      </div>

      {/* Tabs Activos / Archivados */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        <button
          onClick={() => setTab('active')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'active'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ClipboardList className="h-4 w-4" />
          Activos
        </button>
        <button
          onClick={() => setTab('archived')}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'archived'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Archive className="h-4 w-4" />
          Archivados
        </button>
      </div>

      {/* Buscador */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar registros..."
          className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            {tab === 'archived' ? (
              <>
                <Archive className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 font-medium">No hay registros archivados</p>
              </>
            ) : (
              <>
                <ClipboardList className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 font-medium">No hay registros</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Creá tu primer registro de calidad
                </p>
                <Link href="/records/new" className="mt-4">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Crear registro
                  </Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((record) => {
            const type = typeConfig[record.type]
            const TypeIcon = type.icon

            if (tab === 'archived') {
              return (
                <Card key={record.id} className="h-full opacity-75">
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                        <TypeIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Badge variant={type.variant}>{type.label}</Badge>
                    </div>
                    <div className="mt-4 flex-1">
                      <h3 className="font-semibold leading-snug">{record.name}</h3>
                      {record.area && (
                        <p className="mt-1 text-xs text-muted-foreground">{record.area.name}</p>
                      )}
                    </div>
                    <div className="mt-4 border-t pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => restoreMutation.mutate(record.id)}
                        disabled={restoreMutation.isPending}
                      >
                        <ArchiveRestore className="mr-2 h-4 w-4" />
                        Restaurar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            }

            return (
              <Link key={record.id} href={`/records/${record.id}`}>
                <Card className="group h-full transition-all hover:border-primary/30 hover:shadow-md">
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <TypeIcon className="h-5 w-5 text-primary" />
                      </div>
                      <Badge variant={type.variant}>{type.label}</Badge>
                    </div>

                    <div className="mt-4 flex-1">
                      <h3 className="font-semibold leading-snug group-hover:text-primary transition-colors">
                        {record.name}
                      </h3>
                      {record.area && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {record.area.name}
                        </p>
                      )}
                      {record.document && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Doc: {record.document.code || record.document.title}
                        </p>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t pt-3">
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {record.fields.length} campos
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers className="h-3 w-3" />
                          {record._count.entries} entradas
                        </span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
