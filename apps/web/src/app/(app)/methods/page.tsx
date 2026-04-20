'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { FlaskConical, Plus, Search, Trash2, Pencil, Loader2, X, Globe, Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface OrgMethod {
  id: string
  orgId: string | null
  code: string
  name: string
  parameter: string
  unit: string | null
  defaultMin: number | null
  defaultMax: number | null
  isGlobal: boolean
  sourceRef: string | null
}

export default function MethodsPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<OrgMethod | null>(null)
  const [filter, setFilter] = useState<'all' | 'global' | 'own'>('all')

  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['methods', search],
    queryFn: () => api.methods.search(search || undefined) as Promise<OrgMethod[]>,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.methods.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['methods'] })
      toast.success('Metodo eliminado')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = methods.filter((m) => {
    if (filter === 'global') return m.orgId === null
    if (filter === 'own') return m.orgId !== null
    return true
  })

  const globals = filtered.filter((m) => m.orgId === null)
  const own = filtered.filter((m) => m.orgId !== null)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Metodos analiticos</h1>
          <p className="mt-1 text-muted-foreground">Catalogo de metodos de tu organizacion y globales</p>
        </div>
        <Button onClick={() => { setEditing(null); setShowForm(true) }}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo metodo
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por codigo, nombre o parametro..."
            className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as 'all' | 'global' | 'own')}
          className="rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="all">Todos</option>
          <option value="global">Globales</option>
          <option value="own">Propios</option>
        </select>
      </div>

      {(showForm || editing) && (
        <MethodForm
          method={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['methods'] })
            setShowForm(false)
            setEditing(null)
          }}
        />
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FlaskConical className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No se encontraron metodos' : 'No hay metodos en el catalogo'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {own.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground">Tu organizacion ({own.length})</h2>
              </div>
              <div className="rounded-lg border bg-card">
                <div className="grid grid-cols-[1fr_1fr_6rem_5rem_5rem_8rem] gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground bg-muted/30 border-b">
                  <span>Codigo / Nombre</span>
                  <span>Parametro</span>
                  <span>Unidad</span>
                  <span>Min</span>
                  <span>Max</span>
                  <span className="text-right">Acciones</span>
                </div>
                <div className="divide-y">
                  {own.map((m) => (
                    <div key={m.id} className="grid grid-cols-[1fr_1fr_6rem_5rem_5rem_8rem] gap-2 px-4 py-2.5 items-center text-sm">
                      <div>
                        <p className="font-medium">{m.code}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.name}</p>
                      </div>
                      <span>{m.parameter}</span>
                      <span className="text-muted-foreground">{m.unit || '—'}</span>
                      <span className="font-mono text-muted-foreground">{m.defaultMin != null ? m.defaultMin : '—'}</span>
                      <span className="font-mono text-muted-foreground">{m.defaultMax != null ? m.defaultMax : '—'}</span>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={() => { setEditing(m); setShowForm(false) }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => {
                            if (confirm(`Eliminar el metodo "${m.code}"?`)) {
                              deleteMutation.mutate(m.id)
                            }
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {globals.length > 0 && (
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold text-muted-foreground">Globales ({globals.length})</h2>
              </div>
              <div className="rounded-lg border bg-card">
                <div className="grid grid-cols-[1fr_1fr_6rem_5rem_5rem_8rem] gap-2 px-4 py-2.5 text-xs font-medium text-muted-foreground bg-muted/30 border-b">
                  <span>Codigo / Nombre</span>
                  <span>Parametro</span>
                  <span>Unidad</span>
                  <span>Min</span>
                  <span>Max</span>
                  <span className="text-right">Referencia</span>
                </div>
                <div className="divide-y">
                  {globals.map((m) => (
                    <div key={m.id} className="grid grid-cols-[1fr_1fr_6rem_5rem_5rem_8rem] gap-2 px-4 py-2.5 items-center text-sm">
                      <div>
                        <p className="font-medium">{m.code}</p>
                        <p className="text-xs text-muted-foreground truncate">{m.name}</p>
                      </div>
                      <span>{m.parameter}</span>
                      <span className="text-muted-foreground">{m.unit || '—'}</span>
                      <span className="font-mono text-muted-foreground">{m.defaultMin != null ? m.defaultMin : '—'}</span>
                      <span className="font-mono text-muted-foreground">{m.defaultMax != null ? m.defaultMax : '—'}</span>
                      <div className="text-right">
                        {m.sourceRef && (
                          <Badge variant="secondary" className="text-[10px] font-normal">{m.sourceRef}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// --- Formulario de metodo ---

function MethodForm({
  method,
  onClose,
  onSuccess,
}: {
  method: OrgMethod | null
  onClose: () => void
  onSuccess: () => void
}) {
  const isEditing = !!method
  const [code, setCode] = useState(method?.code || '')
  const [methodName, setMethodName] = useState(method?.name || '')
  const [parameter, setParameter] = useState(method?.parameter || '')
  const [unit, setUnit] = useState(method?.unit || '')
  const [defaultMin, setDefaultMin] = useState(method?.defaultMin != null ? String(method.defaultMin) : '')
  const [defaultMax, setDefaultMax] = useState(method?.defaultMax != null ? String(method.defaultMax) : '')
  const [sourceRef, setSourceRef] = useState(method?.sourceRef || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!code.trim() || !methodName.trim() || !parameter.trim()) return
    setSaving(true)
    try {
      const data = {
        code: code.trim(),
        name: methodName.trim(),
        parameter: parameter.trim(),
        unit: unit.trim() || undefined,
        defaultMin: defaultMin ? parseFloat(defaultMin) : undefined,
        defaultMax: defaultMax ? parseFloat(defaultMax) : undefined,
        sourceRef: sourceRef.trim() || undefined,
      }
      if (isEditing) {
        await api.methods.update(method!.id, data)
        toast.success('Metodo actualizado')
      } else {
        await api.methods.create(data)
        toast.success('Metodo creado')
      }
      onSuccess()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>{isEditing ? 'Editar metodo' : 'Nuevo metodo'}</CardTitle>
          <CardDescription>
            {isEditing ? 'Modifica los datos del metodo' : 'Agrega un metodo propio a tu catalogo'}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">Codigo *</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: APHA 4500-H"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Parametro *</label>
            <input
              value={parameter}
              onChange={(e) => setParameter(e.target.value)}
              placeholder="Ej: pH"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Nombre del metodo *</label>
          <input
            value={methodName}
            onChange={(e) => setMethodName(e.target.value)}
            placeholder="Ej: Potencial de Hidrogeno - Electrometrico"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Unidad</label>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Ej: mg/L"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Min por defecto</label>
            <input
              type="number"
              value={defaultMin}
              onChange={(e) => setDefaultMin(e.target.value)}
              placeholder="—"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Max por defecto</label>
            <input
              type="number"
              value={defaultMax}
              onChange={(e) => setDefaultMax(e.target.value)}
              placeholder="—"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium">Referencia</label>
          <input
            value={sourceRef}
            onChange={(e) => setSourceRef(e.target.value)}
            placeholder="Ej: APHA Standard Methods 24th Ed."
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !code.trim() || !methodName.trim() || !parameter.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Guardar cambios' : 'Crear metodo'}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  )
}
