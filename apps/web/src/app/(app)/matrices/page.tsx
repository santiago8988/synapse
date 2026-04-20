'use client'

import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Microscope, Plus, Search, Trash2, Pencil, ChevronRight, ChevronDown, Loader2, X, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { toast } from 'sonner'

interface Parameter {
  name: string
  method?: string
  unit?: string
  minValue?: number | null
  maxValue?: number | null
  order: number
}

interface Condition {
  label: string
  fieldType: string
  unit?: string
  options?: string[]
  order: number
}

interface Matrix {
  id: string
  name: string
  code: string | null
  description: string | null
  version: number
  status: string
  parameters: Parameter[]
  conditions: Condition[]
  _count?: { samples: number }
}

const statusLabels: Record<string, { label: string; variant: 'secondary' | 'warning' | 'success' }> = {
  DRAFT: { label: 'Borrador', variant: 'secondary' },
  IN_REVIEW: { label: 'En revision', variant: 'warning' },
  ACTIVE: { label: 'Activa', variant: 'success' },
}

export default function MatricesPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingMatrix, setEditingMatrix] = useState<Matrix | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data: matrices = [], isLoading } = useQuery({
    queryKey: ['matrices'],
    queryFn: () => api.matrices.list() as Promise<Matrix[]>,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.matrices.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matrices'] })
      toast.success('Matriz eliminada')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const submitMutation = useMutation({
    mutationFn: (id: string) => api.approval.submit({ entityType: 'MATRIX', entityId: id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matrices'] })
      toast.success('Matriz enviada a revision')
    },
    onError: (err: Error) => toast.error(err.message),
  })

  const filtered = matrices.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      (m.code && m.code.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Matrices</h1>
          <p className="mt-1 text-muted-foreground">Tipos de muestra con sus parametros de analisis</p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva matriz
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar matrices..."
          className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {(showForm || editingMatrix) && (
        <MatrixForm
          matrix={editingMatrix}
          onClose={() => { setShowForm(false); setEditingMatrix(null) }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['matrices'] })
            setShowForm(false)
            setEditingMatrix(null)
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
            <Microscope className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {search ? 'No se encontraron matrices' : 'No hay matrices creadas'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((matrix) => {
            const isExpanded = expandedId === matrix.id
            const status = statusLabels[matrix.status] || statusLabels.DRAFT
            return (
              <Card key={matrix.id}>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : matrix.id)}
                  className="flex w-full items-center gap-4 p-4 text-left transition-colors hover:bg-muted/50"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <Microscope className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="font-medium">{matrix.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {matrix.code && <>{matrix.code} &middot; </>}
                      v{matrix.version} &middot; {matrix.parameters.length} parametros
                    </p>
                  </div>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  {matrix._count && matrix._count.samples > 0 && (
                    <span className="text-xs text-muted-foreground">{matrix._count.samples} muestras</span>
                  )}
                </button>
                {isExpanded && (
                  <div className="border-t px-6 py-4 space-y-4">
                    {matrix.description && (
                      <p className="text-sm text-muted-foreground">{matrix.description}</p>
                    )}
                    {matrix.parameters.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold">Parametros de analisis</h4>
                        <div className="rounded-lg border divide-y">
                          <div className="grid grid-cols-[2rem_1fr_1fr_5rem_5rem_5rem] gap-2 px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                            <span>#</span>
                            <span>Parametro</span>
                            <span>Metodo</span>
                            <span>Unidad</span>
                            <span>Min</span>
                            <span>Max</span>
                          </div>
                          {matrix.parameters.map((param, i) => (
                            <div key={i} className="grid grid-cols-[2rem_1fr_1fr_5rem_5rem_5rem] gap-2 px-3 py-2 text-sm">
                              <span className="text-xs text-muted-foreground">{param.order}</span>
                              <span className="font-medium">{param.name}</span>
                              <span className="text-muted-foreground">{param.method || '-'}</span>
                              <span className="text-muted-foreground">{param.unit || '-'}</span>
                              <span className="text-muted-foreground">{param.minValue != null ? param.minValue : '-'}</span>
                              <span className="text-muted-foreground">{param.maxValue != null ? param.maxValue : '-'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {matrix.conditions?.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-semibold">Condiciones de muestreo</h4>
                        <div className="rounded-lg border divide-y">
                          {matrix.conditions.map((cond, i) => (
                            <div key={i} className="flex items-center gap-4 px-3 py-2 text-sm">
                              <span className="text-xs text-muted-foreground">{cond.order}</span>
                              <span className="font-medium">{cond.label}</span>
                              <span className="text-xs text-muted-foreground uppercase">{cond.fieldType}</span>
                              {cond.unit && <span className="text-muted-foreground">{cond.unit}</span>}
                              {cond.options && cond.options.length > 0 && (
                                <span className="text-xs text-muted-foreground">Opciones: {cond.options.join(', ')}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {matrix.status !== 'IN_REVIEW' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingMatrix(matrix)}
                        >
                          <Pencil className="mr-1 h-3 w-3" />
                          Editar
                        </Button>
                      )}
                      {matrix.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          onClick={() => submitMutation.mutate(matrix.id)}
                          disabled={submitMutation.isPending}
                        >
                          <Send className="mr-1 h-3 w-3" />
                          Enviar a revision
                        </Button>
                      )}
                      {matrix.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (confirm(`Eliminar la matriz "${matrix.name}"?`)) {
                              deleteMutation.mutate(matrix.id)
                            }
                          }}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --- Selector de metodo analitico ---

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

function MethodSelector({
  onSelect,
}: {
  onSelect: (method: OrgMethod) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: methods = [] } = useQuery({
    queryKey: ['methods', query],
    queryFn: () => api.methods.search(query || undefined) as Promise<OrgMethod[]>,
  })

  const globals = methods.filter((m) => m.orgId === null)
  const own = methods.filter((m) => m.orgId !== null)

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar metodo (ej: pH, APHA...)"
            className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border bg-background shadow-lg">
          {globals.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 sticky top-0">
                Globales
              </div>
              {globals.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { onSelect(m); setOpen(false); setQuery('') }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <span className="font-medium">{m.code}</span>
                    <span className="ml-2 text-muted-foreground">{m.parameter}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{m.unit || ''}</span>
                </button>
              ))}
            </>
          )}
          {own.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 sticky top-0">
                Tu organizacion
              </div>
              {own.map((m) => (
                <button
                  key={m.id}
                  onClick={() => { onSelect(m); setOpen(false); setQuery('') }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <span className="font-medium">{m.code}</span>
                    <span className="ml-2 text-muted-foreground">{m.parameter}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{m.unit || ''}</span>
                </button>
              ))}
            </>
          )}
          {methods.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No se encontraron metodos
            </div>
          )}
          <div className="border-t">
            <button
              onClick={() => { setShowCreate(true); setOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-muted/50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Crear nuevo metodo
            </button>
          </div>
        </div>
      )}

      {showCreate && (
        <CreateMethodModal
          onClose={() => setShowCreate(false)}
          onCreated={(method) => {
            onSelect(method)
            setShowCreate(false)
          }}
          initialQuery={query}
        />
      )}
    </div>
  )
}

// --- Modal para crear metodo ---

function CreateMethodModal({
  onClose,
  onCreated,
  initialQuery,
}: {
  onClose: () => void
  onCreated: (method: OrgMethod) => void
  initialQuery: string
}) {
  const queryClient = useQueryClient()
  const [code, setCode] = useState(initialQuery)
  const [methodName, setMethodName] = useState('')
  const [parameter, setParameter] = useState('')
  const [unit, setUnit] = useState('')
  const [defaultMin, setDefaultMin] = useState('')
  const [defaultMax, setDefaultMax] = useState('')
  const [sourceRef, setSourceRef] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreate = async () => {
    if (!code.trim() || !methodName.trim() || !parameter.trim()) return
    setSaving(true)
    try {
      const created = await api.methods.create({
        code: code.trim(),
        name: methodName.trim(),
        parameter: parameter.trim(),
        unit: unit.trim() || undefined,
        defaultMin: defaultMin ? parseFloat(defaultMin) : undefined,
        defaultMax: defaultMax ? parseFloat(defaultMax) : undefined,
        sourceRef: sourceRef.trim() || undefined,
      }) as OrgMethod
      queryClient.invalidateQueries({ queryKey: ['methods'] })
      toast.success('Metodo creado')
      onCreated(created)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h3 className="text-base font-semibold">Nuevo metodo analitico</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="space-y-4 px-6 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-xs font-medium">Codigo *</label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Ej: APHA 4500-H"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Parametro *</label>
              <input
                value={parameter}
                onChange={(e) => setParameter(e.target.value)}
                placeholder="Ej: pH"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Nombre del metodo *</label>
            <input
              value={methodName}
              onChange={(e) => setMethodName(e.target.value)}
              placeholder="Ej: Potencial de Hidrogeno - Electrometrico"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Unidad</label>
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Ej: mg/L"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Min por defecto</label>
              <input
                type="number"
                value={defaultMin}
                onChange={(e) => setDefaultMin(e.target.value)}
                placeholder="—"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Max por defecto</label>
              <input
                type="number"
                value={defaultMax}
                onChange={(e) => setDefaultMax(e.target.value)}
                placeholder="—"
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">Referencia</label>
            <input
              value={sourceRef}
              onChange={(e) => setSourceRef(e.target.value)}
              placeholder="Ej: APHA Standard Methods 24th Ed."
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
        <div className="flex gap-2 border-t px-6 py-4">
          <Button onClick={handleCreate} disabled={saving || !code.trim() || !methodName.trim() || !parameter.trim()}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Crear metodo
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </div>
    </div>
  )
}

// --- Formulario de matriz ---

function MatrixForm({ matrix, onClose, onSuccess }: { matrix?: Matrix | null; onClose: () => void; onSuccess: () => void }) {
  const isEditing = !!matrix
  const [name, setName] = useState(matrix?.name || '')
  const [code, setCode] = useState(matrix?.code || '')
  const [description, setDescription] = useState(matrix?.description || '')
  const [parameters, setParameters] = useState<Parameter[]>(matrix?.parameters || [])
  const [conditions, setConditions] = useState<Condition[]>(matrix?.conditions || [])
  const [saving, setSaving] = useState(false)

  const addFromMethod = (method: OrgMethod) => {
    setParameters((prev) => [
      ...prev,
      {
        name: method.parameter,
        method: method.code,
        unit: method.unit || '',
        minValue: method.defaultMin,
        maxValue: method.defaultMax,
        order: prev.length + 1,
      },
    ])
  }

  const handleSave = async () => {
    if (!name.trim()) return
    if (parameters.length === 0) {
      toast.error('Agrega al menos un parametro')
      return
    }
    const emptyNames = parameters.filter((p) => !p.name.trim())
    if (emptyNames.length > 0) {
      toast.error('Todos los parametros deben tener nombre')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        parameters: parameters.map((p, i) => ({
          name: p.name.trim(),
          method: p.method?.trim() || undefined,
          unit: p.unit?.trim() || undefined,
          minValue: p.minValue ?? undefined,
          maxValue: p.maxValue ?? undefined,
          order: i + 1,
        })),
        conditions: conditions.filter((c) => c.label.trim()).map((c, i) => ({
          label: c.label.trim(),
          fieldType: c.fieldType,
          unit: c.unit?.trim() || undefined,
          options: c.options?.filter((o) => o.trim()) || undefined,
          order: i + 1,
        })),
      }
      if (isEditing) {
        await api.matrices.update(matrix!.id, payload)
        toast.success('Matriz actualizada')
      } else {
        await api.matrices.create(payload)
        toast.success('Matriz creada')
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
          <CardTitle>{isEditing ? 'Editar matriz' : 'Nueva matriz'}</CardTitle>
          <CardDescription>{isEditing ? 'Modifica parametros y condiciones' : 'Defini el tipo de muestra y sus parametros de analisis'}</CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Datos basicos */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1">
            <label className="text-sm font-medium">Nombre *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Agua potable"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Codigo</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: MAT-AP"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Descripcion</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Agua para consumo humano"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Agregar parametro desde catalogo */}
        <div>
          <label className="text-sm font-semibold">Agregar parametro desde catalogo de metodos</label>
          <p className="mb-2 text-xs text-muted-foreground">
            Busca un metodo y se agregara como parametro con sus valores por defecto
          </p>
          <MethodSelector onSelect={addFromMethod} />
        </div>

        {/* Parametros agregados */}
        {parameters.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold">Parametros ({parameters.length})</label>
            </div>
            <div className="space-y-2">
              {parameters.map((param, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
                    <input
                      value={param.name}
                      onChange={(e) => {
                        const updated = [...parameters]
                        updated[i] = { ...updated[i], name: e.target.value }
                        setParameters(updated)
                      }}
                      placeholder="Parametro"
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="text-xs text-muted-foreground font-mono">{param.method || ''}</span>
                    {parameters.length > 0 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => setParameters(parameters.filter((_, j) => j !== i))}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-8">
                    <input
                      value={param.unit || ''}
                      onChange={(e) => {
                        const updated = [...parameters]
                        updated[i] = { ...updated[i], unit: e.target.value }
                        setParameters(updated)
                      }}
                      placeholder="Unidad"
                      className="w-28 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="number"
                      value={param.minValue ?? ''}
                      onChange={(e) => {
                        const updated = [...parameters]
                        updated[i] = { ...updated[i], minValue: e.target.value ? parseFloat(e.target.value) : null }
                        setParameters(updated)
                      }}
                      placeholder="Min"
                      className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <input
                      type="number"
                      value={param.maxValue ?? ''}
                      onChange={(e) => {
                        const updated = [...parameters]
                        updated[i] = { ...updated[i], maxValue: e.target.value ? parseFloat(e.target.value) : null }
                        setParameters(updated)
                      }}
                      placeholder="Max"
                      className="w-20 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <span className="text-xs text-muted-foreground">Limites</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Condiciones de muestreo */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div>
              <label className="text-sm font-semibold">Condiciones de muestreo</label>
              <p className="text-xs text-muted-foreground">Campos que se completan al tomar la muestra (opcional)</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setConditions([
                  ...conditions,
                  { label: '', fieldType: 'TEXT', unit: '', options: [], order: conditions.length + 1 },
                ])
              }
            >
              <Plus className="mr-1 h-3 w-3" />
              Agregar
            </Button>
          </div>
          {conditions.length > 0 && (
            <div className="space-y-2">
              {conditions.map((cond, i) => (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center text-xs text-muted-foreground">{i + 1}</span>
                    <input
                      value={cond.label}
                      onChange={(e) => {
                        const updated = [...conditions]
                        updated[i] = { ...updated[i], label: e.target.value }
                        setConditions(updated)
                      }}
                      placeholder="Label (ej: Punto de muestreo)"
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <select
                      value={cond.fieldType}
                      onChange={(e) => {
                        const updated = [...conditions]
                        updated[i] = { ...updated[i], fieldType: e.target.value, options: e.target.value === 'DROPDOWN' ? [''] : [] }
                        setConditions(updated)
                      }}
                      className="w-32 rounded-md border border-input bg-background px-2 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="TEXT">Texto</option>
                      <option value="NUMBER">Numero</option>
                      <option value="DATE">Fecha</option>
                      <option value="DROPDOWN">Opciones</option>
                    </select>
                    {cond.fieldType === 'NUMBER' && (
                      <input
                        value={cond.unit || ''}
                        onChange={(e) => {
                          const updated = [...conditions]
                          updated[i] = { ...updated[i], unit: e.target.value }
                          setConditions(updated)
                        }}
                        placeholder="Unidad"
                        className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  {cond.fieldType === 'DROPDOWN' && (
                    <div className="ml-8 space-y-1">
                      {(cond.options || ['']).map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input
                            value={opt}
                            onChange={(e) => {
                              const updated = [...conditions]
                              const opts = [...(updated[i].options || [])]
                              opts[oi] = e.target.value
                              updated[i] = { ...updated[i], options: opts }
                              setConditions(updated)
                            }}
                            placeholder={`Opcion ${oi + 1}`}
                            className="flex-1 h-7 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          {(cond.options || []).length > 1 && (
                            <button
                              onClick={() => {
                                const updated = [...conditions]
                                updated[i] = { ...updated[i], options: (updated[i].options || []).filter((_, j) => j !== oi) }
                                setConditions(updated)
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() => {
                          const updated = [...conditions]
                          updated[i] = { ...updated[i], options: [...(updated[i].options || []), ''] }
                          setConditions(updated)
                        }}
                        className="text-xs text-primary hover:underline"
                      >
                        + Agregar opcion
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving || !name.trim() || parameters.length === 0}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? 'Guardar cambios' : 'Crear matriz'}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </div>
      </CardContent>
    </Card>
  )
}
