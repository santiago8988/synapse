'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Search, ChevronLeft, ChevronRight, Shield } from 'lucide-react'

interface AuditLog {
  id: string
  userId: string
  userName?: string
  action: string
  entityType: string
  entityId: string
  createdAt: string
  metadata?: Record<string, unknown>
}

interface AuditResponse {
  data: AuditLog[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

const actionLabels: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'destructive' | 'info' }> = {
  CREATE: { label: 'Creado', variant: 'success' },
  UPDATE: { label: 'Actualizado', variant: 'info' },
  DELETE: { label: 'Eliminado', variant: 'destructive' },
  STATUS_CHANGE: { label: 'Cambio de estado', variant: 'warning' },
  COMPLETE: { label: 'Completado', variant: 'success' },
  APPROVE: { label: 'Aprobado', variant: 'info' },
}

const entityTypeLabels: Record<string, string> = {
  RECORD: 'Registro',
  ENTRY: 'Entrada',
  DOCUMENT: 'Documento',
  INSTRUMENT: 'Instrumento',
  NON_CONFORMITY: 'No conformidad',
  ORGANIZATION: 'Organización',
  USER: 'Usuario',
  AREA: 'Área',
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function AuditPage() {
  const [page, setPage] = useState(1)
  const [entityType, setEntityType] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [userId, setUserId] = useState('')

  const filters: Record<string, string | number | undefined> = {
    page,
    pageSize: 20,
    ...(entityType ? { entityType } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    ...(userId ? { userId } : {}),
  }

  const { data, isLoading, isError } = useQuery<AuditResponse>({
    queryKey: ['audit-logs', page, entityType, dateFrom, dateTo, userId],
    queryFn: () => api.audit.list(filters) as Promise<AuditResponse>,
  })

  const handleFilter = () => {
    setPage(1)
  }

  const handleClearFilters = () => {
    setEntityType('')
    setDateFrom('')
    setDateTo('')
    setUserId('')
    setPage(1)
  }

  const pagination = data?.pagination
  const logs = data?.data ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Registro de auditoría</h1>
        <p className="mt-1 text-muted-foreground">
          Historial de acciones realizadas en la organización
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Tipo de entidad</label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Todos</option>
                <option value="RECORD">Registro</option>
                <option value="ENTRY">Entrada</option>
                <option value="DOCUMENT">Documento</option>
                <option value="INSTRUMENT">Instrumento</option>
                <option value="NON_CONFORMITY">No conformidad</option>
                <option value="ORGANIZATION">Organización</option>
                <option value="USER">Usuario</option>
                <option value="AREA">Área</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Fecha desde</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Fecha hasta</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">ID de usuario</label>
              <input
                type="text"
                placeholder="ID del usuario..."
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>

            <div className="flex items-end gap-2">
              <Button size="sm" onClick={handleFilter} className="h-9">
                <Search className="mr-1.5 h-3.5 w-3.5" />
                Filtrar
              </Button>
              <Button size="sm" variant="outline" onClick={handleClearFilters} className="h-9">
                Limpiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Fecha</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Usuario</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Acción</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tipo</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID Entidad</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="px-4 py-3"><div className="h-4 w-32 animate-pulse rounded bg-muted" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-muted" /></td>
                      <td className="px-4 py-3"><div className="h-5 w-20 animate-pulse rounded-full bg-muted" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-muted" /></td>
                      <td className="px-4 py-3"><div className="h-4 w-16 animate-pulse rounded bg-muted" /></td>
                    </tr>
                  ))
                ) : isError ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      Error al cargar los registros de auditoría
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      <Shield className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                      No se encontraron registros de auditoría
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => {
                    const actionConfig = actionLabels[log.action] ?? { label: log.action, variant: 'secondary' as const }
                    const entityLabel = entityTypeLabels[log.entityType] ?? log.entityType
                    return (
                      <tr key={log.id} className="border-b transition-colors hover:bg-muted/50">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDate(log.createdAt)}
                        </td>
                        <td className="px-4 py-3 font-medium">
                          {log.userName ?? log.userId.slice(0, 8) + '...'}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={actionConfig.variant}>{actionConfig.label}</Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{entityLabel}</td>
                        <td className="px-4 py-3">
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {log.entityId.slice(0, 8)}...
                          </code>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 0 && (
            <div className="flex items-center justify-between border-t px-4 py-3">
              <p className="text-sm text-muted-foreground">
                Mostrando {(pagination.page - 1) * pagination.pageSize + 1}-
                {Math.min(pagination.page * pagination.pageSize, pagination.total)} de{' '}
                {pagination.total} registros
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pagination.page <= 1}
                >
                  <ChevronLeft className="mr-1 h-3.5 w-3.5" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {pagination.page} de {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={pagination.page >= pagination.totalPages}
                >
                  Siguiente
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
